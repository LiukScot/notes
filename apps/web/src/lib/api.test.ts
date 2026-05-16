import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { ApiError, api } from "./api.ts";

describe("ApiError", () => {
  test("preserves status code and message", () => {
    const err = new ApiError(401, "Unauthorized");
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(401);
    expect(err.message).toBe("Unauthorized");
  });

  test("can be matched with instanceof", () => {
    const err: unknown = new ApiError(409, "Email already in use");
    expect(err instanceof ApiError).toBe(true);
  });
});

describe("api.auth", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ user: { id: "1", email: "a@b.com" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("login POSTs JSON to /api/auth/login with credentials:include", async () => {
    await api.auth.login({ email: "a@b.com", password: "x" });
    const f = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(f).toHaveBeenCalled();
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe("/api/auth/login");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(JSON.parse(init.body as string)).toEqual({
      email: "a@b.com",
      password: "x",
    });
  });

  test("signup POSTs JSON to /api/auth/signup", async () => {
    await api.auth.signup({
      email: "n@b.com",
      password: "Password123!",
      name: "N",
    });
    const f = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe("/api/auth/signup");
    expect(init.method).toBe("POST");
  });

  test("throws ApiError with status on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "Invalid credentials" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    await expect(
      api.auth.login({ email: "a@b.com", password: "wrong" })
    ).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe("api.pages", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ pages: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("list calls GET /api/pages", async () => {
    await api.pages.list();
    const f = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const [url] = f.mock.calls[0]!;
    expect(url).toBe("/api/pages");
  });

  test("create POSTs to /api/pages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ page: { id: "p1" } }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    await api.pages.create({ title: "Test" });
    const f = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe("/api/pages");
    expect(init.method).toBe("POST");
  });

  test("uploadCover sends FormData (no JSON header)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ coverImage: "/uploads/x.png" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    const file = new File([new Uint8Array(10)], "x.png", { type: "image/png" });
    await api.pages.uploadCover("p1", file);
    const f = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe("/api/pages/p1/cover-upload");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers).not.toHaveProperty("Content-Type");
  });
});
