import type { Db, DbTransaction, OrderStatus, Prisma } from '@nearbux/database';

export function createOrderRepository(db: Db) {
  return {
    findByIdempotencyKey(key: string) {
      return db.order.findUnique({ where: { idempotencyKey: key } });
    },

    findCartForCheckout(userId: string, storeId: string) {
      return db.cart.findUnique({
        where: { userId_storeId: { userId, storeId } },
        include: {
          store: true,
          promotion: true,
          items: { include: { product: true }, orderBy: { addedAt: 'asc' } },
        },
      });
    },

    findAddress(userId: string, addressId: string) {
      return db.address.findFirst({ where: { id: addressId, userId, deletedAt: null } });
    },

    findPaymentMethod(userId: string, id: string) {
      return db.savedPaymentMethod.findFirst({ where: { id, userId, deletedAt: null } });
    },

    countUserRedemptions(promotionId: string, userId: string) {
      return db.promotionRedemption.count({ where: { promotionId, userId } });
    },

    /** Sequence se agla order number — concurrency-safe */
    async nextOrderNumber(tx: DbTransaction): Promise<number> {
      const rows = await tx.$queryRaw<Array<{ value: bigint }>>`
        SELECT nextval('order_number_seq') AS value
      `;
      return Number(rows[0]!.value);
    },

    /**
     * Stock ko CONDITIONALLY ghatata hai.
     *
     * `WHERE stockQty >= n` hi woh cheez hai jo oversell rokti hai. "padho,
     * check karo, likho" karne par do parallel checkouts aakhri item dono ko
     * bech dete hain. Yahan zero rows affected ka matlab hai stock khatam,
     * aur poori transaction rollback ho jaati hai.
     */
    async decrementStock(tx: DbTransaction, productId: string, quantity: number): Promise<boolean> {
      const affected = await tx.$executeRaw`
        UPDATE products
        SET "stockQty" = "stockQty" - ${quantity}
        WHERE id = ${productId}::uuid AND "stockQty" >= ${quantity}
      `;
      return affected === 1;
    },

    runTransaction<T>(fn: (tx: DbTransaction) => Promise<T>): Promise<T> {
      // Remote database par default 5s tight hai — order placement kai
      // writes karta hai aur har ek network round trip hai
      return db.$transaction(fn, { maxWait: 15_000, timeout: 30_000 });
    },

    findOrderById(userId: string, orderId: string) {
      return db.order.findFirst({
        where: { id: orderId, userId },
        include: {
          items: { orderBy: { id: 'asc' } },
          events: { orderBy: { occurredAt: 'asc' } },
          payment: true,
          promotion: { select: { code: true } },
          review: { select: { id: true } },
          store: { select: { slug: true, tagline: true } },
        },
      });
    },

    findOrderByNumber(userId: string, orderNumber: string) {
      return db.order.findFirst({
        where: { orderNumber, userId },
        include: {
          items: { orderBy: { id: 'asc' } },
          events: { orderBy: { occurredAt: 'asc' } },
          payment: true,
          promotion: { select: { code: true } },
          review: { select: { id: true } },
          store: { select: { slug: true, tagline: true } },
        },
      });
    },

    findOrders(params: {
      userId: string;
      statuses: OrderStatus[] | null;
      limit: number;
      cursor?: string;
    }) {
      return db.order.findMany({
        where: {
          userId: params.userId,
          ...(params.statuses ? { status: { in: params.statuses } } : {}),
        },
        include: {
          items: { select: { nameSnapshot: true, quantity: true } },
          review: { select: { id: true } },
          store: { select: { tagline: true } },
        },
        orderBy: { placedAt: 'desc' },
        take: params.limit + 1,
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      });
    },

    cancelOrder(orderId: string, reason: string) {
      const now = new Date();
      return db.$transaction([
        db.order.update({
          where: { id: orderId },
          data: {
            status: 'CANCELLED',
            cancelledAt: now,
            cancelledBy: 'CUSTOMER',
            cancelReason: reason,
          },
        }),
        db.orderStatusEvent.create({
          data: { orderId, status: 'CANCELLED', note: reason, occurredAt: now },
        }),
      ]);
    },

    createNotification(data: {
      userId: string;
      type: 'ORDER_UPDATE' | 'PROMOTION' | 'ACCOUNT' | 'SYSTEM';
      title: string;
      body: string;
      deepLink?: string;
      orderId?: string;
    }) {
      return db.notification.create({ data });
    },
  };
}

export type OrderRepository = ReturnType<typeof createOrderRepository>;
export type { Prisma };
