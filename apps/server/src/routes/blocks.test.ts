import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { createTestDb, mountRoutes, signupAndLogin } from "../test-helpers.ts";

async function setup() {
  const ctx = createTestDb();
  const { app } = await mountRoutes(ctx);
  const owner = await signupAndLogin(app, { email: "blocks-owner@example.com" });
  return { ctx, app, owner };
}

async function createPage(
  app: Hono,
  cookie: string
): Promise<string> {
  const res = await app.request("/api/pages", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ title: "Blocks page" }),
  });
  const data = (await res.json()) as { page: { id: string } };
  return data.page.id;
}

describe("GET /api/blocks/:pageId", () => {
  test("requires authentication (401 without cookie)", async () => {
    const { app } = await setup();
    const res = await app.request("/api/blocks/page-x");
    expect(res.status).toBe(401);
  });

  test("returns 404 when page does not belong to user (IDOR)", async () => {
    const { app, owner } = await setup();
    const pageId = await createPage(app, owner.cookie);
    const intruder = await signupAndLogin(app, { email: "intruder@example.com" });
    const res = await app.request(`/api/blocks/${pageId}`, {
      headers: { cookie: intruder.cookie },
    });
    expect(res.status).toBe(404);
  });

  test("returns null content for fresh page", async () => {
    const { app, owner } = await setup();
    const pageId = await createPage(app, owner.cookie);
    const res = await app.request(`/api/blocks/${pageId}`, {
      headers: { cookie: owner.cookie },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { content: unknown };
    expect(body.content).toBeNull();
  });
});

describe("PUT /api/blocks/:pageId", () => {
  test("requires authentication (401 without cookie)", async () => {
    const { app } = await setup();
    const res = await app.request("/api/blocks/page-x", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: [] }),
    });
    expect(res.status).toBe(401);
  });

  test("saves and reads back content", async () => {
    const { app, owner } = await setup();
    const pageId = await createPage(app, owner.cookie);
    const content = [
      { type: "paragraph", text: "Hello world" },
    ];
    const putRes = await app.request(`/api/blocks/${pageId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ content }),
    });
    expect(putRes.status).toBe(200);

    const getRes = await app.request(`/api/blocks/${pageId}`, {
      headers: { cookie: owner.cookie },
    });
    const body = (await getRes.json()) as { content: unknown };
    expect(body.content).toEqual(content);
  });

  test("rejects content array longer than 5000 elements (PR #18 DoS cap)", async () => {
    const { app, owner } = await setup();
    const pageId = await createPage(app, owner.cookie);
    const content = Array.from({ length: 5001 }, (_, i) => ({
      type: "paragraph",
      text: `Block ${i}`,
    }));
    const res = await app.request(`/api/blocks/${pageId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ content }),
    });
    expect(res.status).toBe(400);
  });

  test("accepts content array of exactly 5000 elements (boundary)", async () => {
    const { app, owner } = await setup();
    const pageId = await createPage(app, owner.cookie);
    const content = Array.from({ length: 5000 }, (_, i) => ({
      type: "paragraph",
      text: `Block ${i}`,
    }));
    const res = await app.request(`/api/blocks/${pageId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ content }),
    });
    expect(res.status).toBe(200);
  });

  test("returns 404 when writing blocks to another user's page (IDOR)", async () => {
    const { app, owner } = await setup();
    const pageId = await createPage(app, owner.cookie);
    const intruder = await signupAndLogin(app, { email: "evil@example.com" });
    const res = await app.request(`/api/blocks/${pageId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie: intruder.cookie },
      body: JSON.stringify({ content: [] }),
    });
    expect(res.status).toBe(404);
  });

  test("returns 423 when saving blocks to a locked page", async () => {
    const { app, owner } = await setup();
    const pageId = await createPage(app, owner.cookie);
    await app.request(`/api/pages/${pageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ isLocked: true }),
    });
    const res = await app.request(`/api/blocks/${pageId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ content: [{ type: "paragraph" }] }),
    });
    expect(res.status).toBe(423);
  });

  test("updates page updatedAt timestamp after block save", async () => {
    const { ctx, app, owner } = await setup();
    const pageId = await createPage(app, owner.cookie);
    const before = ctx.raw
      .query("SELECT updated_at FROM pages WHERE id = ?")
      .get(pageId) as { updated_at: number };

    await new Promise((r) => setTimeout(r, 5));

    await app.request(`/api/blocks/${pageId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ content: [{ type: "paragraph" }] }),
    });

    const after = ctx.raw
      .query("SELECT updated_at FROM pages WHERE id = ?")
      .get(pageId) as { updated_at: number };
    expect(after.updated_at).toBeGreaterThan(before.updated_at);
  });
});
