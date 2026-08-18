export type TaskStatus = "backlog" | "in_progress" | "in_review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  dueDate: string | null;
  version: number;
  updatedAt: string;
}

export interface User { id: string; name: string; email: string; avatarInitials: string }
export interface Project { id: string; workspaceId: string; name: string; summary: string; color: string }
export interface Activity { id: string; workspaceId: string; actorId: string; message: string; occurredAt: string }
export interface Workspace { id: string; name: string; description: string }
export interface Dashboard { workspace: Workspace; projects: Project[]; tasks: Task[]; activity: Activity[]; users: User[]; role: string }
