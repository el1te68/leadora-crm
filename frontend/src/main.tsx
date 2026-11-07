import { StrictMode, Suspense, lazy, useEffect, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Navigate, RouterProvider, useLocation } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import "./styles/index.css";
import { useAuth, useUi } from "./store";
import { api, ApiError } from "./lib/api";
import type { Me } from "./lib/types";
import { AppShell } from "./components/shell/AppShell";
import { PageSkeleton } from "./pages/common";

const Landing = lazy(() => import("./pages/Landing"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MyDay = lazy(() => import("./pages/MyDay"));
const Deals = lazy(() => import("./pages/Deals"));
const DealDetail = lazy(() => import("./pages/DealDetail"));
const Contacts = lazy(() => import("./pages/Contacts"));
const ContactDetail = lazy(() => import("./pages/ContactDetail"));
const Companies = lazy(() => import("./pages/Companies"));
const CompanyDetail = lazy(() => import("./pages/CompanyDetail"));
const Activities = lazy(() => import("./pages/Activities"));
const Automations = lazy(() => import("./pages/Automations"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

function RequireAuth({ children }: { children: ReactNode }) {
  const token = useAuth((s) => s.token);
  const setUser = useAuth((s) => s.setUser);
  const location = useLocation();
  useEffect(() => {
    if (token) api.get<Me>("/auth/me").then(setUser).catch(() => undefined);
  }, [token, setUser]);
  if (!token) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  return <>{children}</>;
}

const page = (el: ReactNode) => <Suspense fallback={<PageSkeleton />}>{el}</Suspense>;

const router = createBrowserRouter([
  { path: "/", element: <Suspense fallback={null}><Landing /></Suspense> },
  { path: "/login", element: <Suspense fallback={null}><Auth mode="login" /></Suspense> },
  { path: "/register", element: <Suspense fallback={null}><Auth mode="register" /></Suspense> },
  { path: "/invite/:token", element: <Suspense fallback={null}><Auth mode="invite" /></Suspense> },
  {
    path: "/app",
    element: <RequireAuth><AppShell /></RequireAuth>,
    children: [
      { index: true, element: page(<Dashboard />) },
      { path: "my-day", element: page(<MyDay />) },
      { path: "deals", element: page(<Deals />) },
      { path: "deals/:id", element: page(<DealDetail />) },
      { path: "contacts", element: page(<Contacts />) },
      { path: "contacts/:id", element: page(<ContactDetail />) },
      { path: "companies", element: page(<Companies />) },
      { path: "companies/:id", element: page(<CompanyDetail />) },
      { path: "activities", element: page(<Activities />) },
      { path: "automations", element: page(<Automations />) },
      { path: "settings/:tab?", element: page(<Settings />) },
      { path: "*", element: page(<NotFound />) },
    ],
  },
  { path: "*", element: <Suspense fallback={null}><NotFound standalone /></Suspense> },
]);

function Root() {
  const theme = useUi((s) => s.theme);
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster dir="rtl" position="bottom-left" theme={theme} richColors={false} closeButton toastOptions={{ duration: 3500 }} />
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
