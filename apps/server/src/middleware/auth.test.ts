import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { createTestDb, mountRoutes, signupAndLogin } from "../test-helpers.ts";

async function setup() {
  const ctx = createTestDb();
  const { app } = await mountRoutes(ctx);
  return { ctx, app };
}

describe("authMiddleware", () => {
  test("rejects requests with no session cookie (401)", async () => {
    const { app } = await setup();
    const res = await app.request("/api/pages");
    expect(res.status).toBe(401);
  });

  test("rejects requests with empty cookie string (401)", async () => {
    const { app } = await setup();
    const res = await app.request("/api/pages", {
      headers: { cookie: "" },
    });
    expect(res.status).toBe(401);
  });

  test("rejects requests with malformed cookie (401)", async () => {
    const { app } = await setup();
    const res = await app.request("/api/pages", {
      headers: { cookie: "session=not-a-valid-token" },
    });
    expect(res.status).toBe(401);
  });

  test("accepts requests with valid session cookie (200)", async () => {
    const { app } = await setup();
    const { cookie } = await signupAndLogin(app, {
      email: "valid@example.com",
    });
    const res = await app.request("/api/pages", {
      headers: { cookie },
    });
    expect(res.status).toBe(200);
  });

  test("rejects requests with expired session (401)", async () => {
    const { ctx, app } = await setup();
    const { cookie } = await signupAndLogin(app, {
      email: "expired@example.com",
    });
    ctx.db.run(sql`UPDATE sessions SET expires_at = 1`);
    const res = await app.request("/api/pages", {
      headers: { cookie },
    });
    expect(res.status).toBe(401);
  });

  test("rejects requests after user session deleted (401)", async () => {
    const { ctx, app } = await setup();
    const { cookie } = await signupAndLogin(app, {
      email: "deleted@example.com",
    });
    ctx.db.run(sql`DELETE FROM sessions`);
    const res = await app.request("/api/pages", {
      headers: { cookie },
    });
    expect(res.status).toBe(401);
  });
});

describe("session cookie security flags", () => {
  test("HttpOnly + Secure + SameSite=Strict set on signup", async () => {
    const ctx = createTestDb();
    const { app } = await mountRoutes(ctx);
    const res = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "flags@example.com",
        password: "Password123!",
        name: "Flags",
      }),
    });
    const cookie = (res.headers.get("set-cookie") ?? "").toLowerCase();
    expect(cookie).toContain("httponly");
    expect(cookie).toContain("secure");
    expect(cookie).toContain("samesite=strict");
  });
});
