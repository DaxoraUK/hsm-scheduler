import { useState } from "react";
import AppCore from "../../AppCore.jsx";
import { Auth } from "../../lib/supabase.js";
import {
  activateTeamFeePayAppDemo,
  resetTeamFeePayAppDemo,
} from "./teamfeepayAppDemoDb.js";
import { ACQUISITION_DEMO_AUTH } from "./teamfeepayRealDemoData.js";

activateTeamFeePayAppDemo();
Auth.saveSession(ACQUISITION_DEMO_AUTH);

function DemoNotice({ onDismiss }) {
  return (
    <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-950">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
            Private TeamFeePay acquisition demonstration
          </div>
          <div className="mt-1 text-sm font-semibold">
            This is the real Daxora application using synthetic club and league data. No TeamFeePay production connection is active.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              resetTeamFeePayAppDemo();
              window.location.reload();
            }}
            className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-black text-emerald-900"
          >
            Reset demo
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white"
          >
            Enter Ground Control
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TeamFeePayAcquisitionDemo() {
  const [noticeVisible, setNoticeVisible] = useState(true);

  return (
    <div className="min-h-screen bg-slate-50">
      {noticeVisible ? <DemoNotice onDismiss={() => setNoticeVisible(false)} /> : null}
      <AppCore />
    </div>
  );
}
