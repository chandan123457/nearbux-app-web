import type { FastifyInstance } from 'fastify';
import { relativeTime } from '@nearbux/core';
import type { Notification, NotificationFeed } from '@nearbux/types';
import { uuidSchema } from '@nearbux/validation';
import { parse } from '../../lib/validate.js';

/** Screen [13] */
export default async function notificationRoutes(app: FastifyInstance) {
  app.get('/notifications', { preHandler: app.requireAuth }, async (request): Promise<NotificationFeed> => {
    const userId = request.currentUser!.sub;
    const rows = await app.db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const map = (n: (typeof rows)[number]): Notification => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      deepLink: n.deepLink,
      isRead: n.readAt !== null,
      createdAt: n.createdAt.toISOString(),
      relativeLabel: relativeTime(n.createdAt, now),
    });

    // Screen [13] ka TODAY / EARLIER grouping server par hota hai — teeno
    // platforms same boundary use karein
    return {
      today: rows.filter((n) => n.createdAt >= startOfToday).map(map),
      earlier: rows.filter((n) => n.createdAt < startOfToday).map(map),
      unreadCount: rows.filter((n) => n.readAt === null).length,
    };
  });

  /** "Mark all as read" */
  app.post('/notifications/read-all', { preHandler: app.requireAuth }, async (request, reply) => {
    await app.db.notification.updateMany({
      where: { userId: request.currentUser!.sub, readAt: null },
      data: { readAt: new Date() },
    });
    reply.code(204);
  });

  app.post<{ Params: { id: string } }>(
    '/notifications/:id/read',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const id = parse(uuidSchema, request.params.id);
      await app.db.notification.updateMany({
        where: { id, userId: request.currentUser!.sub, readAt: null },
        data: { readAt: new Date() },
      });
      reply.code(204);
    },
  );
}
