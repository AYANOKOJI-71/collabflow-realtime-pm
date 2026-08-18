import type { ActivityItem, Dashboard, Task, User, Workspace, WorkspaceRole } from "../domain.js";

export interface TaskUpdateInput {
  title?: string;
  description?: string;
  status?: Task["status"];
  priority?: Task["priority"];
  assigneeId?: string | null;
  dueDate?: string | null;
  expectedVersion: number;
}

export interface WorkspaceRepository {
  getUser(userId: string): Promise<User | undefined>;
  listWorkspacesForUser(userId: string): Promise<Workspace[]>;
  getMembership(workspaceId: string, userId: string): Promise<WorkspaceRole | undefined>;
  getDashboard(workspaceId: string): Promise<Dashboard | undefined>;
  updateTask(taskId: string, actorId: string, input: TaskUpdateInput): Promise<{ task: Task; activity: ActivityItem }>;
}
