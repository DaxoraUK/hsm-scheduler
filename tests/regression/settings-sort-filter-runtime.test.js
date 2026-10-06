/** @vitest-environment jsdom */
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, test, expect } from 'vitest';
import RecordCollection from '../../src/components/lists/RecordCollection.jsx';
import TeamSettingsPanel from '../../src/components/Settings/TeamSettingsPanel.jsx';
import PitchSettingsPanel from '../../src/components/Settings/PitchSettingsPanel.jsx';
import RefereeSettingsPanel from '../../src/components/Settings/RefereeSettingsPanel.jsx';
import IntegrationSettingsPanel from '../../src/components/Settings/IntegrationSettingsPanel.jsx';
import HistorySettingsPanel from '../../src/components/Settings/HistorySettingsPanel.jsx';
import VenueSettingsPanel from '../../src/components/Settings/VenueSettingsPanel.jsx';
let host, root;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const group = name => host.querySelector(`[aria-label="${name} sort and filter"]`);
test('declarative collection filters retain original entries and stale choices', async () => {
  const rows = [{ index: 7, name: 'Pitch 10', site: 'North' }, { index: 3, name: 'Pitch 2', site: 'South' }];
  const props = { label: 'Pitches', rows, columns: [{ key: 'name', label: 'Name', type: 'text', value: row => row.name }], filterFields: [{ key: 'site', label: 'Site', value: row => row.site }], children: displayed => React.createElement('output', null, displayed.map(row => `${row.name}:${row.index}`).join('|')) };
  await act(async () => root.render(React.createElement(RecordCollection, props)));
  expect(host.querySelector('output').textContent).toBe('Pitch 2:3|Pitch 10:7');
  await act(async () => [...host.querySelectorAll('button')].find(row => row.textContent === 'Filter').click());
  const select = host.querySelector('select[aria-label="Filter by Site"]');
  await act(async () => { select.value = 'North'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(host.querySelector('output').textContent).toBe('Pitch 10:7');
  await act(async () => root.render(React.createElement(RecordCollection, { ...props, rows: [rows[1]] })));
  expect(host.querySelector('select[aria-label="Filter by Site"]').value).toBe('North');
  expect(host.textContent).toContain('No records match');
});
function Teams() {
  const [teamCfg, setTeamCfg] = useState([{ name: 'U17 Lisbon', format: '11v11', day: 'Saturday', teamType: 'youth' }, { name: 'U7 Sharks', format: '5v5', day: 'Sunday', teamType: 'youth' }]);
  return React.createElement(TeamSettingsPanel, { teamCfg, setTeamCfg, setTeamContacts: () => {}, workspaceAccess: {}, club: {} });
}
test('real team settings default to age order with day and age filters', async () => {
  await act(async () => root.render(React.createElement(Teams)));
  expect(group('Teams')).not.toBeNull();
  expect([...host.querySelectorAll('aside button')].filter(row => row.textContent.includes('U7') || row.textContent.includes('U17')).map(row => row.querySelector('span.block.truncate')?.textContent)).toEqual(['U7 Sharks', 'U17 Lisbon']);
});
test('real pitch settings preserve edit index after sorted selection', async () => {
  function Pitches() {
    const [pitchCfg, setPitchCfg] = useState([{ id: 'P10', label: 'Pitch 10', format: '11v11' }, { id: 'P2', label: 'Pitch 2', format: '11v11' }]);
    return React.createElement(React.Fragment, null, React.createElement(PitchSettingsPanel, { pitchCfg, setPitchCfg, club: {} }), React.createElement('output', null, pitchCfg.map(row => row.label).join('|')));
  }
  await act(async () => root.render(React.createElement(Pitches)));
  expect(group('Pitches')).not.toBeNull();
  await act(async () => [...host.querySelectorAll('aside button')].find(row => row.textContent.includes('Pitch 2')).click());
  const input = [...host.querySelectorAll('input')].find(row => row.value === 'Pitch 2');
  expect(input).toBeDefined();
  expect(host.querySelector('output').textContent).toBe('Pitch 10|Pitch 2');
});
test('official and fixture source lists have working alphabetical defaults', async () => {
  await act(async () => root.render(React.createElement(RefereeSettingsPanel, { refs: [{ id: 'z', name: 'Zulu' }, { id: 'a', name: 'Alpha' }], setRefs: () => {} })));
  expect(group('Officials')).not.toBeNull();
  expect([...host.querySelectorAll('article input')].filter(row => ['Alpha', 'Zulu'].includes(row.value)).map(row => row.value)).toEqual(['Alpha', 'Zulu']);
  await act(async () => root.render(React.createElement(IntegrationSettingsPanel, { club: { integrations: { fullTimeFa: { sources: [{ id: 'z', name: 'Zulu source', feedId: '1' }, { id: 'a', name: 'Alpha source', feedId: '2' }] } } }, setClub: () => {} })));
  expect(group('Fixture sources')).not.toBeNull();
  expect([...host.querySelectorAll('details summary')].map(row => row.textContent.match(/(?:Alpha|Zulu) source/)?.[0]).filter(Boolean)).toEqual(['Alpha source', 'Zulu source']);
});
test('saved history headings change order without changing which week is loaded', async () => {
  let loaded;
  const history = [{ id: 'old', dateLabel: 'Old week', savedAt: '2026-09-01' }, { id: 'new', dateLabel: 'New week', savedAt: '2026-10-01' }];
  await act(async () => root.render(React.createElement(HistorySettingsPanel, { history, onLoadHistory: week => { loaded = week.id; } })));
  expect(group('Saved matchweeks')).not.toBeNull();
  expect(host.querySelector('tbody tr').textContent).toContain('New week');
  await act(async () => host.querySelector('th button').click());
  expect(host.querySelector('tbody tr').textContent).toContain('Old week');
  await act(async () => host.querySelector('tbody button').click());
  expect(loaded).toBe('old');
});
test('venue display defaults to name rather than configuration position', async () => {
  await act(async () => root.render(React.createElement(VenueSettingsPanel, { club: { sites: [{ id: 'z', name: 'Zulu site' }, { id: 'a', name: 'Alpha site' }] }, setClub: () => {} })));
  expect(group('Venues')).not.toBeNull();
  expect([...host.querySelectorAll('h3')].map(row => row.textContent)).toEqual(['Alpha site', 'Zulu site']);
});
