/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useWorkspaceSecurity } from '../../src/hooks/useWorkspaceSecurity.js';
const api = vi.hoisted(() => ({ listClubMembers: vi.fn(), listClubInvitations: vi.fn(), listSupportSessions: vi.fn(), listAuditEvents: vi.fn() }));
vi.mock('../../src/lib/supabase.js', () => ({ DB: api }));
let host, root, latest, pending;
function Harness({ club, enabled = true }) { latest = useWorkspaceSecurity(club, enabled); return React.createElement('div', null, latest.members.map(row => row.display_name).join(',')); }
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host); pending = {};
  api.listClubMembers.mockImplementation(club => new Promise(resolve => { pending[club] = resolve; }));
  for (const key of ['listClubInvitations', 'listSupportSessions', 'listAuditEvents']) api[key].mockResolvedValue([]);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.clearAllMocks(); });
test('club switch immediately hides previous members while next club is loading', async () => {
  await act(async () => root.render(React.createElement(Harness, { club: 'a' })));
  await act(async () => pending.a([{ display_name: 'Club A coach' }]));
  expect(host.textContent).toBe('Club A coach');
  await act(async () => root.render(React.createElement(Harness, { club: 'b' })));
  expect(host.textContent).toBe('');
  expect(latest.status).toBe('loading');
  await act(async () => pending.b([{ display_name: 'Club B coach' }]));
  expect(host.textContent).toBe('Club B coach');
});
test('a delayed previous-club response cannot replace the current club data', async () => {
  await act(async () => root.render(React.createElement(Harness, { club: 'a' })));
  await act(async () => root.render(React.createElement(Harness, { club: 'b' })));
  await act(async () => pending.b([{ display_name: 'Club B coach' }]));
  await act(async () => pending.a([{ display_name: 'Club A coach' }]));
  expect(host.textContent).toBe('Club B coach');
});
