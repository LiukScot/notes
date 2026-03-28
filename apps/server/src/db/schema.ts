import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "number" }).notNull(),
});

export const pages = sqliteTable("pages", {
  id: text("id").primaryKey(),
  parentPageId: text("parent_page_id").references((): any => pages.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull().default("Untitled"),
  icon: text("icon"),
  coverImage: text("cover_image"),
  sortOrder: integer("sort_order").notNull().default(0),
  fontFamily: text("font_family").notNull().default("default"),
  contentWidth: text("content_width").notNull().default("normal"),
  isLocked: integer("is_locked", { mode: "boolean" }).notNull().default(false),
  isDatabase: integer("is_database", { mode: "boolean" })
    .notNull()
    .default(false),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  archivedAt: integer("archived_at", { mode: "number" }),
});

export const blocks = sqliteTable("blocks", {
  id: text("id").primaryKey(),
  pageId: text("page_id")
    .notNull()
    .references(() => pages.id, { onDelete: "cascade" }),
  parentId: text("parent_id"),
  type: text("type").notNull(),
  content: text("content", { mode: "json" }),
  properties: text("properties", { mode: "json" }),
  position: real("position").notNull(),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
});

export const databaseProperties = sqliteTable("database_properties", {
  id: text("id").primaryKey(),
  pageId: text("page_id")
    .notNull()
    .references(() => pages.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  config: text("config", { mode: "json" }),
  position: integer("position").notNull(),
});

export const databaseRows = sqliteTable("database_rows", {
  id: text("id").primaryKey(),
  databaseId: text("database_id")
    .notNull()
    .references(() => pages.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
});

export const databaseCellValues = sqliteTable("database_cell_values", {
  rowId: text("row_id")
    .notNull()
    .references(() => databaseRows.id, { onDelete: "cascade" }),
  propertyId: text("property_id")
    .notNull()
    .references(() => databaseProperties.id, { onDelete: "cascade" }),
  value: text("value", { mode: "json" }),
});

export const links = sqliteTable("links", {
  id: text("id").primaryKey(),
  sourcePageId: text("source_page_id")
    .notNull()
    .references(() => pages.id, { onDelete: "cascade" }),
  sourceBlockId: text("source_block_id"),
  targetPageId: text("target_page_id")
    .notNull()
    .references(() => pages.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'mention' | 'link' | 'relation'
  createdAt: integer("created_at", { mode: "number" }).notNull(),
});
