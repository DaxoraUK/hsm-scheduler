/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { test, expect } from 'vitest';
import { CapacityFlowHarness } from '../helpers/capacityFlowHarness.jsx';
import { isFixtureSchedulingDemand } from '../../src/lib/domain/fixtureLifecycle.js';
import { pitchesShareSpace } from '../../src/lib/scheduling/pitchResourceModel.js';
import { getFixtureFlowIdentity } from '../../src/lib/domain/fixtureVenueFlow.js';

test('settings → canonical build → real pointer move → draft reload → twenty rebuilds retain exact source owners and intelligence', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const state = () => JSON.parse(host.querySelector('[data-flow-state]').textContent);
  const click = async text => act(async () => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text).click());
  const input = async (label, value) => act(async () => { const element = host.querySelector(`[aria-label="${label}"]`); Object.getOwnPropertyDescriptor(element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value').set.call(element, value); element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); });
  const pointer = (node, type, x, y) => { const event = new Event(type, { bubbles: true }); Object.defineProperties(event, Object.fromEntries(Object.entries({ clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0 }).map(([key, value]) => [key, { value }]))); node.dispatchEvent(event); };
  const assertLegal = () => {
    const { rows, pitches } = state(), active = rows.filter(isFixtureSchedulingDemand);
    expect(active, JSON.stringify(state())).toHaveLength(12); expect(new Set(rows.map(getFixtureFlowIdentity)).size).toBe(14);
    for (const a of active) for (const b of active) if (a !== b && a.koMins < b.endMins && a.endMins > b.koMins) expect(pitchesShareSpace(a.pitchId, b.pitchId, pitches)).toBe(false);
    for (const row of active) expect(active.filter(a => a.koMins <= row.koMins && a.endMins > row.koMins).length).toBeLessThanOrEqual(3);
    expect(state().parkingCount).toBe(12); expect(state().officialsCount).toBe(12);
  };
  try {
    await act(async () => root.render(React.createElement(CapacityFlowHarness)));
    for (let i = 0; i < 3; i++) await click('Add playing area');
    await input('Saturday availability', 'custom'); await input('Saturday available until 1', '13:00');
    await click('Save pitches'); await click('Build synthetic schedule'); assertLegal();
    expect(state().rows.filter(isFixtureSchedulingDemand).map(f => f.koTime).sort()).toEqual(['09:00', '09:00', '09:00', '10:00', '10:00', '10:00', '11:00', '11:00', '11:00', '12:00', '12:00', '12:00']);
    const before = state(), ids = before.rows.map(getFixtureFlowIdentity).sort();
    await click('Open extra hour for a legal move'); await click('Save pitches');
    host.querySelectorAll('[data-planner-pitch-id]').forEach(row => { row.getBoundingClientRect = () => ({ left: 100, width: 600, right: 700, top: 0, bottom: 1000 }); });
    const fixture = state().rows.find(f => f.koMins === 540), target = host.querySelector(`[data-planner-pitch-id="${fixture.pitchId}"]`);
    document.elementFromPoint = () => target;
    const card = [...host.querySelectorAll('[data-fixture-card]')].find(c => c.textContent.includes(fixture.homeTeam));
    await act(async () => pointer(card, 'pointerdown', 100, 100)); await act(async () => pointer(window, 'pointerup', 580, 200));
    expect(state().rows.find(f => f.id === fixture.id)).toMatchObject({ koMins: 780, endMins: 840 });
    before.rows.filter(f => f.id !== fixture.id).forEach(f => expect(state().rows.find(row => row.id === f.id)).toEqual(f));
    await click('Reload saved settings and draft'); assertLegal();
    await click('Try stale move'); expect(host.textContent).toContain('changed since');
    expect(state().rows.find(f => f.id === fixture.id).koMins).toBe(780);
    for (let i = 0; i < 20; i++) { await click('Build synthetic schedule'); assertLegal(); expect(state().rows.map(getFixtureFlowIdentity).sort()).toEqual(ids); expect(state().rows.find(f => f.id === fixture.id).koMins).toBe(780); }
    const saved = state();
    await act(async () => root.render(React.createElement(CapacityFlowHarness, { failSave: true })));
    await click('Build synthetic schedule');
    expect(state()).toEqual(saved); expect(host.querySelector('[data-flow-feedback]').textContent).toContain('could not be saved');
  } finally { await act(async () => root.unmount()); host.remove(); }
});
