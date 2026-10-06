import { useCallback, useEffect, useRef, useState } from "react";
import { DB } from "../lib/supabase.js";

const EMPTY_ROWS = [];

export function useWorkspaceSecurity(clubId, enabled = true) {
  const [snapshot, setSnapshot] = useState(null);
  const [load, setLoad] = useState({ clubId: null, status: "idle", error: "" });
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++generation.current;
    if (!clubId || !enabled) {
      setSnapshot(null);
      setLoad({ clubId, status: "idle", error: "" });
      return;
    }
    setLoad({ clubId, status: "loading", error: "" });
    try {
      const [members, invitations, supportSessions, auditEvents] = await Promise.all([
        DB.listClubMembers(clubId),
        DB.listClubInvitations(clubId),
        DB.listSupportSessions(clubId),
        DB.listAuditEvents(clubId, 60),
      ]);
      if (request !== generation.current) return;
      setSnapshot({ clubId, members, invitations, supportSessions, auditEvents });
      setLoad({ clubId, status: "ready", error: "" });
    } catch (loadError) {
      if (request !== generation.current) return;
      setLoad({ clubId, status: "error", error: loadError?.message || "Workspace security information could not be loaded." });
    }
  }, [clubId, enabled]);

  useEffect(() => {
    refresh();
    return () => { generation.current += 1; };
  }, [refresh]);

  // Never render a cached previous-club collection, including before the new effect runs.
  const visible = enabled && clubId && snapshot?.clubId === clubId ? snapshot : null;
  const currentLoad = enabled && clubId && load.clubId === clubId ? load : null;
  return {
    members: visible?.members || EMPTY_ROWS,
    invitations: visible?.invitations || EMPTY_ROWS,
    supportSessions: visible?.supportSessions || EMPTY_ROWS,
    auditEvents: visible?.auditEvents || EMPTY_ROWS,
    status: currentLoad?.status || (enabled && clubId ? "loading" : "idle"),
    error: currentLoad?.error || "",
    refresh,
  };
}
