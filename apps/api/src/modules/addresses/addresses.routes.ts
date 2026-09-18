import type { FastifyInstance } from 'fastify';
import { addressSchema, updateAddressSchema, uuidSchema } from '@nearbux/validation';
import type { Address } from '@nearbux/types';
import { parse } from '../../lib/validate.js';
import { Errors } from '../../lib/errors.js';

/** Screen [12] → Saved Addresses; screen [1] ka "Deliver to" switcher */
export default async function addressRoutes(app: FastifyInstance) {
  function toDto(a: {
    id: string;
    label: 'HOME' | 'WORK' | 'OTHER';
    line1: string;
    line2: string | null;
    landmark: string | null;
    city: string;
    state: string;
    pincode: string;
    latitude: number;
    longitude: number;
    isDefault: boolean;
  }): Address {
    const label = a.label.charAt(0) + a.label.slice(1).toLowerCase();
    return {
      ...a,
      formatted: `${label} — ${[a.line1, a.line2, a.city].filter(Boolean).join(', ')}`,
    };
  }

  app.get('/addresses', { preHandler: app.requireAuth }, async (request) => {
    const rows = await app.db.address.findMany({
      where: { userId: request.currentUser!.sub, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return rows.map(toDto);
  });

  app.post('/addresses', { preHandler: app.requireAuth }, async (request, reply) => {
    const body = parse(addressSchema, request.body);
    const userId = request.currentUser!.sub;

    // Default set karna ek transaction hai: purana default hatao, naya lagao.
    // Partial unique index (isDefault = true) do defaults hone hi nahi dega,
    // isliye alag order mein karne par insert fail ho jaata.
    const address = await app.db.$transaction(async (tx) => {
      if (body.isDefault) {
        await tx.address.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }
      const count = await tx.address.count({ where: { userId, deletedAt: null } });
      return tx.address.create({
        // Pehla address hamesha default — warna user ka koi delivery address
        // select hi nahi hota aur checkout block ho jaata
        data: { ...body, userId, isDefault: body.isDefault || count === 0 },
      });
    });

    reply.code(201);
    return toDto(address);
  });

  app.patch<{ Params: { id: string } }>(
    '/addresses/:id',
    { preHandler: app.requireAuth },
    async (request) => {
      const id = parse(uuidSchema, request.params.id);
      const body = parse(updateAddressSchema, request.body);
      const userId = request.currentUser!.sub;

      const existing = await app.db.address.findFirst({ where: { id, userId, deletedAt: null } });
      if (!existing) throw Errors.notFound('Address');

      const address = await app.db.$transaction(async (tx) => {
        if (body.isDefault) {
          await tx.address.updateMany({
            where: { userId, isDefault: true, id: { not: id } },
            data: { isDefault: false },
          });
        }
        return tx.address.update({ where: { id }, data: body });
      });

      return toDto(address);
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/addresses/:id',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const id = parse(uuidSchema, request.params.id);
      const userId = request.currentUser!.sub;

      const existing = await app.db.address.findFirst({ where: { id, userId, deletedAt: null } });
      if (!existing) throw Errors.notFound('Address');

      // Soft delete — past orders isi row ko reference karte hain, aur
      // receipts ka address snapshot bhi order par hai
      await app.db.address.update({ where: { id }, data: { deletedAt: new Date(), isDefault: false } });
      reply.code(204);
    },
  );
}
