import { useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { Dashboard, Task, TaskStatus } from "./lib/types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const DEMO_USER_ID = "u-rony";
const columns: { status: TaskStatus; label: string; tone: string }[] = [
  { status: "backlog", label: "Backlog", tone: "slate" },
  { status: "in_progress", label: "In Progress", tone: "violet" },
  { status: "in_review", label: "In Review", tone: "amber" },
  { status: "done", label: "Done", tone: "green" }
];

function formatDate(value: string | null) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function applyTaskUpdate(current: Dashboard, task: Task, activity: Dashboard["activity"][number]): Dashboard {
  const activityExists = current.activity.some((item) => item.id === activity.id);
  return {
    ...current,
    tasks: current.tasks.map((item) => item.id === task.id ? task : item),
    activity: activityExists ? current.activity : [activity, ...current.activity]
  };
}

export function App() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [notice, setNotice] = useState("Connecting to the collaborative workspace…");
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const workspaceId = dashboard?.workspace.id;

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      try {
        const login = await fetch(`${API_URL}/api/demo/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: DEMO_USER_ID }) });
        if (!login.ok) throw new Error("Demo authentication failed");
        const session = await login.json() as { token: string };
        const response = await fetch(`${API_URL}/api/workspaces/ws-cyber-invasion/dashboard`, { headers: { Authorization: `Bearer ${session.token}` } });
        if (!response.ok) throw new Error("Workspace could not be loaded");
        if (!active) return;
        setToken(session.token);
        setDashboard(await response.json() as Dashboard);
        setNotice("Live collaboration is ready.");
      } catch (error) {
        if (active) setNotice(error instanceof Error ? error.message : "Unable to load the workspace.");
      }
    }
    void bootstrap();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!token || !workspaceId) return;
    const socket: Socket = io(API_URL, { auth: { token }, transports: ["websocket", "polling"] });
    socket.on("connect", () => {
      socket.emit("workspace:join", workspaceId, (result: { ok: boolean }) => {
        setConnected(result.ok);
        if (result.ok) setNotice("Live collaboration is connected. Task changes are broadcast instantly.");
      });
    });
    socket.on("task:updated", ({ task, activity }: { task: Task; activity: Dashboard["activity"][number] }) => {
      setDashboard((current) => current ? applyTaskUpdate(current, task, activity) : current);
      setNotice(`Live update received: ${task.title}`);
    });
    socket.on("disconnect", () => setConnected(false));
    return () => { socket.close(); };
  }, [token, workspaceId]);

  const usersById = useMemo(() => new Map(dashboard?.users.map((user) => [user.id, user]) ?? []), [dashboard?.users]);

  async function advanceTask(task: Task) {
    if (!token) return;
    const next = { backlog: "in_progress", in_progress: "in_review", in_review: "done", done: "backlog" } as const;
    setBusyTaskId(task.id);
    try {
      const response = await fetch(`${API_URL}/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: next[task.status], expectedVersion: task.version })
      });
      if (!response.ok) throw new Error(response.status === 409 ? "A teammate updated this task first. Refreshing live state…" : "Task update failed");
      const result = await response.json() as { task: Task; activity: Dashboard["activity"][number] };
      setDashboard((current) => current ? applyTaskUpdate(current, result.task, result.activity) : current);
      setNotice(`Moved “${result.task.title}” to ${result.task.status.replace("_", " ")}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Task update failed.");
    } finally {
      setBusyTaskId(null);
    }
  }

  if (!dashboard) return <main className="loading-shell"><div className="pulse-dot" /><p>{notice}</p></main>;
  const doneCount = dashboard.tasks.filter((task) => task.status === "done").length;
  const completion = Math.round((doneCount / dashboard.tasks.length) * 100);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">C</span><span>CollabFlow</span></div>
        <div className="workspace-switcher"><span className="workspace-dot" />{dashboard.workspace.name}<span className="chevron">⌄</span></div>
        <nav aria-label="Workspace navigation">
          <a className="nav-link active" href="#board">▦ <span>My workspace</span></a>
          <a className="nav-link" href="#activity">◷ <span>Activity log</span></a>
          <a className="nav-link" href="#architecture">◇ <span>System design</span></a>
        </nav>
        <section className="sidebar-card">
          <span className="eyebrow">COLLABORATION STATUS</span>
          <strong>{connected ? "Live sync active" : "Reconnecting"}</strong>
          <p>Socket rooms isolate workspace events while optimistic versions prevent stale updates.</p>
          <span className={`status-dot ${connected ? "online" : "offline"}`}>{connected ? "Connected" : "Offline"}</span>
        </section>
        <div className="sidebar-footer"><span className="avatar dark">SR</span><div><strong>Sarowar Hossain Rony</strong><small>Workspace owner</small></div></div>
      </aside>

      <section className="content">
        <header className="topbar"><div><p className="eyebrow">WORKSPACE / OPERATIONS</p><h1>Project command center</h1></div><div className="top-actions"><span className="live-pill"><i />{connected ? "Live" : "Syncing"}</span><button className="new-task" type="button" onClick={() => setNotice("Task creation is intentionally represented by the API contract in this portfolio demo.")}>+ New task</button></div></header>
        <div className="notice" role="status">{notice}</div>

        <section className="metrics" aria-label="Workspace metrics">
          <article><span className="metric-label">TASK COMPLETION</span><strong>{completion}%</strong><div className="progress"><i style={{ width: `${completion}%` }} /></div><small>{doneCount} of {dashboard.tasks.length} tasks completed</small></article>
          <article><span className="metric-label">ACTIVE COLLABORATORS</span><strong>{dashboard.users.length}</strong><div className="avatars">{dashboard.users.map((user) => <span className="avatar" key={user.id}>{user.avatarInitials}</span>)}</div><small>Role-aware workspace members</small></article>
          <article><span className="metric-label">DELIVERY HEALTH</span><strong className="healthy">Nominal</strong><div className="health-row"><span>API</span><b>Healthy</b><span>Event bus</span><b>Ready</b></div><small>Readiness checks available</small></article>
        </section>

        <section className="board-header" id="board"><div><p className="eyebrow">LIVE WORK QUEUE</p><h2>Execution board</h2></div><p>Click a task card to move it through its next state. Open a second browser tab to see the WebSocket update arrive.</p></section>
        <section className="board" aria-label="Task board">
          {columns.map((column) => {
            const columnTasks = dashboard.tasks.filter((task) => task.status === column.status);
            return <article className="column" key={column.status}><header><span className={`column-chip ${column.tone}`}>{column.label}</span><b>{columnTasks.length}</b></header><div className="task-stack">{columnTasks.map((task) => <button className="task-card" disabled={busyTaskId === task.id} key={task.id} onClick={() => void advanceTask(task)}><span className={`priority ${task.priority}`}>{task.priority}</span><strong>{task.title}</strong><p>{task.description}</p><footer><span className="assignee">{task.assigneeId ? usersById.get(task.assigneeId)?.avatarInitials : "—"}</span><span>{formatDate(task.dueDate)}</span><span className="version">v{task.version}</span></footer></button>)}</div></article>;
          })}
        </section>

        <section className="bottom-grid" id="activity"><article className="activity-card"><header><div><p className="eyebrow">AUDITABLE COLLABORATION</p><h2>Activity stream</h2></div><span>Latest</span></header>{dashboard.activity.slice(0, 4).map((item) => <div className="activity" key={item.id}><span className="avatar mini">{usersById.get(item.actorId)?.avatarInitials ?? "CF"}</span><p><strong>{usersById.get(item.actorId)?.name ?? "System"}</strong> {item.message}<small>{new Date(item.occurredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></p></div>)}</article>
        <article className="architecture-card" id="architecture"><p className="eyebrow">PRODUCTION TRAJECTORY</p><h2>Designed beyond one process</h2><ul><li><b>PostgreSQL</b><span>Durable workspace, membership, task, and audit data</span></li><li><b>Redis adapter</b><span>Cross-instance Socket.IO event propagation</span></li><li><b>Docker Compose</b><span>Repeatable local API, web, database, and cache startup</span></li></ul></article></section>
      </section>
    </main>
  );
}
