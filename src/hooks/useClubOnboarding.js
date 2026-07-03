import { useCallback, useEffect, useState } from "react";
import { DB } from "../lib/supabase.js";
import { normaliseOnboardingState } from "../lib/onboarding/onboardingEngine.js";

const EMPTY_STATE = normaliseOnboardingState();

export function useClubOnboarding(clubId, enabled = true) {
  const [onboarding, setOnboarding] = useState(EMPTY_STATE);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!clubId || !enabled) {
      setOnboarding(EMPTY_STATE);
      setStatus("idle");
      setError("");
      return EMPTY_STATE;
    }

    setStatus("loading");
    setError("");
    try {
      const result = normaliseOnboardingState(await DB.getClubOnboarding(clubId));
      setOnboarding(result);
      setStatus("ready");
      return result;
    } catch (loadError) {
      setStatus("error");
      setError(loadError?.message || "Onboarding status could not be loaded.");
      return EMPTY_STATE;
    }
  }, [clubId, enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const start = useCallback(async ({ forceRestart = false } = {}) => {
    if (!clubId) return EMPTY_STATE;
    setStatus("saving");
    setError("");
    try {
      const result = normaliseOnboardingState(
        await DB.startClubOnboarding(clubId, { forceRestart })
      );
      setOnboarding(result);
      setStatus("ready");
      return result;
    } catch (startError) {
      setStatus("error");
      setError(startError?.message || "Onboarding could not be started.");
      throw startError;
    }
  }, [clubId]);

  const saveProgress = useCallback(async ({ currentStep, completedSteps, draft }) => {
    if (!clubId) return EMPTY_STATE;
    setStatus("saving");
    setError("");
    try {
      const result = normaliseOnboardingState(
        await DB.saveClubOnboarding(clubId, { currentStep, completedSteps, draft })
      );
      setOnboarding(result);
      setStatus("ready");
      return result;
    } catch (saveError) {
      setStatus("error");
      setError(saveError?.message || "Onboarding progress could not be saved.");
      throw saveError;
    }
  }, [clubId]);

  const complete = useCallback(async ({ configuration, teams, pitches, draft }) => {
    if (!clubId) return EMPTY_STATE;
    setStatus("saving");
    setError("");
    try {
      const result = normaliseOnboardingState(
        await DB.completeClubOnboarding(clubId, {
          configuration,
          teams,
          pitches,
          draft,
        })
      );
      setOnboarding(result);
      setStatus("ready");
      return result;
    } catch (completeError) {
      setStatus("error");
      setError(completeError?.message || "Onboarding could not be completed.");
      throw completeError;
    }
  }, [clubId]);

  return {
    onboarding,
    status,
    error,
    refresh,
    start,
    saveProgress,
    complete,
  };
}
