import { useCallback, useEffect, useState } from "react";
import { DB } from "../lib/supabase.js";
import { normaliseSubscriptionPayload } from "../lib/subscriptions/entitlements.js";

export function useClubEntitlements(clubId, enabled = true) {
  const [state, setState] = useState({
    status: "idle",
    subscription: null,
    error: "",
  });

  const refresh = useCallback(async () => {
    if (!enabled || !clubId) {
      setState({ status: "idle", subscription: null, error: "" });
      return null;
    }

    setState((current) => ({ ...current, status: "loading", error: "" }));
    try {
      const payload = await DB.getClubSubscription(clubId);
      const subscription = normaliseSubscriptionPayload(payload || {});
      setState({ status: "ready", subscription, error: "" });
      return subscription;
    } catch (error) {
      setState({
        status: "error",
        subscription: null,
        error: error?.message || "Subscription access could not be verified",
      });
      return null;
    }
  }, [clubId, enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    ...state,
    refresh,
  };
}
