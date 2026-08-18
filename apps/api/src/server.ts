import "dotenv/config";
import { createServer } from "node:http";
import { createApp } from "./app.js";
import { InMemoryWorkspaceRepository } from "./repositories/memory.js";
import { PostgresWorkspaceRepository } from "./repositories/postgres.js";
import type { WorkspaceRepository } from "./repositories/types.js";
import { createCollaborationGateway } from "./sockets/collaboration.js";
import { attachRedisAdapter } from "./sockets/redis.js";

const port = Number(process.env.PORT ?? 4000);
const jwtSecret = process.env.JWT_SECRET ?? "development-only-secret-change-me";
const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";

async function bootstrap() {
  const demoMode = process.env.DEMO_MODE !== "false";
  const repository: WorkspaceRepository = demoMode
    ? new InMemoryWorkspaceRepository()
    : await PostgresWorkspaceRepository.connect(process.env.DATABASE_URL ?? "");
  const app = createApp({
    repository,
    jwtSecret,
    corsOrigin,
    onTaskUpdated: ({ workspaceId, task, activity }) => io.to(`workspace:${workspaceId}`).emit("task:updated", { task, activity })
  });
  const httpServer = createServer(app);
  const io = createCollaborationGateway(httpServer, repository, jwtSecret, corsOrigin);
  const detachRedis = demoMode ? undefined : await attachRedisAdapter(io, process.env.REDIS_URL ?? "");

  httpServer.listen(port, () => console.log(`CollabFlow API listening on http://localhost:${port} (${demoMode ? "demo" : "postgres+redis"} mode)`));
  async function shutdown() {
    await detachRedis?.();
    if (repository instanceof PostgresWorkspaceRepository) await repository.close();
    httpServer.close();
  }
  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());
}

void bootstrap().catch((error: unknown) => {
  console.error("CollabFlow failed to start", error);
  process.exit(1);
});
