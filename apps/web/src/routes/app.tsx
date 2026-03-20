import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { api, ApiError } from "@/lib/api";
import { Sidebar } from "@/components/layout/Sidebar";
import { useAppStore } from "@/lib/store";

export const Route = createFileRoute("/app")({
  beforeLoad: async ({ context }) => {
    try {
      const { user } = await api.auth.me();
      return { user };
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        throw redirect({ to: "/login" });
      }
      throw e;
    }
  },
  component: AppLayout,
});

function AppLayout() {
  const { user } = Route.useRouteContext();
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setUser = useAppStore((s) => s.setUser);

  useEffect(() => {
    if (user) setUser(user);
  }, [user, setUser]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--color-bg)" }}>
      {sidebarOpen && <Sidebar />}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
