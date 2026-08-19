import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  alignTeamContactsForEditing,
  normaliseEditableTeamContact,
  normaliseTeamContact,
} from "../../src/lib/communications/contactModel.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const teamSettings = read("../../src/components/Settings/TeamSettingsPanel.jsx");
const privacySettings = read("../../src/components/Settings/CommunicationsPrivacyPanel.jsx");
const communicationsPage = read("../../src/pages/CommunicationsPage.jsx");
const confirmDialog = read("../../src/ui/ConfirmDialog.jsx");
const migration = read("../../supabase/migrations/202607110004_fix_communication_request_key_ambiguity.sql");

describe("communications pilot UI and database fixes", () => {
  test("preserves spaces while coach contact fields are being edited and trims them only for persistence", () => {
    const editing = normaliseEditableTeamContact({
      teamKey: "u14",
      teamName: "U14",
      coachName: "Andrew ",
      coachPhone: "07123 ",
      coachEmail: "andrew ",
    });

    expect(editing.coachName).toBe("Andrew ");
    expect(editing.coachPhone).toBe("07123 ");
    expect(editing.coachEmail).toBe("andrew ");

    const aligned = alignTeamContactsForEditing(
      [{ id: "u14", name: "U14" }],
      [editing],
    );
    expect(aligned[0].coachName).toBe("Andrew ");

    const saved = normaliseTeamContact(editing);
    expect(saved.coachName).toBe("Andrew");
    expect(saved.coachPhone).toBe("07123");
    expect(saved.coachEmail).toBe("andrew");
  });

  test("does not normalise contact or privacy text on every keypress", () => {
    expect(teamSettings).toContain("alignTeamContactsForEditing");
    expect(teamSettings).toContain("normaliseEditableTeamContact");
    expect(privacySettings).toContain('setDraft((current) => ({ ...current, [field]: value }))');
    expect(privacySettings).not.toContain('setDraft((current) => normaliseCommunicationPrivacy({ ...current, [field]: value }))');
  });

  test("uses app-native portalled dialogs instead of the browser confirm popup", () => {
    expect(communicationsPage).toContain('import { createPortal } from "react-dom"');
    expect(communicationsPage).toContain("return createPortal(");
    expect(communicationsPage).toContain("<ConfirmDialog");
    expect(communicationsPage).toContain("Send staging email test");
    expect(communicationsPage).not.toContain("window.confirm");
    expect(confirmDialog).toContain('import { createPortal } from "react-dom"');
    expect(confirmDialog).toContain("document.body");
  });

  test("targets the delivery batch unique constraint so request_key is unambiguous", () => {
    expect(migration).toContain("on conflict on constraint communication_delivery_batches_club_id_request_key_key");
    expect(migration).not.toContain("on conflict (club_id, request_key)");
  });
});
