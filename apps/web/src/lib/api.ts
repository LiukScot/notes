import type {
  User,
  Page,
  SignupInput,
  LoginInput,
  CreatePageInput,
  UpdatePageInput,
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
};
