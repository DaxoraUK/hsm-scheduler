import React from "react";

export default function CardShell({ children, className = "", padded = true }) {
  return (
    <section
      className={`overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm ${className}`}
    >
      <div className={padded ? "p-6" : ""}>{children}</div>
    </section>
  );
}
