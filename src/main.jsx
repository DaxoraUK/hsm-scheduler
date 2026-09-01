// main.jsx
// Entry point - mounts the App into the page.

import React from "react";
import ReactDOM from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import App from "./App.jsx";
import AppErrorBoundary from "./components/system/AppErrorBoundary.jsx";
import { DaxoraInteractionProvider } from "./contexts/DaxoraInteractionContext.jsx";
import { installStaleDeploymentRecovery } from "./lib/errors/staleDeploymentRecovery.js";
import "./index.css";

installStaleDeploymentRecovery();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <DaxoraInteractionProvider>
        <App />
        <Analytics />
        <SpeedInsights />
      </DaxoraInteractionProvider>
    </AppErrorBoundary>
  </React.StrictMode>
);
