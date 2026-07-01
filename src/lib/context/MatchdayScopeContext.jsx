import React, { createContext, useContext, useMemo } from "react";
import {
  MATCHDAY_SCOPES,
  getDayTabFromScope,
  getMatchdayScopeLabel,
  normaliseMatchdayScope,
} from "../domain/matchdayScope.js";

const MatchdayScopeContext = createContext({
  scope: MATCHDAY_SCOPES.WEEKEND,
  scopeLabel: "Weekend",
  setScope: () => {},
  setWeekend: () => {},
  setSaturday: () => {},
  setSunday: () => {},
  getNavigationDay: () => MATCHDAY_SCOPES.SATURDAY,
});

export function MatchdayScopeProvider({ scope, setScope, children }) {
  const normalisedScope = normaliseMatchdayScope(scope);

  const value = useMemo(
    () => ({
      scope: normalisedScope,
      scopeLabel: getMatchdayScopeLabel(normalisedScope),
      setScope: (nextScope) => setScope?.(normaliseMatchdayScope(nextScope)),
      setWeekend: () => setScope?.(MATCHDAY_SCOPES.WEEKEND),
      setSaturday: () => setScope?.(MATCHDAY_SCOPES.SATURDAY),
      setSunday: () => setScope?.(MATCHDAY_SCOPES.SUNDAY),
      getNavigationDay: (fallback) => getDayTabFromScope(normalisedScope, fallback),
    }),
    [normalisedScope, setScope]
  );

  return (
    <MatchdayScopeContext.Provider value={value}>
      {children}
    </MatchdayScopeContext.Provider>
  );
}

export function useMatchdayScope() {
  return useContext(MatchdayScopeContext);
}

export default MatchdayScopeContext;
