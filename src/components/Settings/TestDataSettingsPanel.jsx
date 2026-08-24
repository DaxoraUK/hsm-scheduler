import React, { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Save, TestTube2, Trash2 } from "lucide-react";
import { getFixtureDayDefinition } from "../../lib/domain/fixtureDay.js";
import {
  TEST_DATA_SCENARIOS,
  createFixtureTeamKey,
  createTestDataSeed,
  generateTestFixtures,
} from "../../lib/testData/testFixtureGenerator.js";
import { DB, isSupaConfigured } from "../../lib/supabase.js";
import { tenantSetJson } from "../../lib/storage/tenantStorage.js";
import { isMidweekEnabled } from "../../lib/settings/workspaceSettings.js";
import {
  Field,
  Notice,
  PrimaryButton,
  SecondaryButton,
  SettingsPanel,
  SettingsSectionHeader,
  inputClass,
  selectClass,
} from "./SettingsPrimitives.jsx";

function blankFixture(dayKey) {
  return {
    homeTeam: "",
    awayTeam: "",
    league: "",
    isCup: false,
    status: "active",
    referee: "",
    refPhone: "",
    refStatus: "TBC",
    fixtureDayKey: dayKey,
    __day: dayKey,
  };
}

const ALL_DAY_OPTIONS = [
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
  { key: "midweek", label: "Midweek" },
];

