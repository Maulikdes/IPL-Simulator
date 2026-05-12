import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import { config } from './config';
import { attachSocketIo } from './realtime/socket';
import { ReplayEngine } from './replay/engine';

async function main() {
  const app = Fastify({ logger: true });

  await app.register(fastifyCors, { origin: config.corsOrigin, credentials: true });

  let engine: ReplayEngine | null = null;
  const io = attachSocketIo(app, config.corsOrigin, () => engine);
  engine = new ReplayEngine(io, app.log);

  app.get('/health', async () => ({ ok: true, ts: Date.now() }));

  app.post('/start-over', async (req, reply) => {
    // Fire-and-forget so the HTTP response doesn't block on the ~3 min over.
    engine.start().catch((err) => app.log.error({ err }, 'engine.start failed'));
    return { ok: true, started: true };
  });

  await app.listen({ port: config.port, host: '0.0.0.0' });
  app.log.info(`server listening on http://localhost:${config.port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
