import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { nanoid } from "nanoid";
import { db } from "../db/index.js";
import { pages } from "../db/schema.js";
import { eq, isNull, and, asc } from "drizzle-orm";
import {
  createPageSchema,
  updatePageSchema,
  reorderPagesSchema,
} from "@notes/shared";
import { authMiddleware, type AuthEnv } from "../middleware/auth.js";
import { mkdirSync, existsSync, unlinkSync } from "fs";
import { resolve, extname } from "path";

const uploadRoot = resolve(import.meta.dir, "../../data/uploads");

function getOwnedPage(userId: string, pageId: string) {
  return db
    .select()
    .from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.createdBy, userId)))
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

function isUnlockOnlyUpdate(input: Record<string, unknown>) {
  const keys = Object.keys(input);
  return keys.length === 1 && keys[0] === "isLocked" && input.isLocked === false;
}

function getLockedError(page: { isLocked: boolean }, input?: Record<string, unknown>) {
  if (!page.isLocked) return null;
  if (input && isUnlockOnlyUpdate(input)) return null;
  return { error: "Page is locked" } as const;
}

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
        coverImage: pages.coverImage,
        sortOrder: pages.sortOrder,
        fontFamily: pages.fontFamily,
        contentWidth: pages.contentWidth,
        isLocked: pages.isLocked,
        isDatabase: pages.isDatabase,
        createdAt: pages.createdAt,
        updatedAt: pages.updatedAt,
        archivedAt: pages.archivedAt,
      })
      .from(pages)
      .where(and(eq(pages.createdBy, user.id), isNull(pages.archivedAt)))
      .orderBy(asc(pages.parentPageId), asc(pages.sortOrder), asc(pages.createdAt))
      .all();

    return c.json({ pages: allPages });
  })

  .get("/:id", async (c) => {
    const user = c.get("user");
    const page = getOwnedPage(user.id, c.req.param("id"));

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
      sortOrder: getNextSortOrder(user.id, input.parentPageId ?? null),
      fontFamily: "default" as const,
      contentWidth: "normal" as const,
      isLocked: false,
      isDatabase: false,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };

    db.insert(pages).values(page).run();

    return c.json({ page }, 201);
  })

  .put("/reorder", zValidator("json", reorderPagesSchema), async (c) => {
    const user = c.get("user");
    const { parentPageId, orderedPageIds } = c.req.valid("json");

    const siblingPages = db
      .select({
        id: pages.id,
        isLocked: pages.isLocked,
      })
      .from(pages)
      .where(
        and(
          eq(pages.createdBy, user.id),
          parentPageId === null ? isNull(pages.parentPageId) : eq(pages.parentPageId, parentPageId),
          isNull(pages.archivedAt)
        )
      )
      .all();

    if (siblingPages.length !== orderedPageIds.length) {
      return c.json({ error: "Ordered pages must match the sibling set" }, 400);
    }

    const siblingIds = new Set(siblingPages.map((page) => page.id));
    if (orderedPageIds.some((id) => !siblingIds.has(id))) {
      return c.json({ error: "Ordered pages must all belong to the same sibling set" }, 400);
    }

    if (siblingPages.some((page) => page.isLocked)) {
      return c.json({ error: "Locked pages cannot be reordered" }, 423);
    }

    const updatedAt = Date.now();
    db.transaction(() => {
      orderedPageIds.forEach((id, index) => {
        db.update(pages)
          .set({ sortOrder: index, updatedAt })
          .where(eq(pages.id, id))
          .run();
      });
    });

    return c.json({ ok: true });
  })

  .patch("/:id", zValidator("json", updatePageSchema), async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const input = c.req.valid("json");

    const existing = getOwnedPage(user.id, id);
    if (!existing) {
      return c.json({ error: "Page not found" }, 404);
    }

    const lockError = getLockedError(existing, input);
    if (lockError) {
      return c.json(lockError, 423);
    }

    const updates = { ...input } as Record<string, unknown>;
    if (
      input.parentPageId !== undefined &&
      input.parentPageId !== existing.parentPageId
    ) {
      updates.sortOrder = getNextSortOrder(user.id, input.parentPageId ?? null);
    }

    const updatedAt = Date.now();
    db.update(pages)
      .set({ ...updates, updatedAt })
      .where(eq(pages.id, id))
      .run();

    return c.json({ page: { ...existing, ...updates, updatedAt } });
  })

  .post("/:id/cover-upload", async (c) => {
    const user = c.get("user");
    const page = getOwnedPage(user.id, c.req.param("id"));

    if (!page) {
      return c.json({ error: "Page not found" }, 404);
    }

    const lockError = getLockedError(page);
    if (lockError) {
      return c.json(lockError, 423);
    }

    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return c.json({ error: "Image file is required" }, 400);
    }
    if (!file.type.startsWith("image/")) {
      return c.json({ error: "Only image uploads are supported" }, 400);
    }

    const userDir = resolve(uploadRoot, "covers", user.id);
    mkdirSync(userDir, { recursive: true });

    const suffix = extname(file.name || "").replace(/[^a-zA-Z0-9.]/g, "") || ".bin";
    const filename = `${Date.now()}-${nanoid()}${suffix}`;
    const filePath = resolve(userDir, filename);
    await Bun.write(filePath, file);

    if (page.coverImage?.startsWith(`/uploads/covers/${user.id}/`)) {
      const previousPath = resolve(uploadRoot, page.coverImage.replace("/uploads/", ""));
      if (existsSync(previousPath)) {
        unlinkSync(previousPath);
      }
    }

    const coverImage = `/uploads/covers/${user.id}/${filename}`;
    db.update(pages)
      .set({ coverImage, updatedAt: Date.now() })
      .where(eq(pages.id, page.id))
      .run();

    return c.json({ coverImage });
  })

  .delete("/:id/cover", async (c) => {
    const user = c.get("user");
    const page = getOwnedPage(user.id, c.req.param("id"));

    if (!page) {
      return c.json({ error: "Page not found" }, 404);
    }

    const lockError = getLockedError(page);
    if (lockError) {
      return c.json(lockError, 423);
    }

    if (page.coverImage?.startsWith(`/uploads/covers/${user.id}/`)) {
      const filePath = resolve(uploadRoot, page.coverImage.replace("/uploads/", ""));
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    }

    db.update(pages)
      .set({ coverImage: null, updatedAt: Date.now() })
      .where(eq(pages.id, page.id))
      .run();

    return c.json({ ok: true });
  })

  .delete("/:id", async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");

    const existing = getOwnedPage(user.id, id);
    if (!existing) {
      return c.json({ error: "Page not found" }, 404);
    }

    const lockError = getLockedError(existing);
    if (lockError) {
      return c.json(lockError, 423);
    }

    const now = Date.now();
    db.update(pages)
      .set({ archivedAt: now, updatedAt: now })
      .where(eq(pages.id, id))
      .run();

    return c.json({ ok: true });
  });
