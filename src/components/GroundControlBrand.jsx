import React from "react";
import { GroundControlMark } from "./BrandSplash.jsx";

export default function GroundControlBrand() {
  return (
    <div
      className="flex items-center gap-3.5"
      aria-label="Ground Control Operations Platform"
    >
      <GroundControlMark
        className="h-16 w-16 shrink-0"
        title="Ground Control"
      />

      <div className="min-w-0">
        <div className="text-[17px] font-black uppercase leading-[0.95] tracking-[0.12em] text-white">
          Ground
        </div>

        <div className="mt-1.5 text-[17px] font-black uppercase leading-[0.95] tracking-[0.12em] text-[#f15b4d]">
          Control
        </div>

        <div className="mt-2 whitespace-nowrap text-[7px] font-black uppercase tracking-[0.28em] text-slate-500">
          Operations Platform
        </div>
      </div>
    </div>
  );
}
