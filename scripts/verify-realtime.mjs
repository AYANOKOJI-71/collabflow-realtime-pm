import assert from "node:assert/strict";
import { io } from "socket.io-client";

const apiUrl = process.env.API_URL ?? "http://localhost:4000";
const demoUserId = process.env.DEMO_USER_ID ?? "u-rony";

async function request(path, init = {}) {
  const response = await fetch(`${apiUrl}${path}`, init);
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${path} failed with ${response.status}`);
  return response.json();
}

async function connectToWorkspace(token, workspaceId) {
  const socket = io(apiUrl, { auth: { token }, transports: ["websocket"] });
  await new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  const joined = await new Promise((resolve) => socket.emit("workspace:join", workspaceId, resolve));
  assert.equal(joined.ok, true, "Socket client should join its authorized workspace room");
  return socket;
}

async function main() {
  const session = await request("/api/demo/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: demoUserId })
  });
  const authorization = { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" };
  const dashboard = await request("/api/workspaces/ws-cyber-invasion/dashboard", { headers: authorization });
  const task = dashboard.tasks.find((item) => item.status !== "done") ?? dashboard.tasks[0];
  const nextStatus = { backlog: "in_progress", in_progress: "in_review", in_review: "done", done: "backlog" }[task.status];

  const observer = await connectToWorkspace(session.token, dashboard.workspace.id);
  try {
    const broadcast = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timed out waiting for a workspace task broadcast")), 5_000);
      observer.on("task:updated", (event) => {
        if (event.task.id === task.id) {
          clearTimeout(timeout);
          resolve(event);
        }
      });
    });

    const updated = await request(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: authorization,
      body: JSON.stringify({ status: nextStatus, expectedVersion: task.version })
    });
    const event = await broadcast;
    assert.equal(event.task.id, updated.task.id);
    assert.equal(event.task.version, updated.task.version);
    assert.equal(event.task.status, nextStatus);
    console.log(`Real-time check passed: ${event.task.title} reached ${event.task.status} at version ${event.task.version}.`);
  } finally {
    observer.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
