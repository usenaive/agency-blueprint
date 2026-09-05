import "@fontsource-variable/inter";
import "./app.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import { Shell } from "./Shell";
import { AgencyAgents } from "./screens/AgencyAgents";
import { Approvals } from "./screens/Approvals";
import { ClientAgents } from "./screens/ClientAgents";
import { ClientCalendar } from "./screens/ClientCalendar";
import { ClientConnections } from "./screens/ClientConnections";
import { ClientOverview } from "./screens/ClientOverview";
import { ClientPosts } from "./screens/ClientPosts";
import { ClientWorkspace } from "./screens/ClientWorkspace";
import { Clients } from "./screens/Clients";
import { Crm } from "./screens/Crm";
import { Settings } from "./screens/Settings";

const router = createBrowserRouter([
  {
    path: "/",
    Component: Shell,
    children: [
      { index: true, element: <Navigate to="/crm" replace /> },
      { path: "crm", Component: Crm },
      { path: "approvals", Component: Approvals },
      { path: "agents", Component: AgencyAgents },
      { path: "clients", Component: Clients },
      {
        path: "clients/:id",
        Component: ClientWorkspace,
        children: [
          { index: true, element: <Navigate to="overview" replace /> },
          { path: "overview", Component: ClientOverview },
          { path: "connections", Component: ClientConnections },
          { path: "calendar", Component: ClientCalendar },
          { path: "agents", Component: ClientAgents },
          { path: "posts", Component: ClientPosts },
        ],
      },
      { path: "settings", Component: Settings },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
