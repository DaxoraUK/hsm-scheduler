import { lazy, Suspense, useEffect } from "react";
import AppCore from "./AppCore.jsx";
import ProductShell from "./layout/ProductShell.jsx";
import { buildDaxoraAppEntry, getDaxoraSurface } from "./lib/platform/platformUrls.js";
import { applyAppMetadata } from "./lib/platform/publicMetadata.js";

const TeamFeePayAcquisitionDemo = lazy(() =>
  import("./demo/teamfeepay/TeamFeePayAcquisitionDemo.jsx")
);
const DaxoraLandingPage = lazy(() => import("./pages/DaxoraLandingPage.jsx"));
const DaxoraPublicPage = lazy(() => import("./pages/DaxoraPublicPage.jsx"));

const PUBLIC_PAGES = new Set(["pricing", "security", "privacy", "terms", "contact"]);

function requestedPublicPage() {
  if (typeof window === "undefined") return "";
  const page = window.location.pathname.replace(/^\/+|\/+$/g, "").toLowerCase();
  return PUBLIC_PAGES.has(page) ? page : "";
}

function acquisitionDemoEnabled() {
  if (import.meta.env.DEV) return true;
  return String(import.meta.env.VITE_ENABLE_ACQUISITION_DEMO ?? "").toLowerCase() === "true";
}

function acquisitionDemoRequested() {
  if (!acquisitionDemoEnabled() || typeof window === "undefined") return false;
  const path = window.location.pathname.replace(/\/+$/, "").toLowerCase();
  const query = new URLSearchParams(window.location.search);
  return path === "/teamfeepay-demo" || query.get("demo") === "teamfeepay";
}

function DemoLoadingState() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <div className="max-w-md text-center">
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-emerald-300">
          Daxora Ground Control
        </p>
        <p className="mt-3 text-lg">Loading the private strategic demonstration…</p>
      </div>
    </main>
  );
}

export default function App() {
  const surface = getDaxoraSurface();
  useEffect(() => {
    if (surface === "app") applyAppMetadata();
  }, [surface]);

  if (acquisitionDemoRequested()) {
    return (
      <Suspense fallback={<DemoLoadingState />}>
        <TeamFeePayAcquisitionDemo />
      </Suspense>
    );
  }

  if (surface === "public") {
    const publicPage = requestedPublicPage();
    return (
      <Suspense fallback={<DemoLoadingState />}>
        {publicPage ? <DaxoraPublicPage page={publicPage} /> : <DaxoraLandingPage
            onSignIn={() => window.location.assign(buildDaxoraAppEntry("signin"))}
            onCreateAccount={() => window.location.assign(buildDaxoraAppEntry("signup"))}
          />}
      </Suspense>
    );
  }

  return <AppCore />;
}

export { ProductShell };
