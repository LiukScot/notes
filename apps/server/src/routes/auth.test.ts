import { describe, expect, test } from "bun:test";
import {
  createTestDb,
  mountRoutes,
  signupAndLogin,
  extractSessionCookie,
} from "../test-helpers.ts";

async function setup() {
  const ctx = createTestDb();
  const { app } = await mountRoutes(ctx);
  return { ctx, app };
}

describe("POST /api/auth/signup", () => {
  test("creates user, returns 200 with user payload, and sets session cookie", async () => {
    const { app } = await setup();
    const res = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "new@example.com",
        password: "Password123!",
        name: "New",
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { id: string; email: string } };
    expect(body.user.email).toBe("new@example.com");
    expect(body.user.id).toBeTruthy();
    const cookie = res.headers.get("set-cookie");
    expect(cookie).toContain("session=");
  });

  test("session cookie is SameSite=Strict, HttpOnly, Secure (PR #18 CSRF hardening)", async () => {
    const { app } = await setup();
    const res = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "strict@example.com",
        password: "Password123!",
        name: "Strict",
      }),
    });
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie.toLowerCase()).toContain("samesite=strict");
  });

  test("rejects duplicate email with 409", async () => {
    const { app } = await setup();
    await signupAndLogin(app, { email: "dup@example.com" });
    const res = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "dup@example.com",
        password: "Password123!",
        name: "Other",
      }),
    });
    expect(res.status).toBe(409);
  });

  test("rejects password shorter than 8 chars with 400", async () => {
    const { app } = await setup();
    const res = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "short@example.com",
        password: "abc",
        name: "Short",
      }),
    });
    expect(res.status).toBe(400);
  });

  test("rejects invalid email format with 400", async () => {
    const { app } = await setup();
    const res = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "not-an-email",
        password: "Password123!",
        name: "Bad",
      }),
    });
    expect(res.status).toBe(400);
  });

  test("stores password as argon2id hash, never plaintext", async () => {
    const { ctx, app } = await setup();
    await signupAndLogin(app, {
      email: "hash@example.com",
      password: "Password123!",
    });
    const row = ctx.raw
      .query("SELECT password_hash FROM users WHERE email = ?")
      .get("hash@example.com") as { password_hash: string };
    expect(row.password_hash).toBeTruthy();
    expect(row.password_hash).not.toContain("Password123!");
    expect(row.password_hash.startsWith("$argon2id$")).toBe(true);
  });
});

describe("POST /api/auth/login", () => {
  test("returns 200 and sets cookie on correct creds", async () => {
    const { app } = await setup();
    await signupAndLogin(app, { email: "login@example.com" });
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "login@example.com",
        password: "Password123!",
      }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("session=");
  });

  test("returns 401 on wrong password", async () => {
    const { app } = await setup();
    await signupAndLogin(app, { email: "wrong@example.com" });
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "wrong@example.com",
        password: "WrongPass99!",
      }),
    });
    expect(res.status).toBe(401);
  });

  test("returns 401 on unknown email", async () => {
    const { app } = await setup();
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "nobody@example.com",
        password: "Password123!",
      }),
    });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  test("returns ok and deletes session", async () => {
    const { ctx, app } = await setup();
    const { cookie } = await signupAndLogin(app);
    const res = await app.request("/api/auth/logout", {
      method: "POST",
      headers: { cookie },
    });
    expect(res.status).toBe(200);
    const sessionsLeft = ctx.raw
      .query("SELECT COUNT(*) as n FROM sessions")
      .get() as { n: number };
    expect(sessionsLeft.n).toBe(0);
  });

  test("returns ok without cookie present", async () => {
    const { app } = await setup();
    const res = await app.request("/api/auth/logout", { method: "POST" });
    expect(res.status).toBe(200);
  });
});

describe("GET /api/auth/me", () => {
  test("returns 401 without cookie", async () => {
    const { app } = await setup();
    const res = await app.request("/api/auth/me");
    expect(res.status).toBe(401);
  });

  test("returns current user with valid session cookie", async () => {
    const { app } = await setup();
    const { cookie, user } = await signupAndLogin(app, {
      email: "me@example.com",
    });
    const res = await app.request("/api/auth/me", { headers: { cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { id: string; email: string } };
    expect(body.user.id).toBe(user.id);
    expect(body.user.email).toBe("me@example.com");
  });

  test("returns 401 with garbage cookie value", async () => {
    const { app } = await setup();
    const res = await app.request("/api/auth/me", {
      headers: { cookie: "session=not-a-real-token" },
    });
    expect(res.status).toBe(401);
  });

  test("extractSessionCookie returns first segment", () => {
    expect(
      extractSessionCookie("session=abc123; Path=/; HttpOnly; Secure")
    ).toBe("session=abc123");
  });
});
