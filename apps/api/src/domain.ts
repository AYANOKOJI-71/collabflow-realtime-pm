export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";
export type TaskStatus = "backlog" | "in_progress" | "in_review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface User {
  id: string;
  name: string;
  email: string;
  avatarInitials: string;
}

export interface WorkspaceMember {
  userId: string;
  role: WorkspaceRole;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  members: WorkspaceMember[];
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  summary: string;
  color: string;
}

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

export interface ActivityItem {
  id: string;
  workspaceId: string;
  actorId: string;
  message: string;
  occurredAt: string;
}

export interface Dashboard {
  workspace: Workspace;
  projects: Project[];
  tasks: Task[];
  activity: ActivityItem[];
  users: User[];
}

export const rolePermissions: Record<WorkspaceRole, readonly string[]> = {
  owner: ["workspace:manage", "project:write", "task:write", "task:assign", "activity:read"],
  admin: ["project:write", "task:write", "task:assign", "activity:read"],
  member: ["task:write", "activity:read"],
  viewer: ["activity:read"]
};

export function can(role: WorkspaceRole, permission: string): boolean {
  return rolePermissions[role].includes(permission);
}
