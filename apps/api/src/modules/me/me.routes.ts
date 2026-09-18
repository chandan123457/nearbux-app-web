import type { FastifyInstance } from 'fastify';
import { updateProfileSchema } from '@nearbux/validation';
import { initials } from '@nearbux/core';
import type { UserProfile } from '@nearbux/types';
import { parse } from '../../lib/validate.js';
import { Errors } from '../../lib/errors.js';

/** Screen [12] — My Profile */
export default async function meRoutes(app: FastifyInstance) {
  app.get('/me', { preHandler: app.requireAuth }, async (request): Promise<UserProfile> => {
    const user = await app.db.user.findFirst({
      where: { id: request.currentUser!.sub, deletedAt: null },
    });
    if (!user) throw Errors.notFound('User');
    return toProfile(user);
  });

  app.patch('/me', { preHandler: app.requireAuth }, async (request): Promise<UserProfile> => {
    const body = parse(updateProfileSchema, request.body);
    const user = await app.db.user.update({
      where: { id: request.currentUser!.sub },
      data: {
        fullName: body.fullName,
        ...(body.email !== undefined ? { email: body.email } : {}),
      },
    });
    return toProfile(user);
  });
}

function toProfile(user: {
  id: string;
  phone: string;
  email: string | null;
  fullName: string;
  avatarUrl: string | null;
}): UserProfile {
  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    // Avatar fallback server par compute hota hai taaki teeno platforms
    // par exactly same dikhe
    initials: initials(user.fullName),
  };
}
