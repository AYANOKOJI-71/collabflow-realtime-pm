import jwt from "jsonwebtoken";
import type { RequestHandler } from "express";
import type { WorkspaceRole } from "./domain.js";

export interface AuthenticatedRequest extends Express.Request {
  auth?: { userId: string };
}

export interface TokenPayload {
  sub: string;
}

export function signAccessToken(userId: string, secret: string): string {
  return jwt.sign({}, secret, { subject: userId, expiresIn: "8h", algorithm: "HS256" });
}

export function verifyAccessToken(token: string, secret: string): TokenPayload {
  const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
  if (typeof payload === "string" || !payload.sub) throw new Error("INVALID_TOKEN");
  return { sub: payload.sub };
}

export function requireAuth(secret: string): RequestHandler {
  return (request: AuthenticatedRequest, response, next) => {
    const [scheme, token] = request.header("authorization")?.split(" ") ?? [];
    if (scheme !== "Bearer" || !token) return response.status(401).json({ error: "AUTH_REQUIRED" });
    try {
      request.auth = { userId: verifyAccessToken(token, secret).sub };
      next();
    } catch {
      response.status(401).json({ error: "INVALID_TOKEN" });
    }
  };
}

export function roleCanUpdateTask(role: WorkspaceRole): boolean {
  return role === "owner" || role === "admin" || role === "member";
}
