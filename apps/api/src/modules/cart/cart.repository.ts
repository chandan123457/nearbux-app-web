import type { Db } from '@nearbux/database';

export function createCartRepository(db: Db) {
  return {
    findCart(userId: string, storeId: string) {
      return db.cart.findUnique({
        where: { userId_storeId: { userId, storeId } },
        include: {
          store: true,
          promotion: true,
          items: {
            orderBy: { addedAt: 'asc' },
            include: { product: true },
          },
        },
      });
    },

    findCarts(userId: string) {
      return db.cart.findMany({
        where: { userId },
        include: { store: true, items: { include: { product: true } } },
        orderBy: { updatedAt: 'desc' },
      });
    },

    ensureCart(userId: string, storeId: string) {
      return db.cart.upsert({
        where: { userId_storeId: { userId, storeId } },
        create: { userId, storeId },
        update: {},
      });
    },

    /**
     * Add ya increment — ek atomic upsert mein.
     *
     * "pehle padho, phir likho" karne par do parallel taps ek doosre ko
     * overwrite kar dete hain aur quantity 2 ki jagah 1 reh jaati hai.
     * Unique constraint (cartId, productId) isse handle karne deta hai.
     */
    upsertItem(cartId: string, productId: string, quantity: number) {
      return db.cartItem.upsert({
        where: { cartId_productId: { cartId, productId } },
        create: { cartId, productId, quantity },
        update: { quantity: { increment: quantity } },
      });
    },

    setItemQuantity(cartId: string, productId: string, quantity: number) {
      return db.cartItem.update({
        where: { cartId_productId: { cartId, productId } },
        data: { quantity },
      });
    },

    removeItem(cartId: string, productId: string) {
      return db.cartItem.deleteMany({ where: { cartId, productId } });
    },

    clearCart(cartId: string) {
      return db.cart.delete({ where: { id: cartId } });
    },

    applyPromotion(cartId: string, promotionId: string | null) {
      return db.cart.update({ where: { id: cartId }, data: { promotionId } });
    },

    findPromotionByCode(code: string) {
      return db.promotion.findUnique({ where: { code } });
    },

    countUserRedemptions(promotionId: string, userId: string) {
      return db.promotionRedemption.count({ where: { promotionId, userId } });
    },

    countTotalRedemptions(promotionId: string) {
      return db.promotionRedemption.count({ where: { promotionId } });
    },

    findProduct(productId: string) {
      return db.product.findFirst({ where: { id: productId, deletedAt: null } });
    },
  };
}

export type CartRepository = ReturnType<typeof createCartRepository>;
