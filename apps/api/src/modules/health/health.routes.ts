import type { FastifyInstance } from 'fastify';

export default async function healthRoutes(app: FastifyInstance) {
  /**
   * Liveness — process zinda hai? Database touch NAHI karta.
   *
   * Render iske basis par restart karta hai. Agar yeh database check kare,
   * to ek transient DB blip poore API ko restart loop mein daal degi, jabki
   * process bilkul theek hai.
   */
  app.get('/health', { config: { rateLimit: false } }, async () => ({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
  }));

  /** Readiness — traffic le sakte hain? Yeh database check karta hai. */
  app.get('/health/ready', { config: { rateLimit: false } }, async (_request, reply) => {
    try {
      await app.db.$queryRaw`SELECT 1`;
      return { status: 'ready', database: 'up' };
    } catch {
      reply.code(503);
      return { status: 'not_ready', database: 'down' };
    }
  });
}
