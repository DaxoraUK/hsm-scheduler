import { lazy, Suspense } from "react";
import AppCore from "./AppCore.jsx";
import ProductShell from "./layout/ProductShell.jsx";
import { buildDaxoraAppEntry, getDaxoraSurface } from "./lib/platform/platformUrls.js";

const TeamFeePayAcquisitionDemo = lazy(() =>
  import("./demo/teamfeepay/TeamFeePayAcquisitionDemo.jsx")
);
const DaxoraLandingPage = lazy(() => import("./pages/DaxoraLandingPage.jsx"));

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
  if (acquisitionDemoRequested()) {
    return (
      <Suspense fallback={<DemoLoadingState />}>
        <TeamFeePayAcquisitionDemo />
      </Suspense>
    );
  }

  if (getDaxoraSurface() === "public") {
    return (
      <Suspense fallback={<DemoLoadingState />}>
        <DaxoraLandingPage
          onSignIn={() => window.location.assign(buildDaxoraAppEntry("signin"))}
          onCreateAccount={() => window.location.assign(buildDaxoraAppEntry("signup"))}
        />
      </Suspense>
    );
  }

  return <AppCore />;
}

export { ProductShell };
