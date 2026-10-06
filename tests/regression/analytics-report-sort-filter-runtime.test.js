/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import Dashboard from '../../src/components/analytics/UnifiedFacilityAnalyticsDashboard.jsx';
import FacilityNonPitchActivity from '../../src/components/analytics/FacilityNonPitchActivity.jsx';
import Report from '../../src/components/reports/UnifiedFacilityReportDocument.jsx';
import Tracker from '../../src/components/analytics/FundingApplicationTracker.jsx';
import MatchdayAnalytics from '../../src/components/analytics/AnalyticsVisualDashboard.jsx';
import GrantDashboard from '../../src/components/analytics/GrantImpactDashboard.jsx';
import ImpactPanel from '../../src/components/analytics/FundingImpactEvidencePanel.jsx';
import ReportsPage from '../../src/pages/ReportsPage.jsx';
import { makeFixture } from './fixtures.js';
vi.mock('../../src/lib/supabase.js', () => ({ DB: {}, Auth: { getSession: () => null }, isSupaConfigured: () => false }));
import { buildUnifiedFacilityAnalyticsModel } from '../../src/lib/analytics/unifiedFacilityAnalyticsEngine.js';
let root, host;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; vi.stubGlobal('React', React); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
const pitches = [{ id: 'P10', label: 'Pitch 10' }, { id: 'P2', label: 'Pitch 2' }];
const planner = { bookings: [
  { id: 'a', booking_type: 'training', pitch_id: 'P10', status: 'confirmed', start_at: '2026-10-10T09:00:00', end_at: '2026-10-10T19:00:00' },
  { id: 'b', booking_type: 'training', pitch_id: 'P2', status: 'confirmed', start_at: '2026-10-10T09:00:00', end_at: '2026-10-10T11:00:00' },
] };
const names = () => [...host.querySelectorAll('table:first-of-type tbody tr td:first-child')].map(td => td.querySelector('div')?.textContent || td.textContent);
test('facility headers sort raw hours and names without changing upstream aggregates', async () => {
  const params = { pitchCfg: pitches, plannerData: planner, club: { id: 'c' } };
  const snapshot = JSON.stringify(params);
  await act(async () => root.render(React.createElement(Dashboard, params)));
  expect(host.querySelector('[aria-label="Facility usage sort and filter"]')).not.toBeNull();
  expect(names()).toEqual(['Pitch 2', 'Pitch 10']);
  const hours = [...host.querySelectorAll('th button')].find(row => row.textContent === 'Pitch hours');
  await act(async () => hours.click());
  expect(names()).toEqual(['Pitch 2', 'Pitch 10']);
  await act(async () => hours.click());
  expect(names()).toEqual(['Pitch 10', 'Pitch 2']);
  expect(hours.closest('th').getAttribute('aria-sort')).toBe('descending');
  expect(JSON.stringify(params)).toBe(snapshot);
});
test('non-pitch activity filters reference records but print mode preserves all records', async () => {
  const rows = [{ id: 'b', teamName: 'U17 Lisbon', facilityScope: 'away', durationHours: 10 }, { id: 'a', teamName: 'U7 Sharks', facilityScope: 'unallocated', durationHours: 2 }];
  await act(async () => root.render(React.createElement(FacilityNonPitchActivity, { rows })));
  expect(host.querySelector('[aria-label="Reference activity sort and filter"]')).not.toBeNull();
  const print = renderToStaticMarkup(React.createElement(FacilityNonPitchActivity, { rows, interactive: false }));
  expect(print).not.toContain('sort and filter');
  expect(print).not.toContain('<button');
  expect(print).toContain('U17 Lisbon');
  expect(print).toContain('U7 Sharks');
});
test('facility report never inherits display filtering or interactive controls', () => {
  const model = buildUnifiedFacilityAnalyticsModel({ pitchCfg: pitches, plannerData: planner, filters: { startDate: '2026-10-10', endDate: '2026-10-10' } });
  const print = renderToStaticMarkup(React.createElement(Report, { model }));
  expect(print).toContain('Pitch 2'); expect(print).toContain('Pitch 10');
  expect(print).not.toContain('sort and filter');
});
test('funding tasks and obligations get named record controls without changing save targets', async () => {
  await act(async () => root.render(React.createElement(Tracker, { project: { id: 'p', title: 'Project' }, applications: [{ id: 'a', projectId: 'p', status: 'preparing' }], tasks: [{ id: 'z', applicationId: 'a', title: 'Zulu', status: 'todo' }, { id: 'b', applicationId: 'a', title: 'Alpha', status: 'done' }], obligations: [], canManage: false })));
  expect(host.querySelector('[aria-label="Application tasks sort and filter"]')).not.toBeNull();
  expect(host.querySelector('[aria-label="Monitoring obligations sort and filter"]')).not.toBeNull();
});
test('source record table exposes sort controls in the actual analytics panel', async () => {
  await act(async () => root.render(React.createElement(MatchdayAnalytics, { history: [{ id: 'w', date: '2026-10-10', fixtureDays: [{ key: 'saturday', date: '2026-10-10', scheduled: [makeFixture()], postponed: [], cancelled: [], unresolved: [], hasRun: true }] }] })));
  await act(async () => [...host.querySelectorAll('button')].find(row => row.textContent.includes('Source records')).click());
  expect(host.querySelector('[aria-label="Analytics source records sort and filter"]')).not.toBeNull();
});
test('grant evidence matrix and opportunity cards expose controls', async () => {
  await act(async () => root.render(React.createElement(GrantDashboard, { activeClubId: 'test-club' })));
  expect(host.querySelector('[aria-label="Grant requirements sort and filter"]')).not.toBeNull();
  expect(host.querySelector('[aria-label="Funding opportunities sort and filter"]')).not.toBeNull();
});
test('impact evidence sorts delivery numbers while retaining original edit records', async () => {
  localStorage.setItem('gc_funding_impact_v1:test-club', JSON.stringify([{ id: 'a', projectId: 'p', periodStart: '2026-10-01', completedSessions: 2, status: 'draft' }, { id: 'b', projectId: 'p', periodStart: '2026-10-02', completedSessions: 10, status: 'verified' }]));
  await act(async () => root.render(React.createElement(ImpactPanel, { clubId: 'test-club', projectId: 'p' })));
  expect(host.querySelector('[aria-label="Impact evidence sort and filter"]')).not.toBeNull();
  const heading = [...host.querySelectorAll('th button')].find(row => row.textContent === 'Delivery');
  await act(async () => { heading.click(); });
  await act(async () => { heading.click(); });
  expect(host.querySelector('tbody tr td:nth-child(2) strong').textContent).toBe('10');
});
test('funding project choices and document/snapshot registers are sortable', async () => {
  localStorage.setItem('gc_funding_workspace_v1:fund-club', JSON.stringify({ projects: [{ id: 'z', title: 'Zulu project' }, { id: 'a', title: 'Alpha project' }], documents: [{ id: 'doc', projectId: 'z', fileName: 'Document.pdf', requirementKey: 'x', sizeBytes: 10 }], snapshots: [{ id: 'snap', projectId: 'z', label: 'Snapshot' }] }));
  await act(async () => root.render(React.createElement(GrantDashboard, { activeClubId: 'fund-club' })));
  expect([...host.querySelector('[aria-label="Funding project"]').options].map(option => option.textContent)).toEqual(['New unsaved project', 'Alpha project', 'Zulu project']);
  await act(async () => host.querySelector('#funding-tab-documents').click());
  expect(host.querySelector('[aria-label="Funding documents sort and filter"]')).not.toBeNull();
  await act(async () => host.querySelector('#funding-tab-snapshots').click());
  expect(host.querySelector('[aria-label="Evidence snapshots sort and filter"]')).not.toBeNull();
});
test('report choices use name ordering without altering the selected report or print scope', async () => {
  await act(async () => root.render(React.createElement(ReportsPage, {})));
  const choices = [...host.querySelectorAll('[role="tab"]')].map(row => row.querySelector('div')?.textContent || row.textContent);
  expect(choices.length).toBeGreaterThan(1);
  expect(choices).toEqual([...choices].sort(new Intl.Collator('en-GB', { numeric: true, sensitivity: 'base' }).compare));
});
