import { createFileRoute, redirect } from "@tanstack/react-router";
import { api, ApiError } from "@/lib/api";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    try {
      await api.auth.me();
      throw redirect({ to: "/app" });
    } catch (e) {
      if (e instanceof ApiError) {
        throw redirect({ to: "/login" });
      }
      throw e;
    }
  },
});
