import bcrypt from "bcryptjs";
import { Router, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { env } from "../config/env.js";
import { conflict, HttpError, notFound } from "../lib/errors.js";
import { parse } from "../lib/validate.js";
import { AUTH_COOKIE, currentUserId, requireAuth, signToken } from "../middleware/auth.js";
import { publicUser, UserModel } from "../models/User.js";

export const authRouter = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === "test" ? 1000 : 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});
const registerSchema = credentials.extend({ name: z.string().trim().min(1, "Name is required").max(80) });
const loginSchema = credentials.extend({ client: z.enum(["web", "extension"]).default("web") });

function setSession(res: Response, token: string) {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

authRouter.post("/register", limiter, async (req, res) => {
  const body = parse(registerSchema, req.body);
  if (await UserModel.exists({ email: body.email })) throw conflict("An account with this email already exists");
  const user = await UserModel.create({
    name: body.name,
    email: body.email,
    passwordHash: await bcrypt.hash(body.password, 12),
  });
  setSession(res, signToken(user._id.toString()));
  res.status(201).json({ user: publicUser(user) });
});

authRouter.post("/login", limiter, async (req, res) => {
  const body = parse(loginSchema, req.body);
  const user = await UserModel.findOne({ email: body.email }).select("+passwordHash");
  // Same message for unknown email and wrong password to avoid account enumeration.
  if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
    throw new HttpError(401, "Incorrect email or password", "invalid_credentials");
  }
  const token = signToken(user._id.toString());
  if (body.client === "extension") {
    // The extension cannot use the web app's httpOnly cookie, so it stores a bearer token.
    res.json({ user: publicUser(user), token });
    return;
  }
  setSession(res, token);
  res.json({ user: publicUser(user) });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { path: "/" });
  res.status(204).end();
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await UserModel.findById(currentUserId(req));
  if (!user) throw notFound("User");
  res.json({ user: publicUser(user) });
});
