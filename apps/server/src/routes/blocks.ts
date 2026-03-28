import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "../db/index.js";
import { blocks, pages } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { authMiddleware, type AuthEnv } from "../middleware/auth.js";

const saveBlocksSchema = z.object({
  content: z.array(z.any()),
});

export const blockRoutes = new Hono<AuthEnv>()
  .use(authMiddleware)

  // Get document content for a page
  .get("/:pageId", async (c) => {
    const user = c.get("user");
    const pageId = c.req.param("pageId");

    const page = db
      .select({ id: pages.id, isLocked: pages.isLocked })
      .from(pages)
      .where(and(eq(pages.id, pageId), eq(pages.createdBy, user.id)))
      .get();

    if (!page) {
      return c.json({ error: "Page not found" }, 404);
    }

    const docBlock = db
      .select({ content: blocks.content })
      .from(blocks)
      .where(and(eq(blocks.pageId, pageId), eq(blocks.type, "__document")))
      .get();

    return c.json({ content: docBlock?.content ?? null });
  })

  // Save document content for a page
  .put("/:pageId", zValidator("json", saveBlocksSchema), async (c) => {
    const user = c.get("user");
    const pageId = c.req.param("pageId");
    const { content } = c.req.valid("json");

    const page = db
      .select({ id: pages.id, isLocked: pages.isLocked })
      .from(pages)
      .where(and(eq(pages.id, pageId), eq(pages.createdBy, user.id)))
      .get();

    if (!page) {
      return c.json({ error: "Page not found" }, 404);
    }
    if (page.isLocked) {
      return c.json({ error: "Page is locked" }, 423);
    }

    const now = Date.now();

    db.transaction(() => {
      db.insert(blocks)
        .values({
          id: `${pageId}_doc`,
          pageId,
          parentId: null,
          type: "__document",
          content: content as any,
          properties: null,
          position: 0,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: blocks.id,
          set: { content: content as any, updatedAt: now },
        })
        .run();

      db.update(pages)
        .set({ updatedAt: now })
        .where(eq(pages.id, pageId))
        .run();
    });

    return c.json({ ok: true });
  });
