import { useEffect, useState } from "react";

function readOnlineState() {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

export function useConnectivity() {
  const [online, setOnline] = useState(readOnlineState);
  const [changedAt, setChangedAt] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const update = () => {
      setOnline(readOnlineState());
      setChangedAt(new Date().toISOString());
    };

    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return { online, changedAt };
}
