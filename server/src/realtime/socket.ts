import { Server as IoServer } from 'socket.io';
import type { FastifyInstance } from 'fastify';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@shared/types';
import { Events } from './events';
import { recordDecision } from '../decisions/store';
import type { ReplayEngine } from '../replay/engine';

export type AppSocketData = {
  userId?: string;
  userName?: string;
};

export type AppIoServer = IoServer<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  AppSocketData
>;

export function attachSocketIo(
  app: FastifyInstance,
  corsOrigin: string,
  engineGetter: () => ReplayEngine | null,
): AppIoServer {
  const io: AppIoServer = new IoServer(app.server, {
    cors: { origin: corsOrigin, credentials: true },
  }) as AppIoServer;

  io.on('connection', (socket) => {
    app.log.info({ socketId: socket.id }, 'socket connected');

    socket.on(Events.UserHello, (hello) => {
      app.log.info({ socketId: socket.id, hello }, 'user:hello');
      socket.data.userId = hello.user_id;
      socket.data.userName = hello.name;
    });

    socket.on(Events.DecisionSubmit, (decision, ack) => {
      const engine = engineGetter();
      if (!engine || !engine.knowsBall(decision.ball_id)) {
        ack({ ok: false, reason: 'unknown_ball' });
        return;
      }
      if (!engine.isAcceptingDecisions(decision.ball_id)) {
        ack({ ok: false, reason: 'late_submission' });
        return;
      }
      recordDecision(decision);
      app.log.info(
        { userId: decision.user_id, ballId: decision.ball_id, bowler: decision.placement.bowler_id },
        'decision:submit accepted',
      );
      ack({ ok: true });
    });

    socket.on('disconnect', (reason) => {
      app.log.info({ socketId: socket.id, reason }, 'socket disconnected');
    });
  });

  return io;
}
