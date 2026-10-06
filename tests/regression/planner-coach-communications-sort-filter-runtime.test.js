/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import CommunicationsPage from '../../src/pages/CommunicationsPage.jsx';
import CoachHubPage from '../../src/pages/CoachHubPage.jsx';
import AnnualPlannerPage, { AvailabilityWorkspace } from '../../src/pages/AnnualPlannerPage.jsx';
import AnnualPlannerCompletionWorkspace from '../../src/components/planning/AnnualPlannerCompletionWorkspace.jsx';
vi.mock('../../src/lib/supabase.js', () => ({ DB: {
  loadTeamContacts: async () => [], listCommunicationEvents: async () => [], listCoachHubMatchweekDeliveryStatus: async () => [],
  ensureMyCoachHubRoleAccess: async () => ({}), getCoachHubWorkspace: async () => ({ person: { display_name: 'Coach' }, assignments: [{ id: 'a', team_key: 'lisbon', team_name: 'U17 Lisbon', staff_role: 'coach' }, { id: 'b', team_key: 'sharks', team_name: 'U7 Sharks', staff_role: 'coach' }] }),
  getMyCoachTrainingPreferences: async () => ({}), listMyAnnualPlannerAlternatives: async () => [{ id: 'alt', status: 'offered', team_name: 'U17 Lisbon' }], listMyAnnualPlannerWaitlistOffers: async () => [{ id: 'offer', status: 'offered', team_name: 'U7 Sharks' }],
}, Auth: {}, isSupaConfigured: () => false }));
let root, host;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; vi.stubGlobal('React', React); vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => JSON.stringify({ channels: {} }) }))); localStorage.clear(); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
const button = text => [...host.querySelectorAll('nav[aria-label="Coach Hub sections"] button')].find(row => [...row.querySelectorAll('span')].some(span => span.textContent === text));
test('communications display sorts Home updates by team age without admitting Away fixtures', async () => {
  const props = { activeClubId: 'club-a', workspaceAccess: { canCommunicate: true }, satHasRun: true, satFinal: [{ id: 'a', homeTeam: 'U17 Lisbon', awayTeam: 'Visitors', status: 'active', koTime: '10:00', pitchId: 'P1' }, { id: 'b', homeTeam: 'U7 Sharks', awayTeam: 'Visitors', status: 'postponed' }, { id: 'c', homeTeam: 'Other', awayTeam: 'U10 Away', status: 'away', isAwayFixture: true }], teamCfg: [{ name: 'U17 Lisbon' }, { name: 'U7 Sharks' }, { name: 'U10 Away' }] };
  await act(async () => root.render(React.createElement(CommunicationsPage, props)));
  expect(host.querySelector('[aria-label="Coach messages sort and filter"]')).not.toBeNull();
  expect([...host.querySelectorAll('article[data-communication-fixture] h3')].map(row => row.textContent)).toEqual(['U7 Sharks', 'U17 Lisbon']);
  expect(host.querySelectorAll('article[data-communication-fixture]')).toHaveLength(2);
  const search = host.querySelector('[aria-label="Search coach messages"]');
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(search, 'no such team'); search.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(host.querySelector('[aria-label="Coach messages sort and filter"]')).not.toBeNull();
  expect([...host.querySelectorAll('button')].some(row => row.textContent === 'Clear filters')).toBe(true);
  await act(async () => root.render(React.createElement(CommunicationsPage, { ...props, activeClubId: 'club-b' })));
  expect(host.querySelector('[aria-label="Search coach messages"]').value).toBe('');
  expect(host.querySelectorAll('article[data-communication-fixture]')).toHaveLength(2);
});
test('Coach team directory sorts connected teams by age while preserving scope', async () => {
  await act(async () => root.render(React.createElement(CoachHubPage, { clubId: 'club-a' })));
  await act(async () => button('Team').click());
  expect(host.querySelector('[aria-label="My teams sort and filter"]')).not.toBeNull();
  expect([...host.querySelectorAll('h2')].map(row => row.textContent).filter(row => row.startsWith('U'))).toEqual(['U7 Sharks', 'U17 Lisbon']);
  await act(async () => button('Requests').click());
  expect(host.querySelector('[aria-label="My requests sort and filter"]')).not.toBeNull();
  expect(host.querySelector('[aria-label="My slot offers sort and filter"]')).not.toBeNull();
  expect(host.querySelector('[aria-label="Closure alternatives sort and filter"]')).not.toBeNull();
  await act(async () => button('Messages').click());
  expect(host.querySelector('[aria-label="My messages sort and filter"]')).not.toBeNull();
});
test('Annual Planner booking register exposes sorting while calendars stay chronological', async () => {
  localStorage.setItem('daxora_annual_planner_club-a', JSON.stringify({ bookings: [{ id: 'a', title: 'Zulu session', start_at: '2026-10-10T10:00:00Z', end_at: '2026-10-10T11:00:00Z', booking_type: 'training', status: 'confirmed' }, { id: 'b', title: 'Alpha session', start_at: '2026-10-11T10:00:00Z', end_at: '2026-10-11T11:00:00Z', booking_type: 'training', status: 'confirmed' }] }));
  await act(async () => root.render(React.createElement(AnnualPlannerPage, { club: { id: 'club-a' }, workspaceAccess: { canOperate: false } })));
  const tab = [...host.querySelectorAll('button')].find(row => row.textContent.includes('Bookings'));
  expect(tab).toBeDefined();
  await act(async () => tab.click());
  expect(host.querySelector('[aria-label="Planner bookings sort and filter"]')).not.toBeNull();
  await act(async () => [...host.querySelectorAll('button')].find(row => row.textContent.includes('Requests')).click());
  expect(host.querySelector('[aria-label="Booking requests sort and filter"]')).not.toBeNull();
  await act(async () => [...host.querySelectorAll('button')].find(row => row.textContent.includes('Availability')).click());
  expect(host.querySelector('[aria-label="Blackouts sort and filter"]')).not.toBeNull();
});
test('planner completion collections retain ID based bulk selection after filtering', async () => {
  await act(async () => root.render(React.createElement(AnnualPlannerCompletionWorkspace, { bookings: [{ id: 'z', title: 'Zulu', teamName: 'U17 Lisbon', status: 'confirmed' }, { id: 'a', title: 'Alpha', teamName: 'U7 Sharks', status: 'confirmed' }] })));
  expect(host.querySelector('[aria-label="Bulk bookings sort and filter"]')).not.toBeNull();
  expect(host.querySelector('[aria-label="Waiting-list offers sort and filter"]')).not.toBeNull();
  expect(host.querySelector('[aria-label="Calendar feeds sort and filter"]')).not.toBeNull();
  const cards = [...host.querySelectorAll('label')].filter(row => row.querySelector('input[type="checkbox"]'));
  expect(cards.map(row => row.querySelector('span span').textContent)).toEqual(['U7 Sharks', 'U17 Lisbon']);
  await act(async () => cards[0].querySelector('input').click());
  expect(cards[0].querySelector('input').checked).toBe(true);
});
test('limited communication feeds explicitly describe their recent-only scope', async () => {
  await act(async () => root.render(React.createElement(CommunicationsPage, { activeClubId: 'c', workspaceAccess: {} })));
  expect(host.textContent).toContain('up to 50');
  expect(host.textContent).toContain('up to 30');
  expect(host.querySelector('[aria-label="Recent communication activity sort and filter"]')).toBeNull();
});
test('Coach home connected teams provide age-ordered collection controls', async () => {
  await act(async () => root.render(React.createElement(CoachHubPage, { clubId: 'club-a' })));
  expect(host.querySelectorAll('[aria-label="Connected teams sort and filter"]')).toHaveLength(1);
  expect(host.querySelector('header [aria-label="Connected teams sort and filter"]')).toBeNull();
});
test('Planner closure action and matchday closure records can be filtered without changing resolve targets', async () => {
  const onResolve = vi.fn();
  const impact = { id: 'i', status: 'action_required', booking_title: 'Zulu booking', team_name: 'U17 Lisbon' };
  await act(async () => root.render(React.createElement(AvailabilityWorkspace, { blackouts: [], closureImpacts: [impact], pitchClosures: [{ id: 'p', pitchName: 'Pitch 10', startDate: '2026-10-10' }], pitchCfg: [], settings: {}, canOperate: true, onResolveImpact: onResolve })));
  expect(host.querySelector('[aria-label="Closure actions sort and filter"]')).not.toBeNull();
  expect(host.querySelector('[aria-label="Matchday pitch closures sort and filter"]')).not.toBeNull();
  await act(async () => [...host.querySelectorAll('button')].find(row => row.textContent === 'Review and resolve').click());
  expect(onResolve).toHaveBeenCalledWith(impact);
});
test('communications date sorting orders actual Midweek Saturday Sunday dates in both directions without changing IDs', async () => {
  const fixture = (id, name) => ({ id, homeTeam: name, awayTeam: 'Visitors', status: 'active', koTime: '10:00', pitchId: 'P1' });
  const props = { activeClubId: 'c', workspaceAccess: { canCommunicate: true }, teamCfg: [{ name: 'U7 Saturday' }, { name: 'U10 Sunday' }, { name: 'U17 Midweek' }], satHasRun: true, sunHasRun: true, midweekHasRun: true, satDate: '2026-10-10', sunDate: '2026-10-11', midweekDate: '2026-10-07', satDateLabel: 'Saturday, 10 October 2026', sunDateLabel: 'Sunday, 11 October 2026', midweekDateLabel: 'Wednesday, 7 October 2026', satFinal: [fixture('b', 'U7 Saturday')], sunFinal: [fixture('a', 'U10 Sunday')], midweekFinal: [fixture('c', 'U17 Midweek')] };
  await act(async () => root.render(React.createElement(CommunicationsPage, props)));
  const ids = [...host.querySelectorAll('article[data-communication-fixture]')].map(row => row.getAttribute('data-communication-fixture')).sort();
  const names = () => [...host.querySelectorAll('article[data-communication-fixture] h3')].map(row => row.textContent);
  await act(async () => { const select = host.querySelector('[aria-label="Coach messages sort and filter"] select[aria-label="Sort by"]'); select.value = 'date'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(names()).toEqual(['U17 Midweek', 'U7 Saturday', 'U10 Sunday']);
  await act(async () => host.querySelector('[aria-label="Coach messages sort and filter"] button[aria-label="Sort descending"]').click());
  expect(names()).toEqual(['U10 Sunday', 'U7 Saturday', 'U17 Midweek']);
  expect([...host.querySelectorAll('article[data-communication-fixture]')].map(row => row.getAttribute('data-communication-fixture')).sort()).toEqual(ids);
});
test('communications age sorting honours original configured youth and Adult metadata', async () => {
  const configs = [{ name: 'U17 Historic', ageGroup: 'Adult' }, { name: 'U17 Lisbon', ageGroup: 'U17' }, { name: 'Sharks', ageGroup: 'U7' }];
  const fixtures = configs.map((cfg, index) => ({ id: String(index), homeTeam: cfg.name, cfg, awayTeam: 'Visitors', status: 'active', koTime: '10:00', pitchId: 'P1' }));
  await act(async () => root.render(React.createElement(CommunicationsPage, { activeClubId: 'c', workspaceAccess: { canCommunicate: true }, teamCfg: configs, satHasRun: true, satFinal: fixtures })));
  expect([...host.querySelectorAll('article[data-communication-fixture] h3')].map(row => row.textContent)).toEqual(['Sharks', 'U17 Lisbon', 'U17 Historic']);
});
test('closure action age sort retains configured age metadata and action IDs', async () => {
  const teams = [{ id: 'adult', name: 'U17 Historic', ageGroup: 'Adult' }, { id: 'youth', name: 'Sharks', ageGroup: 'U7' }];
  const impacts = teams.map((team, index) => ({ id: 'impact-' + index, team_key: team.id, team_name: team.name, booking_title: 'Action ' + index, booking_start_at: '2026-10-10T10:00:00Z', status: 'action_required' }));
  const selectImpact = vi.fn();
  await act(async () => root.render(React.createElement(AvailabilityWorkspace, { teams, settings: {}, blackouts: [], pitchCfg: [], closureImpacts: impacts, canOperate: true, onResolveImpact: selectImpact })));
  const select = host.querySelector('[aria-label="Closure actions sort and filter"] select[aria-label="Sort by"]');
  await act(async () => { select.value = 'team'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  const actions = [...host.querySelectorAll('button')].filter(button => button.textContent === 'Review and resolve');
  expect(actions[0].parentElement.textContent).toContain('Action 1');
  await act(async () => actions[0].click());
  expect(selectImpact).toHaveBeenCalledWith(impacts[1]);
});
