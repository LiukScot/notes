import { Hono } from "hono";
import type { Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import { nanoid } from "nanoid";
import { db } from "../db/index.js";
import { users, sessions } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { signupSchema, loginSchema } from "@notes/shared";
import { authMiddleware } from "../middleware/auth.js";

const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

function createSession(c: Context, userId: string) {
  const token = nanoid(32);
  db.insert(sessions)
    .values({
      id: nanoid(),
      userId,
      token,
      expiresAt: Date.now() + SESSION_DURATION,
    })
    .run();
  setCookie(c, "session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION / 1000,
  });
}

export const authRoutes = new Hono()
  .post("/signup", zValidator("json", signupSchema), async (c) => {
    const { email, password, name } = c.req.valid("json");

    const existing = db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .get();
    if (existing) {
      return c.json({ error: "Email already in use" }, 409);
    }

    const passwordHash = await Bun.password.hash(password, {
      algorithm: "argon2id",
    });

    const userId = nanoid();
    const now = Date.now();

    db.insert(users)
      .values({
        id: userId,
        email,
        name,
        passwordHash,
        createdAt: now,
      })
      .run();

    createSession(c, userId);

    return c.json({
      user: { id: userId, email, name, avatarUrl: null, createdAt: now },
    });
  })

  .post("/login", zValidator("json", loginSchema), async (c) => {
    const { email, password } = c.req.valid("json");

    const user = db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .get();
    if (!user) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    const valid = await Bun.password.verify(password, user.passwordHash);
    if (!valid) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    createSession(c, user.id);

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
    });
  })

  .post("/logout", async (c) => {
    const token = getCookie(c, "session");
    if (token) {
      db.delete(sessions).where(eq(sessions.token, token)).run();
    }
    deleteCookie(c, "session", { path: "/" });
    return c.json({ ok: true });
  })

  .get("/me", authMiddleware, async (c) => {
    const user = c.get("user");
    return c.json({ user });
  });
