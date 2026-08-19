import { lazy, Suspense } from "react";
import AppCore from "./AppCore.jsx";
import ProductShell from "./layout/ProductShell.jsx";

const TeamFeePayAcquisitionDemo = lazy(() =>
  import("./demo/teamfeepay/TeamFeePayAcquisitionDemo.jsx")
);

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

  return <AppCore />;
}

export { ProductShell };
