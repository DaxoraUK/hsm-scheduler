/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, test } from 'vitest';
import MatchdayScheduleCard from '../../src/components/Operations/shared/MatchdayScheduleCard.jsx';
import OfficialsIntelligenceCard from '../../src/components/Operations/shared/OfficialsIntelligenceCard.jsx';
let root, host;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
test.each(['Saturday', 'Sunday', 'Midweek'])('%s list sorting/filtering opens the original fixture without altering allocations', async day => {
  const games = [{ id: 'lisbon', homeTeam: 'U17 Lisbon', awayTeam: 'Rangers', pitchId: 'P1', koTime: '10:00', koMins: 600, status: 'active', cfg: { name: 'U17 Lisbon', format: '11v11' } }, { id: 'sharks', homeTeam: 'U7 Sharks', awayTeam: 'Bears', pitchId: 'P2', koTime: '09:00', koMins: 540, status: 'active', cfg: { name: 'U7 Sharks', format: '5v5' } }];
  let opened;
  await act(async () => root.render(React.createElement(MatchdayScheduleCard, { day, club: {}, games, hasRun: true, onFixtureClick: (fixture, index) => { opened = [fixture.id, index]; } })));
  expect(host.querySelector(`[aria-label="${day} fixtures sort and filter"]`)).not.toBeNull();
  expect([...host.querySelectorAll('h3')].map(row => row.textContent)).toEqual(['U7 Sharks', 'U17 Lisbon']);
  await act(async () => [...host.querySelectorAll('button')].find(row => row.textContent.includes('Open Control Centre')).click());
  expect(opened).toEqual(['sharks', 1]);
  expect(games.map(row => [row.id, row.pitchId, row.koTime])).toEqual([['lisbon', 'P1', '10:00'], ['sharks', 'P2', '09:00']]);
  await act(async () => [...host.querySelectorAll('button')].find(row => row.textContent === 'Filter').click());
  const select = host.querySelector('[aria-label="Filter by Pitch"]');
  await act(async () => { select.value = 'P1'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  expect([...host.querySelectorAll('h3')].map(row => row.textContent)).toEqual(['U17 Lisbon']);
  expect(host.textContent).toContain('1 of 2');
});
test('official coverage can filter the whole queue without dropping priority or edit targets', async () => {
  let opened;
  const missingFixtures = Array.from({ length: 10 }, (_, index) => ({ id: `f${index}`, label: `Fixture ${index}`, state: index === 9 ? 'declined' : 'unassigned', window: '09:00', fixture: { id: `original${index}` } }));
  await act(async () => root.render(React.createElement(OfficialsIntelligenceCard, { intelligence: { missingFixtures }, onFixtureClick: fixture => { opened = fixture.id; } })));
  expect(host.querySelector('[aria-label="Official coverage sort and filter"]')).not.toBeNull();
  await act(async () => [...host.querySelectorAll('button')].find(row => row.textContent === 'Filter').click());
  const filter = host.querySelector('[aria-label="Filter by Status"]');
  await act(async () => { filter.value = 'declined'; filter.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(host.textContent).toContain('1 of 10');
  await act(async () => [...host.querySelectorAll('button')].find(row => row.textContent.includes('Fixture 9')).click());
  expect(opened).toBe('original9');
});
