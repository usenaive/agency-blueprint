import "@fontsource-variable/inter";
import "./app.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Navigate, Outlet, RouterProvider, type RouteObject } from "react-router";
import type { AppId } from "../templates";
import { SCREENS } from "./apps";
import { Gate } from "./Gate";
import { ClientOverview } from "./screens/ClientOverview";
import { ClientPosts } from "./screens/ClientPosts";
import { ClientWorkspace, WorkClient } from "./screens/ClientWorkspace";

/** The app's pane; the Studio draws the frame, the rail and the head around it (ADR-1766). */
const Pane = () => <main className="pane min-h-dvh"><Outlet /></main>;

/**
 * One app's routes under `/app`: its screen, and the page for one client. The CRM holds the
 * clients, so its client page has the record; every other app knows a client by its work.
 */
function routesFor(app: AppId): RouteObject[] {
  const client: RouteObject = app === "crm"
    ? {
      path: "clients/:id",
      Component: ClientWorkspace,
      children: [
        { index: true, element: <Navigate to="overview" replace /> },
        { path: "overview", Component: ClientOverview },
        { path: "posts", Component: ClientPosts },
      ],
    }
    : { path: "work/:id", Component: WorkClient, children: [{ index: true, Component: ClientPosts }] };
  return [{ path: "/", Component: Pane, children: [{ index: true, Component: SCREENS[app].Component }, client, { path: "*", element: <Navigate to="/" replace /> }] }];
}

// The gate is outside the router on purpose: no screen mounts, and so no screen fetches, until
// `/api/session` says the browser is in and which app this is (`src/Gate.tsx`).
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Gate>
      {(app) => {
        document.title = SCREENS[app].label;
        return <RouterProvider router={createBrowserRouter(routesFor(app), { basename: "/app" })} />;
      }}
    </Gate>
  </StrictMode>,
);
