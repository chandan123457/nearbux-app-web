import { computeBill, formatDiscount } from '@nearbux/core';
import type { Cart, CartItem } from '@nearbux/types';
import { Errors } from '../../lib/errors.js';
import type { CartRepository } from './cart.repository.js';

type CartWithRelations = NonNullable<Awaited<ReturnType<CartRepository['findCart']>>>;

export function createCartService(repo: CartRepository) {
  /**
   * Cart ko bill ke saath DTO mein badalta hai.
   *
   * Prices LIVE product rows se aate hain, cart se snapshot nahi hote.
   * Agar store kal price badalta hai, user ko naya price dikhna chahiye —
   * snapshot dikhane ka matlab hota checkout par surprise, aur woh sabse
   * bura waqt hai surprise ke liye.
   */
  function toCartDto(cart: CartWithRelations): Cart {
    const items: CartItem[] = cart.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      name: item.product.name,
      unitLabel: item.product.unitLabel,
      imageUrl: item.product.images[0] ?? null,
      unitPriceMinor: item.product.priceMinor,
      quantity: item.quantity,
      lineTotalMinor: item.product.priceMinor * item.quantity,
      isAvailable: item.product.isAvailable && item.product.deletedAt === null,
    }));

    const promo = cart.promotion;
    const bill = computeBill({
      lines: items.map((i) => ({ unitPriceMinor: i.unitPriceMinor, quantity: i.quantity })),
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

    return {
      id: cart.id,
      storeId: cart.storeId,
      storeName: cart.store.name,
      etaMinMinutes: cart.store.etaMinMinutes,
      etaMaxMinutes: cart.store.etaMaxMinutes,
      items,
      itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
      promotion:
        promo && bill.discountMinor > 0
          ? {
              id: promo.id,
              code: promo.code,
              label: `${formatDiscount(bill.discountMinor)} ${promo.title}`,
              discountMinor: bill.discountMinor,
            }
          : null,
      bill,
      meetsMinimumOrder: bill.itemTotalMinor >= cart.store.minOrderMinor,
      minOrderMinor: cart.store.minOrderMinor,
    };
  }

  async function loadCart(userId: string, storeId: string): Promise<Cart | null> {
    const cart = await repo.findCart(userId, storeId);
    return cart ? toCartDto(cart) : null;
  }

  return {
    toCartDto,
    loadCart,

    async listCarts(userId: string): Promise<Cart[]> {
      const carts = await repo.findCarts(userId);
      const full = await Promise.all(carts.map((c) => repo.findCart(userId, c.storeId)));
      return full.filter((c): c is CartWithRelations => c !== null).map(toCartDto);
    },

    async addItem(params: { userId: string; productId: string; quantity: number }): Promise<Cart> {
      const product = await repo.findProduct(params.productId);
      if (!product) throw Errors.notFound('Product');
      if (!product.isAvailable) {
        throw Errors.conflict('PRODUCT_UNAVAILABLE', 'This item is currently unavailable');
      }

      const cart = await repo.ensureCart(params.userId, product.storeId);
      await repo.upsertItem(cart.id, product.id, params.quantity);

      return (await loadCart(params.userId, product.storeId))!;
    },

    async updateItem(params: {
      userId: string;
      storeId: string;
      productId: string;
      quantity: number;
    }): Promise<Cart | null> {
      const cart = await repo.findCart(params.userId, params.storeId);
      if (!cart) throw Errors.notFound('Cart');

      if (params.quantity === 0) {
        await repo.removeItem(cart.id, params.productId);
        // Aakhri item hatate hi cart delete — warna khaali carts jama hote
        // rehte hain aur "Cart" tab jhooth bolta hai
        if (cart.items.length <= 1) {
          await repo.clearCart(cart.id);
          return null;
        }
      } else {
        await repo.setItemQuantity(cart.id, params.productId, params.quantity);
      }

      return loadCart(params.userId, params.storeId);
    },

    async clear(params: { userId: string; storeId: string }): Promise<void> {
      const cart = await repo.findCart(params.userId, params.storeId);
      if (cart) await repo.clearCart(cart.id);
    },

    /** Screen [7] — promo code box */
    async applyPromotion(params: {
      userId: string;
      storeId: string;
      code: string;
    }): Promise<Cart> {
      const cart = await repo.findCart(params.userId, params.storeId);
      if (!cart) throw Errors.notFound('Cart');

      const promo = await repo.findPromotionByCode(params.code);
      const invalid = () =>
        Errors.conflict('PROMO_INVALID', 'This promo code is not valid');

      if (!promo || !promo.isActive) throw invalid();

      const now = new Date();
      if (promo.startsAt > now || promo.endsAt < now) {
        throw Errors.conflict('PROMO_EXPIRED', 'This promo code has expired');
      }
      // Store-scoped promo doosre store ke cart par nahi lag sakta
      if (promo.scope === 'STORE' && promo.storeId !== params.storeId) {
        throw invalid();
      }

      const [userUses, totalUses] = await Promise.all([
        repo.countUserRedemptions(promo.id, params.userId),
        promo.totalUsageLimit ? repo.countTotalRedemptions(promo.id) : Promise.resolve(0),
      ]);

      if (userUses >= promo.perUserLimit) {
        throw Errors.conflict('PROMO_ALREADY_USED', 'You have already used this code');
      }
      if (promo.totalUsageLimit && totalUses >= promo.totalUsageLimit) {
        throw Errors.conflict('PROMO_EXHAUSTED', 'This code is no longer available');
      }

      const itemTotal = cart.items.reduce(
        (sum, i) => sum + i.product.priceMinor * i.quantity,
        0,
      );
      if (itemTotal < promo.minOrderMinor) {
        throw Errors.conflict(
          'PROMO_BELOW_MINIMUM',
          'Your order does not meet the minimum for this code',
          { minOrderMinor: promo.minOrderMinor },
        );
      }

      await repo.applyPromotion(cart.id, promo.id);
      return (await loadCart(params.userId, params.storeId))!;
    },

    async removePromotion(params: { userId: string; storeId: string }): Promise<Cart> {
      const cart = await repo.findCart(params.userId, params.storeId);
      if (!cart) throw Errors.notFound('Cart');
      await repo.applyPromotion(cart.id, null);
      return (await loadCart(params.userId, params.storeId))!;
    },
  };
}

export type CartService = ReturnType<typeof createCartService>;
