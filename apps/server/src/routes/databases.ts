import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { nanoid } from "nanoid";
import { db } from "../db/index.js";
import {
  pages,
  databaseProperties,
  databaseRows,
  databaseCellValues,
} from "../db/schema.js";
import { eq, and, isNull, asc } from "drizzle-orm";
import {
  createDatabaseSchema,
  createPropertySchema,
  updatePropertySchema,
  reorderPropertiesSchema,
  createRowSchema,
  updateCellSchema,
} from "@notes/shared";
import { authMiddleware, type AuthEnv } from "../middleware/auth.js";

function getOwnedDatabasePage(userId: string, pageId: string) {
  return db
    .select()
    .from(pages)
    .where(
      and(
        eq(pages.id, pageId),
        eq(pages.createdBy, userId),
        eq(pages.isDatabase, true)
      )
    )
    .get();
}

function getNextSortOrder(userId: string, parentPageId: string | null) {
  const siblings = db
    .select({ sortOrder: pages.sortOrder })
    .from(pages)
    .where(
      and(
        eq(pages.createdBy, userId),
        parentPageId === null ? isNull(pages.parentPageId) : eq(pages.parentPageId, parentPageId),
        isNull(pages.archivedAt)
      )
    )
    .orderBy(asc(pages.sortOrder), asc(pages.createdAt))
    .all();

  return siblings.length === 0 ? 0 : siblings[siblings.length - 1].sortOrder + 1;
}

function getLockedError(page: { isLocked: boolean }) {
  if (page.isLocked) {
    return { error: "Page is locked" } as const;
  }
  return null;
}

function getRowsWithCells(pageId: string) {
  const rows = db
    .select()
    .from(databaseRows)
    .where(eq(databaseRows.databaseId, pageId))
    .all();

  if (rows.length === 0) return [];

  // Get all cells via join on rows belonging to this database
  const cells = db
    .select({
      rowId: databaseCellValues.rowId,
      propertyId: databaseCellValues.propertyId,
      value: databaseCellValues.value,
    })
    .from(databaseCellValues)
    .innerJoin(databaseRows, eq(databaseCellValues.rowId, databaseRows.id))
    .where(eq(databaseRows.databaseId, pageId))
    .all();

  const cellsByRow = new Map<string, Record<string, unknown>>();
  for (const cell of cells) {
    if (!cellsByRow.has(cell.rowId)) {
      cellsByRow.set(cell.rowId, {});
    }
    cellsByRow.get(cell.rowId)![cell.propertyId] = cell.value;
  }

  return rows.map((row) => ({
    ...row,
    cells: cellsByRow.get(row.id) || {},
  }));
}

