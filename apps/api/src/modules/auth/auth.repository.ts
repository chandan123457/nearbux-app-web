import type { Db } from '@nearbux/database';

/**
 * SAARI Prisma calls yahan rehti hain — service layer mein ek bhi nahi.
 *
 * Isse do fayde: business logic ORM se independent rehta hai, aur services
 * ko ek fake repository dekar test kiya ja sakta hai bina database ke.
 */
export function createAuthRepository(db: Db) {
  return {
    findActiveChallenge(phone: string) {
      return db.otpChallenge.findFirst({
        where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      });
    },

    createChallenge(data: { phone: string; codeHash: string; expiresAt: Date }) {
      return db.otpChallenge.create({ data });
    },

    /** Naya challenge bhejne par purane invalidate — warna kai codes ek saath valid rehte */
    consumeAllChallenges(phone: string) {
      return db.otpChallenge.updateMany({
        where: { phone, consumedAt: null },
        data: { consumedAt: new Date() },
      });
    },

    incrementChallengeAttempts(id: string) {
      return db.otpChallenge.update({
        where: { id },
        data: { attempts: { increment: 1 } },
      });
    },

    consumeChallenge(id: string) {
      return db.otpChallenge.update({ where: { id }, data: { consumedAt: new Date() } });
    },

    countRecentChallenges(phone: string, since: Date) {
      return db.otpChallenge.count({ where: { phone, createdAt: { gte: since } } });
    },

    findUserById(id: string) {
      return db.user.findFirst({ where: { id, deletedAt: null } });
    },

    findUserByPhone(phone: string) {
      return db.user.findFirst({ where: { phone, deletedAt: null } });
    },

    createUser(data: { phone: string; fullName: string }) {
      return db.user.create({ data: { ...data, phoneVerified: true } });
    },

    /** Anonymous account — phone null. Har device ko pehli launch par milta hai. */
    createGuest() {
      return db.user.create({ data: { fullName: 'Guest' } });
    },

    /**
     * Guest ko verified account mein upgrade karta hai — SAME row.
     *
     * Naya user banane se guest ka cart, orders, addresses aur favourites
     * sab orphan ho jaate. Ek upgrade sab kuch bacha leta hai.
     */
    upgradeGuest(userId: string, data: { phone: string; fullName?: string }) {
      return db.user.update({
        where: { id: userId },
        data: {
          phone: data.phone,
          phoneVerified: true,
          ...(data.fullName ? { fullName: data.fullName } : {}),
        },
      });
    },

    markPhoneVerified(userId: string) {
      return db.user.update({ where: { id: userId }, data: { phoneVerified: true } });
    },

    createSession(data: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
      deviceLabel?: string | null;
      ipAddress?: string | null;
    }) {
      return db.session.create({ data });
    },

    findSessionByHash(tokenHash: string) {
      return db.session.findUnique({ where: { tokenHash } });
    },

    /**
     * Rotation ek transaction mein: purana session revoke + naya banao.
     * Alag-alag karne par ek crash user ko dono tokens se locked out kar
     * sakta hai.
     */
    rotateSession(
      oldSessionId: string,
      next: { userId: string; tokenHash: string; expiresAt: Date; deviceLabel?: string | null },
    ) {
      return db.$transaction(async (tx) => {
        const created = await tx.session.create({ data: next });
        await tx.session.update({
          where: { id: oldSessionId },
          data: { revokedAt: new Date(), replacedById: created.id },
        });
        return created;
      });
    },

    revokeSession(id: string) {
      return db.session.update({ where: { id }, data: { revokedAt: new Date() } });
    },

    /** Token reuse detect hone par: us user ke saare sessions maar do */
    revokeAllUserSessions(userId: string) {
      return db.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    },

    upsertDeviceToken(data: { userId: string; token: string; platform: string }) {
      return db.deviceToken.upsert({
        where: { token: data.token },
        create: data,
        update: { userId: data.userId, lastSeenAt: new Date() },
      });
    },
  };
}

export type AuthRepository = ReturnType<typeof createAuthRepository>;
