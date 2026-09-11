import { useCallback, useEffect, useMemo, useState } from "react";
import { DB, isSupaConfigured } from "../lib/supabase.js";
import { readMatchdayLock, writeMatchdayLock } from "../lib/operations/matchdayLock.js";

export function useMatchdayLocks({ clubId, satDate, sunDate, midweekDate, canOperate, cloud = isSupaConfigured(), database = DB }) {
  const dates = useMemo(() => ({ saturday: satDate, sunday: sunDate, midweek: midweekDate }), [satDate, sunDate, midweekDate]);
  const [records, setRecords] = useState({});
  const key = useCallback((scope) => `${clubId || "local"}:${scope}:${dates[scope]}`, [clubId, dates]);
  useEffect(() => {
    let active = true;
    const refresh = () => Promise.all(Object.entries(dates).filter(([, date]) => date).map(async ([scope, date]) => {
      try {
        const value = cloud && clubId
          ? await database.getMatchdayLock(clubId, { dayScope: scope, matchdayDate: date })
          : { locked: readMatchdayLock({ clubId, day: scope, date }) };
        if (active) setRecords((previous) => ({ ...previous, [key(scope)]: { ...value, loaded: true } }));
      } catch (error) {
        if (active) setRecords((previous) => ({ ...previous, [key(scope)]: { loaded: false, error: error.message } }));
      }
    }));
    void refresh();
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, [clubId, cloud, database, dates, key]);
  const locks = Object.fromEntries(Object.keys(dates).map((scope) => [scope, records[key(scope)] || { loaded: false }]));
  const canEdit = (scope) => Boolean(canOperate && locks[scope]?.loaded && !locks[scope]?.locked);
  const setLock = useCallback(async (scope, locked, details = {}) => {
    if (!canOperate) throw new Error("Scheduling access required");
    if (!dates[scope]) throw new Error("Select a matchday date");
    const value = cloud && clubId
      ? await database.setMatchdayLock(clubId, { dayScope: scope, matchdayDate: dates[scope], locked, ...details })
      : { locked: writeMatchdayLock({ clubId, day: scope, date: dates[scope] }, locked) };
    setRecords((previous) => ({ ...previous, [key(scope)]: { ...value, loaded: true } }));
    return value;
  }, [canOperate, clubId, cloud, database, dates, key]);
  return { locks, canEdit, setLock };
}
