/** @vitest-environment jsdom */
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import PitchSettingsPanel from '../../src/components/Settings/PitchSettingsPanel.jsx';

let host, root;
const parent = () => ({ id: 'AST', label: 'Astro', surface: 'astro', independent: true, siteId: 'main-ground', trainingCapacity: 2, trainingAreas: [{ id: 'training-west', label: 'Training west' }], custom: { keep: true } });
const layout = () => [{ ...parent(), playingAreas: [{ id: 'east', label: 'East' }, { id: 'west', label: 'West' }] }, { id: 'A', label: 'East layout', innerOf: 'AST', playingAreaIds: ['east'], surface: 'astro' }, { id: 'B', label: 'West layout', innerOf: 'AST', playingAreaIds: ['west'], surface: 'astro' }];
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function mount(pitches = [parent()], { saveTab = vi.fn().mockResolvedValue(true), limit = 50 } = {}) {
  function Harness() {
    const [pitchCfg, setPitchCfg] = useState(pitches);
    return React.createElement(React.Fragment, null, React.createElement(PitchSettingsPanel, { pitchCfg, setPitchCfg, club: {}, subscription: { limits: { pitches: limit } }, saveTab }), React.createElement('output', { 'data-state': true }, JSON.stringify(pitchCfg)));
  }
  await act(async () => root.render(React.createElement(Harness)));
  return saveTab;
}
const state = () => JSON.parse(host.querySelector('output[data-state]').textContent);
const labelled = name => host.querySelector(`[aria-label="${name}"]`);
async function click(text) { const button = [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text || b.getAttribute('aria-label') === text); expect(button, text).toBeDefined(); await act(async () => button.click()); }
async function change(element, value) {
  expect(element).not.toBeNull();
  await act(async () => { Object.getOwnPropertyDescriptor(element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value').set.call(element, value); element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); });
}
async function selectPitch(name) { await act(async () => [...host.querySelectorAll('aside button')].find(b => b.textContent.includes(name)).click()); }

test('add_three_and_ten_areas with mapped entitled child layouts', async () => {
  await mount();
  for (let i = 0; i < 10; i++) await click('Add playing area');
  const rows = state();
  expect(rows[0].playingAreas).toHaveLength(10);
  expect(rows).toHaveLength(11);
  expect(new Set(rows.map(p => p.id)).size).toBe(11);
  expect(new Set(rows[0].playingAreas.map(a => a.id)).size).toBe(10);
  rows.slice(1).forEach((p, i) => expect(p).toMatchObject({ innerOf: 'AST', playingAreaIds: [rows[0].playingAreas[i].id], surface: 'astro', siteId: 'main-ground', independent: true }));
});

test('rename_keeps_area_and_pitch_ids and training_fields_unchanged', async () => {
  const save = await mount(); await click('Add playing area');
  const before = state();
  await change(labelled('Playing area name 1'), 'New physical name');
  expect(state()[0].playingAreas[0]).toEqual({ ...before[0].playingAreas[0], label: 'New physical name' });
  expect(state().map(p => p.id)).toEqual(before.map(p => p.id));
  expect(state()[0].trainingAreas).toEqual(parent().trainingAreas);
  expect(state()[0].trainingCapacity).toBe(2);
  await click('Save pitches');
  expect(save.mock.calls[0][1].pitchCfg[0]).toMatchObject({ custom: { keep: true }, trainingCapacity: 2, trainingAreas: parent().trainingAreas });
});

test('cannot_remove_referenced_area_or_parent and cannot reparent mapped layouts', async () => {
  await mount(layout());
  await click('Remove playing area East');
  expect(state()).toHaveLength(3); expect(state()[0].playingAreas).toHaveLength(2);
  expect(host.textContent).toContain('referenced');
  await click('Remove'); expect(state()).toHaveLength(3);
  await selectPitch('East layout');
  const select = [...host.querySelectorAll('label')].find(l => l.textContent.includes('Inside pitch')).querySelector('select');
  await change(select, '');
  expect(state()[1].innerOf).toBe('AST');
});

test('map_disjoint_and_alternative_layouts explicitly without silently changing another layout', async () => {
  await mount(layout()); await selectPitch('East layout');
  await act(async () => labelled('Uses playing area West').click());
  expect(state()[1].playingAreaIds).toEqual(['east', 'west']);
  expect(state()[2].playingAreaIds).toEqual(['west']);
});

test('inherit_override_closed_and_split_day_windows', async () => {
  const save = await mount(layout()); await selectPitch('East layout');
  await change(labelled('Saturday availability'), 'custom');
  await change(labelled('Saturday available from 1'), '09:10');
  await change(labelled('Saturday available until 1'), '13:00');
  await click('Add Saturday window');
  await change(labelled('Saturday available from 2'), '14:00');
  await change(labelled('Saturday available until 2'), '18:00');
  await change(labelled('Sunday availability'), 'closed');
  await change(labelled('Monday availability'), 'custom');
  await change(labelled('Monday availability'), 'inherit');
  await click('Save pitches');
  const child = save.mock.calls[0][1].pitchCfg[1];
  expect(child.availabilityByDay.saturday).toEqual([{ from: '09:10', to: '13:00' }, { from: '14:00', to: '18:00' }]);
  expect(child.availabilityByDay.sunday).toEqual([]);
  expect(child.availabilityByDay.monday).toBeUndefined();
});

test.each([{ saturday: [{ from: '22:00', to: '01:00' }] }, { saturday: [{ from: '09:99', to: '13:00' }] }, { saturday: [null] }])('reject_overnight_and_malformed_times before repository save: %j', async availabilityByDay => {
  const save = await mount([{ ...parent(), availabilityByDay }]);
  await click('Save pitches'); expect(save).not.toHaveBeenCalled();
  expect(host.textContent).toContain('Not synced');
});

test('pitch_limit_preserved for child creation', async () => {
  await mount([parent()], { limit: 3 });
  await click('Add playing area'); await click('Add playing area'); await click('Add playing area');
  expect(state()).toHaveLength(3); expect(state()[0].playingAreas).toHaveLength(2);
  expect(host.textContent).toContain('allows 3 pitches');
});

test('filter_select_edit_correct_pitch', async () => {
  await mount([{ id: 'P10', label: 'Pitch 10' }, parent()]);
  await change(labelled('Find a pitch, site or format'), 'Astro'); await selectPitch('Astro');
  await click('Add playing area');
  expect(state()[0].playingAreas).toBeUndefined();
  expect(state()[1].playingAreas).toHaveLength(1);
});

test('repository failure does not display false Saved confirmation', async () => {
  await mount([parent()], { saveTab: vi.fn().mockRejectedValue(new Error('offline')) });
  await click('Save pitches');
  expect(host.textContent).toContain('Not synced');
  expect(host.textContent).toContain('Retry save');
});
