import React, { useRef, useState } from 'react';
import PitchSettingsPanel from '../../src/components/Settings/PitchSettingsPanel.jsx';
import MatchdayTimelineCard from '../../src/components/Operations/shared/MatchdayTimelineCard.jsx';
import { scheduleFixtureDay } from '../../src/lib/scheduler.js';
import { prepareScopedScheduleDraft } from '../../src/lib/scheduling/prepareScopedScheduleDraft.js';
import { applyFixtureMoveTransaction } from '../../src/lib/scheduling/fixtureMove.js';
import { applyFixtureOverrides, getFixtureFlowIdentity } from '../../src/lib/domain/fixtureVenueFlow.js';
import { isFixtureSchedulingDemand } from '../../src/lib/domain/fixtureLifecycle.js';
import { setTenantStorageContext } from '../../src/lib/storage/tenantStorage.js';
import { writeMatchdayScheduleDraft, readMatchdayScheduleDraft } from '../../src/lib/storage/matchdayScheduleDraft.js';
import { migratePitches } from '../../src/lib/pitches.js';
import { getParkingSnapshot } from '../../src/lib/engines/parkingEngine.js';
import { calculateOfficialsReadiness } from '../../src/lib/engines/officialsEngine.js';
import { modelFixture, modelTeam } from './capacitySchedulingFixtures.js';

const context = { userId: 'synthetic-user', clubId: 'synthetic-club' };
const scope = { context, dayKey: 'saturday', matchDate: '2026-10-10' };
const resources = Object.freeze({ status: 'disabled' });
const club = { startHour: 9, startMin: 0, endHour: 13, endMin: 0, maxConcurrent: 3, bufferYouth: 15, carParkSpaces: 1, useAstro: true };
export const flowSources = [...Array.from({ length: 12 }, (_, i) => modelFixture({ id: 'source:' + i, sourceFixtureKey: 'source:' + i, homeTeam: 'U10 Team ' + i, awayTeam: 'Visitors ' + i, cfg: modelTeam({ id: 'team-' + i, name: 'U10 Team ' + i }), cars: 10, ref: 'Official ' + i, refStatus: 'confirmed' })), modelFixture({ id: 'away', sourceFixtureKey: 'away', status: 'away', venueRole: 'away' }), modelFixture({ id: 'postponed', sourceFixtureKey: 'postponed', status: 'postponed' })];

// Local-only synthetic fixture repository; never calls a live database or import.
export function CapacityFlowHarness({ failSave = false, report = () => {} }) {
  const [pitches, setPitches] = useState([{ id: 'AST', label: 'Astro', format: '5v5', surface: 'astro', independent: false }]);
  const [rows, setRows] = useState([]), [overrides, setOverrides] = useState({}), [feedback, setFeedback] = useState('');
  const savedSettings = useRef(null), current = useRef({ rows, overrides, pitches });
  current.current = { rows, overrides, pitches };
  const saveDraft = result => !failSave && writeMatchdayScheduleDraft({ ...scope, scheduled: result.fixtures || result.scheduled, unresolved: result.unresolved || [], overrides: result.overrides });
  const commit = result => { current.current = { ...current.current, rows: result.fixtures, overrides: result.overrides }; setRows(result.fixtures); setOverrides(result.overrides); };
  const move = async request => {
    const result = await applyFixtureMoveTransaction({ request, getCurrent: () => ({ fixtures: current.current.rows, overrides: current.current.overrides, pitchCfg: current.current.pitches, club, matchDate: scope.matchDate }), loadResources: async () => resources, writeDraft: saveDraft, commitState: commit });
    setFeedback(result.ok ? 'Move applied' : result.reason); report(result); return result;
  };
  const build = async () => {
    setTenantStorageContext(context);
    const all = applyFixtureOverrides(flowSources, current.current.overrides);
    const result = await prepareScopedScheduleDraft({ ...scope, all, away: all.filter(f => f.status === 'away'), overrides: current.current.overrides,
      loadResources: async () => resources, writeDraft: args => !failSave && writeMatchdayScheduleDraft(args),
      schedule: resourceContext => scheduleFixtureDay({ fixtures: all, cfgList: all.map(f => f.cfg), useAstro: true, pitchCfg: current.current.pitches, startMins: 540, endMins: 780, maxConcurrent: 3, club, matchDate: scope.matchDate, resourceContext }) });
    if (result.ok) { current.current.rows = result.scheduled; setRows(result.scheduled); }
    setFeedback(result.ok ? 'Schedule rebuilt' : result.reason); return result.ok;
  };
  const active = rows.filter(isFixtureSchedulingDemand);
  const parking = getParkingSnapshot({ fixtures: active, club, pitchCfg: pitches });
  const officials = calculateOfficialsReadiness({ fixtures: active, active });
  return <main>
    <h1>Synthetic scheduling checks — no club data</h1>
    <PitchSettingsPanel pitchCfg={pitches} setPitchCfg={setPitches} subscription={{ limits: { pitches: 50 } }} club={{}} saveTab={async (_, data) => { if (failSave) return false; savedSettings.current = JSON.stringify(data.pitchCfg); return true; }} />
    <button onClick={build}>Build synthetic schedule</button>
    <button onClick={() => setPitches(p => p.map(pitch => pitch.id === 'AST' ? { ...pitch, availabilityByDay: { saturday: [{ from: '09:00', to: '14:00' }] } } : pitch))}>Open extra hour for a legal move</button>
    <button onClick={() => { const draft = readMatchdayScheduleDraft(scope); if (savedSettings.current) setPitches(migratePitches(JSON.parse(savedSettings.current))); if (draft) { setRows(draft.scheduled); setOverrides(draft.overrides); } }}>Reload saved settings and draft</button>
    <button onClick={() => move({ fixtureIdentity: getFixtureFlowIdentity(current.current.rows.find(isFixtureSchedulingDemand)), patch: { koMins: 540 }, expectedPreviousPatch: { koMins: -1 } })}>Try stale move</button>
    <output data-flow-state>{JSON.stringify({ pitches, rows, overrides, parkingCount: parking.fixtureCount, officialsCount: officials.metrics.fixtures })}</output>
    <p role="status" data-flow-feedback>{feedback}</p>
    <MatchdayTimelineCard games={rows} pitchCfg={pitches} club={club} matchDate={scope.matchDate} resourceContext={resources} onMoveRequest={move} />
  </main>;
}
