/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import CoachCalendar from '../../src/components/coach/CoachSharedCalendar.jsx';
import Access from '../../src/components/Settings/AccessSecurityPanel.jsx';
import Header from '../../src/components/lists/SortableTableHeader.jsx';
import Planner from '../../src/pages/AnnualPlannerPage.jsx';
import Seasonal from '../../src/components/planning/SeasonalResourceWorkspace.jsx';
import Winter from '../../src/components/planning/WinterSiteWorkspace.jsx';
import Training from '../../src/components/planning/SmartTrainingAllocationWorkspace.jsx';
import Assistant from '../../src/components/Operations/shared/OperationsAssistantCard.jsx';
import Command from '../../src/pages/OperationsCentrePage.jsx';
import Policy from '../../src/components/planning/TrainingSchedulingPolicyPanel.jsx';
import { FundingPanel } from '../../src/components/elite/EliteControlWorkspace.jsx';
import Pilot from '../../src/components/PlatformPilotLaunchPanel.jsx';
import Elite from '../../src/pages/EliteCommandCentrePage.jsx';
vi.mock('../../src/lib/supabase.js', () => ({ DB: { platformGetPilotLaunchReadiness: async () => ({ pilots: [{ club_id: "z", club_name: "Zulu" }, { club_id: "a", club_name: "Alpha" }] }), listClubMembers: async () => [{ user_id: 'z', display_name: 'Zulu', email: 'z@example.test', role: 'viewer' }, { user_id: 'a', display_name: 'Alpha', email: 'a@example.test', role: 'viewer' }], listClubInvitations: async () => [], listSupportSessions: async () => [], listAuditEvents: async () => [] }, Auth: {}, isSupaConfigured: () => false }));
let host, root;
beforeEach(() => { vi.stubGlobal('React', React); globalThis.IS_REACT_ACT_ENVIRONMENT = true; localStorage.clear(); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
test('the shared heading also supports a semantic grid heading without invalid table markup', async () => {
  const sort = vi.fn();
  await act(async () => root.render(React.createElement(Header, { as: 'div', columnKey: 'hours', label: 'Hours', sort: { key: 'hours', direction: 'desc' }, onSort: sort })));
  expect(host.querySelector('th')).toBeNull();
  expect(host.querySelector('[role="columnheader"]').getAttribute('aria-sort')).toBe('descending');
  await act(async () => host.querySelector('button').click());
  expect(sort).toHaveBeenCalledWith('hours');
});
test('Planner register data headings are clickable and share toolbar state', async () => {
  await act(async () => root.render(React.createElement(Planner, { club: { id: 'c' }, workspaceAccess: { canOperate: false } })));
  await act(async () => [...host.querySelectorAll('button')].find(row => row.textContent.includes('Bookings')).click());
  expect(host.querySelectorAll('[role="columnheader"] button')).toHaveLength(5);
  await act(async () => [...host.querySelectorAll('[role="columnheader"] button')].find(row => row.textContent.includes('Time')).click());
  expect(host.querySelector('select[aria-label="Sort by"]').value).toBe('time');
});
test('seasonal resources and waiting list have full collection controls and age-sorted team options', async () => {
  await act(async () => root.render(React.createElement(Seasonal, { teams: [{ id: 'z', name: 'U17 Lisbon' }, { id: 'a', name: 'U7 Sharks' }] })));
  expect(host.querySelector('[aria-label="Planner resources sort and filter"]')).not.toBeNull();
  expect(host.querySelector('[aria-label="Planner waiting list sort and filter"]')).not.toBeNull();
  const team = [...host.querySelectorAll('select')].find(select => [...select.options].some(option => option.textContent === 'U7 Sharks'));
  expect([...team.options].filter(option => option.value).map(option => option.textContent)).toEqual(['U7 Sharks', 'U17 Lisbon']);
});
test('Elite site records and action queues expose controls while retaining upstream calculations', async () => {
  await act(async () => root.render(React.createElement(Elite, { club: { name: 'Club' }, teamCfg: [], pitchCfg: [], memberships: [], satFinal: [], sunFinal: [], midweekFinal: [], satUnresolved: [], sunUnresolved: [], midweekUnresolved: [], closedPitches: {}, workspaceAccess: {} })));
  expect(host.querySelector('[aria-label="Organisation sites sort and filter"]')).not.toBeNull();
  expect(host.querySelector('[aria-label="Organisation actions sort and filter"]')).not.toBeNull();
});
test.each([[Winter, 'Winter sites'], [Training, 'Training preferences'], [Policy, 'Training policy requests']])('remaining planner workspaces expose shared collection controls %#', async (Component, label) => {
  await act(async () => root.render(React.createElement(Component, { sites: [{ id: 'z', name: 'Zulu winter site' }, { id: 'a', name: 'Alpha winter site' }], teams: [], club: {}, pitches: [], winterSites: [], policies: [], preferences: [], proposals: [], winterSlots: [], bookings: [], assignments: [], allocationRuns: [], allocationItems: [], preferenceProposals: [], waitlist: [], workspaceAccess: {} })));
  expect(host.querySelector(`[aria-label="${label} sort and filter"]`)).not.toBeNull();
});
test('Planner pitch utilisation headings are sortable without changing its totals', async () => {
  await act(async () => root.render(React.createElement(Planner, { club: { id: 'c' }, workspaceAccess: { canOperate: false } })));
  await act(async () => [...host.querySelectorAll('button')].find(row => row.textContent.includes('Insights')).click());
  expect(host.querySelector('[aria-label="Planner pitch utilisation sort and filter"]')).not.toBeNull();
  expect(host.querySelectorAll('[role="columnheader"] button')).toHaveLength(4);
});
test('Coach calendar team picker uses age order without changing event chronology', async () => {
  const assignments = [{ id: 'z', teamKey: 'z', teamName: 'U17 Lisbon' }, { id: 'a', teamKey: 'a', teamName: 'U7 Sharks' }];
  await act(async () => root.render(React.createElement(CoachCalendar, { assignments, workspace: { assignments, bookings: [], requests: [], messages: [] } })));
  expect(host.querySelector('[aria-label="Coach calendar feeds sort and filter"]')).not.toBeNull();
  const select = [...host.querySelectorAll('select')].find(row => [...row.options].some(option => option.textContent === 'U7 Sharks'));
  expect([...select.options].filter(option => option.value !== 'all').map(option => option.textContent)).toEqual(['U7 Sharks', 'U17 Lisbon']);
  expect(assignments.map(row => row.id)).toEqual(['z', 'a']);
});
test('authorised access lists sort members and expose active support controls only within the selected club', async () => {
  await act(async () => root.render(React.createElement(Access, { activeClubId: 'c', activeMembership: { role: 'owner' }, authSession: { user: { id: 'owner' } } })));
  expect(host.querySelector('[aria-label="Club members sort and filter"]')).not.toBeNull();
  expect(host.querySelector('[aria-label="Support sessions sort and filter"]')).not.toBeNull();
});
test('Operations assistant action controls retain ranked default and original data', async () => {
  const actions = [{ id: 'z', title: 'Zulu urgent', status: 'danger' }, { id: 'a', title: 'Alpha warning', status: 'warning' }];
  await act(async () => root.render(React.createElement(Assistant, { assistant: { actions } })));
  expect(host.querySelector('[aria-label="Assistant actions sort and filter"]')).not.toBeNull();
  expect([...host.querySelectorAll('h4')].map(row => row.textContent)).toEqual(['Zulu urgent', 'Alpha warning']);
  await act(async () => {
    const select = host.querySelector('select[aria-label="Sort by"]');
    select.value = 'name'; select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect([...host.querySelectorAll('h4')].map(row => row.textContent)).toEqual(['Alpha warning', 'Zulu urgent']);
  expect(actions[0].id).toBe('z');
});
test('Operations command queues and incident register have controls within current context', async () => {
  await act(async () => root.render(React.createElement(Command, { club: { id: 'c' }, teamCfg: [], pitchCfg: [], satFinal: [], sunFinal: [], midweekFinal: [] })));
  expect(host.querySelector('[aria-label="Priority actions sort and filter"]')).not.toBeNull();
  expect(host.querySelector('[aria-label="Incidents sort and filter"]')).not.toBeNull();
});
test('organisation funding projects and deadlines use named/date controls', async () => {
  await act(async () => root.render(React.createElement(FundingPanel, { clubId: 'c', data: { funding: { projects: [{ id: 'z', title: 'Zulu' }, { id: 'a', title: 'Alpha' }], applicationTasks: [{ id: 't', title: 'Evidence', dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10) }] }, approvals: [] } })));
  expect(host.querySelector('[aria-label="Organisation funding projects sort and filter"]')).not.toBeNull();
  expect(host.querySelector('[aria-label="Funding deadlines sort and filter"]')).not.toBeNull();
  expect([...host.querySelectorAll('article .text-base.font-black')].map(row => row.textContent)).toEqual(['Alpha', 'Zulu']);
});
test('training allocation preview exposes display-only controls', async () => {
  await act(async () => root.render(React.createElement(Training, { teams: [{ id: 'u7', name: 'U7 Sharks' }], policies: [], pitches: [], preferences: [], assignments: [], winterSites: [], winterSlots: [], bookings: [], allocationRuns: [], allocationItems: [], preferenceProposals: [], waitlist: [], workspaceAccess: {} })));
  await act(async () => [...host.querySelectorAll('button')].find(row => row.textContent === ' Build draft').click());
  expect(host.querySelector('[aria-label="Training draft allocations sort and filter"]')).not.toBeNull();
});
test('season rollover history exposes all loaded records before filtering', async () => {
  await act(async () => root.render(React.createElement(Seasonal, { teams: [], rollovers: Array.from({ length: 8 }, (_, i) => ({ id: String(i), from_season_phase: 'summer', to_season_phase: 'winter', status: 'draft' })) })));
  expect(host.querySelector('[aria-label="Season rollovers sort and filter"]')).not.toBeNull();
  expect(host.querySelector('[aria-label="Season rollovers sort and filter"]').textContent).toContain('8 of 8');
});
test('pilot clubs have named collection controls without changing launch gates', async () => {
  await act(async () => root.render(React.createElement(Pilot, { clubs: [], isPlatformAdmin: false })));
  expect(host.querySelector('[aria-label="Pilot clubs sort and filter"]')).not.toBeNull();
});
test('collection toolbar spans the card grid rather than occupying one record cell', async () => {
  await act(async () => root.render(React.createElement(Winter, { sites: [{ id: 's', name: 'Site' }], slots: [], teams: [], assignments: [] })));
  expect(host.querySelector('[aria-label="Winter sites sort and filter"]').className).toContain('col-span-full');
});
