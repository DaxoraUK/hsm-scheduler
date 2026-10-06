import { expect, test } from 'vitest';
import * as ordering from '../../src/lib/teams/teamOrdering.js';

test('team display uses actual numeric ages then adult and unknown groups', () => {
  const teams = [{ name: 'Adult' }, { name: 'Horwich U17 Lisbon', defaultPitch: 'P1', format: '11v11', ageOrder: 11 }, { name: 'U10 Bears' }, { name: 'Unknown' }, { name: 'U7 Zebras' }, { name: 'U10 Avengers' }];
  expect(ordering.sortTeamsByAgeGroup(teams).map(row => row.name)).toEqual(['U7 Zebras', 'U10 Avengers', 'U10 Bears', 'Horwich U17 Lisbon', 'Adult', 'Unknown']);
  expect(teams[0].name).toBe('Adult');
  expect(ordering.getTeamDisplayAge(teams[1])).toBe(17);
});
test('configured age takes precedence without borrowing scheduling or pitch fields', () => {
  expect(ordering.getTeamDisplayAge({ name: 'U17 team', ageGroup: 'U12' })).toBe(12);
  expect(ordering.getTeamDisplayAge({ name: 'U17 team', age_group: 'Under 15' })).toBe(15);
  expect(ordering.getTeamDisplayAge({ name: 'Unknown', ageOrder: 7, format: '11v11', defaultPitch: 'P1' })).toBeNull();
  expect(ordering.sortTeamsByAgeGroup([{ name: 'Unknown' }, { name: 'First Team', teamType: 'adult' }]).map(row => row.name)).toEqual(['First Team', 'Unknown']);
});
test('sorted entries keep original team index and matching contact attached', () => {
  const entries = [{ team: { name: 'U17 Lisbon' }, index: 0, contact: 'Lisbon coach' }, { team: { name: 'U7 Sharks' }, index: 1, contact: 'Sharks coach' }];
  const rows = ordering.sortTeamEntriesByAgeGroup(entries);
  expect(rows.map(row => [row.index, row.contact])).toEqual([[1, 'Sharks coach'], [0, 'Lisbon coach']]);
  expect(entries[0].index).toBe(0);
});
test('configured adult metadata wins over a legacy youth label for display ordering', () => {
  const adult = { name: 'U17 historic label', ageGroup: 'Adult' };
  expect(ordering.getTeamDisplayAge(adult)).toBeNull();
  expect(ordering.sortTeamsByAgeGroup([adult, { name: 'U18 youth' }]).map(row => row.name)).toEqual(['U18 youth', 'U17 historic label']);
});
