export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: number;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: number;
}

export interface Page {
  id: string;
  parentPageId: string | null;
  title: string;
  icon: string | null;
  coverImage: string | null;
  sortOrder: number;
  fontFamily: "default" | "serif" | "mono";
  contentWidth: "normal" | "wide";
  isLocked: boolean;
  isDatabase: boolean;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
}

export interface Block {
  id: string;
  pageId: string;
  parentId: string | null;
  type: string;
  content: unknown;
  properties: unknown;
  position: number;
  createdAt: number;
  updatedAt: number;
}

export type PropertyType = "text" | "number" | "select" | "multi_select" | "date" | "checkbox";

export interface DatabaseProperty {
  id: string;
  pageId: string;
  name: string;
  type: PropertyType;
  config: unknown;
  position: number;
}

export interface DatabaseRow {
  id: string;
  databaseId: string;
  createdAt: number;
  updatedAt: number;
}

export interface DatabaseCellValue {
  rowId: string;
  propertyId: string;
  value: unknown;
}

export interface DatabaseRowWithCells extends DatabaseRow {
  cells: Record<string, unknown>;
}

export interface Link {
  id: string;
  sourcePageId: string;
  sourceBlockId: string | null;
  targetPageId: string;
  type: "mention" | "link" | "relation";
  createdAt: number;
}

export interface PageTreeItem {
  id: string;
  title: string;
  icon: string | null;
  sortOrder: number;
  isLocked: boolean;
  isDatabase: boolean;
  parentPageId: string | null;
  children: PageTreeItem[];
}
