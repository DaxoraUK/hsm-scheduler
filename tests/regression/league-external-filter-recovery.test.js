/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import FixtureCommand from '../../src/components/league/LeagueFixtureCommandWorkspace.jsx';
import Schedule from '../../src/components/league/LeagueScheduleWorkspace.jsx';

const payload = {
  version: { id: 'v', seasonId: 's', status: 'published' },
  entries: [{ id: 'fixture-1', seasonId: 's', divisionId: 'd', homeTeamId: 'a', awayTeamId: 'b', scheduledDate: '2026-10-10', kickOff: '10:00', venueId: '' }],
};
vi.mock('../../src/lib/supabase.js', () => ({ DB: {
  listLeagueScheduleVersions: async () => [payload.version],
  getLeagueScheduleVersion: async () => payload,
} }));
const workspace = {
  league: { id: 'l' }, access: { role: 'viewer' },
  seasons: [{ id: 's', name: 'Season', status: 'active', startDate: '2026-10-01', endDate: '2026-10-31' }],
  divisions: [{ id: 'd', seasonId: 's', name: 'Division' }],
  teams: [{ id: 'a', seasonId: 's', divisionId: 'd', name: 'Alpha', status: 'active' }, { id: 'b', seasonId: 's', divisionId: 'd', name: 'Beta', status: 'active' }],
  venues: [], clubs: [], fixtures: [], cups: [], cupTies: [], cupDivisions: [], cupRounds: [], cupVenues: [], cupTeamOverrides: [], playDates: [], fixtureWindows: [], blackouts: [],
};
const operations = { requirements: [], assignments: [], officials: [], availability: [], postponements: [] };
let host, root;
beforeEach(() => {
  vi.stubGlobal('React', React); globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear(); host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

test.each([
  [FixtureCommand, 'list', 'League fixtures', 'Team or venue'],
  [FixtureCommand, 'exceptions', 'Missing venues', 'Team or venue'],
  [Schedule, '', 'League schedule allocations', 'Find a team or venue'],
])('case %# clear and reset recover external filters without changing identities', async (Component, initialView, label, placeholder) => {
  await act(async () => root.render(React.createElement(Component, { leagueId: 'l', workspace, operations, canOperate: false, initialView })));
  const group = () => host.querySelector(`[aria-label="${label} sort and filter"]`);
  const query = () => host.querySelector(`input[placeholder="${placeholder}"]`);
  const setQuery = async value => act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(query(), value);
    query().dispatchEvent(new Event('input', { bubbles: true }));
  });
  const recovery = text => [...group().querySelectorAll('button')].find(button => button.textContent === text);
  expect(group()).not.toBeNull();
  const sort = group().querySelector('select[aria-label="Sort by"]');
  await act(async () => { sort.value = initialView === 'exceptions' ? 'date' : 'time'; sort.dispatchEvent(new Event('change', { bubbles: true })); });
  await act(async () => group().querySelector('[aria-label="Sort descending"]').click());
  await setQuery('not a configured team');
  expect(group().querySelector('[role="status"]').textContent).toMatch(/^0 of/);
  await act(async () => recovery('Clear filters').click());
  expect(query().value).toBe('');
  expect(group().querySelector('[role="status"]').textContent).toMatch(/^1 of/);
  expect(group().querySelector('select[aria-label="Sort by"]').value).toBe(initialView === 'exceptions' ? 'date' : 'time');
  expect(group().querySelector('[aria-label="Sort ascending"]')).not.toBeNull();
  await setQuery('Alpha');
  expect(recovery('Clear filters')).toBeDefined();
  if (Component === Schedule) expect(group().textContent).toContain('1 active filter');
  await act(async () => recovery('Reset view').click());
  expect(query().value).toBe('');
  expect(group().querySelector('select[aria-label="Sort by"]').value).toBe(Component === FixtureCommand && initialView === 'list' ? 'date' : 'team');
  expect(payload.entries[0].id).toBe('fixture-1');
  expect(payload.entries[0].kickOff).toBe('10:00');
});
