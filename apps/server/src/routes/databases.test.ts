import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { createTestDb, mountRoutes, signupAndLogin } from "../test-helpers.ts";

async function setup() {
  const ctx = createTestDb();
  const { app } = await mountRoutes(ctx);
  const owner = await signupAndLogin(app, { email: "db-owner@example.com" });
  return { ctx, app, owner };
}

async function createDatabase(
  app: Hono,
  cookie: string
): Promise<{ pageId: string }> {
  const res = await app.request("/api/databases", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ title: "My DB" }),
  });
  if (res.status !== 201) {
    const text = await res.text();
    throw new Error(`createDatabase: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { page: { id: string } };
  return { pageId: data.page.id };
}

async function createProperty(
  app: Hono,
  cookie: string,
  pageId: string,
  body: { name: string; type: string; config?: unknown }
): Promise<{ id: string }> {
  const res = await app.request(`/api/databases/${pageId}/properties`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify(body),
  });
  if (res.status !== 201) {
    const text = await res.text();
    throw new Error(`createProperty: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { property: { id: string } };
  return { id: data.property.id };
}

async function createRow(
  app: Hono,
  cookie: string,
  pageId: string,
  cells?: Record<string, unknown>
): Promise<{ id: string }> {
  const res = await app.request(`/api/databases/${pageId}/rows`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ cells: cells ?? {} }),
  });
  if (res.status !== 201) {
    const text = await res.text();
    throw new Error(`createRow: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { row: { id: string } };
  return { id: data.row.id };
}

describe("POST /api/databases", () => {
  test("requires authentication", async () => {
    const { app } = await setup();
    const res = await app.request("/api/databases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  test("creates a database page with default 'Title' property", async () => {
    const { ctx, app, owner } = await setup();
    const { pageId } = await createDatabase(app, owner.cookie);
    const props = ctx.raw
      .query(
        "SELECT name, type FROM database_properties WHERE page_id = ?"
      )
      .all(pageId) as { name: string; type: string }[];
    expect(props.length).toBe(1);
    expect(props[0]?.name).toBe("Title");
    expect(props[0]?.type).toBe("text");
  });
});

describe("GET /api/databases/:pageId", () => {
  test("returns 404 for non-database page (e.g. plain page)", async () => {
    const { app, owner } = await setup();
    const pageRes = await app.request("/api/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ title: "Plain" }),
    });
    const plain = (await pageRes.json()) as { page: { id: string } };
    const res = await app.request(`/api/databases/${plain.page.id}`, {
      headers: { cookie: owner.cookie },
    });
    expect(res.status).toBe(404);
  });

  test("returns 404 for database owned by another user (IDOR)", async () => {
    const { app, owner } = await setup();
    const { pageId } = await createDatabase(app, owner.cookie);
    const intruder = await signupAndLogin(app, { email: "evil@example.com" });
    const res = await app.request(`/api/databases/${pageId}`, {
      headers: { cookie: intruder.cookie },
    });
    expect(res.status).toBe(404);
  });

  test("returns properties and empty rows array", async () => {
    const { app, owner } = await setup();
    const { pageId } = await createDatabase(app, owner.cookie);
    const res = await app.request(`/api/databases/${pageId}`, {
      headers: { cookie: owner.cookie },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      properties: unknown[];
      rows: unknown[];
    };
    expect(body.properties.length).toBe(1);
    expect(body.rows).toEqual([]);
  });
});

describe("POST /api/databases/:pageId/properties", () => {
  test("creates property with valid type", async () => {
    const { app, owner } = await setup();
    const { pageId } = await createDatabase(app, owner.cookie);
    const res = await app.request(`/api/databases/${pageId}/properties`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ name: "Status", type: "select" }),
    });
    expect(res.status).toBe(201);
  });

  test("rejects unknown property type", async () => {
    const { app, owner } = await setup();
    const { pageId } = await createDatabase(app, owner.cookie);
    const res = await app.request(`/api/databases/${pageId}/properties`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ name: "Bad", type: "rocket" }),
    });
    expect(res.status).toBe(400);
  });

  test("rejects empty name", async () => {
    const { app, owner } = await setup();
    const { pageId } = await createDatabase(app, owner.cookie);
    const res = await app.request(`/api/databases/${pageId}/properties`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ name: "", type: "text" }),
    });
    expect(res.status).toBe(400);
  });

  test("returns 404 when adding property to another user's database (IDOR)", async () => {
    const { app, owner } = await setup();
    const { pageId } = await createDatabase(app, owner.cookie);
    const intruder = await signupAndLogin(app, { email: "evil2@example.com" });
    const res = await app.request(`/api/databases/${pageId}/properties`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: intruder.cookie },
      body: JSON.stringify({ name: "Hack", type: "text" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/databases/:pageId/properties/:propertyId", () => {
  test("updates name", async () => {
    const { app, owner } = await setup();
    const { pageId } = await createDatabase(app, owner.cookie);
    const { id: propId } = await createProperty(app, owner.cookie, pageId, {
      name: "Old",
      type: "text",
    });
    const res = await app.request(
      `/api/databases/${pageId}/properties/${propId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie: owner.cookie },
        body: JSON.stringify({ name: "New" }),
      }
    );
    expect(res.status).toBe(200);
  });

  test("returns 404 for property in another user's database (IDOR)", async () => {
    const { app, owner } = await setup();
    const { pageId } = await createDatabase(app, owner.cookie);
    const { id: propId } = await createProperty(app, owner.cookie, pageId, {
      name: "Status",
      type: "select",
    });
    const intruder = await signupAndLogin(app, { email: "intr@example.com" });
    const res = await app.request(
      `/api/databases/${pageId}/properties/${propId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie: intruder.cookie },
        body: JSON.stringify({ name: "Hacked" }),
      }
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/databases/:pageId/properties/:propertyId", () => {
  test("deletes property", async () => {
    const { ctx, app, owner } = await setup();
    const { pageId } = await createDatabase(app, owner.cookie);
    const { id: propId } = await createProperty(app, owner.cookie, pageId, {
      name: "Temp",
      type: "text",
    });
    const res = await app.request(
      `/api/databases/${pageId}/properties/${propId}`,
      { method: "DELETE", headers: { cookie: owner.cookie } }
    );
    expect(res.status).toBe(200);
    const left = ctx.raw
      .query(
        "SELECT COUNT(*) as n FROM database_properties WHERE id = ?"
      )
      .get(propId) as { n: number };
    expect(left.n).toBe(0);
  });

  test("returns 404 for property not in this database", async () => {
    const { app, owner } = await setup();
    const dbA = await createDatabase(app, owner.cookie);
    const dbB = await createDatabase(app, owner.cookie);
    const { id: propInB } = await createProperty(app, owner.cookie, dbB.pageId, {
      name: "PropB",
      type: "text",
    });
    const res = await app.request(
      `/api/databases/${dbA.pageId}/properties/${propInB}`,
      { method: "DELETE", headers: { cookie: owner.cookie } }
    );
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/databases/:pageId/properties/reorder", () => {
  test("requires full permutation, rejects partial (PR #18 regression)", async () => {
    const { app, owner } = await setup();
    const { pageId } = await createDatabase(app, owner.cookie);
    const a = await createProperty(app, owner.cookie, pageId, {
      name: "A",
      type: "text",
    });
    const res = await app.request(
      `/api/databases/${pageId}/properties/reorder`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", cookie: owner.cookie },
        body: JSON.stringify({ propertyIds: [a.id] }),
      }
    );
    expect(res.status).toBe(400);
  });

  test("rejects duplicate IDs (PR #18 regression)", async () => {
    const { app, owner } = await setup();
    const { pageId } = await createDatabase(app, owner.cookie);
    const a = await createProperty(app, owner.cookie, pageId, {
      name: "A",
      type: "text",
    });
    await createProperty(app, owner.cookie, pageId, {
      name: "B",
      type: "text",
    });
    const titleProp = (
      await (
        await app.request(`/api/databases/${pageId}`, {
          headers: { cookie: owner.cookie },
        })
      ).json()
    ) as { properties: { id: string }[] };
    const res = await app.request(
      `/api/databases/${pageId}/properties/reorder`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", cookie: owner.cookie },
        body: JSON.stringify({
          propertyIds: [titleProp.properties[0]!.id, a.id, a.id],
        }),
      }
    );
    expect(res.status).toBe(400);
  });

  test("rejects ID belonging to another database (PR #18 regression)", async () => {
    const { app, owner } = await setup();
    const dbA = await createDatabase(app, owner.cookie);
    const dbB = await createDatabase(app, owner.cookie);
    const a = await createProperty(app, owner.cookie, dbA.pageId, {
      name: "A",
      type: "text",
    });
    const bProp = await createProperty(app, owner.cookie, dbB.pageId, {
      name: "B",
      type: "text",
    });
    const dbAState = (await (
      await app.request(`/api/databases/${dbA.pageId}`, {
        headers: { cookie: owner.cookie },
      })
    ).json()) as { properties: { id: string }[] };
    const res = await app.request(
      `/api/databases/${dbA.pageId}/properties/reorder`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", cookie: owner.cookie },
        body: JSON.stringify({
          propertyIds: [
            dbAState.properties[0]!.id,
            a.id,
            bProp.id,
          ],
        }),
      }
    );
    expect(res.status).toBe(400);
  });

  test("accepts a full valid permutation", async () => {
    const { app, owner } = await setup();
    const { pageId } = await createDatabase(app, owner.cookie);
    const a = await createProperty(app, owner.cookie, pageId, {
      name: "A",
      type: "text",
    });
    const b = await createProperty(app, owner.cookie, pageId, {
      name: "B",
      type: "text",
    });
    const titleResp = (await (
      await app.request(`/api/databases/${pageId}`, {
        headers: { cookie: owner.cookie },
      })
    ).json()) as { properties: { id: string }[] };
    const titleId = titleResp.properties[0]!.id;
    const res = await app.request(
      `/api/databases/${pageId}/properties/reorder`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", cookie: owner.cookie },
        body: JSON.stringify({ propertyIds: [b.id, titleId, a.id] }),
      }
    );
    expect(res.status).toBe(200);
  });
});

describe("POST /api/databases/:pageId/rows", () => {
  test("creates row, returns row id", async () => {
    const { app, owner } = await setup();
    const { pageId } = await createDatabase(app, owner.cookie);
    const res = await app.request(`/api/databases/${pageId}/rows`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ cells: {} }),
    });
    expect(res.status).toBe(201);
  });

  test("returns 404 when creating row on other user's database (IDOR)", async () => {
    const { app, owner } = await setup();
    const { pageId } = await createDatabase(app, owner.cookie);
    const intruder = await signupAndLogin(app, { email: "evilr@example.com" });
    const res = await app.request(`/api/databases/${pageId}/rows`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: intruder.cookie },
      body: JSON.stringify({ cells: {} }),
    });
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/databases/:pageId/rows/:rowId/cells/:propertyId", () => {
  test("writes cell value when propertyId belongs to this database", async () => {
    const { app, owner } = await setup();
    const { pageId } = await createDatabase(app, owner.cookie);
    const { id: propId } = await createProperty(app, owner.cookie, pageId, {
      name: "Status",
      type: "text",
    });
    const row = await createRow(app, owner.cookie, pageId);
    const res = await app.request(
      `/api/databases/${pageId}/rows/${row.id}/cells/${propId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", cookie: owner.cookie },
        body: JSON.stringify({ value: "ready" }),
      }
    );
    expect(res.status).toBe(200);
  });

  test("rejects cell write when propertyId belongs to a DIFFERENT database (PR #18 IDOR fix)", async () => {
    const { app, owner } = await setup();
    const dbA = await createDatabase(app, owner.cookie);
    const dbB = await createDatabase(app, owner.cookie);
    const otherProp = await createProperty(app, owner.cookie, dbB.pageId, {
      name: "OtherDB Prop",
      type: "text",
    });
    const row = await createRow(app, owner.cookie, dbA.pageId);
    const res = await app.request(
      `/api/databases/${dbA.pageId}/rows/${row.id}/cells/${otherProp.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", cookie: owner.cookie },
        body: JSON.stringify({ value: "leak" }),
      }
    );
    expect(res.status).toBe(404);
  });

  test("rejects cell write to another user's database (auth IDOR)", async () => {
    const { app, owner } = await setup();
    const { pageId } = await createDatabase(app, owner.cookie);
    const { id: propId } = await createProperty(app, owner.cookie, pageId, {
      name: "T",
      type: "text",
    });
    const row = await createRow(app, owner.cookie, pageId);
    const intruder = await signupAndLogin(app, { email: "evilc@example.com" });
    const res = await app.request(
      `/api/databases/${pageId}/rows/${row.id}/cells/${propId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", cookie: intruder.cookie },
        body: JSON.stringify({ value: "x" }),
      }
    );
    expect(res.status).toBe(404);
  });

  test("returns 404 for row that doesn't belong to database", async () => {
    const { app, owner } = await setup();
    const dbA = await createDatabase(app, owner.cookie);
    const dbB = await createDatabase(app, owner.cookie);
    const { id: propId } = await createProperty(app, owner.cookie, dbA.pageId, {
      name: "T",
      type: "text",
    });
    const otherRow = await createRow(app, owner.cookie, dbB.pageId);
    const res = await app.request(
      `/api/databases/${dbA.pageId}/rows/${otherRow.id}/cells/${propId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", cookie: owner.cookie },
        body: JSON.stringify({ value: "x" }),
      }
    );
    expect(res.status).toBe(404);
  });

  test("upserts: second write overwrites first", async () => {
    const { ctx, app, owner } = await setup();
    const { pageId } = await createDatabase(app, owner.cookie);
    const { id: propId } = await createProperty(app, owner.cookie, pageId, {
      name: "T",
      type: "text",
    });
    const row = await createRow(app, owner.cookie, pageId);
    for (const value of ["first", "second"]) {
      await app.request(
        `/api/databases/${pageId}/rows/${row.id}/cells/${propId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json", cookie: owner.cookie },
          body: JSON.stringify({ value }),
        }
      );
    }
    const cells = ctx.raw
      .query(
        "SELECT COUNT(*) as n, value FROM database_cell_values WHERE row_id = ? AND property_id = ?"
      )
      .get(row.id, propId) as { n: number; value: string };
    expect(cells.n).toBe(1);
    expect(JSON.parse(cells.value)).toBe("second");
  });
});

