import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DB, isSupaConfigured } from "../lib/supabase.js";
import { normaliseLeagueAccess } from "../lib/league/leagueManagerModel.js";
import { getUserScopedItem, setUserScopedItem } from "../lib/storage/tenantStorage.js";
import { isRecoverableAccessVerificationError } from "../lib/errors/recovery.js";

const ACTIVE_LEAGUE_KEY = "league-selected";
const INVITE_QUERY_KEY = "league_invite";

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
    // A malformed browser URL must not block normal workspace access.
  }
}

export function useLeagueAccess(authSession) {
  const [leagues, setLeagues] = useState([]);
  const [activeLeagueId, setActiveLeagueId] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const verifiedRef = useRef({ userId: "", leagues: [], activeLeagueId: "" });
  const userId = authSession?.user?.id || "";

  const refresh = useCallback(async () => {
    if (!authSession?.access_token || !userId) {
      verifiedRef.current = { userId: "", leagues: [], activeLeagueId: "" };
      setLeagues([]);
      setActiveLeagueId("");
      setStatus("idle");
      setError("");
      return [];
    }

    if (!isSupaConfigured()) {
      setStatus("error");
      setError("Supabase environment configuration is missing.");
      return [];
    }

    const previous = verifiedRef.current;
    const hasVerified = previous.userId === userId && previous.leagues.length > 0;
    setStatus(hasVerified ? "ready" : "loading");
    setError("");

    try {
      const inviteToken = readInviteToken();
      if (inviteToken) {
        await DB.acceptLeagueInvitation(inviteToken);
        clearInviteToken();
      }

      const nextLeagues = (await DB.listAccessibleLeagues())
        .map(normaliseLeagueAccess)
        .filter((league) => league.leagueId && league.status !== "closed");

      setLeagues(nextLeagues);
      if (!nextLeagues.length) {
        verifiedRef.current = { userId, leagues: [], activeLeagueId: "" };
        setActiveLeagueId("");
        setStatus("empty");
        return [];
      }

      const savedLeagueId = getUserScopedItem(userId, ACTIVE_LEAGUE_KEY, "");
      const selected = nextLeagues.find((league) => league.leagueId === savedLeagueId) || nextLeagues[0];
      verifiedRef.current = { userId, leagues: nextLeagues, activeLeagueId: selected.leagueId };
      setActiveLeagueId(selected.leagueId);
      setUserScopedItem(userId, ACTIVE_LEAGUE_KEY, selected.leagueId);
      setStatus("ready");
      return nextLeagues;
    } catch (loadError) {
      const canKeepVerified = previous.userId === userId
        && previous.leagues.length > 0
        && isRecoverableAccessVerificationError(loadError);
      if (canKeepVerified) {
        setLeagues(previous.leagues);
        setActiveLeagueId(previous.activeLeagueId);
        setStatus("ready");
        setError("");
        return previous.leagues;
      }

      verifiedRef.current = { userId: "", leagues: [], activeLeagueId: "" };
      setLeagues([]);
      setActiveLeagueId("");
      setStatus("error");
      setError(loadError?.message || "League Manager access could not be verified.");
      return [];
    }
  }, [authSession?.access_token, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectLeague = useCallback((leagueId, availableLeagues = leagues) => {
    const candidates = Array.isArray(availableLeagues) ? availableLeagues : leagues;
    const selected = candidates.find((league) => league.leagueId === leagueId);
    if (!selected || !userId) return false;
    verifiedRef.current = { userId, leagues: candidates, activeLeagueId: selected.leagueId };
    setLeagues(candidates);
    setActiveLeagueId(selected.leagueId);
    setUserScopedItem(userId, ACTIVE_LEAGUE_KEY, selected.leagueId);
    setStatus("ready");
    setError("");
    return true;
  }, [leagues, userId]);

  const activeLeague = useMemo(
    () => leagues.find((league) => league.leagueId === activeLeagueId) || null,
    [activeLeagueId, leagues],
  );

  return {
    leagues,
    activeLeague,
    activeLeagueId,
    status,
    error,
    refresh,
    selectLeague,
  };
}
