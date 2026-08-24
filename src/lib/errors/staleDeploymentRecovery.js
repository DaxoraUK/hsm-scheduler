const STALE_CHUNK_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /chunkloaderror/i,
  /loading chunk [\w-]+ failed/i,
];

function messageFrom(error) {
  return String(error?.message || error?.reason?.message || error || "").trim();
}

export function isStaleDeploymentChunkError(error) {
  const message = messageFrom(error);
  return STALE_CHUNK_PATTERNS.some((pattern) => pattern.test(message));
}

function recoveryKey(error) {
  const message = messageFrom(error);
  const asset = message.match(/https?:\/\/[^\s"']+\/assets\/[^\s"']+/i)?.[0];
  return `daxora:chunk-recovery:${asset || message.slice(0, 180)}`;
}

export function recoverStaleDeploymentChunk(error, targetWindow = typeof window === "undefined" ? null : window) {
  if (!targetWindow || !isStaleDeploymentChunkError(error)) return false;
  const key = recoveryKey(error);
  try {
    if (targetWindow.sessionStorage?.getItem(key)) return false;
    targetWindow.sessionStorage?.setItem(key, new Date().toISOString());
  } catch {
    // A refresh is still the safest recovery when browser storage is unavailable.
  }
  targetWindow.location?.reload?.();
  return true;
}

export function installStaleDeploymentRecovery(targetWindow = typeof window === "undefined" ? null : window) {
  if (!targetWindow?.addEventListener) return () => {};
  const handlePreloadError = (event) => {
    if (!isStaleDeploymentChunkError(event?.payload)) return;
    event.preventDefault?.();
    recoverStaleDeploymentChunk(event.payload, targetWindow);
  };
  targetWindow.addEventListener("vite:preloadError", handlePreloadError);
  return () => targetWindow.removeEventListener("vite:preloadError", handlePreloadError);
}