export const databaseRoutes = new Hono<AuthEnv>()
  .use(authMiddleware)

  // Create a new database
  .post("/", zValidator("json", createDatabaseSchema), async (c) => {
    const user = c.get("user");
    const input = c.req.valid("json");
    const now = Date.now();
    const pageId = nanoid();
    const propertyId = nanoid();

    db.transaction(() => {
      db.insert(pages)
        .values({
          id: pageId,
          parentPageId: input.parentPageId ?? null,
          title: input.title ?? "Untitled Database",
          icon: null,
          coverImage: null,
          sortOrder: getNextSortOrder(user.id, input.parentPageId ?? null),
          fontFamily: "default",
          contentWidth: "normal",
          isLocked: false,
          isDatabase: true,
          createdBy: user.id,
          createdAt: now,
          updatedAt: now,
          archivedAt: null,
        })
        .run();

      // Create default "Title" property
      db.insert(databaseProperties)
        .values({
          id: propertyId,
          pageId,
          name: "Title",
          type: "text",
          config: null,
          position: 0,
        })
        .run();
    });

    const page = db.select().from(pages).where(eq(pages.id, pageId)).get();
    if (!page) {
      return c.json({ error: "Failed to create database" }, 500);
    }
    return c.json({ page }, 201);
  })

  // Get database data (properties + rows with cells)
  .get("/:pageId", async (c) => {
    const user = c.get("user");
    const pageId = c.req.param("pageId");

    const page = getOwnedDatabasePage(user.id, pageId);
    if (!page) {
      return c.json({ error: "Database not found" }, 404);
    }

    const properties = db
      .select()
      .from(databaseProperties)
      .where(eq(databaseProperties.pageId, pageId))
      .orderBy(databaseProperties.position)
      .all();

    const rows = getRowsWithCells(pageId);

    return c.json({ properties, rows });
  })

  // Create property
  .post(
    "/:pageId/properties",
    zValidator("json", createPropertySchema),
    async (c) => {
      const user = c.get("user");
      const pageId = c.req.param("pageId");
      const input = c.req.valid("json");

      const page = getOwnedDatabasePage(user.id, pageId);
      if (!page) {
        return c.json({ error: "Database not found" }, 404);
      }
      const lockError = getLockedError(page);
      if (lockError) return c.json(lockError, 423);

      // Get max position
      const existing = db
        .select({ position: databaseProperties.position })
        .from(databaseProperties)
        .where(eq(databaseProperties.pageId, pageId))
        .orderBy(databaseProperties.position)
        .all();
      const maxPos =
        existing.length > 0 ? existing[existing.length - 1].position : -1;

      const id = nanoid();
      const property = {
        id,
        pageId,
        name: input.name,
        type: input.type,
        config: input.config ?? null,
        position: maxPos + 1,
      };

      db.insert(databaseProperties).values(property).run();

      return c.json({ property }, 201);
    }
  )

  // Update property
  .patch(
    "/:pageId/properties/:propertyId",
    zValidator("json", updatePropertySchema),
    async (c) => {
      const user = c.get("user");
      const pageId = c.req.param("pageId");
      const propertyId = c.req.param("propertyId");
      const input = c.req.valid("json");

      const page = getOwnedDatabasePage(user.id, pageId);
      if (!page) {
        return c.json({ error: "Database not found" }, 404);
      }
      const lockError = getLockedError(page);
      if (lockError) return c.json(lockError, 423);

      const existing = db
        .select()
        .from(databaseProperties)
        .where(
          and(
            eq(databaseProperties.id, propertyId),
            eq(databaseProperties.pageId, pageId)
          )
        )
        .get();

      if (!existing) {
        return c.json({ error: "Property not found" }, 404);
      }

      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.type !== undefined) updates.type = input.type;
      if (input.config !== undefined) updates.config = input.config;

      db.update(databaseProperties)
        .set(updates)
        .where(eq(databaseProperties.id, propertyId))
        .run();

      const property = db
        .select()
        .from(databaseProperties)
        .where(eq(databaseProperties.id, propertyId))
        .get();

      if (!property) {
        return c.json({ error: "Property not found after update" }, 500);
      }

      return c.json({ property });
    }
  )

  // Delete property
  .delete("/:pageId/properties/:propertyId", async (c) => {
    const user = c.get("user");
    const pageId = c.req.param("pageId");
    const propertyId = c.req.param("propertyId");

    const page = getOwnedDatabasePage(user.id, pageId);
    if (!page) {
      return c.json({ error: "Database not found" }, 404);
    }
    const lockError = getLockedError(page);
    if (lockError) return c.json(lockError, 423);

    const existing = db
      .select({ id: databaseProperties.id })
      .from(databaseProperties)
      .where(
        and(
          eq(databaseProperties.id, propertyId),
          eq(databaseProperties.pageId, pageId)
        )
      )
      .get();

    if (!existing) {
      return c.json({ error: "Property not found" }, 404);
    }

    db.delete(databaseProperties)
      .where(eq(databaseProperties.id, propertyId))
      .run();

    return c.json({ ok: true });
  })

  // Reorder properties
  .put(
    "/:pageId/properties/reorder",
    zValidator("json", reorderPropertiesSchema),
    async (c) => {
      const user = c.get("user");
      const pageId = c.req.param("pageId");
      const { propertyIds } = c.req.valid("json");

      const page = getOwnedDatabasePage(user.id, pageId);
      if (!page) {
        return c.json({ error: "Database not found" }, 404);
      }
      const lockError = getLockedError(page);
      if (lockError) return c.json(lockError, 423);

      db.transaction(() => {
        for (let i = 0; i < propertyIds.length; i++) {
          db.update(databaseProperties)
            .set({ position: i })
            .where(
              and(
                eq(databaseProperties.id, propertyIds[i]),
                eq(databaseProperties.pageId, pageId)
              )
            )
            .run();
        }
      });

      return c.json({ ok: true });
    }
  )

  // Create row
  .post(
    "/:pageId/rows",
    zValidator("json", createRowSchema),
    async (c) => {
      const user = c.get("user");
      const pageId = c.req.param("pageId");
      const input = c.req.valid("json");

      const page = getOwnedDatabasePage(user.id, pageId);
      if (!page) {
        return c.json({ error: "Database not found" }, 404);
      }
      const lockError = getLockedError(page);
      if (lockError) return c.json(lockError, 423);

      const now = Date.now();
      const rowId = nanoid();

      db.transaction(() => {
        db.insert(databaseRows)
          .values({
            id: rowId,
            databaseId: pageId,
            createdAt: now,
            updatedAt: now,
          })
          .run();

        if (input.cells) {
          for (const [propertyId, value] of Object.entries(input.cells)) {
            db.insert(databaseCellValues)
              .values({ rowId, propertyId, value })
              .run();
          }
        }
      });

      const cells = input.cells || {};
      return c.json(
        {
          row: {
            id: rowId,
            databaseId: pageId,
            createdAt: now,
            updatedAt: now,
            cells,
          },
        },
        201
      );
    }
  )

  // Delete row
  .delete("/:pageId/rows/:rowId", async (c) => {
    const user = c.get("user");
    const pageId = c.req.param("pageId");
    const rowId = c.req.param("rowId");

    const page = getOwnedDatabasePage(user.id, pageId);
    if (!page) {
      return c.json({ error: "Database not found" }, 404);
    }
    const lockError = getLockedError(page);
    if (lockError) return c.json(lockError, 423);

    const existing = db
      .select({ id: databaseRows.id })
      .from(databaseRows)
      .where(
        and(eq(databaseRows.id, rowId), eq(databaseRows.databaseId, pageId))
      )
      .get();

    if (!existing) {
      return c.json({ error: "Row not found" }, 404);
    }

    db.delete(databaseRows).where(eq(databaseRows.id, rowId)).run();

    return c.json({ ok: true });
  })

  // Update cell value (upsert via delete + insert)
  .put(
    "/:pageId/rows/:rowId/cells/:propertyId",
    zValidator("json", updateCellSchema),
    async (c) => {
      const user = c.get("user");
      const pageId = c.req.param("pageId");
      const rowId = c.req.param("rowId");
      const propertyId = c.req.param("propertyId");
      const { value } = c.req.valid("json");

      const page = getOwnedDatabasePage(user.id, pageId);
      if (!page) {
        return c.json({ error: "Database not found" }, 404);
      }
      const lockError = getLockedError(page);
      if (lockError) return c.json(lockError, 423);

      const row = db
        .select({ id: databaseRows.id })
        .from(databaseRows)
        .where(
          and(eq(databaseRows.id, rowId), eq(databaseRows.databaseId, pageId))
        )
        .get();

      if (!row) {
        return c.json({ error: "Row not found" }, 404);
      }

      db.transaction(() => {
        // Delete existing cell value
        db.delete(databaseCellValues)
          .where(
            and(
              eq(databaseCellValues.rowId, rowId),
              eq(databaseCellValues.propertyId, propertyId)
            )
          )
          .run();

        // Insert new value
        db.insert(databaseCellValues)
          .values({ rowId, propertyId, value })
          .run();

        // Update row timestamp
        db.update(databaseRows)
          .set({ updatedAt: Date.now() })
          .where(eq(databaseRows.id, rowId))
          .run();
      });

      return c.json({ cell: { rowId, propertyId, value } });
    }
  );
