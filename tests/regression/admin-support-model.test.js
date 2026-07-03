import { describe, expect, test } from "vitest";

import {
  formatCaseNumber,
  normalisePlatformClub,
  normalisePlatformContext,
  normaliseSupportCase,
  summarisePlatform,
  validateCaseDraft,
  validateSubscriptionChange,
} from "../../src/lib/platform/adminModel.js";

describe("Daxora admin and support model", () => {
  test("normalises platform administrator identity without granting it to normal users", () => {
    expect(normalisePlatformContext({ is_platform_staff: false })).toMatchObject({
      isPlatformStaff: false,
      isPlatformAdmin: false,
      role: "support",
    });

    expect(normalisePlatformContext({
      is_platform_staff: true,
      user_id: "operator-1",
      email: "admin@daxora.test",
      display_name: "Daxora Admin",
      platform_role: "admin",
      status: "active",
    })).toMatchObject({
      isPlatformStaff: true,
      isPlatformAdmin: true,
      role: "admin",
      roleLabel: "Platform Administrator",
      displayName: "Daxora Admin",
    });
  });

  test("normalises club, subscription and owner metadata", () => {
    const club = normalisePlatformClub({
      club_id: "club-1",
      club_name: "Horwich St Mary's FC",
      club_status: "active",
      plan_code: "link",
      plan_name: "Link",
      subscription_status: "trialing",
      owner_email: "owner@example.test",
      member_count: "4",
      team_count: "12",
      pitch_count: "5",
      venue_count: "1",
      open_case_count: "2",
      active_support_count: "1",
      trial_ends_at: "2026-07-17T12:00:00Z",
    });

    expect(club).toMatchObject({
      id: "club-1",
      name: "Horwich St Mary's FC",
      planCode: "link",
      planName: "Link",
      subscriptionStatus: "trialing",
      ownerEmail: "owner@example.test",
      memberCount: 4,
      teamCount: 12,
      pitchCount: 5,
      venueCount: 1,
      openCaseCount: 2,
      activeSupportCount: 1,
    });
    expect(club.trialEndsAt).toBeInstanceOf(Date);
  });

  test("summarises platform risk and support workload", () => {
    const clubs = [
      normalisePlatformClub({ club_id: "a", club_status: "active", subscription_status: "trialing", active_support_count: 1 }),
      normalisePlatformClub({ club_id: "b", club_status: "suspended", subscription_status: "suspended", active_support_count: 2 }),
      normalisePlatformClub({ club_id: "c", club_status: "active", subscription_status: "grace", active_support_count: 0 }),
    ];
    const cases = [
      normaliseSupportCase({ id: "1", status: "open", priority: "urgent" }),
      normaliseSupportCase({ id: "2", status: "investigating", priority: "normal" }),
      normaliseSupportCase({ id: "3", status: "resolved", priority: "urgent" }),
    ];

    expect(summarisePlatform(clubs, cases)).toEqual({
      clubs: 3,
      activeClubs: 2,
      suspendedClubs: 1,
      trials: 1,
      grace: 1,
      readOnlySubscriptions: 1,
      openCases: 2,
      urgentCases: 1,
      activeSupportSessions: 3,
    });
  });

  test("validates manual plan changes and retains the Link product name", () => {
    expect(validateSubscriptionChange({
      planCode: "link",
      status: "active",
      billingInterval: "monthly",
      reason: "Approved commercial move",
    })).toEqual([]);

    expect(validateSubscriptionChange({
      planCode: "club-link",
      status: "unknown",
      billingInterval: "weekly",
      reason: "no",
    })).toEqual([
      "Select a supported plan.",
      "Select a supported subscription status.",
      "Select a supported billing interval.",
      "Enter a clear reason for the plan change.",
    ]);
  });

  test("validates support-case input and formats traceable case numbers", () => {
    expect(validateCaseDraft({
      clubId: "club-1",
      subject: "Cannot publish Saturday matchweek",
      priority: "high",
      requesterEmail: "owner@example.test",
    })).toEqual([]);

    expect(validateCaseDraft({ clubId: "", subject: "No", priority: "critical", requesterEmail: "wrong" })).toHaveLength(4);
    expect(formatCaseNumber(1042)).toBe("GC-001042");
  });
});
