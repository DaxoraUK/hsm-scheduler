import { sendDaxoraEmail } from "../notifications/email.js";

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date to be confirmed"
    : new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/London",
    }).format(date);
}

export async function deliverCoachHubReminder(reminder = {}) {
  const recipient = String(reminder.email || "").trim().toLowerCase();
  if (!recipient) {
    throw Object.assign(new Error("The coach reminder has no email recipient."), {
      code: "COACH_REMINDER_RECIPIENT_REQUIRED",
      status: 400,
    });
  }
  const displayName = String(reminder.display_name || reminder.displayName || "Coach").trim();
  const clubName = String(reminder.club_name || reminder.clubName || "Your club").trim();
  const teamName = String(reminder.team_name || reminder.teamName || "Your team").trim();
  const title = String(reminder.booking_title || reminder.bookingTitle || "Team activity").trim();
  const venue = [reminder.venue_name || reminder.venueName, reminder.pitch_name || reminder.pitchName].map((value) => String(value || "").trim()).filter(Boolean).join(" · ") || "Venue to be confirmed";
  const when = formatDate(reminder.start_at || reminder.startAt);
  const urgent = String(reminder.reminder_type || reminder.reminderType) === "4_hour";
  const subject = `${urgent ? "Today" : "Coming up"}: ${teamName} · ${title}`;
  const html = `
    <div style="background:#f1f5f9;padding:32px 16px;font-family:Arial,sans-serif;color:#0f172a">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;overflow:hidden">
        <div style="background:#020617;padding:26px 28px;color:#ffffff">
          <div style="font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#6ee7b7">Daxora Coach Hub</div>
          <h1 style="margin:12px 0 0;font-size:27px;line-height:1.2">${urgent ? "Team activity today" : "Upcoming team activity"}</h1>
        </div>
        <div style="padding:28px">
          <p style="font-size:16px;line-height:1.65;margin:0 0 18px">Hello ${escapeHtml(displayName)},</p>
          <p style="font-size:16px;line-height:1.65;margin:0 0 18px"><strong>${escapeHtml(teamName)}</strong> has <strong>${escapeHtml(title)}</strong> scheduled.</p>
          <div style="border:1px solid #d1fae5;background:#ecfdf5;border-radius:16px;padding:18px;margin:0 0 20px">
            <div style="font-weight:800;color:#065f46">${escapeHtml(when)}</div>
            <div style="margin-top:6px;color:#047857">${escapeHtml(venue)}</div>
          </div>
          <p style="font-size:14px;line-height:1.65;color:#475569;margin:0">Open Coach Hub to review the latest details and acknowledge urgent updates. ${escapeHtml(clubName)} remains the source of truth for venue changes.</p>
        </div>
      </div>
    </div>`;
  return sendDaxoraEmail({
    to: [recipient],
    subject,
    html,
    text: `${displayName}, ${teamName} has ${title} on ${when} at ${venue}. Open Daxora Coach Hub for the latest details.`,
    idempotencyKey: `coach-reminder-${reminder.id}`,
    tags: { product: "coach-hub", type: urgent ? "4-hour-reminder" : "48-hour-reminder" },
  });
}
