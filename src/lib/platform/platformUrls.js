const PRODUCTION_PUBLIC_URL = "https://www.daxora.co.uk";
const PRODUCTION_APP_URL = "https://app.daxora.co.uk";

function configuredUrl(key, fallback) {
  const value = String(import.meta.env?.[key] || fallback).trim();
  try {
    return new URL(value).origin;
  } catch {
    return fallback;
  }
}

export function getDaxoraPublicUrl() {
  return configuredUrl("VITE_DAXORA_PUBLIC_URL", PRODUCTION_PUBLIC_URL);
}

export function getDaxoraAppUrl() {
  return configuredUrl("VITE_DAXORA_APP_URL", PRODUCTION_APP_URL);
}

export function getDaxoraSurface(location = typeof window !== "undefined" ? window.location : null) {
  const hostname = String(location?.hostname || "").trim().toLowerCase();
  if (["daxora.co.uk", "www.daxora.co.uk"].includes(hostname)) return "public";
  if (hostname === "app.daxora.co.uk") return "app";
  return "combined";
}

export function buildDaxoraAppEntry(mode = "signin", location = typeof window !== "undefined" ? window.location : null) {
  const target = new URL(`/${mode === "signup" ? "signup" : "signin"}`, getDaxoraAppUrl());
  const sourceParams = new URLSearchParams(location?.search || "");
  for (const [key, value] of sourceParams.entries()) target.searchParams.append(key, value);
  return target.toString();
}

export function buildDaxoraPublicEntry() {
  return getDaxoraPublicUrl();
}
