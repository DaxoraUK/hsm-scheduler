import { useCallback, useEffect, useRef, useState } from "react";
import { DB } from "../lib/supabase.js";
import { normaliseSubscriptionPayload } from "../lib/subscriptions/entitlements.js";

function assertSubscriptionPayload(payload, clubId) {
  if (!payload || typeof payload !== "object") {
    throw new Error("No subscription record was returned for this club");
  }

  const payloadClubId = String(payload.club_id || payload.clubId || "").trim();
  const planCode = String(payload.plan_code || payload.planCode || "").trim();

  if (!payloadClubId || payloadClubId !== String(clubId)) {
    throw new Error("The subscription record could not be matched to this club");
  }
  if (!planCode) {
    throw new Error("The club subscription does not contain a valid plan");
  }
}

export function useClubEntitlements(clubId, enabled = true) {
  const requestVersionRef = useRef(0);
  const [state, setState] = useState({
    status: "idle",
    subscription: null,
    error: "",
  });

  const refresh = useCallback(async ({ silent = false } = {}) => {
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;

    if (!enabled || !clubId) {
      setState({ status: "idle", subscription: null, error: "" });
      return null;
    }

    if (!silent) {
      setState((current) => ({ ...current, status: "loading", error: "" }));
    }

    try {
      const payload = await DB.getClubSubscription(clubId);
      assertSubscriptionPayload(payload, clubId);
      const subscription = normaliseSubscriptionPayload(payload);
      if (requestVersionRef.current === requestVersion) {
        setState({ status: "ready", subscription, error: "" });
      }
      return subscription;
    } catch (error) {
      if (requestVersionRef.current === requestVersion) {
        setState({
          status: "error",
          subscription: null,
          error: error?.message || "Subscription access could not be verified",
        });
      }
      return null;
    }
  }, [clubId, enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);


  useEffect(() => {
    if (!enabled || !clubId || typeof window === "undefined") return undefined;

    const refreshAfterPackageChange = (event) => {
      const changedClubId = String(event?.detail?.clubId || "").trim();
      if (changedClubId && changedClubId !== String(clubId)) return;
      refresh({ silent: true });
    };

    window.addEventListener("ground-control-subscription-updated", refreshAfterPackageChange);
    return () => {
      window.removeEventListener("ground-control-subscription-updated", refreshAfterPackageChange);
    };
  }, [clubId, enabled, refresh]);

  useEffect(() => {
    if (!enabled || !clubId || typeof window === "undefined") return undefined;

    const refreshWhenActive = () => {
      if (document.visibilityState === "visible") refresh({ silent: true });
    };

    window.addEventListener("focus", refreshWhenActive);
    document.addEventListener("visibilitychange", refreshWhenActive);

    return () => {
      window.removeEventListener("focus", refreshWhenActive);
      document.removeEventListener("visibilitychange", refreshWhenActive);
    };
  }, [clubId, enabled, refresh]);

  return {
    ...state,
    refresh,
  };
}
