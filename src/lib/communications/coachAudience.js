function text(value) {
  return String(value ?? "").trim();
}

function unique(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(text).filter(Boolean))];
}

export function buildAnnualPlannerCoachAudience({
  reason = "Annual Planner update",
  bookings = [],
  blackouts = [],
  selectedBookingIds = [],
  selectedBlackoutIds = [],
  teamKeys = [],
} = {}) {
  const bookingIds = new Set(unique(selectedBookingIds));
  const blackoutIds = new Set(unique(selectedBlackoutIds));
  const selectedBookings = bookingIds.size
    ? (Array.isArray(bookings) ? bookings : []).filter((booking) => bookingIds.has(text(booking.id)))
    : [];
  const selectedBlackouts = (Array.isArray(blackouts) ? blackouts : []).filter((blackout) => blackoutIds.has(text(blackout.id)));
  const affectedTeams = new Set(unique(teamKeys));

  selectedBookings.forEach((booking) => {
    if (text(booking.teamKey || booking.team_key)) affectedTeams.add(text(booking.teamKey || booking.team_key));
  });

  selectedBlackouts.forEach((blackout) => {
    const start = new Date(blackout.startAt || blackout.start_at || 0).getTime();
    const end = new Date(blackout.endAt || blackout.end_at || start).getTime();
    const pitchId = text(blackout.pitchId || blackout.pitch_id);
    (Array.isArray(bookings) ? bookings : []).forEach((booking) => {
      const bookingStart = new Date(booking.startAt || booking.start_at || 0).getTime();
      const bookingEnd = new Date(booking.endAt || booking.end_at || bookingStart).getTime();
      const pitchMatch = !pitchId || text(booking.pitchId || booking.pitch_id) === pitchId;
      if (pitchMatch && bookingStart < end && bookingEnd > start && text(booking.teamKey || booking.team_key)) {
        affectedTeams.add(text(booking.teamKey || booking.team_key));
      }
    });
  });

  return {
    id: `annual-planner-${Date.now()}`,
    source: "annual_planner",
    reason: text(reason) || "Annual Planner update",
    teamKeys: [...affectedTeams].sort(),
    bookingIds: selectedBookings.map((row) => text(row.id)).filter(Boolean),
    blackoutIds: [...blackoutIds],
    createdAt: new Date().toISOString(),
  };
}

export function filterCommunicationRowsByAudience(rows = [], audience = null) {
  if (!audience?.teamKeys?.length) return Array.isArray(rows) ? rows : [];
  const keys = new Set(unique(audience.teamKeys).map((row) => row.toLowerCase()));
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const contactKey = text(row.contact?.teamKey || row.contact?.team_key).toLowerCase();
    const teamName = text(row.teamName || row.team_name).toLowerCase();
    return keys.has(contactKey) || keys.has(teamName);
  });
}

export function coachAudienceSummary(audience = null) {
  if (!audience?.teamKeys?.length) return "All teams";
  const count = audience.teamKeys.length;
  return `${count} affected team${count === 1 ? "" : "s"} · ${audience.reason || "Annual Planner update"}`;
}
