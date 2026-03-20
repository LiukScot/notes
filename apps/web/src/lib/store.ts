import { create } from "zustand";
import type { User } from "@notes/shared";

interface AppState {
  user: User | null;
  sidebarOpen: boolean;
  setUser: (user: User | null) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  sidebarOpen: true,
  setUser: (user) => set({ user }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
