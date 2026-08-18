import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { InMemoryWorkspaceRepository } from "../src/repositories/memory.js";

function testApp() {
  return createApp({ repository: new InMemoryWorkspaceRepository(), jwtSecret: "test-secret", corsOrigin: "http://localhost:5173" });
}

async function login(userId = "u-rony") {
  const response = await request(testApp()).post("/api/demo/login").send({ userId });
  return response.body.token as string;
}

describe("CollabFlow API", () => {
  it("returns health without credentials", async () => {
    await request(testApp()).get("/healthz").expect(200, { status: "healthy", service: "collabflow-api" });
  });

  it("limits workspaces to the authenticated member", async () => {
    const token = await login();
    const response = await request(testApp()).get("/api/me/workspaces").set("Authorization", `Bearer ${token}`).expect(200);
    expect(response.body.workspaces).toHaveLength(1);
    expect(response.body.workspaces[0].name).toBe("Cyber Invasion Army");
  });

  it("updates a task with version control for authorized members", async () => {
    const app = testApp();
    const token = (await request(app).post("/api/demo/login").send({ userId: "u-adnan" })).body.token;
    const response = await request(app)
      .patch("/api/tasks/t-003")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "in_progress", expectedVersion: 1 })
      .expect(200);
    expect(response.body.task.status).toBe("in_progress");
    expect(response.body.task.version).toBe(2);
  });

  it("rejects stale task updates", async () => {
    const app = testApp();
    const token = (await request(app).post("/api/demo/login").send({ userId: "u-rony" })).body.token;
    await request(app).patch("/api/tasks/t-001").set("Authorization", `Bearer ${token}`).send({ status: "in_review", expectedVersion: 1 }).expect(200);
    await request(app).patch("/api/tasks/t-001").set("Authorization", `Bearer ${token}`).send({ status: "done", expectedVersion: 1 }).expect(409, { error: "VERSION_CONFLICT" });
  });
});
