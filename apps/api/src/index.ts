// Yeh PEHLA import hona chahiye. ESM imports hoist hote hain, isliye env
// loading ek alag side-effect module mein hai — dekho load-env.ts.
import './lib/load-env.js';

import { loadEnv } from './lib/env.js';
import { buildServer } from './server.js';

const env = loadEnv();

const app = await buildServer({ env });

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (err) {
  app.log.error(err, 'Failed to start server');
  process.exit(1);
}

/**
 * Graceful shutdown.
 *
 * Render deploy par SIGTERM bhejta hai. Iske bina in-flight requests beech
 * mein kat jaati hain aur DB connections leak hote hain.
 */
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, async () => {
    app.log.info({ signal }, 'Shutting down…');
    try {
      await app.close();
      process.exit(0);
    } catch (err) {
      app.log.error(err, 'Error during shutdown');
      process.exit(1);
    }
  });
}
