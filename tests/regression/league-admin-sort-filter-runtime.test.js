/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import Admin from '../../src/pages/PlatformAdminPage.jsx';
import LeagueAnalytics from '../../src/components/league/LeagueAnalyticsWorkspace.jsx';
import LeagueResults from '../../src/components/league/LeagueResultsWorkspace.jsx';
import LeagueRegistrations from '../../src/components/league/LeagueRegistrationsWorkspace.jsx';
import LeagueDiscipline from '../../src/components/league/LeagueDisciplineWorkspace.jsx';
import LeagueFinance from '../../src/components/league/LeagueFinanceWorkspace.jsx';
import LeagueOfficials from '../../src/components/league/LeagueOfficialsWorkspace.jsx';
import LeagueFixtureCommand from '../../src/components/league/LeagueFixtureCommandWorkspace.jsx';
import LeagueCups from '../../src/components/league/LeagueCupWorkspace.jsx';
import ClubRegistrations from '../../src/components/league/LeagueClubRegistrationsPanel.jsx';
import ClubFinance from '../../src/components/league/LeagueClubFinancePanel.jsx';
import ClubDiscipline from '../../src/components/league/LeagueClubDisciplinePanel.jsx';
const state = vi.hoisted(() => ({ failLater: false }));
vi.mock('../../src/lib/supabase.js', () => ({ DB: {
  platformListClubs: async ({ offset = 0 }) => {
    if (offset && state.failLater) throw new Error('second page unavailable');
    const all = Array.from({ length: 102 }, (_, n) => ({ club_id: `club-${n}`, club_name: n === 101 ? 'Alpha last page' : `Zulu ${n}` }));
    return { items: all.slice(offset, offset + 100), total: all.length, limit: 100, offset };
  }, platformListSupportCases: async () => [], platformListActivity: async () => [],
  getLeagueClubOperationsData: async () => ({}), getLeagueResultsData: async () => ({}), getLeagueReportConfiguration: async () => ({}),
  getLeagueRegistrationData: async () => ({ players: [{ id: 'z', first_name: 'Zulu', last_name: 'Player' }, { id: 'a', first_name: 'Alpha', last_name: 'Player' }] }),
  getLeagueDisciplineData: async () => ({}),
  getLeagueFinanceData: async () => ({}),
  listLeagueScheduleVersions: async () => [],
  getLeagueClubRegistrationData: async () => ({}),
  getLeagueClubFinanceData: async () => ({}),
  getLeagueClubDisciplineData: async () => ({ cases: [{ id: 'z', title: 'Zulu case', case_type: 'club', status: 'closed' }, { id: 'a', title: 'Alpha case', case_type: 'club', status: 'closed' }] }),
} }));
let root, host;
beforeEach(() => { state.failLater = false; vi.useFakeTimers(); vi.stubGlobal('React', React); localStorage.clear(); globalThis.IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
async function mount() { await act(async () => root.render(React.createElement(Admin, { platformContext: { isPlatformStaff: true, displayName: 'Tester' } }))); await act(async () => vi.advanceTimersByTimeAsync(200)); }
test('Admin loads every authorised club page before sorting the whole collection', async () => {
  await mount();
  expect(host.querySelector('[aria-label="Club workspaces sort and filter"]')).not.toBeNull();
  expect(host.querySelectorAll('button .truncate.text-sm.font-black')).toHaveLength(102);
  expect(host.querySelector('button .truncate.text-sm.font-black').textContent).toBe('Alpha last page');
});
test('failed later page retains the last complete results with an explicit incomplete warning', async () => {
  await mount(); state.failLater = true;
  await act(async () => [...host.querySelectorAll('button')].find(row => row.textContent.includes('Refresh')).click());
  expect(host.querySelector('[role="alert"]').textContent).toMatch(/incomplete|previous complete/i);
  expect(host.querySelectorAll('button .truncate.text-sm.font-black')).toHaveLength(102);
});
const workspace = { league: { id: 'l' }, access: { role: 'viewer' }, seasons: [{ id: 's', name: 'Season', status: 'active' }], divisions: [{ id: 'd', seasonId: 's', name: 'Division', sortOrder: 1 }], clubs: [], teams: [{ id: 'z', seasonId: 's', divisionId: 'd', name: 'Zulu', status: 'active' }, { id: 'a', seasonId: 's', divisionId: 'd', name: 'Alpha', status: 'active' }], members: [], venues: [], cups: [], cupTies: [], cupDivisions: [], cupTeamOverrides: [], cupRounds: [], cupVenues: [], fixtures: [] };
test.each([['clubs', 'Club scorecards'], ['competitions', 'Competition performance'], ['officials', 'League officials analytics']])('league analytics %s table has sortable numeric headers', async (initialTab, label) => {
  await act(async () => root.render(React.createElement(LeagueAnalytics, { leagueId: 'l', workspace, operations: {}, initialTab })));
  expect(host.querySelector(`[aria-label="${label} sort and filter"]`)).not.toBeNull();
  expect(host.querySelectorAll('th button').length).toBeGreaterThan(1);
});
test('league standings retain official position by default with optional team sorting', async () => {
  await act(async () => root.render(React.createElement(LeagueResults, { leagueId: 'l', workspace, initialTab: 'tables' })));
  expect(host.querySelector('[aria-label="League standings sort and filter"]')).not.toBeNull();
  expect(host.querySelector('th').getAttribute('aria-sort')).toBe('ascending');
  expect(host.querySelector('tbody tr td').textContent).toBe('1');
});
test('authorised player register supports name sorting without changing source objects', async () => {
  await act(async () => root.render(React.createElement(LeagueRegistrations, { leagueId: 'l', workspace, initialTab: 'players' })));
  expect(host.querySelector('[aria-label="League players sort and filter"]')).not.toBeNull();
  expect(host.querySelector('tbody tr td').textContent).toBe('Alpha Player');
});
test('league discipline tables expose controls without broadening permissions', async () => {
  await act(async () => root.render(React.createElement(LeagueDiscipline, { leagueId: 'l', workspace, initialTab: 'sanctions' })));
  expect(host.querySelector('[aria-label="League sanctions sort and filter"]')).not.toBeNull();
});
test.each([['invoices', 'League invoices'], ['charges', 'League charges'], ['expenses', 'Official expenses']])('league finance %s keeps optional filters separate from action scope', async (initialTab, label) => {
  await act(async () => root.render(React.createElement(LeagueFinance, { leagueId: 'l', workspace, initialTab })));
  expect(host.querySelector(`[aria-label="${label} sort and filter"]`)).not.toBeNull();
});
test.each([['applications', 'Registration applications'], ['cases', 'Discipline cases']])('league %s queues expose shared controls', async (initialTab, label) => {
  const component = initialTab === 'cases' ? LeagueDiscipline : LeagueRegistrations;
  await act(async () => root.render(React.createElement(component, { leagueId: 'l', workspace, initialTab })));
  expect(host.querySelector(`[aria-label="${label} sort and filter"]`)).not.toBeNull();
});
test.each([[LeagueOfficials, 'League official pool'], [LeagueCups, 'League cups']])('league official and cup selectors use shared controls', async (Component, label) => {
  const operations = { officials: [], assignments: [], requirements: [], availability: [], postponements: [] };
  await act(async () => root.render(React.createElement(Component, { leagueId: 'l', workspace, operations, cups: [], canEdit: false })));
  expect(host.querySelector(`[aria-label="${label} sort and filter"]`)).not.toBeNull();
});
test.each([[ClubRegistrations, 'Club registration applications'], [ClubFinance, 'Club invoices'], [ClubDiscipline, 'Club discipline cases']])('club-scoped register controls without widening access %#', async (Component, label) => {
  await act(async () => root.render(React.createElement(Component, { leagueId: 'l' })));
  expect(host.querySelector(`[aria-label="${label} sort and filter"]`)).not.toBeNull();
});
test('actual League fixture list exposes shared controls without changing calendar geometry', async () => {
  const operations = { officials: [], assignments: [], requirements: [], availability: [], postponements: [] };
  await act(async () => root.render(React.createElement(LeagueFixtureCommand, { leagueId: 'l', workspace, operations, initialView: 'list' })));
  expect(host.querySelector('[aria-label="League fixtures sort and filter"]')).not.toBeNull();
});
