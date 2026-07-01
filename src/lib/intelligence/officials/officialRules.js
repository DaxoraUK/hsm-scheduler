import { findOfficialClash } from "./officialService.js";

export function refereeClashRule({
  fixtures = [],
  fixtureIndex,
  next = {},
  refs = [],
} = {}) {
  const clash = findOfficialClash({
    fixtures,
    fixtureIndex,
    next,
    refs,
  });

  if (!clash) return null;

  return {
    ok: false,
    type: "referee_clash",
    rule: "refereeClashRule",
    severity: "blocked",
    reason: `${next.referee || clash.referee} is already allocated to ${
      clash.homeTeam || "another fixture"
    } at ${clash.koTime || "that time"}.`,
    clash,
  };
}
