/** @vitest-environment jsdom */
import { afterEach, test, expect, vi } from 'vitest';
import { migratePitches } from '../../src/lib/pitches.js';
import { validatePitchSchedulingConfig } from '../../src/lib/scheduling/pitchResourceModel.js';
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });
test('authenticated REST JSON round trip preserves stable playing units, windows and unrelated metadata', async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://ground-control-test.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key-that-is-long-enough-for-configuration');
  vi.resetModules();
  const { DB, Auth } = await import('../../src/lib/supabase.js');
  Auth.saveSession({ access_token: 'signed-in-user-jwt', refresh_token: 'refresh', expires_at: Date.now() / 1000 + 3600, user: { id: 'user-test' } });
  const rows = [{ id: 'AST', label: 'Astro', surface: 'astro', independent: true, playingAreas: [{ id: 'stable-a', label: 'A' }, { id: 'stable-b', label: 'B' }], availabilityByDay: { saturday: [{ from: '09:00', to: '13:00' }], sunday: [] }, trainingCapacity: 3, trainingAreas: [{ id: 'legacy', label: 'Half' }], custom: { untouched: true } }, { id: 'AST-A', label: 'Astro A', innerOf: 'AST', playingAreaIds: ['stable-a'], availabilityByDay: { monday: null, saturday: [{ from: '10:00', to: '12:00' }] }, custom: 'keep' }];
  let saved;
  const fetchMock = vi.fn(async (url, options) => {
    expect(options.headers.Authorization).toBe('Bearer signed-in-user-jwt');
    if (url.includes('replace_club_collection')) { saved = JSON.parse(options.body); return { ok: true, status: 200, text: async () => 'true' }; }
    expect(url).toContain('/pitches?');
    return { ok: true, status: 200, text: async () => JSON.stringify(saved.records) };
  });
  vi.stubGlobal('fetch', fetchMock);
  await DB.savePitches('club-test', rows);
  expect(saved).toEqual({ target_club_id: 'club-test', collection_name: 'pitches', records: rows.map(p => ({ id: p.id, data: p })) });
  const loaded = migratePitches(await DB.loadPitches('club-test'));
  rows.forEach((row, i) => { for (const key of Object.keys(row)) expect(loaded[i][key]).toEqual(row[key]); });
  expect(validatePitchSchedulingConfig(loaded).ok).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  Auth.clearSession();
});
