import { useCallback, useEffect, useState } from "react";
import { DB } from "../lib/supabase.js";

export function useWorkspaceSecurity(clubId, enabled = true) {
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [supportSessions, setSupportSessions] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!clubId || !enabled) {
      setMembers([]);
      setInvitations([]);
      setSupportSessions([]);
      setAuditEvents([]);
      setStatus("idle");
      setError("");
      return;
    }

    setStatus("loading");
    setError("");
    try {
      const [nextMembers, nextInvitations, nextSupport, nextAudit] = await Promise.all([
        DB.listClubMembers(clubId),
        DB.listClubInvitations(clubId),
        DB.listSupportSessions(clubId),
        DB.listAuditEvents(clubId, 60),
      ]);
      setMembers(nextMembers);
      setInvitations(nextInvitations);
      setSupportSessions(nextSupport);
      setAuditEvents(nextAudit);
      setStatus("ready");
    } catch (loadError) {
      setStatus("error");
      setError(loadError?.message || "Workspace security information could not be loaded.");
    }
  }, [clubId, enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    members,
    invitations,
    supportSessions,
    auditEvents,
    status,
    error,
    refresh,
  };
}
