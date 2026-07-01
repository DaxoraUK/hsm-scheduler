import React, { useEffect, useState } from "react";
import {
  X,
  Clock,
  MapPin,
  UserCheck,
  MessageSquareText,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Car,
  Printer,
  ClipboardList,
  Building2,
  Radio,
  History,
  Sparkles,
} from "lucide-react";
import { cleanName } from "../../../lib/scheduler.js";
import { sortPitches } from "../../../lib/pitches.js";
import {
  getFixtureHealth,
  getFixtureRecommendations,
  timeToMinutes,
  getFixtureDuration,
} from "../../../lib/operationsEngine.js";
import { getOperationsImpact } from "../../../lib/engines/recommendationEngine.js";
import StatusChip from "../../ui/StatusChip.jsx";
import PrimaryButton from "../../ui/PrimaryButton.jsx";

export default function FixtureDrawer({
  fixture,
  fixtures = [],
  club,
  refs = [],
  pitchCfg = [],
  closedPitches = [],
  onOverride,
  onClose,
}) {
  const [blockedMove, setBlockedMove] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    setBlockedMove(null);
    setActiveTab("overview");
  }, [fixture?.__index]);

  if (!fixture) return null;

  const teamName = cleanName(fixture.homeTeam, club?.name);
  const opposition = fixture.awayTeam || "TBC";
  const pendingPatch = blockedMove?.pendingPatch || {};
  const displayFixture = { ...fixture, ...pendingPatch };

  const pitchLabel =
    displayFixture.pitchLabel || displayFixture.pitchId || "TBC";

  const format =
    fixture.cfg?.format || fixture.manualFormat || fixture.format || "Fixture";

  const fixtureIndex = typeof fixture.__index === "number" ? fixture.__index : 0;
  const canEdit = typeof onOverride === "function";

  const closeDrawer = () => {
    setBlockedMove(null);
    onClose?.();
  };

  const applyFixturePatch = (patch) => {
    Object.entries(patch).forEach(([field, value]) => {
      onOverride(fixtureIndex, field, value);
    });
  };

  const buildPatch = (field, value) => {
    if (field === "koTime") {
      const koMins = timeToMinutes(value);
      const duration = getFixtureDuration({
        ...fixture,
        ...(blockedMove?.pendingPatch || {}),
        koTime: value,
        koMins,
        endMins: null,
      });

      return {
        koTime: value,
        koMins,
        endMins: koMins != null ? koMins + duration : fixture.endMins,
      };
    }

    if (field === "pitchId") {
      const pitch = pitchCfg.find((item) => item.id === value);

      return {
        pitchId: value,
        pitchLabel: pitch?.label || value,
      };
    }

    return { [field]: value };
  };

  const updateFixturePatch = (patch) => {
    if (!canEdit) return;

    const impact = getOperationsImpact({
      fixtures,
      fixtureIndex,
      pitchCfg,
      closedPitches,
      club,
      start: club?.startTime,
      end: club?.endTime,
      patch,
    });

    if (!impact.ok) {
      setBlockedMove({
        ...impact,
        pendingPatch: patch,
      });
      return;
    }

    setBlockedMove(null);
    applyFixturePatch(patch);
  };

  const updateFixture = (field, value) => {
    const patch = buildPatch(field, value);
    updateFixturePatch(patch);
  };

  const applySuggestedTime = (time) => {
    updateFixturePatch({
      ...(blockedMove?.pendingPatch || {}),
      ...buildPatch("koTime", time),
    });
  };

  const applySuggestedPitch = (pitchId) => {
    updateFixturePatch({
      ...(blockedMove?.pendingPatch || {}),
      ...buildPatch("pitchId", pitchId),
    });
  };

  const applyValidatedRecommendation = (patch) => {
    updateFixturePatch({
      ...(blockedMove?.pendingPatch || {}),
      ...(patch || {}),
    });
  };

  const fixtureHealth = getFixtureHealth(displayFixture);
  const recommendations = getFixtureRecommendations(displayFixture);

  const healthColour =
    fixtureHealth.variant === "success"
      ? "text-emerald-700"
      : fixtureHealth.variant === "warning"
      ? "text-amber-700"
      : "text-red-700";

  const managerMessage = `Hi! ${teamName} are home.

KO: ${displayFixture.koTime || "TBC"}
Pitch: ${pitchLabel}
vs: ${opposition}
Referee: ${displayFixture.referee || "TBC"}

Please arrive in good time and let me know if there are any issues.`;

  const refereeMessage = `Hi ${displayFixture.referee || "there"},

Thanks for officiating.

Fixture: ${teamName} vs ${opposition}
KO: ${displayFixture.koTime || "TBC"}
Pitch: ${pitchLabel}

Please arrive around 20 minutes before kick-off.

Thanks.`;

  const parentMessage = `Morning everyone.

Today's fixture:

${teamName} vs ${opposition}
KO: ${displayFixture.koTime || "TBC"}
Pitch: ${pitchLabel}

Please arrive in good time. Parking may be busy around peak kick-off times.

Good luck!`;

  const tabs = [
    ["overview", "Overview", ClipboardList],
    ["operations", "Operations", Building2],
    ["messages", "Messages", MessageSquareText],
    ["history", "History", History],
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-sm">
      <button
        type="button"
        className="flex-1"
        onClick={closeDrawer}
        aria-label="Close fixture drawer"
      />

      <aside className="h-full w-full max-w-2xl overflow-y-auto bg-slate-50 shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs font-black uppercase tracking-[0.28em] text-emerald-700">
                  Match Control Centre
                </div>

                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                  {teamName} <span className="text-slate-400">vs</span>{" "}
                  {opposition}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeDrawer}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <X size={21} strokeWidth={2.5} />
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <StatusChip variant={fixtureHealth.pitchStatus.variant}>
                {fixtureHealth.pitchStatus.label}
              </StatusChip>

              <StatusChip variant="neutral">{format}</StatusChip>

              <StatusChip variant={fixtureHealth.officialStatus.variant}>
                {fixtureHealth.officialStatus.label}
              </StatusChip>

              {fixture.isCup && <StatusChip variant="warning">Cup</StatusChip>}
              {fixture.manual && <StatusChip variant="info">Manual</StatusChip>}
            </div>
          </div>

          <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
            <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
              {tabs.map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition ${
                    activeTab === key
                      ? "bg-slate-950 text-white shadow-sm"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon size={16} strokeWidth={2.5} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6 p-6">
          {activeTab === "overview" && (
            <>
              <DrawerSection
                icon={Sparkles}
                eyebrow="Overview"
                title="Operational Health"
                description="A live readiness score for this fixture."
              >
                <div className="flex items-center justify-between rounded-3xl bg-slate-50 p-5">
                  <div>
                    <div className={`text-5xl font-black ${healthColour}`}>
                      {fixtureHealth.score}%
                    </div>

                    <div className="mt-1 text-sm font-black text-slate-500">
                      {fixtureHealth.label}
                    </div>
                  </div>

                  {fixtureHealth.score >= 75 ? (
                    <CheckCircle2 className="text-emerald-600" size={38} />
                  ) : (
                    <AlertTriangle className="text-amber-600" size={38} />
                  )}
                </div>

                <div className="mt-4 grid gap-2">
                  {fixtureHealth.items.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200"
                    >
                      <span className="text-sm font-bold text-slate-700">
                        {item.label}
                      </span>

                      <span
                        className={`text-sm font-black ${
                          item.ok ? "text-emerald-700" : "text-amber-700"
                        }`}
                      >
                        {item.ok ? "OK" : "Review"}
                      </span>
                    </div>
                  ))}
                </div>
              </DrawerSection>

              <DrawerSection
                icon={ClipboardList}
                eyebrow="Scheduling"
                title="Fixture Controls"
                description={
                  canEdit
                    ? "Edit the operational details for this fixture."
                    : "Dashboard view is read-only. Open Operations to make changes."
                }
              >
                {!canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      closeDrawer();
                      window.dispatchEvent(
                        new CustomEvent("ground-control-open-operations", {
                          detail: {
                            day: String(
                              fixture.__day ||
                                fixture.day ||
                                fixture.cfg?.day ||
                                ""
                            )
                              .toLowerCase()
                              .includes("sunday")
                              ? "sunday"
                              : "saturday",
                          },
                        })
                      );
                    }}
                    className="mb-5 w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
                  >
                    Edit in Matchday Planner →
                  </button>
                )}

                {blockedMove && (
                  <BlockedMoveCard
                    blockedMove={blockedMove}
                    applySuggestedPitch={applySuggestedPitch}
                    applySuggestedTime={applySuggestedTime}
                    applyValidatedRecommendation={applyValidatedRecommendation}
                  />
                )}

                <div className="grid gap-4">
                  <ControlRow icon={ShieldCheck} label="Status">
                    {canEdit ? (
                      <select
                        value={displayFixture.status || "active"}
                        onChange={(e) => updateFixture("status", e.target.value)}
                        className="control-input"
                      >
                        <option value="active">Active</option>
                        <option value="postponed">Postponed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    ) : (
                      <ReadOnlyValue value={displayFixture.status || "active"} />
                    )}
                  </ControlRow>

                  <ControlRow icon={Clock} label="Kick off">
                    {canEdit ? (
                      <input
                        type="time"
                        value={displayFixture.koTime || ""}
                        onChange={(e) => updateFixture("koTime", e.target.value)}
                        className="control-input"
                      />
                    ) : (
                      <ReadOnlyValue value={displayFixture.koTime || "TBC"} />
                    )}
                  </ControlRow>

                  <ControlRow icon={MapPin} label="Pitch">
                    {canEdit ? (
                      <select
                        value={displayFixture.pitchId || ""}
                        onChange={(e) => updateFixture("pitchId", e.target.value)}
                        className="control-input"
                      >
                        <option value="">Select pitch...</option>
                        {sortPitches(pitchCfg).map((pitch) => {
                          const isClosed = closedPitches.includes(pitch.id);

                          return (
                            <option
                              key={pitch.id}
                              value={pitch.id}
                              disabled={isClosed}
                            >
                              {pitch.label}{isClosed ? " (Closed)" : ""}
                            </option>
                          );
                        })}
                      </select>
                    ) : (
                      <ReadOnlyValue value={pitchLabel} />
                    )}
                  </ControlRow>
                </div>
              </DrawerSection>

              <DrawerSection
                icon={UserCheck}
                eyebrow="Officials"
                title="Official Management"
                description="Track the referee or match official for this fixture."
              >
                <div className="grid gap-4">
                  <ControlRow icon={UserCheck} label="Official">
                    {canEdit ? (
                      <select
                        value={
                          refs.find(
                            (ref) =>
                              String(ref.name || "").replace(/\./g, "").trim().toLowerCase() ===
                              String(displayFixture.referee || "").replace(/\./g, "").trim().toLowerCase()
                          )?.name ||
                          displayFixture.referee ||
                          ""
                        }
                        onChange={(e) => {
                          const value = e.target.value;

                          const selectedRef = refs.find(
                            (ref) =>
                              String(ref.name || "").trim() ===
                              String(value || "").trim()
                          );

                          updateFixturePatch({
                            referee: value,
                            refPhone:
                              selectedRef?.phone ||
                              selectedRef?.mobile ||
                              selectedRef?.tel ||
                              selectedRef?.contact ||
                              selectedRef?.number ||
                              "",
                          });
                        }}
                        className="control-input"
                      >
                        <option value="">Select official...</option>
                        <option value="Parent Ref">Parent Ref</option>
                        {refs.map((ref) => (
                          <option key={ref.id || ref.name} value={ref.name}>
                            {ref.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <ReadOnlyValue value={displayFixture.referee || "TBC"} />
                    )}
                  </ControlRow>

                  <ControlRow icon={ShieldCheck} label="Official status">
                    {canEdit ? (
                      <select
                        value={displayFixture.refStatus || "TBC"}
                        onChange={(e) =>
                          updateFixture("refStatus", e.target.value)
                        }
                        className="control-input"
                      >
                        <option value="TBC">TBC</option>
                        <option value="Awaiting">Awaiting</option>
                        <option value="Confirmed">Confirmed</option>
                      </select>
                    ) : (
                      <ReadOnlyValue value={displayFixture.refStatus || "TBC"} />
                    )}
                  </ControlRow>

                  <ControlRow icon={Radio} label="Official phone">
                    {canEdit ? (
                      <input
                        value={displayFixture.refPhone || ""}
                        onChange={(e) =>
                          updateFixture("refPhone", e.target.value)
                        }
                        placeholder="07xxx..."
                        className="control-input"
                      />
                    ) : (
                      <ReadOnlyValue value={displayFixture.refPhone || "TBC"} />
                    )}
                  </ControlRow>
                </div>
              </DrawerSection>
            </>
          )}

          {activeTab === "operations" && (
            <>
              <DrawerSection
                icon={Building2}
                eyebrow="Facilities"
                title="Facilities & Resources"
                description="Operational resource view for this fixture."
              >
                <div className="grid gap-3">
                  <InfoRow icon={MapPin} label="Pitch" value={pitchLabel} />

                  <InfoRow
                    icon={Car}
                    label="Parking estimate"
                    value={fixtureHealth.parkingEstimate.label}
                  />

                  <InfoRow
                    icon={ShieldCheck}
                    label="League"
                    value={fixture.league || "Manual"}
                  />
                </div>
              </DrawerSection>

              <DrawerSection
                icon={AlertTriangle}
                eyebrow="Operations"
                title="Operations Intelligence"
                description="Decision support generated from the operations engine."
              >
                {recommendations.length === 0 ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
                    No major operational actions needed for this fixture.
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {recommendations.map((item, index) => (
                      <div
                        key={`${item.title}-${index}`}
                        className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
                      >
                        <div className="text-sm font-black text-amber-900">
                          {item.title}
                        </div>

                        <div className="mt-1 text-sm font-medium leading-6 text-amber-800">
                          {item.detail}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </DrawerSection>
            </>
          )}

          {activeTab === "messages" && (
            <DrawerSection
              icon={MessageSquareText}
              eyebrow="Communications"
              title="Fixture Messages"
              description="Ready-made updates for managers, officials and parents."
            >
              <div className="grid gap-4">
                <MessagePreview
                  title="Manager WhatsApp"
                  text={managerMessage}
                  buttonLabel="Copy Manager Message"
                />

                <MessagePreview
                  title="Referee Message"
                  text={refereeMessage}
                  buttonLabel="Copy Referee Message"
                />

                <MessagePreview
                  title="Parent Arrival Message"
                  text={parentMessage}
                  buttonLabel="Copy Parent Message"
                />

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-black text-slate-900">
                    Fixture Report
                  </div>

                  <div className="mt-1 text-sm font-medium leading-6 text-slate-500">
                    Dedicated fixture reports will be generated from the Reports
                    Centre.
                  </div>

                  <button
                    type="button"
                    disabled
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-400"
                  >
                    <Printer size={16} />
                    Available in Reports
                  </button>
                </div>
              </div>
            </DrawerSection>
          )}

          {activeTab === "history" && (
            <DrawerSection
              icon={History}
              eyebrow="History"
              title="Fixture History"
              description="Audit trail placeholder. This will connect to Supabase history later."
            >
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-500">
                History tracking will appear here once fixture-level audit events
                are wired into Ground Control.
              </div>
            </DrawerSection>
          )}
        </div>
      </aside>
    </div>
  );
}

function BlockedMoveCard({
  blockedMove,
  applySuggestedPitch,
  applySuggestedTime,
  applyValidatedRecommendation,
}) {
  const validatedRecommendations = blockedMove.validatedRecommendations || [];
  const hasValidatedRecommendations = validatedRecommendations.length > 0;
  const hasPitchSuggestions = blockedMove.pitchSuggestions?.length > 0;
  const hasTimeSuggestions = blockedMove.timeSuggestions?.length > 0;

  return (
    <div className="mb-5 overflow-hidden rounded-3xl border border-red-200 bg-white shadow-sm">
      <div className="border-b border-red-200 bg-red-50 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-100">
            <AlertTriangle
              className="text-red-700"
              size={20}
              strokeWidth={2.5}
            />
          </div>

          <div>
            <div className="text-xs font-black uppercase tracking-[0.22em] text-red-700">
              Operations Impact
            </div>

            <div className="mt-1 text-lg font-black text-slate-900">
              {blockedMove.title}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="text-sm font-medium leading-6 text-slate-600">
          {blockedMove.message}
        </div>

        {blockedMove.action && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-600">
            {blockedMove.action}
          </div>
        )}

        {blockedMove.conflict && (
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="mb-3 text-xs font-black uppercase tracking-wide text-slate-400">
              Existing Fixture
            </div>

            <div className="space-y-2">
              <InfoRow
                icon={ShieldCheck}
                label="Fixture"
                value={blockedMove.conflict.fixture}
              />

              <InfoRow
                icon={MapPin}
                label="Pitch"
                value={blockedMove.conflict.pitch}
              />

              <InfoRow
                icon={Clock}
                label="Kick Off"
                value={blockedMove.conflict.koTime}
              />

              {blockedMove.conflict.referee && (
                <InfoRow
                  icon={UserCheck}
                  label="Official"
                  value={blockedMove.conflict.referee}
                />
              )}
            </div>
          </div>
        )}


        {hasValidatedRecommendations && (
          <div>
            <div className="mb-3 text-xs font-black uppercase tracking-wide text-emerald-700">
              Validated Fixes
            </div>

            <div className="grid gap-2">
              {validatedRecommendations.map((recommendation) => (
                <button
                  type="button"
                  key={recommendation.id}
                  onClick={() => applyValidatedRecommendation(recommendation.patch)}
                  className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left transition hover:bg-emerald-100"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-black text-emerald-950">
                      {recommendation.title}
                    </span>
                    <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-700 shadow-sm">
                      Fix now
                    </span>
                  </div>
                  <div className="mt-1 text-xs font-bold leading-5 text-emerald-700">
                    {recommendation.detail}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {hasPitchSuggestions && (
          <div>
            <div className="mb-3 text-xs font-black uppercase tracking-wide text-emerald-700">
              Available Pitches
            </div>

            <div className="grid gap-2">
              {blockedMove.pitchSuggestions.map((pitch) => (
                <button
                  type="button"
                  key={pitch.pitchId}
                  onClick={() => applySuggestedPitch(pitch.pitchId)}
                  className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left transition hover:bg-emerald-100"
                >
                  <span className="font-black text-emerald-900">
                    {pitch.pitchLabel}
                  </span>

                  <span className="text-sm font-bold text-emerald-700">
                    Apply
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {hasTimeSuggestions && (
          <div>
            <div className="mb-3 text-xs font-black uppercase tracking-wide text-blue-700">
              Available Kick Offs
            </div>

            <div className="flex flex-wrap gap-2">
              {blockedMove.timeSuggestions.map((time) => (
                <button
                  type="button"
                  key={time}
                  onClick={() => applySuggestedTime(time)}
                  className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-black text-blue-800 transition hover:bg-blue-100"
                >
                  {time}
                </button>
              ))}
            </div>
          </div>
        )}

        {!hasValidatedRecommendations && !hasPitchSuggestions && !hasTimeSuggestions && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
            No automatic alternatives found. Try a later kick-off or assign a
            different official.
          </div>
        )}
      </div>
    </div>
  );
}

function DrawerSection({ icon: Icon, eyebrow, title, description, children }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <Icon size={20} strokeWidth={2.5} />
        </div>

        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">
            {eyebrow}
          </div>

          <div className="mt-1 font-black text-slate-950">{title}</div>

          {description && (
            <div className="mt-1 text-sm font-medium leading-6 text-slate-500">
              {description}
            </div>
          )}
        </div>
      </div>

      {children}
    </section>
  );
}

function ControlRow({ icon: Icon, label, children }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-400">
        <Icon size={15} strokeWidth={2.5} />
        {label}
      </div>

      {children}
    </div>
  );
}

function ReadOnlyValue({ value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black text-slate-600">
      {value || "TBC"}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
        <Icon size={20} strokeWidth={2.5} />
      </div>

      <div className="min-w-0">
        <div className="text-xs font-black uppercase tracking-wide text-slate-400">
          {label}
        </div>

        <div className="mt-0.5 truncate text-sm font-black text-slate-800">
          {value}
        </div>
      </div>
    </div>
  );
}

function MessagePreview({ title, text, buttonLabel }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-sm font-black text-slate-900">{title}</div>

      <div className="mt-3 whitespace-pre-line rounded-2xl bg-slate-50 p-4 text-sm font-medium leading-6 text-slate-600">
        {text}
      </div>

      <PrimaryButton
        className="mt-3 w-full"
        onClick={() => navigator.clipboard.writeText(text)}
      >
        {buttonLabel}
      </PrimaryButton>
    </div>
  );
}
