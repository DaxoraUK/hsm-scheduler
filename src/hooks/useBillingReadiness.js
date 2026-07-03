import { useCallback, useEffect, useState } from "react";
import { DB } from "../lib/supabase.js";
import { normaliseBillingReadiness } from "../lib/billing/billingModel.js";

export function useBillingReadiness(clubId, enabled = true) {
  const [state, setState] = useState({ status: "idle", billing: null, error: "" });

  const refresh = useCallback(async () => {
    if (!enabled || !clubId) {
      setState({ status: "idle", billing: null, error: "" });
      return null;
    }
    setState((current) => ({ ...current, status: "loading", error: "" }));
    try {
      const payload = await DB.getBillingLegalStatus(clubId);
      const billing = normaliseBillingReadiness(payload || {});
      setState({ status: "ready", billing, error: "" });
      return billing;
    } catch (error) {
      setState({ status: "error", billing: null, error: error?.message || "Billing readiness could not be verified" });
      return null;
    }
  }, [clubId, enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, refresh };
}