export default function TestDataSettingsPanel({
  testSat = [],
  setTestSat,
  testSun = [],
  setTestSun,
  testMidweek = [],
  setTestMidweek,
  club = {},
  teamCfg = [],
  refs = [],
  activeClubId = "",
}) {
  const dayOptions = useMemo(
    () =>
      ALL_DAY_OPTIONS.filter(
        (option) => option.key !== "midweek" || isMidweekEnabled(club),
      ),
    [club],
  );
  const [dayKey, setDayKey] = useState(dayOptions[0]?.key || "saturday");
  const [scenario, setScenario] = useState("standard");
  const [seed, setSeed] = useState("ground-control-demo");
  const [saved, setSaved] = useState("");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!dayOptions.some((option) => option.key === dayKey)) {
      setDayKey(dayOptions[0]?.key || "saturday");
    }
  }, [dayKey, dayOptions]);

  const collections = {
    saturday: { list: testSat, setList: setTestSat },
    sunday: { list: testSun, setList: setTestSun },
    midweek: { list: testMidweek, setList: setTestMidweek },
  };
  const active = collections[dayKey] || collections.saturday;
  const list = active.list || [];
  const setList = active.setList;
  const definition = getFixtureDayDefinition(dayKey);

  const update = (index, field, value) => {
    setList?.((current) =>
      current.map((fixture, rowIndex) =>
        rowIndex === index ? { ...fixture, [field]: value } : fixture,
      ),
    );
  };

  const selectHomeTeam = (index, homeTeam) => {
    const team = teamCfg.find((candidate) =>
      `${club.name || "Ground Control FC"} ${candidate.name}` === homeTeam,
    );
    setList?.((current) => current.map((fixture, rowIndex) => rowIndex === index
      ? {
          ...fixture,
          homeTeam,
          homeTeamId: team?.id || team?.teamId || "",
          homeTeamKey: createFixtureTeamKey(team),
          teamId: team?.id || team?.teamId || "",
        }
      : fixture));
  };

  const generate = (nextSeed = seed) => {
    const safeSeed =
      String(nextSeed || "ground-control-demo").trim() || "ground-control-demo";
    setSeed(safeSeed);
    setList?.(
      generateTestFixtures({
        dayKey,
        seed: safeSeed,
        scenario,
        club,
        teams: teamCfg,
        officials: refs,
      }),
    );
    setSaved("");
  };

  const generateNew = () => generate(createTestDataSeed(dayKey));

  const save = async () => {
    setSaveError("");
    const storageKey =
      dayKey === "sunday"
        ? "testSunday"
        : dayKey === "midweek"
          ? "testMidweek"
          : "testSaturday";

    tenantSetJson(storageKey, list);

    try {
      if (isSupaConfigured() && activeClubId) {
        await DB.saveTestFixtures(
          activeClubId,
          definition.remoteConfigKey,
          list,
        );
      }

      setSaved(dayKey);
      window.setTimeout(() => setSaved(""), 2200);
    } catch (error) {
      setSaveError(
        error?.message || "The demonstration fixtures could not be saved.",
      );
    }
  };

  return (
    <SettingsPanel>
      <SettingsSectionHeader
        icon={TestTube2}
        eyebrow="Development only"
        title="Demonstration fixtures"
        description="Generate repeatable fixture sets for light, standard or high-pressure product demonstrations. This page disappears in production mode."
      />

      <div className="mt-5 flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-1.5">
        {dayOptions.map((option) => {
          const count = collections[option.key]?.list?.length || 0;
          const activeDay = dayKey === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => setDayKey(option.key)}
              className={`rounded-xl px-4 py-2 text-sm font-black transition ${activeDay ? "bg-slate-950 text-white shadow" : "text-slate-500 hover:text-slate-900"}`}
            >
              {option.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="mt-5 space-y-3">
        <Notice tone="warning">
          Generated fixtures are development records only. A seed recreates the
          same fixture set, which keeps demonstrations and regression checks
          repeatable.
        </Notice>
        {saveError ? <Notice tone="danger">{saveError}</Notice> : null}
      </div>

      <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-5 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-2">
          <Field
            label="Scenario"
            hint={
              TEST_DATA_SCENARIOS.find((option) => option.value === scenario)
                ?.description
            }
          >
            <select
              className={selectClass}
              value={scenario}
              onChange={(event) => setScenario(event.target.value)}
            >
              {TEST_DATA_SCENARIOS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Seed"
            hint="Reuse this value whenever you need to recreate the same fixture set."
          >
            <input
              className={inputClass}
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
            />
          </Field>
        </div>
        <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-end">
          <SecondaryButton
            className="sm:min-w-44"
            icon={RefreshCw}
            onClick={() => generate(seed)}
          >
            Rebuild same set
          </SecondaryButton>
          <PrimaryButton
            className="sm:min-w-44"
            icon={RefreshCw}
            onClick={generateNew}
          >
            Generate new set
          </PrimaryButton>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {list.map((fixture, index) => (
          <article
            key={fixture.id || `${fixture.homeTeam}-${index}`}
            className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5 sm:p-6"
          >
            <div className="grid gap-x-4 gap-y-5 lg:grid-cols-2 xl:grid-cols-3">
              <Field label="Home team">
                <select
                  className={selectClass}
                  value={fixture.homeTeam || ""}
                  onChange={(event) =>
                    selectHomeTeam(index, event.target.value)
                  }
                >
                  <option value="">Select team…</option>
                  {teamCfg.map((team) => {
                    const full = `${club.name || "Ground Control FC"} ${team.name}`;
                    return (
                      <option key={team.name} value={full}>
                        {team.name}
                      </option>
                    );
                  })}
                </select>
              </Field>
              <Field label="Opposition">
                <input
                  className={inputClass}
                  value={fixture.awayTeam || ""}
                  onChange={(event) =>
                    update(index, "awayTeam", event.target.value)
                  }
                  placeholder="Opposition"
                />
              </Field>
              <Field label="League">
                <input
                  className={inputClass}
                  value={fixture.league || ""}
                  onChange={(event) =>
                    update(index, "league", event.target.value)
                  }
                  placeholder="League"
                />
              </Field>
              <div className="flex items-end justify-between gap-3 lg:col-span-2 xl:col-span-3">
                <label className="flex h-11 min-w-28 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 text-sm font-black text-slate-700">
                  <input
                    type="checkbox"
                    checked={!!fixture.isCup}
                    onChange={(event) =>
                      update(index, "isCup", event.target.checked)
                    }
                    className="h-5 w-5 rounded border-slate-300"
                  />{" "}
                  Cup fixture
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setList?.((current) =>
                      current.filter((_, rowIndex) => rowIndex !== index),
                    )
                  }
                  className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 text-sm font-black text-rose-600 transition hover:bg-rose-50"
                  aria-label="Remove demonstration fixture"
                >
                  <Trash2 size={18} /> Remove
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {!list.length ? (
        <div className="mt-5 rounded-[22px] border border-dashed border-slate-300 p-8 text-center text-sm font-semibold text-slate-500">
          No demonstration fixtures for this day. Generate a scenario or add one
          manually.
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-5">
        <PrimaryButton
          icon={Plus}
          onClick={() =>
            setList?.((current) => [...current, blankFixture(dayKey)])
          }
        >
          Add fixture
        </PrimaryButton>
        <SecondaryButton icon={Save} onClick={save}>
          {saved === dayKey ? "Saved" : `Save ${definition.label}`}
        </SecondaryButton>
      </div>
    </SettingsPanel>
  );
}
