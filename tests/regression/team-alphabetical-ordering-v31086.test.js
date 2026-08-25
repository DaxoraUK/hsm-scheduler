import { describe, expect, test } from "vitest";
import {
  sortTeamEntriesAlphabetically,
  sortTeamsAlphabetically,
} from "../../src/lib/teams/teamOrdering.js";

describe("team display ordering", () => {
  test("sorts names naturally without mutating the stored scheduling order", () => {
    const stored = [
      { id: "u14", name: "U14 Spartans", ageOrder: 2 },
      { id: "adult", name: "HSM 1st Team", ageOrder: 1 },
      { id: "u8", name: "U8 Sharks", ageOrder: 3 },
      { id: "u10", name: "U10 Wanderers", ageOrder: 4 },
    ];

    expect(sortTeamsAlphabetically(stored).map((team) => team.name)).toEqual([
      "HSM 1st Team",
      "U8 Sharks",
      "U10 Wanderers",
      "U14 Spartans",
    ]);
    expect(stored.map((team) => team.id)).toEqual(["u14", "adult", "u8", "u10"]);
    expect(stored.map((team) => team.ageOrder)).toEqual([2, 1, 3, 4]);
  });

  test("keeps original edit indices when a settings list is alphabetised", () => {
    const entries = [
      { team: { name: "U16 Bears" }, index: 0 },
      { team: { name: "HSM Reserves" }, index: 1 },
    ];

    expect(sortTeamEntriesAlphabetically(entries).map(({ index }) => index)).toEqual([1, 0]);
  });
});
