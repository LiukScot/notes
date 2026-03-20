import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { nanoid } from "nanoid";
import { db } from "../db/index.js";
import { pages } from "../db/schema.js";
import { eq, isNull, and } from "drizzle-orm";
import { createPageSchema, updatePageSchema } from "@notes/shared";
import { authMiddleware, type AuthEnv } from "../middleware/auth.js";

export const pageRoutes = new Hono<AuthEnv>()
  .use(authMiddleware)

  .get("/", async (c) => {
    const user = c.get("user");
    const allPages = db
      .select({
        id: pages.id,
        parentPageId: pages.parentPageId,
        title: pages.title,
        icon: pages.icon,
        isDatabase: pages.isDatabase,
        createdAt: pages.createdAt,
        updatedAt: pages.updatedAt,
        archivedAt: pages.archivedAt,
      })
      .from(pages)
      .where(and(eq(pages.createdBy, user.id), isNull(pages.archivedAt)))
      .all();

    return c.json({ pages: allPages });
  })

  .get("/:id", async (c) => {
    const user = c.get("user");
    const page = db
      .select()
      .from(pages)
      .where(and(eq(pages.id, c.req.param("id")), eq(pages.createdBy, user.id)))
      .get();

    if (!page) {
      return c.json({ error: "Page not found" }, 404);
    }
    return c.json({ page });
  })

  .post("/", zValidator("json", createPageSchema), async (c) => {
    const user = c.get("user");
    const input = c.req.valid("json");
    const now = Date.now();
    const id = nanoid();

    const page = {
      id,
      parentPageId: input.parentPageId ?? null,
      title: input.title ?? "Untitled",
      icon: input.icon ?? null,
      coverImage: null,
      isDatabase: false,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };

    db.insert(pages).values(page).run();

    return c.json({ page }, 201);
  })

  .patch("/:id", zValidator("json", updatePageSchema), async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const input = c.req.valid("json");

    const existing = db
      .select()
      .from(pages)
      .where(and(eq(pages.id, id), eq(pages.createdBy, user.id)))
      .get();

    if (!existing) {
      return c.json({ error: "Page not found" }, 404);
    }

    const updatedAt = Date.now();
    db.update(pages)
      .set({ ...input, updatedAt })
      .where(eq(pages.id, id))
      .run();

    return c.json({ page: { ...existing, ...input, updatedAt } });
  })

  .delete("/:id", async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");

    const existing = db
      .select({ id: pages.id })
      .from(pages)
      .where(and(eq(pages.id, id), eq(pages.createdBy, user.id)))
      .get();

    if (!existing) {
      return c.json({ error: "Page not found" }, 404);
    }

    const now = Date.now();
    db.update(pages)
      .set({ archivedAt: now, updatedAt: now })
      .where(eq(pages.id, id))
      .run();

    return c.json({ ok: true });
  });
