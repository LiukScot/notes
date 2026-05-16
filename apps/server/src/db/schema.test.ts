import { describe, expect, test } from "bun:test";
import { createTestDb, mountRoutes, signupAndLogin } from "../test-helpers.ts";

async function setup() {
  const ctx = createTestDb();
  const { app } = await mountRoutes(ctx);
  const owner = await signupAndLogin(app, { email: "schema@example.com" });
  return { ctx, app, owner };
}

describe("schema invariants", () => {
  test("users.email is UNIQUE", async () => {
    const { ctx } = await setup();
    expect(() => {
      ctx.raw
        .query(
          "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)"
        )
        .run("dup1", "schema@example.com", "X", "h", Date.now());
    }).toThrow();
  });

  test("deleting a session does not delete its user", async () => {
    const { ctx, app } = await setup();
    const { cookie } = await signupAndLogin(app, {
      email: "cascade@example.com",
    });
    expect(cookie).toBeTruthy();
    ctx.raw.query("DELETE FROM sessions").run();
    const users = ctx.raw.query("SELECT id FROM users").all();
    expect(users.length).toBeGreaterThan(0);
  });

  test("deleting a page cascades to its blocks", async () => {
    const { ctx, app, owner } = await setup();
    const created = await app.request("/api/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ title: "Cascade test" }),
    });
    const page = (await created.json()) as { page: { id: string } };
    await app.request(`/api/blocks/${page.page.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ content: [{ type: "paragraph" }] }),
    });
    ctx.raw.query("DELETE FROM pages WHERE id = ?").run(page.page.id);
    const blocks = ctx.raw
      .query("SELECT id FROM blocks WHERE page_id = ?")
      .all(page.page.id);
    expect(blocks.length).toBe(0);
  });

  test("deleting a database row cascades to cell values", async () => {
    const { ctx, app, owner } = await setup();
    const dbCreated = await app.request("/api/databases", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ title: "DB" }),
    });
    const dbPage = (await dbCreated.json()) as { page: { id: string } };
    const dbState = (await (
      await app.request(`/api/databases/${dbPage.page.id}`, {
        headers: { cookie: owner.cookie },
      })
    ).json()) as { properties: { id: string }[] };
    const propId = dbState.properties[0]!.id;
    const rowRes = await app.request(`/api/databases/${dbPage.page.id}/rows`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ cells: { [propId]: "hello" } }),
    });
    const row = (await rowRes.json()) as { row: { id: string } };
    ctx.raw
      .query("DELETE FROM database_rows WHERE id = ?")
      .run(row.row.id);
    const cellsLeft = ctx.raw
      .query("SELECT COUNT(*) as n FROM database_cell_values WHERE row_id = ?")
      .get(row.row.id) as { n: number };
    expect(cellsLeft.n).toBe(0);
  });

  test("foreign_keys pragma is ON in test DB", () => {
    const { ctx } = (() => {
      const c = createTestDb();
      return { ctx: c };
    })();
    const row = ctx.raw.query("PRAGMA foreign_keys").get() as {
      foreign_keys: number;
    };
    expect(row.foreign_keys).toBe(1);
  });
});
