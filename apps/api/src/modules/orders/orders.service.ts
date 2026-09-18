import { computeBill, formatOrderNumber, statusesForFilter } from '@nearbux/core';
import type { OrderDetail, OrderFilter, OrderSummary, Paginated } from '@nearbux/types';
import { Errors } from '../../lib/errors.js';
import type { OrderRepository } from './orders.repository.js';
import { toOrderDetail, toOrderSummary } from './orders.mappers.js';

export interface PlaceOrderInput {
  userId: string;
  storeId: string;
  addressId: string;
  paymentMethodId?: string | null;
  paymentMethodType: 'UPI' | 'CARD' | 'NETBANKING' | 'WALLET' | 'COD';
  expectedTotalMinor: number;
  idempotencyKey: string;
  notes?: string;
}

export function createOrderService(repo: OrderRepository) {
  return {
    /**
     * Order place karna — poore system ka sabse important operation.
     *
     * Sab kuch EK transaction mein hai. Beech mein crash hone par ya to
     * poora order banta hai ya kuch bhi nahi — aadha order jisme stock ghat
     * gaya ho par payment record na ho, manually theek karna padta hai.
     *
     * Order of operations deliberate hai:
     *   1. Idempotency check — retry par duplicate order nahi
     *   2. Cart + address + promo validate
     *   3. Bill SERVER par dobara compute, client ke bheje total se compare
     *   4. Stock conditionally decrement (oversell rokta hai)
     *   5. Order + items (SNAPSHOTS ke saath) + events + payment + redemption
     *   6. Cart delete
     */
    async placeOrder(input: PlaceOrderInput): Promise<OrderDetail> {
      // 1. Idempotency — network retry par pehla order wapas do, naya nahi
      const existing = await repo.findByIdempotencyKey(input.idempotencyKey);
      if (existing) {
        const detail = await repo.findOrderById(input.userId, existing.id);
        if (detail) return toOrderDetail(detail);
      }

      const [cart, address] = await Promise.all([
        repo.findCartForCheckout(input.userId, input.storeId),
        repo.findAddress(input.userId, input.addressId),
      ]);

      if (!cart || cart.items.length === 0) throw Errors.notFound('Cart');
      if (!address) throw Errors.notFound('Address');
      if (!cart.store.isActive || cart.store.isTemporarilyClosed) {
        throw Errors.conflict('STORE_CLOSED', 'This store is not accepting orders right now');
      }

      // Unavailable items chupchaap order karna sabse bura outcome hai —
      // user pay kar deta hai aur store deliver nahi kar pata
      const unavailable = cart.items.filter(
        (i) => !i.product.isAvailable || i.product.deletedAt !== null,
      );
      if (unavailable.length > 0) {
        throw Errors.conflict(
          'ITEMS_UNAVAILABLE',
          'Some items are no longer available. Please review your cart.',
          { productIds: unavailable.map((i) => i.productId) },
        );
      }

      const promo = cart.promotion;
      if (promo) {
        const uses = await repo.countUserRedemptions(promo.id, input.userId);
        if (uses >= promo.perUserLimit) {
          throw Errors.conflict('PROMO_ALREADY_USED', 'You have already used this code');
        }
      }

      // 3. Bill SERVER par compute hota hai, hamesha.
      //    Client ka bheja total sirf CHECK hai, price ka source nahi —
      //    warna koi bhi ₹1 mein order kar leta.
      const lines = cart.items.map((i) => ({
        unitPriceMinor: i.product.priceMinor,
        quantity: i.quantity,
      }));
      const bill = computeBill({
        lines,
        deliveryFeeMinor: cart.store.deliveryFeeMinor,
        promotion: promo
          ? {
              type: promo.type,
              value: promo.value,
              maxDiscountMinor: promo.maxDiscountMinor,
              minOrderMinor: promo.minOrderMinor,
            }
          : null,
      });

      if (bill.itemTotalMinor < cart.store.minOrderMinor) {
        throw Errors.conflict('BELOW_MINIMUM_ORDER', 'Your order is below the store minimum', {
          minOrderMinor: cart.store.minOrderMinor,
        });
      }

      if (bill.totalMinor !== input.expectedTotalMinor) {
        // Price checkout ke beech badal gaya. Chupchaap charge karne se
        // user ko woh amount lagta hai jo usne dekha hi nahi tha.
        throw Errors.conflict('PRICE_CHANGED', 'Prices changed. Please review your order.', {
          expectedTotalMinor: input.expectedTotalMinor,
          actualTotalMinor: bill.totalMinor,
        });
      }

      const paymentMethod = input.paymentMethodId
        ? await repo.findPaymentMethod(input.userId, input.paymentMethodId)
        : null;

      const orderId = await repo.runTransaction(async (tx) => {
        // 4. Stock — conditional, warna do parallel checkouts aakhri item
        //    dono ko bech dete hain
        for (const item of cart.items) {
          const ok = await repo.decrementStock(tx, item.productId, item.quantity);
          if (!ok) {
            throw Errors.conflict(
              'OUT_OF_STOCK',
              `${item.product.name} is out of stock`,
              { productId: item.productId },
            );
          }
        }

        const sequence = await repo.nextOrderNumber(tx);
        const now = new Date();

        const order = await tx.order.create({
          data: {
            orderNumber: formatOrderNumber(sequence),
            userId: input.userId,
            storeId: cart.storeId,
            addressId: address.id,
            // 5. SNAPSHOTS — receipt kabhi nahi badalni chahiye, chahe user
            //    address edit kare ya store rename ho jaye
            deliveryAddressSnapshot: {
              label: address.label,
              line1: address.line1,
              line2: address.line2,
              landmark: address.landmark,
              city: address.city,
              state: address.state,
              pincode: address.pincode,
              formatted: formatAddress(address),
            },
            storeNameSnapshot: cart.store.name,
            storePhoneSnapshot: cart.store.phone,
            status: 'PLACED',
            itemTotalMinor: bill.itemTotalMinor,
            deliveryFeeMinor: bill.deliveryFeeMinor,
            taxMinor: bill.taxMinor,
            platformFeeMinor: bill.platformFeeMinor,
            discountMinor: bill.discountMinor,
            totalMinor: bill.totalMinor,
            promotionId: promo?.id ?? null,
            etaMinMinutes: cart.store.etaMinMinutes,
            etaMaxMinutes: cart.store.etaMaxMinutes,
            placedAt: now,
            idempotencyKey: input.idempotencyKey,
            items: {
              create: cart.items.map((i) => ({
                productId: i.productId,
                nameSnapshot: i.product.name,
                unitSnapshot: i.product.unitLabel,
                imageSnapshot: i.product.images[0] ?? null,
                unitPriceMinor: i.product.priceMinor,
                quantity: i.quantity,
                lineTotalMinor: i.product.priceMinor * i.quantity,
              })),
            },
            events: { create: [{ status: 'PLACED', occurredAt: now }] },
            payment: {
              create: {
                method: input.paymentMethodType,
                // COD delivery par collect hota hai; online payments gateway
                // confirm karne tak PENDING rehte hain
                status: input.paymentMethodType === 'COD' ? 'PENDING' : 'PAID',
                amountMinor: bill.totalMinor,
                displayLabel: paymentMethod
                  ? `${paymentMethod.type} • ${paymentMethod.displayLabel}`
                  : input.paymentMethodType,
                paidAt: input.paymentMethodType === 'COD' ? null : now,
              },
            },
            ...(promo && bill.discountMinor > 0
              ? {
                  redemption: {
                    create: {
                      promotionId: promo.id,
                      userId: input.userId,
                      discountMinor: bill.discountMinor,
                    },
                  },
                }
              : {}),
          },
        });

        // 6. Cart khatam — items cascade delete ho jaate hain
        await tx.cart.delete({ where: { id: cart.id } });

        return order.id;
      });

      // Notification transaction ke BAAHAR — yeh fail ho to order fail nahi
      // hona chahiye. User ka order lag chuka hai; notification nice-to-have hai.
      await repo
        .createNotification({
          userId: input.userId,
          type: 'ORDER_UPDATE',
          title: 'Order placed',
          body: `Your order from ${cart.store.name} has been confirmed.`,
          deepLink: `nearbux://orders/${orderId}`,
          orderId,
        })
        .catch(() => undefined);

      const detail = await repo.findOrderById(input.userId, orderId);
      return toOrderDetail(detail!);
    },

    async getOrder(userId: string, orderId: string): Promise<OrderDetail> {
      const order = await repo.findOrderById(userId, orderId);
      if (!order) throw Errors.notFound('Order');
      return toOrderDetail(order);
    },

    async getOrderByNumber(userId: string, orderNumber: string): Promise<OrderDetail> {
      const order = await repo.findOrderByNumber(userId, orderNumber);
      if (!order) throw Errors.notFound('Order');
      return toOrderDetail(order);
    },

    /** Screen [11] — filter tabs ke saath list */
    async listOrders(params: {
      userId: string;
      filter: OrderFilter;
      limit: number;
      cursor?: string;
    }): Promise<Paginated<OrderSummary>> {
      const rows = await repo.findOrders({
        userId: params.userId,
        statuses: statusesForFilter(params.filter),
        limit: params.limit,
        cursor: params.cursor,
      });

      const hasMore = rows.length > params.limit;
      const page = hasMore ? rows.slice(0, params.limit) : rows;

      return {
        items: page.map(toOrderSummary),
        nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
        hasMore,
      };
    },

    /** Screen [10] — "Cancel Order" */
    async cancelOrder(params: {
      userId: string;
      orderId: string;
      reason: string;
    }): Promise<OrderDetail> {
      const order = await repo.findOrderById(params.userId, params.orderId);
      if (!order) throw Errors.notFound('Order');

      // Cancellation window server par enforce hoti hai. Client button chhupa
      // deta hai, lekin ek purana build ya direct API call phir bhi try kar
      // sakta hai — jab tak store pack kar chuka ho.
      const detail = toOrderDetail(order);
      if (!detail.canCancel) {
        throw Errors.conflict(
          'CANCEL_WINDOW_CLOSED',
          'This order can no longer be cancelled. Please contact the store.',
        );
      }

      await repo.cancelOrder(order.id, params.reason);
      const updated = await repo.findOrderById(params.userId, order.id);
      return toOrderDetail(updated!);
    },
  };
}

function formatAddress(a: {
  label: string;
  line1: string;
  line2: string | null;
  city: string;
}): string {
  const label = a.label.charAt(0) + a.label.slice(1).toLowerCase();
  const parts = [a.line1, a.line2, a.city].filter(Boolean);
  return `${label} — ${parts.join(', ')}`;
}

export type OrderService = ReturnType<typeof createOrderService>;
