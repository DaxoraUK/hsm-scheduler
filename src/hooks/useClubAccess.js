import { useCallback, useEffect, useMemo, useState } from "react";
import { DB, isSupaConfigured } from "../lib/supabase.js";
import { getUserScopedItem, setUserScopedItem } from "../lib/storage/tenantStorage.js";

const ACTIVE_CLUB_KEY = "selected";

export function useClubAccess(authSession) {
  const [memberships, setMemberships] = useState([]);
  const [activeClubId, setActiveClubId] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [canBootstrap, setCanBootstrap] = useState(false);

  const userId = authSession?.user?.id || "";

  const refresh = useCallback(async () => {
    if (!authSession?.access_token || !userId) {
      setMemberships([]);
      setActiveClubId("");
      setStatus("idle");
      setCanBootstrap(false);
      setError("");
      return [];
    }

    if (!isSupaConfigured()) {
      setStatus("error");
      setError("Supabase environment configuration is missing.");
      return [];
    }

    setStatus("loading");
    setError("");

    try {
      const nextMemberships = await DB.listMemberships();
      setMemberships(nextMemberships);

      if (!nextMemberships.length) {
        const bootstrap = await DB.getBootstrapStatus();
        setCanBootstrap(Boolean(bootstrap?.can_bootstrap));
        setActiveClubId("");
        setStatus(
          bootstrap?.can_bootstrap
            ? "bootstrap"
            : bootstrap?.workspace_unclaimed
              ? "bootstrap-locked"
              : "denied"
        );
        return [];
      }

      setCanBootstrap(false);
      const savedClubId = getUserScopedItem(userId, ACTIVE_CLUB_KEY, "");
      const selected = nextMemberships.find((membership) => membership.clubId === savedClubId)
        || nextMemberships[0];

      setActiveClubId(selected.clubId);
      setUserScopedItem(userId, ACTIVE_CLUB_KEY, selected.clubId);
      setStatus("ready");
      return nextMemberships;
    } catch (loadError) {
      setMemberships([]);
      setActiveClubId("");
      setCanBootstrap(false);
      setStatus("error");
      setError(loadError?.message || "Club access could not be verified.");
      return [];
    }
  }, [authSession?.access_token, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectClub = useCallback((clubId) => {
    const next = memberships.find((membership) => membership.clubId === clubId);
    if (!next || !userId) return false;
    setActiveClubId(next.clubId);
    setUserScopedItem(userId, ACTIVE_CLUB_KEY, next.clubId);
    setStatus("ready");
    setError("");
    return true;
  }, [memberships, userId]);

  const bootstrapFirstWorkspace = useCallback(async ({ clubName, organisationName } = {}) => {
    setStatus("loading");
    setError("");
    try {
      await DB.bootstrapFirstClub({ clubName, organisationName });
      return await refresh();
    } catch (bootstrapError) {
      setStatus("bootstrap");
      setError(bootstrapError?.message || "The existing workspace could not be secured.");
      return [];
    }
  }, [refresh]);

  const activeMembership = useMemo(
    () => memberships.find((membership) => membership.clubId === activeClubId) || null,
    [activeClubId, memberships]
  );

  return {
    memberships,
    activeMembership,
    activeClubId,
    status,
    error,
    canBootstrap,
    refresh,
    selectClub,
    bootstrapFirstWorkspace,
  };
}