describe("DELETE /api/databases/:pageId/rows/:rowId", () => {
  test("deletes row, cascades cell values", async () => {
    const { ctx, app, owner } = await setup();
    const { pageId } = await createDatabase(app, owner.cookie);
    const { id: propId } = await createProperty(app, owner.cookie, pageId, {
      name: "T",
      type: "text",
    });
    const row = await createRow(app, owner.cookie, pageId);
    await app.request(
      `/api/databases/${pageId}/rows/${row.id}/cells/${propId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", cookie: owner.cookie },
        body: JSON.stringify({ value: "v" }),
      }
    );
    const res = await app.request(
      `/api/databases/${pageId}/rows/${row.id}`,
      { method: "DELETE", headers: { cookie: owner.cookie } }
    );
    expect(res.status).toBe(200);
    const cellsLeft = ctx.raw
      .query("SELECT COUNT(*) as n FROM database_cell_values WHERE row_id = ?")
      .get(row.id) as { n: number };
    expect(cellsLeft.n).toBe(0);
  });

  test("returns 404 for row in another user's database (IDOR)", async () => {
    const { app, owner } = await setup();
    const { pageId } = await createDatabase(app, owner.cookie);
    const row = await createRow(app, owner.cookie, pageId);
    const intruder = await signupAndLogin(app, { email: "rrr@example.com" });
    const res = await app.request(
      `/api/databases/${pageId}/rows/${row.id}`,
      { method: "DELETE", headers: { cookie: intruder.cookie } }
    );
    expect(res.status).toBe(404);
  });
});

describe("database is locked behavior", () => {
  test("locked database rejects property creation (423)", async () => {
    const { app, owner } = await setup();
    const { pageId } = await createDatabase(app, owner.cookie);
    await app.request(`/api/pages/${pageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ isLocked: true }),
    });
    const res = await app.request(`/api/databases/${pageId}/properties`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ name: "X", type: "text" }),
    });
    expect(res.status).toBe(423);
  });

  test("locked database rejects row creation (423)", async () => {
    const { app, owner } = await setup();
    const { pageId } = await createDatabase(app, owner.cookie);
    await app.request(`/api/pages/${pageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ isLocked: true }),
    });
    const res = await app.request(`/api/databases/${pageId}/rows`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ cells: {} }),
    });
    expect(res.status).toBe(423);
  });

  test("locked database rejects cell writes (423)", async () => {
    const { app, owner } = await setup();
    const { pageId } = await createDatabase(app, owner.cookie);
    const { id: propId } = await createProperty(app, owner.cookie, pageId, {
      name: "T",
      type: "text",
    });
    const row = await createRow(app, owner.cookie, pageId);
    await app.request(`/api/pages/${pageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ isLocked: true }),
    });
    const res = await app.request(
      `/api/databases/${pageId}/rows/${row.id}/cells/${propId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", cookie: owner.cookie },
        body: JSON.stringify({ value: "x" }),
      }
    );
    expect(res.status).toBe(423);
  });
});
