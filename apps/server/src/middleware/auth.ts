import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { db } from "../db/index.js";
import { sessions, users } from "../db/schema.js";
import { eq, and, gt } from "drizzle-orm";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export type AuthEnv = {
  Variables: {
    user: AuthUser;
    sessionToken: string;
  };
};

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const token = getCookie(c, "session");
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const now = Date.now();
  const result = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      sessionToken: sessions.token,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, now)))
    .get();

  if (!result) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", {
    id: result.userId,
    email: result.email,
    name: result.name,
  });
  c.set("sessionToken", result.sessionToken);
  await next();
});
