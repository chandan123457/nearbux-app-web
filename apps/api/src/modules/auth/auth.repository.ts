import type { Db } from '@nearbux/database';

/**
 * SAARI Prisma calls yahan rehti hain — service layer mein ek bhi nahi.
 *
 * Isse do fayde: business logic ORM se independent rehta hai, aur services
 * ko ek fake repository dekar test kiya ja sakta hai bina database ke.
 */
export function createAuthRepository(db: Db) {
  return {
    findUserById(id: string) {
      return db.user.findFirst({ where: { id, deletedAt: null } });
    },

    findUserByPhone(phone: string) {
      return db.user.findFirst({ where: { phone, deletedAt: null } });
    },

    createUser(data: {
      phone: string;
      fullName: string;
      passwordHash: string;
      firebaseUid: string | null;
    }) {
      return db.user.create({ data: { ...data, phoneVerified: true } });
    },

    /** Forgot-password flow — phone verify hone ke BAAD hi call hota hai */
    updatePassword(userId: string, passwordHash: string) {
      return db.user.update({
        where: { id: userId },
        data: { passwordHash, phoneVerified: true },
      });
    },

    /**
     * Firebase UID link karta hai agar abhi tak set nahi hai.
     *
     * Purane accounts (jo Firebase se pehle bane the) ke paas UID nahi hota;
     * woh apne pehle verified flow par link ho jaate hain. Already-set UID
     * ko OVERWRITE nahi karte — woh ek account takeover ka raasta hota.
     */
    linkFirebaseUid(userId: string, firebaseUid: string) {
      return db.user.updateMany({
        where: { id: userId, firebaseUid: null },
        data: { firebaseUid },
      });
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

    /** Token reuse detect hone par, aur password reset ke baad bhi */
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
