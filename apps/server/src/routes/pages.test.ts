import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { createTestDb, mountRoutes, signupAndLogin } from "../test-helpers.ts";

async function setup() {
  const ctx = createTestDb();
  const { app } = await mountRoutes(ctx);
  const owner = await signupAndLogin(app, { email: "owner@example.com" });
  return { ctx, app, owner };
}

async function createPage(
  app: Hono,
  cookie: string,
  body: Record<string, unknown> = {}
): Promise<{ id: string }> {
  const res = await app.request("/api/pages", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ title: "Page", ...body }),
  });
  if (res.status !== 201) {
    const text = await res.text();
    throw new Error(`createPage: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { page: { id: string } };
  return { id: data.page.id };
}

describe("GET /api/pages", () => {
  test("requires authentication (401 without cookie)", async () => {
    const { app } = await setup();
    const res = await app.request("/api/pages");
    expect(res.status).toBe(401);
  });

  test("returns empty list for new user", async () => {
    const { app, owner } = await setup();
    const res = await app.request("/api/pages", {
      headers: { cookie: owner.cookie },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { pages: unknown[] };
    expect(body.pages).toEqual([]);
  });

  test("returns only pages owned by current user (IDOR)", async () => {
    const { app, owner } = await setup();
    await createPage(app, owner.cookie, { title: "Owner page" });

    const intruder = await signupAndLogin(app, { email: "intruder@example.com" });
    const res = await app.request("/api/pages", {
      headers: { cookie: intruder.cookie },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { pages: unknown[] };
    expect(body.pages).toEqual([]);
  });
});

describe("POST /api/pages", () => {
  test("creates a page with defaults", async () => {
    const { app, owner } = await setup();
    const res = await app.request("/api/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      page: { id: string; title: string; isLocked: boolean };
    };
    expect(body.page.id).toBeTruthy();
    expect(body.page.title).toBe("Untitled");
    expect(body.page.isLocked).toBe(false);
  });
});

describe("GET /api/pages/:id", () => {
  test("returns 404 when other user tries to access page (IDOR)", async () => {
    const { app, owner } = await setup();
    const page = await createPage(app, owner.cookie);

    const intruder = await signupAndLogin(app, { email: "evil@example.com" });
    const res = await app.request(`/api/pages/${page.id}`, {
      headers: { cookie: intruder.cookie },
    });
    expect(res.status).toBe(404);
  });

  test("returns 404 for non-existent id", async () => {
    const { app, owner } = await setup();
    const res = await app.request("/api/pages/does-not-exist", {
      headers: { cookie: owner.cookie },
    });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/pages/:id", () => {
  test("rejects updates on locked page", async () => {
    const { app, owner } = await setup();
    const page = await createPage(app, owner.cookie);
    await app.request(`/api/pages/${page.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ isLocked: true }),
    });
    const res = await app.request(`/api/pages/${page.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ title: "Hacked" }),
    });
    expect(res.status).toBe(423);
  });

  test("allows unlock-only update on locked page", async () => {
    const { app, owner } = await setup();
    const page = await createPage(app, owner.cookie);
    await app.request(`/api/pages/${page.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ isLocked: true }),
    });
    const res = await app.request(`/api/pages/${page.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ isLocked: false }),
    });
    expect(res.status).toBe(200);
  });

  test("rejects non-https coverImage URL (PR #18 regression)", async () => {
    const { app, owner } = await setup();
    const page = await createPage(app, owner.cookie);
    const res = await app.request(`/api/pages/${page.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ coverImage: "http://evil.com/bad.png" }),
    });
    expect(res.status).toBe(400);
  });

  test("rejects javascript: coverImage URL (PR #18 regression)", async () => {
    const { app, owner } = await setup();
    const page = await createPage(app, owner.cookie);
    const res = await app.request(`/api/pages/${page.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({
        coverImage: "javascript:alert(1)",
      }),
    });
    expect(res.status).toBe(400);
  });

  test("rejects coverImage URL longer than 2048 chars (PR #18 regression)", async () => {
    const { app, owner } = await setup();
    const page = await createPage(app, owner.cookie);
    const longUrl = `https://example.com/${"a".repeat(2100)}.png`;
    const res = await app.request(`/api/pages/${page.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ coverImage: longUrl }),
    });
    expect(res.status).toBe(400);
  });

  test("accepts valid https coverImage URL ≤ 2048 chars", async () => {
    const { app, owner } = await setup();
    const page = await createPage(app, owner.cookie);
    const res = await app.request(`/api/pages/${page.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({
        coverImage: "https://example.com/cover.png",
      }),
    });
    expect(res.status).toBe(200);
  });

  test("accepts internal /uploads/... coverImage path", async () => {
    const { app, owner } = await setup();
    const page = await createPage(app, owner.cookie);
    const res = await app.request(`/api/pages/${page.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({
        coverImage: `/uploads/covers/${owner.user.id}/abc.png`,
      }),
    });
    expect(res.status).toBe(200);
  });
});

describe("PUT /api/pages/reorder", () => {
  test("rejects duplicate IDs in payload (PR #18 corruption fix)", async () => {
    const { app, owner } = await setup();
    const a = await createPage(app, owner.cookie, { title: "A" });
    await createPage(app, owner.cookie, { title: "B" });
    const res = await app.request("/api/pages/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({
        parentPageId: null,
        orderedPageIds: [a.id, a.id],
      }),
    });
    expect(res.status).toBe(400);
  });

  test("rejects when ordered set doesn't match siblings", async () => {
    const { app, owner } = await setup();
    await createPage(app, owner.cookie, { title: "A" });
    const res = await app.request("/api/pages/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({
        parentPageId: null,
        orderedPageIds: ["nonexistent-id"],
      }),
    });
    expect(res.status).toBe(400);
  });

  test("succeeds with full valid permutation", async () => {
    const { app, owner } = await setup();
    const a = await createPage(app, owner.cookie, { title: "A" });
    const b = await createPage(app, owner.cookie, { title: "B" });
    const res = await app.request("/api/pages/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({
        parentPageId: null,
        orderedPageIds: [b.id, a.id],
      }),
    });
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/pages/:id", () => {
  test("archives page and all descendants recursively", async () => {
    const { ctx, app, owner } = await setup();
    const parent = await createPage(app, owner.cookie, { title: "Parent" });
    const child = await createPage(app, owner.cookie, {
      title: "Child",
      parentPageId: parent.id,
    });
    const grandchild = await createPage(app, owner.cookie, {
      title: "Grandchild",
      parentPageId: child.id,
    });

    const res = await app.request(`/api/pages/${parent.id}`, {
      method: "DELETE",
      headers: { cookie: owner.cookie },
    });
    expect(res.status).toBe(200);

    for (const id of [parent.id, child.id, grandchild.id]) {
      const row = ctx.raw
        .query("SELECT archived_at FROM pages WHERE id = ?")
        .get(id) as { archived_at: number | null };
      expect(row.archived_at).not.toBeNull();
    }
  });

  test("returns 404 when user tries to delete page they don't own", async () => {
    const { app, owner } = await setup();
    const page = await createPage(app, owner.cookie);
    const intruder = await signupAndLogin(app, { email: "intruder2@example.com" });
    const res = await app.request(`/api/pages/${page.id}`, {
      method: "DELETE",
      headers: { cookie: intruder.cookie },
    });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/pages/:id/cover-upload", () => {
  function makeImageFile(
    name: string,
    mime: string,
    size = 1024
  ): File {
    const buf = new Uint8Array(size);
    return new File([buf], name, { type: mime });
  }

  test("rejects .html upload posing as image (PR #18 extension allowlist)", async () => {
    const { app, owner } = await setup();
    const page = await createPage(app, owner.cookie);
    const form = new FormData();
    form.append("file", makeImageFile("evil.html", "image/png", 100));
    const res = await app.request(`/api/pages/${page.id}/cover-upload`, {
      method: "POST",
      headers: { cookie: owner.cookie },
      body: form,
    });
    expect(res.status).toBe(400);
  });

  test("rejects .svg upload (PR #18 extension allowlist; XSS vector)", async () => {
    const { app, owner } = await setup();
    const page = await createPage(app, owner.cookie);
    const form = new FormData();
    form.append("file", makeImageFile("xss.svg", "image/svg+xml", 100));
    const res = await app.request(`/api/pages/${page.id}/cover-upload`, {
      method: "POST",
      headers: { cookie: owner.cookie },
      body: form,
    });
    expect(res.status).toBe(400);
  });

  test("accepts .png upload (PR #18 extension allowlist)", async () => {
    const { app, owner } = await setup();
    const page = await createPage(app, owner.cookie);
    const form = new FormData();
    form.append("file", makeImageFile("cover.png", "image/png", 1024));
    const res = await app.request(`/api/pages/${page.id}/cover-upload`, {
      method: "POST",
      headers: { cookie: owner.cookie },
      body: form,
    });
    expect(res.status).toBe(200);
  });

  test("accepts .jpeg upload", async () => {
    const { app, owner } = await setup();
    const page = await createPage(app, owner.cookie);
    const form = new FormData();
    form.append("file", makeImageFile("photo.jpeg", "image/jpeg", 1024));
    const res = await app.request(`/api/pages/${page.id}/cover-upload`, {
      method: "POST",
      headers: { cookie: owner.cookie },
      body: form,
    });
    expect(res.status).toBe(200);
  });

  test("rejects upload >5MB (size cap)", async () => {
    const { app, owner } = await setup();
    const page = await createPage(app, owner.cookie);
    const oversized = 5 * 1024 * 1024 + 1;
    const form = new FormData();
    form.append("file", makeImageFile("big.png", "image/png", oversized));
    const res = await app.request(`/api/pages/${page.id}/cover-upload`, {
      method: "POST",
      headers: { cookie: owner.cookie },
      body: form,
    });
    expect(res.status).toBe(413);
  });

  test("returns 404 when uploading to page owned by another user", async () => {
    const { app, owner } = await setup();
    const page = await createPage(app, owner.cookie);
    const intruder = await signupAndLogin(app, { email: "evil3@example.com" });
    const form = new FormData();
    form.append("file", makeImageFile("a.png", "image/png", 100));
    const res = await app.request(`/api/pages/${page.id}/cover-upload`, {
      method: "POST",
      headers: { cookie: intruder.cookie },
      body: form,
    });
    expect(res.status).toBe(404);
  });
});
