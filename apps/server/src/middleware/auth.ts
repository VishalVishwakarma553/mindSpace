import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { HttpError, unauthorized } from "../lib/errors.js";

export const AUTH_COOKIE = "mm_token";

declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
  }
}

interface TokenPayload {
  sub: string;
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId } satisfies TokenPayload, env.JWT_SECRET, {
    expiresIn: env.JWT_TTL as jwt.SignOptions["expiresIn"],
  });
}

export function verifyToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/** Reads a JWT from the httpOnly cookie (web app) or the Authorization header (extension). */
export function tokenFromRequest(req: Pick<Request, "headers" | "cookies">): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  const cookie = (req.cookies as Record<string, string> | undefined)?.[AUTH_COOKIE];
  return cookie ?? null;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = tokenFromRequest(req);
  const userId = token ? verifyToken(token) : null;
  if (!userId) return next(unauthorized());
  req.userId = userId;
  next();
}

/** Auth for the local Python worker: shared secret, compared in constant time. */
export function requireWorker(req: Request, _res: Response, next: NextFunction): void {
  const provided = Buffer.from(String(req.headers["x-worker-token"] ?? ""));
  const expected = Buffer.from(env.WORKER_TOKEN);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return next(new HttpError(401, "Invalid worker token", "unauthorized"));
  }
  next();
}

/** Narrowing helper for handlers mounted behind requireAuth. */
export function currentUserId(req: Request): string {
  if (!req.userId) throw unauthorized();
  return req.userId;
}
