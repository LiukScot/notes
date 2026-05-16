import { Database } from "bun:sqlite";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { mock } from "bun:test";
import { Hono } from "hono";
import { resolve } from "path";
import { nanoid } from "nanoid";
import * as schema from "./db/schema.js";

const migrationsFolder = resolve(import.meta.dir, "./db/migrations");

export type TestDB = BunSQLiteDatabase<typeof schema>;

export type TestContext = {
  db: TestDB;
  raw: Database;
};

export function createTestDb(): TestContext {
  const raw = new Database(":memory:");
  raw.query("PRAGMA foreign_keys = ON").run();
  const db = drizzle(raw, { schema });
  migrate(db, { migrationsFolder });
  return { db, raw };
}

export async function mountRoutes(ctx: TestContext): Promise<{
  app: Hono;
  authRoutes: typeof import("./routes/auth.js").authRoutes;
  pageRoutes: typeof import("./routes/pages.js").pageRoutes;
  blockRoutes: typeof import("./routes/blocks.js").blockRoutes;
  databaseRoutes: typeof import("./routes/databases.js").databaseRoutes;
}> {
  await mock.module("./db/index.js", () => ({
    db: ctx.db,
    sqlite: ctx.raw,
  }));
  await mock.module("../db/index.js", () => ({
    db: ctx.db,
    sqlite: ctx.raw,
  }));

  const { authRoutes } = await import("./routes/auth.js");
  const { pageRoutes } = await import("./routes/pages.js");
  const { blockRoutes } = await import("./routes/blocks.js");
  const { databaseRoutes } = await import("./routes/databases.js");

  const app = new Hono()
    .basePath("/api")
    .route("/auth", authRoutes)
    .route("/pages", pageRoutes)
    .route("/blocks", blockRoutes)
    .route("/databases", databaseRoutes);

  return { app, authRoutes, pageRoutes, blockRoutes, databaseRoutes };
}

export type SeededUser = {
  id: string;
  email: string;
  password: string;
  name: string;
};

export async function seedUser(
  ctx: TestContext,
  opts: { email?: string; password?: string; name?: string } = {}
): Promise<SeededUser> {
  const email = opts.email ?? `u-${nanoid(6)}@example.com`;
  const password = opts.password ?? "Password123!";
  const name = opts.name ?? "Test User";
  const passwordHash = await Bun.password.hash(password, {
    algorithm: "argon2id",
  });
  const id = nanoid();
  ctx.db
    .insert(schema.users)
    .values({ id, email, name, passwordHash, createdAt: Date.now() })
    .run();
  return { id, email, password, name };
}

export function extractSessionCookie(setCookieHeader: string | null): string {
  if (!setCookieHeader) {
    throw new Error("extractSessionCookie: missing Set-Cookie header");
  }
  const first = setCookieHeader.split(";")[0];
  if (!first) {
    throw new Error("extractSessionCookie: empty Set-Cookie header");
  }
  return first;
}

export async function signupAndLogin(
  app: Hono,
  opts: { email?: string; password?: string; name?: string } = {}
): Promise<{ cookie: string; user: { id: string; email: string } }> {
  const email = opts.email ?? `u-${nanoid(6)}@example.com`;
  const password = opts.password ?? "Password123!";
  const name = opts.name ?? "Test User";
  const res = await app.request("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  if (res.status !== 200) {
    const text = await res.text();
    throw new Error(`signupAndLogin: ${res.status} ${text}`);
  }
  const body = (await res.json()) as { user: { id: string; email: string } };
  const cookie = extractSessionCookie(res.headers.get("set-cookie"));
  return { cookie, user: body.user };
}
