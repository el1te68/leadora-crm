import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Me } from "@/lib/types";

interface AuthState {
  token: string | null;
  user: Me | null;
  workspaceId: string | null;
  setSession: (token: string, user: Me) => void;
  setUser: (user: Me) => void;
  setWorkspace: (id: string) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      workspaceId: null,
      setSession: (token, user) => {
        const current = get().workspaceId;
        const keep = current && user.workspaces.some((w) => w.id === current) ? current : user.workspaces[0]?.id ?? null;
        set({ token, user, workspaceId: keep });
      },
      setUser: (user) => {
        const current = get().workspaceId;
        set({ user, workspaceId: current && user.workspaces.some((w) => w.id === current) ? current : user.workspaces[0]?.id ?? null });
      },
      setWorkspace: (id) => set({ workspaceId: id }),
      logout: () => set({ token: null, user: null, workspaceId: null }),
    }),
    { name: "leadora-auth" },
  ),
);

export const useActiveWorkspace = () => {
  const user = useAuth((s) => s.user);
  const id = useAuth((s) => s.workspaceId);
  return user?.workspaces.find((w) => w.id === id) ?? null;
};

type Theme = "light" | "dark";
interface UiState {
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  paletteOpen: boolean;
  shortcutsOpen: boolean;
  theme: Theme;
  toggleSidebar: () => void;
  setMobileNav: (v: boolean) => void;
  setPalette: (v: boolean) => void;
  setShortcuts: (v: boolean) => void;
  setTheme: (t: Theme) => void;
}

const initialTheme = (): Theme => (typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "dark" : "light");

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      mobileNavOpen: false,
      paletteOpen: false,
      shortcutsOpen: false,
      theme: initialTheme(),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setMobileNav: (v) => set({ mobileNavOpen: v }),
      setPalette: (v) => set({ paletteOpen: v }),
      setShortcuts: (v) => set({ shortcutsOpen: v }),
      setTheme: (theme) => {
        document.documentElement.classList.toggle("dark", theme === "dark");
        try {
          localStorage.setItem("leadora-theme", theme);
        } catch {
          /* private mode */
        }
        set({ theme });
      },
    }),
    { name: "leadora-ui", partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }) },
  ),
);
