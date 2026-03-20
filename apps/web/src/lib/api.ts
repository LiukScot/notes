import type {
  User,
  Page,
  DatabaseProperty,
  DatabaseRowWithCells,
  DatabaseCellValue,
  SignupInput,
  LoginInput,
  CreatePageInput,
  UpdatePageInput,
  CreateDatabaseInput,
  CreatePropertyInput,
  UpdatePropertyInput,
  CreateRowInput,
  UpdateCellInput,
} from "@notes/shared";

const BASE = "/api";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error || "Request failed");
  }

  return res.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export const api = {
  auth: {
    signup: (data: SignupInput) =>
      request<{ user: User }>("/auth/signup", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    login: (data: LoginInput) =>
      request<{ user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    logout: () =>
      request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
    me: () => request<{ user: User }>("/auth/me"),
  },
  pages: {
    list: () =>
      request<{ pages: Page[] }>("/pages"),
    get: (id: string) =>
      request<{ page: Page }>(`/pages/${id}`),
    create: (data: CreatePageInput) =>
      request<{ page: Page }>("/pages", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: UpdatePageInput) =>
      request<{ page: Page }>(`/pages/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/pages/${id}`, { method: "DELETE" }),
  },
  blocks: {
    get: (pageId: string) =>
      request<{ content: any[] | null }>(`/blocks/${pageId}`),
    save: (pageId: string, content: any[]) =>
      request<{ ok: boolean }>(`/blocks/${pageId}`, {
        method: "PUT",
        body: JSON.stringify({ content }),
      }),
  },
  databases: {
    create: (data: CreateDatabaseInput) =>
      request<{ page: Page }>("/databases", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    get: (pageId: string) =>
      request<{ properties: DatabaseProperty[]; rows: DatabaseRowWithCells[] }>(
        `/databases/${pageId}`
      ),
    createProperty: (pageId: string, data: CreatePropertyInput) =>
      request<{ property: DatabaseProperty }>(
        `/databases/${pageId}/properties`,
        { method: "POST", body: JSON.stringify(data) }
      ),
    updateProperty: (
      pageId: string,
      propertyId: string,
      data: UpdatePropertyInput
    ) =>
      request<{ property: DatabaseProperty }>(
        `/databases/${pageId}/properties/${propertyId}`,
        { method: "PATCH", body: JSON.stringify(data) }
      ),
    deleteProperty: (pageId: string, propertyId: string) =>
      request<{ ok: boolean }>(
        `/databases/${pageId}/properties/${propertyId}`,
        { method: "DELETE" }
      ),
    reorderProperties: (pageId: string, propertyIds: string[]) =>
      request<{ ok: boolean }>(
        `/databases/${pageId}/properties/reorder`,
        { method: "PUT", body: JSON.stringify({ propertyIds }) }
      ),
    createRow: (pageId: string, data?: CreateRowInput) =>
      request<{ row: DatabaseRowWithCells }>(`/databases/${pageId}/rows`, {
        method: "POST",
        body: JSON.stringify(data || {}),
      }),
    deleteRow: (pageId: string, rowId: string) =>
      request<{ ok: boolean }>(`/databases/${pageId}/rows/${rowId}`, {
        method: "DELETE",
      }),
    updateCell: (
      pageId: string,
      rowId: string,
      propertyId: string,
      data: UpdateCellInput
    ) =>
      request<{ cell: DatabaseCellValue }>(
        `/databases/${pageId}/rows/${rowId}/cells/${propertyId}`,
        { method: "PUT", body: JSON.stringify(data) }
      ),
  },
};
