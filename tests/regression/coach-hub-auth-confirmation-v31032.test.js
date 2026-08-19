import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const migrationPath = "supabase/migrations/202607160006_coach_hub_auth_callback_and_self_service_audit.sql";

describe("Ground Control v3.10.3.2 Coach Hub account confirmation", () => {
  it("sends Supabase signup confirmation back to the live Ground Control origin", () => {
    const repository = read("src/lib/supabase.js");
    expect(repository).toContain("VITE_AUTH_REDIRECT_URL");
    expect(repository).toContain("/signup?redirect_to=");
    expect(repository).toContain("encodeURIComponent(redirectTo)");
    expect(repository).toContain('"coach_invite"');
  });

  it("consumes the Supabase implicit confirmation session before validating stored auth", () => {
    const repository = read("src/lib/supabase.js");
    const app = read("src/AppCore.jsx");
    expect(repository).toContain("async consumeRedirectSession()");
    expect(repository).toContain('params.get("access_token")');
    expect(repository).toContain('params.get("refresh_token")');
    expect(repository).toContain("Auth.saveSession(session)");
    expect(app).toContain("const callback = await Auth.consumeRedirectSession()");
    expect(app.indexOf("Auth.consumeRedirectSession()")).toBeLessThan(app.indexOf("callback?.session || Auth.getSession()"));
  });

  it("retains the pending Coach Hub token if Supabase confirmation opens another tab", () => {
    const access = read("src/hooks/useClubAccess.js");
    expect(access).toContain("gc_pending_auth_context_");
    expect(access).toContain("window.localStorage?.setItem");
    expect(access).toContain("window.localStorage?.getItem");
    expect(access).toContain("window.localStorage?.removeItem");
  });

  it("replaces the operator-only audit call in invitation acceptance", () => {
    const migration = read(migrationPath);
    expect(migration).toContain("private.record_coach_hub_audit_event");
    expect(migration).toContain("accept_coach_hub_invitation");
    expect(migration).toContain("create_booking_from_coach_request");
    expect(migration).toContain("pg_catalog.pg_get_functiondef");
    expect(migration).toContain("'public.record_audit_event('");
    expect(migration).toContain("'private.record_coach_hub_audit_event('");
  });

  it("keeps the self-service audit helper private and access checked", () => {
    const migration = read(migrationPath);
    expect(migration).toContain("not public.can_operate_club(target_club_id)");
    expect(migration).toContain("not public.can_access_coach_hub(target_club_id)");
    expect(migration).toContain("revoke all on function private.record_coach_hub_audit_event");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });
});
