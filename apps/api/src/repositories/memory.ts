import { randomUUID } from "node:crypto";
import type { ActivityItem, Dashboard, Project, Task, User, Workspace, WorkspaceRole } from "../domain.js";
import type { TaskUpdateInput, WorkspaceRepository } from "./types.js";

const demoUsers: User[] = [
  { id: "u-rony", name: "Sarowar Hossain Rony", email: "shrony1995@gmail.com", avatarInitials: "SR" },
  { id: "u-maya", name: "Maya Rahman", email: "maya@example.com", avatarInitials: "MR" },
  { id: "u-adnan", name: "Adnan Khan", email: "adnan@example.com", avatarInitials: "AK" }
];

const workspace: Workspace = {
  id: "ws-cyber-invasion",
  name: "Cyber Invasion Army",
  description: "A live planning space for CTF operations and security research.",
  members: [
    { userId: "u-rony", role: "owner" },
    { userId: "u-maya", role: "admin" },
    { userId: "u-adnan", role: "member" }
  ]
};

const projects: Project[] = [
  { id: "p-platform", workspaceId: workspace.id, name: "Platform Hardening", summary: "Harden the collaboration delivery stack.", color: "#6d5dfc" },
  { id: "p-ctf", workspaceId: workspace.id, name: "CTF Operations", summary: "Coordinate research and challenge preparation.", color: "#e28c49" }
];

const initialTasks: Task[] = [
  { id: "t-001", projectId: "p-platform", title: "Add Socket.IO presence indicators", description: "Show who is viewing the active workspace.", status: "in_progress", priority: "high", assigneeId: "u-rony", dueDate: "2026-08-21", version: 1, updatedAt: "2026-08-18T08:00:00.000Z" },
  { id: "t-002", projectId: "p-platform", title: "Document Redis adapter fallback", description: "Explain single-node and Redis-backed modes.", status: "in_review", priority: "medium", assigneeId: "u-maya", dueDate: "2026-08-20", version: 2, updatedAt: "2026-08-18T07:30:00.000Z" },
  { id: "t-003", projectId: "p-ctf", title: "Create forensics challenge brief", description: "Draft the task flow and evidence set.", status: "backlog", priority: "high", assigneeId: "u-adnan", dueDate: "2026-08-24", version: 1, updatedAt: "2026-08-17T10:00:00.000Z" },
  { id: "t-004", projectId: "p-ctf", title: "Review deployment runbook", description: "Validate the production rollback sequence.", status: "done", priority: "low", assigneeId: "u-maya", dueDate: null, version: 4, updatedAt: "2026-08-16T09:00:00.000Z" }
];

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class InMemoryWorkspaceRepository implements WorkspaceRepository {
  private readonly users = clone(demoUsers);
  private readonly workspace = clone(workspace);
  private readonly projects = clone(projects);
  private readonly tasks = clone(initialTasks);
  private readonly activity: ActivityItem[] = [
    { id: "a-001", workspaceId: workspace.id, actorId: "u-maya", message: "moved “Document Redis adapter fallback” to review.", occurredAt: "2026-08-18T07:30:00.000Z" },
    { id: "a-002", workspaceId: workspace.id, actorId: "u-rony", message: "started “Add Socket.IO presence indicators”.", occurredAt: "2026-08-18T08:00:00.000Z" }
  ];

  async getUser(userId: string): Promise<User | undefined> {
    return clone(this.users.find((user) => user.id === userId));
  }

  async listWorkspacesForUser(userId: string): Promise<Workspace[]> {
    return this.workspace.members.some((member) => member.userId === userId) ? [clone(this.workspace)] : [];
  }

  async getMembership(workspaceId: string, userId: string): Promise<WorkspaceRole | undefined> {
    if (workspaceId !== this.workspace.id) return undefined;
    return this.workspace.members.find((member) => member.userId === userId)?.role;
  }

  async getDashboard(workspaceId: string): Promise<Dashboard | undefined> {
    if (workspaceId !== this.workspace.id) return undefined;
    return clone({ workspace: this.workspace, projects: this.projects, tasks: this.tasks, activity: this.activity, users: this.users });
  }

  async updateTask(taskId: string, actorId: string, input: TaskUpdateInput): Promise<{ task: Task; activity: ActivityItem }> {
    const task = this.tasks.find((candidate) => candidate.id === taskId);
    if (!task) throw new Error("TASK_NOT_FOUND");
    if (task.version !== input.expectedVersion) throw new Error("VERSION_CONFLICT");

    const changes = Object.fromEntries(Object.entries(input).filter(([key]) => key !== "expectedVersion"));
    Object.assign(task, changes, { version: task.version + 1, updatedAt: new Date().toISOString() });
    const actor = this.users.find((user) => user.id === actorId);
    const activity: ActivityItem = {
      id: randomUUID(),
      workspaceId: this.workspace.id,
      actorId,
      message: `${actor?.name ?? "A member"} updated “${task.title}”.`,
      occurredAt: task.updatedAt
    };
    this.activity.unshift(activity);
    return clone({ task, activity });
  }
}
