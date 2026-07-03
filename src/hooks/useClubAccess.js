import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DB, isSupaConfigured } from "../lib/supabase.js";
import { getUserScopedItem, setUserScopedItem } from "../lib/storage/tenantStorage.js";
import { isRecoverableAccessVerificationError } from "../lib/errors/recovery.js";

const ACTIVE_CLUB_KEY = "selected";
const INVITE_QUERY_KEY = "club_invite";

function readInviteToken() {
  if (typeof window === "undefined") return "";
  try {
    return new URL(window.location.href).searchParams.get(INVITE_QUERY_KEY)?.trim() || "";
  } catch {
    return "";
  }
}

function clearInviteToken() {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(INVITE_QUERY_KEY)) return;
    url.searchParams.delete(INVITE_QUERY_KEY);
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // A malformed browser URL must not prevent normal workspace access.
  }
}

export function useClubAccess(authSession) {
  const [memberships, setMemberships] = useState([]);
  const [activeClubId, setActiveClubId] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [canBootstrap, setCanBootstrap] = useState(false);
  const verifiedAccessRef = useRef({ userId: "", memberships: [], activeClubId: "" });

  const userId = authSession?.user?.id || "";

  const refresh = useCallback(async () => {
    if (!authSession?.access_token || !userId) {
      verifiedAccessRef.current = { userId: "", memberships: [], activeClubId: "" };
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

    const verifiedAccess = verifiedAccessRef.current;
    const hasVerifiedAccess = verifiedAccess.userId === userId
      && Boolean(verifiedAccess.activeClubId)
      && verifiedAccess.memberships.length > 0;

    // Background revalidation must not close an already verified workspace.
    setStatus(hasVerifiedAccess ? "ready" : "loading");
    setError("");

    try {
      let nextMemberships = await DB.listMemberships();
      const inviteToken = readInviteToken();

      if (inviteToken) {
        try {
          await DB.acceptClubInvitation(inviteToken);
          clearInviteToken();
          nextMemberships = await DB.listMemberships();
        } catch (inviteError) {
          if (!nextMemberships.length) throw inviteError;
          setError(inviteError?.message || "The club invitation could not be accepted.");
        }
      }

      setMemberships(nextMemberships);

      if (!nextMemberships.length) {
        verifiedAccessRef.current = { userId: "", memberships: [], activeClubId: "" };
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

      verifiedAccessRef.current = {
        userId,
        memberships: nextMemberships,
        activeClubId: selected.clubId,
      };
      setActiveClubId(selected.clubId);
      setUserScopedItem(userId, ACTIVE_CLUB_KEY, selected.clubId);
      setStatus("ready");
      return nextMemberships;
    } catch (loadError) {
      const verified = verifiedAccessRef.current;
      const canKeepVerifiedWorkspace = verified.userId === userId
        && Boolean(verified.activeClubId)
        && verified.memberships.length > 0
        && isRecoverableAccessVerificationError(loadError);

      if (canKeepVerifiedWorkspace) {
        setMemberships(verified.memberships);
        setActiveClubId(verified.activeClubId);
        setCanBootstrap(false);
        setStatus("ready");
        setError("");
        return verified.memberships;
      }

      verifiedAccessRef.current = { userId: "", memberships: [], activeClubId: "" };
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

  const selectClub = useCallback((clubId, availableMemberships = memberships) => {
    const candidates = Array.isArray(availableMemberships) ? availableMemberships : memberships;
    const next = candidates.find((membership) => membership.clubId === clubId);
    if (!next || !userId) return false;
    verifiedAccessRef.current = { userId, memberships: candidates, activeClubId: next.clubId };
    setMemberships(candidates);
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

  useEffect(() => {
    const expiresAt = activeMembership?.supportExpiresAt;
    if (!expiresAt) return undefined;
    const delay = new Date(expiresAt).getTime() - Date.now() + 500;
    if (!Number.isFinite(delay) || delay <= 0) {
      refresh();
      return undefined;
    }
    const timer = window.setTimeout(refresh, Math.min(delay, 2_147_000_000));
    return () => window.clearTimeout(timer);
  }, [activeMembership?.supportExpiresAt, refresh]);

  useEffect(() => {
    if (!authSession?.access_token || typeof window === "undefined") return undefined;

    const verifyAccess = () => {
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      if (typeof document === "undefined" || document.visibilityState === "visible") refresh();
    };

    window.addEventListener("focus", verifyAccess);
    window.addEventListener("online", verifyAccess);
    document?.addEventListener?.("visibilitychange", verifyAccess);

    const interval = activeMembership?.accessMode === "support"
      ? window.setInterval(refresh, 30_000)
      : null;

    return () => {
      window.removeEventListener("focus", verifyAccess);
      window.removeEventListener("online", verifyAccess);
      document?.removeEventListener?.("visibilitychange", verifyAccess);
      if (interval) window.clearInterval(interval);
    };
  }, [activeMembership?.accessMode, authSession?.access_token, refresh]);

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
