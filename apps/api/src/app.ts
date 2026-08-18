import express, { type Express } from "express";
import cors from "cors";
import { z } from "zod";
import { requireAuth, signAccessToken, type AuthenticatedRequest } from "./auth.js";
import { roleCanUpdateTask } from "./auth.js";
import type { WorkspaceRepository } from "./repositories/types.js";

const taskUpdateSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  status: z.enum(["backlog", "in_progress", "in_review", "done"]).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
  expectedVersion: z.number().int().positive()
});

export interface AppDependencies {
  repository: WorkspaceRepository;
  jwtSecret: string;
  corsOrigin: string;
  onTaskUpdated?: (payload: { workspaceId: string; taskId: string; task: unknown; activity: unknown }) => void;
}

export function createApp(dependencies: AppDependencies): Express {
  const app = express();
  app.use(cors({ origin: dependencies.corsOrigin, credentials: false }));
  app.use(express.json({ limit: "64kb" }));

  app.get("/healthz", (_request, response) => response.json({ status: "healthy", service: "collabflow-api" }));
  app.get("/readyz", (_request, response) => response.json({ status: "ready", dependencies: ["repository", "socket-gateway"] }));

  app.post("/api/demo/login", async (request, response) => {
    const parsed = z.object({ userId: z.string().min(1) }).safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: "INVALID_LOGIN_REQUEST" });
    const user = await dependencies.repository.getUser(parsed.data.userId);
    if (!user) return response.status(404).json({ error: "USER_NOT_FOUND" });
    return response.json({ token: signAccessToken(user.id, dependencies.jwtSecret), user });
  });

  app.use("/api", requireAuth(dependencies.jwtSecret));

  app.get("/api/me/workspaces", async (request: AuthenticatedRequest, response) => {
    const workspaces = await dependencies.repository.listWorkspacesForUser(request.auth!.userId);
    return response.json({ workspaces });
  });

  app.get("/api/workspaces/:workspaceId/dashboard", async (request: AuthenticatedRequest, response) => {
    const role = await dependencies.repository.getMembership(request.params.workspaceId, request.auth!.userId);
    if (!role) return response.status(403).json({ error: "WORKSPACE_ACCESS_DENIED" });
    const dashboard = await dependencies.repository.getDashboard(request.params.workspaceId);
    if (!dashboard) return response.status(404).json({ error: "WORKSPACE_NOT_FOUND" });
    return response.json({ ...dashboard, role });
  });

  app.patch("/api/tasks/:taskId", async (request: AuthenticatedRequest, response) => {
    const parsed = taskUpdateSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: "INVALID_TASK_UPDATE", details: parsed.error.flatten() });

    const dashboard = await dependencies.repository.getDashboard("ws-cyber-invasion");
    const task = dashboard?.tasks.find((candidate) => candidate.id === request.params.taskId);
    if (!task) return response.status(404).json({ error: "TASK_NOT_FOUND" });
    const project = dashboard?.projects.find((candidate) => candidate.id === task.projectId);
    const role = project ? await dependencies.repository.getMembership(project.workspaceId, request.auth!.userId) : undefined;
    if (!role || !roleCanUpdateTask(role)) return response.status(403).json({ error: "TASK_UPDATE_DENIED" });

    try {
      const result = await dependencies.repository.updateTask(task.id, request.auth!.userId, parsed.data);
      dependencies.onTaskUpdated?.({ workspaceId: project!.workspaceId, taskId: task.id, ...result });
      return response.json(result);
    } catch (error) {
      if (error instanceof Error && error.message === "VERSION_CONFLICT") return response.status(409).json({ error: "VERSION_CONFLICT" });
      return response.status(500).json({ error: "TASK_UPDATE_FAILED" });
    }
  });

  return app;
}
