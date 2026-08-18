import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type { WorkspaceRepository } from "../repositories/types.js";
import { verifyAccessToken } from "../auth.js";

export function createCollaborationGateway(server: HttpServer, repository: WorkspaceRepository, jwtSecret: string, corsOrigin: string) {
  const io = new Server(server, { cors: { origin: corsOrigin, methods: ["GET", "POST"] } });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (typeof token !== "string") return next(new Error("AUTH_REQUIRED"));
      socket.data.userId = verifyAccessToken(token, jwtSecret).sub;
      next();
    } catch {
      next(new Error("INVALID_TOKEN"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("workspace:join", async (workspaceId: string, ack?: (result: { ok: boolean }) => void) => {
      const role = await repository.getMembership(workspaceId, socket.data.userId as string);
      if (!role) return ack?.({ ok: false });
      socket.join(`workspace:${workspaceId}`);
      io.to(`workspace:${workspaceId}`).emit("presence:changed", { userId: socket.data.userId, state: "joined" });
      ack?.({ ok: true });
    });

    socket.on("disconnect", () => {
      for (const room of socket.rooms) {
        if (room.startsWith("workspace:")) io.to(room).emit("presence:changed", { userId: socket.data.userId, state: "left" });
      }
    });
  });

  return io;
}
