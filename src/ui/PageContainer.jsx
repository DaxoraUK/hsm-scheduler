import React from "react";

export default function PageContainer({ children, className = "" }) {
  return (
    <main className={`mx-auto w-full max-w-7xl space-y-6 ${className}`}>
      {children}
    </main>
  );
}
