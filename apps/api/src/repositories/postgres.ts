import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import type { ActivityItem, Dashboard, Project, Task, User, Workspace, WorkspaceRole } from "../domain.js";
import type { TaskUpdateInput, WorkspaceRepository } from "./types.js";

type Row = Record<string, unknown>;

function asUser(row: Row): User {
  return { id: String(row.id), name: String(row.name), email: String(row.email), avatarInitials: String(row.avatar_initials) };
}

function asTask(row: Row): Task {
  return {
    id: String(row.id), projectId: String(row.project_id), title: String(row.title), description: String(row.description),
    status: row.status as Task["status"], priority: row.priority as Task["priority"], assigneeId: row.assignee_id ? String(row.assignee_id) : null,
    dueDate: row.due_date ? new Date(String(row.due_date)).toISOString().slice(0, 10) : null, version: Number(row.version), updatedAt: new Date(String(row.updated_at)).toISOString()
  };
}

export class PostgresWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly pool: Pool) {}

  static async connect(databaseUrl: string): Promise<PostgresWorkspaceRepository> {
    const pool = new Pool({ connectionString: databaseUrl, max: 10, idleTimeoutMillis: 30_000 });
    await pool.query("SELECT 1");
    return new PostgresWorkspaceRepository(pool);
  }

  async getUser(userId: string): Promise<User | undefined> {
    const result = await this.pool.query("SELECT id, name, email, avatar_initials FROM users WHERE id = $1", [userId]);
    return result.rows[0] ? asUser(result.rows[0]) : undefined;
  }

  async listWorkspacesForUser(userId: string): Promise<Workspace[]> {
    const result = await this.pool.query(
      `SELECT w.id, w.name, w.description FROM workspaces w
       JOIN workspace_members m ON m.workspace_id = w.id WHERE m.user_id = $1 ORDER BY w.name`, [userId]
    );
    return Promise.all(result.rows.map(async (row) => this.workspaceWithMembers(String(row.id), row)));
  }

  async getMembership(workspaceId: string, userId: string): Promise<WorkspaceRole | undefined> {
    const result = await this.pool.query("SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2", [workspaceId, userId]);
    return result.rows[0]?.role as WorkspaceRole | undefined;
  }

  async getDashboard(workspaceId: string): Promise<Dashboard | undefined> {
    const workspaceResult = await this.pool.query("SELECT id, name, description FROM workspaces WHERE id = $1", [workspaceId]);
    if (!workspaceResult.rows[0]) return undefined;
    const [workspace, projectsResult, tasksResult, activityResult, usersResult] = await Promise.all([
      this.workspaceWithMembers(workspaceId, workspaceResult.rows[0]),
      this.pool.query("SELECT id, workspace_id, name, summary, color FROM projects WHERE workspace_id = $1 ORDER BY name", [workspaceId]),
      this.pool.query(
        `SELECT t.* FROM tasks t JOIN projects p ON p.id = t.project_id
         WHERE p.workspace_id = $1 ORDER BY CASE t.status WHEN 'in_progress' THEN 1 WHEN 'in_review' THEN 2 WHEN 'backlog' THEN 3 ELSE 4 END, t.updated_at DESC`, [workspaceId]
      ),
      this.pool.query("SELECT id, workspace_id, actor_id, message, occurred_at FROM activity WHERE workspace_id = $1 ORDER BY occurred_at DESC LIMIT 50", [workspaceId]),
      this.pool.query(
        `SELECT u.id, u.name, u.email, u.avatar_initials FROM users u JOIN workspace_members m ON m.user_id = u.id WHERE m.workspace_id = $1 ORDER BY u.name`, [workspaceId]
      )
    ]);
    return {
      workspace,
      projects: projectsResult.rows.map((row): Project => ({ id: String(row.id), workspaceId: String(row.workspace_id), name: String(row.name), summary: String(row.summary), color: String(row.color) })),
      tasks: tasksResult.rows.map(asTask),
      activity: activityResult.rows.map((row): ActivityItem => ({ id: String(row.id), workspaceId: String(row.workspace_id), actorId: String(row.actor_id), message: String(row.message), occurredAt: new Date(String(row.occurred_at)).toISOString() })),
      users: usersResult.rows.map(asUser)
    };
  }

  async updateTask(taskId: string, actorId: string, input: TaskUpdateInput): Promise<{ task: Task; activity: ActivityItem }> {
    const changes = Object.entries(input).filter(([key, value]) => key !== "expectedVersion" && value !== undefined);
    if (changes.length === 0) throw new Error("TASK_NOT_FOUND");
    const columns = changes.map(([key], index) => `${this.toColumn(key)} = $${index + 1}`);
    const values = changes.map(([, value]) => value);
    const update = await this.pool.query(
      `UPDATE tasks SET ${columns.join(", ")}, version = version + 1, updated_at = NOW()
       WHERE id = $${values.length + 1} AND version = $${values.length + 2} RETURNING *`, [...values, taskId, input.expectedVersion]
    );
    if (!update.rows[0]) throw new Error("VERSION_CONFLICT");
    const task = asTask(update.rows[0]);
    const context = await this.pool.query(
      `SELECT p.workspace_id, u.name FROM projects p JOIN tasks t ON t.project_id = p.id JOIN users u ON u.id = $1 WHERE t.id = $2`, [actorId, taskId]
    );
    const row = context.rows[0];
    if (!row) throw new Error("TASK_NOT_FOUND");
    const activity: ActivityItem = {
      id: randomUUID(), workspaceId: String(row.workspace_id), actorId,
      message: `${String(row.name)} updated “${task.title}”.`, occurredAt: new Date().toISOString()
    };
    await this.pool.query("INSERT INTO activity (id, workspace_id, actor_id, message, occurred_at) VALUES ($1, $2, $3, $4, $5)", [activity.id, activity.workspaceId, activity.actorId, activity.message, activity.occurredAt]);
    return { task, activity };
  }

  async close(): Promise<void> { await this.pool.end(); }

  private async workspaceWithMembers(id: string, row: Row): Promise<Workspace> {
    const members = await this.pool.query("SELECT user_id, role FROM workspace_members WHERE workspace_id = $1", [id]);
    return { id, name: String(row.name), description: String(row.description), members: members.rows.map((member) => ({ userId: String(member.user_id), role: member.role as WorkspaceRole })) };
  }

  private toColumn(key: string): string {
    const columns: Record<string, string> = { title: "title", description: "description", status: "status", priority: "priority", assigneeId: "assignee_id", dueDate: "due_date" };
    const column = columns[key];
    if (!column) throw new Error("INVALID_TASK_FIELD");
    return column;
  }
}
