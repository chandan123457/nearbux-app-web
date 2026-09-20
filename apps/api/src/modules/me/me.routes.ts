import type { FastifyInstance } from 'fastify';
import { updateProfileSchema } from '@nearbux/validation';
import { initials } from '@nearbux/core';
import type { SavedPaymentMethod, UserProfile } from '@nearbux/types';
import { parse } from '../../lib/validate.js';
import { Errors } from '../../lib/errors.js';

/** Screen [12] — My Profile */
export default async function meRoutes(app: FastifyInstance) {
  /**
   * Profile + onboarding state.
   *
   * `hasAddress` yahin se aata hai, kisi alag call se nahi. App ka onboarding
   * gate har launch par yahi ek request dekh kar decide karta hai ki user ko
   * home bhejna hai ya address screen — do calls hone par woh decision do
   * alag-alag waqt ke jawaabon par banega aur beech mein screen flicker
   * karegi.
   */
  async function loadProfile(userId: string): Promise<UserProfile> {
    const [user, addressCount] = await Promise.all([
      app.db.user.findFirst({ where: { id: userId, deletedAt: null } }),
      app.db.address.count({ where: { userId, deletedAt: null } }),
    ]);
    if (!user) throw Errors.notFound('User');
    return toProfile(user, addressCount > 0);
  }

  app.get('/me', { preHandler: app.requireAuth }, async (request): Promise<UserProfile> => {
    return loadProfile(request.currentUser!.sub);
  });

  /**
   * Saved payment methods (screen [22] ka "PAYMENT METHOD" card).
   *
   * Sirf display-safe fields nikalte hain. `providerToken` kabhi client tak
   * nahi jaata — woh gateway ke saath charge karne ke liye hai, dikhane ke
   * liye nahi.
   */
  app.get(
    '/payment-methods',
    { preHandler: app.requireAuth },
    async (request): Promise<SavedPaymentMethod[]> => {
      const rows = await app.db.savedPaymentMethod.findMany({
        where: { userId: request.currentUser!.sub, deletedAt: null },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        select: { id: true, type: true, displayLabel: true, isDefault: true },
      });
      return rows;
    },
  );

  app.patch('/me', { preHandler: app.requireAuth }, async (request): Promise<UserProfile> => {
    const body = parse(updateProfileSchema, request.body);
    await app.db.user.update({
      where: { id: request.currentUser!.sub },
      data: {
        fullName: body.fullName,
        ...(body.email !== undefined ? { email: body.email } : {}),
      },
    });
    return loadProfile(request.currentUser!.sub);
  });
}

function toProfile(
  user: {
    id: string;
    phone: string;
    email: string | null;
    fullName: string;
    avatarUrl: string | null;
  },
  hasAddress: boolean,
): UserProfile {
  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    // Avatar fallback server par compute hota hai taaki teeno platforms
    // par exactly same dikhe
    initials: initials(user.fullName),
    hasAddress,
  };
}
