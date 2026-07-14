const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

export function normaliseUkPostcode(value) {
  const compact = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (compact.length < 5 || compact.length > 7) return "";
  const formatted = `${compact.slice(0, -3)} ${compact.slice(-3)}`;
  return UK_POSTCODE.test(formatted) ? formatted : "";
}

export function buildVenueGeocodeRequest(venues = []) {
  const seen = new Set();
  return (Array.isArray(venues) ? venues : [])
    .map((venue) => ({ id: String(venue?.id || "").trim(), postcode: normaliseUkPostcode(venue?.postcode) }))
    .filter((venue) => venue.id && venue.postcode)
    .filter((venue) => {
      const key = `${venue.id}:${venue.postcode}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 100);
}

export function coordinateSourceLabel(source) {
  const labels = {
    manual: "Manually refined",
    postcode_centroid: "Postcode centroid",
    import: "Imported coordinates",
    mixed: "Mixed coordinate quality",
  };
  return labels[String(source || "").toLowerCase()] || "Location not classified";
}

export function haversineMiles(left, right) {
  const lat1 = Number(left?.latitude);
  const lon1 = Number(left?.longitude);
  const lat2 = Number(right?.latitude);
  const lon2 = Number(right?.longitude);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusMiles = 3958.7613;
  const deltaLat = radians(lat2 - lat1);
  const deltaLon = radians(lon2 - lon1);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return earthRadiusMiles * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function physicalVenueName(name) {
  return String(name || "Venue")
    .replace(/\s+#\d+\s*$/i, "")
    .replace(/\s+pitch\s+\d+\s*$/i, "")
    .trim();
}

function sourceForRows(rows) {
  const sources = new Set(rows.map((row) => String(row.coordinateSource || "").toLowerCase()).filter(Boolean));
  if (!sources.size) return "";
  return sources.size === 1 ? [...sources][0] : "mixed";
}

export function groupLeagueVenues(venues = [], venuePositions = []) {
  const positions = new Map((Array.isArray(venuePositions) ? venuePositions : []).map((row) => [row.id, row]));
  const groups = new Map();

  for (const sourceVenue of Array.isArray(venues) ? venues : []) {
    const position = positions.get(sourceVenue.id) || {};
    const venue = { ...sourceVenue, ...position };
    const postcode = normaliseUkPostcode(venue.postcode);
    const coordinateKey = Number.isFinite(venue.latitude) && Number.isFinite(venue.longitude)
      ? `${Number(venue.latitude).toFixed(4)}:${Number(venue.longitude).toFixed(4)}`
      : "";
    const key = String(venue.groundShareKey || "").trim()
      || (postcode && coordinateKey ? `${postcode}:${coordinateKey}` : `venue:${venue.id}`);
    const current = groups.get(key) || {
      id: key,
      name: physicalVenueName(venue.name),
      postcode: postcode || String(venue.postcode || ""),
      address: venue.address || "",
      groundShareKey: venue.groundShareKey || "",
      venueIds: [],
      pitches: [],
      capacity: 0,
      latitude: null,
      longitude: null,
      coordinateSource: "",
      coordinateAccuracy: "",
      positionRows: [],
    };
    current.venueIds.push(venue.id);
    current.pitches.push({
      id: venue.id,
      name: venue.name,
      simultaneousFixtureLimit: Number(venue.simultaneousFixtureLimit || 1),
      latitude: Number.isFinite(venue.latitude) ? Number(venue.latitude) : null,
      longitude: Number.isFinite(venue.longitude) ? Number(venue.longitude) : null,
      coordinateSource: venue.coordinateSource || "",
      coordinateAccuracy: venue.coordinateAccuracy || "",
    });
    current.capacity += Math.max(1, Number(venue.simultaneousFixtureLimit || 1));
    if (Number.isFinite(venue.latitude) && Number.isFinite(venue.longitude)) {
      current.positionRows.push(venue);
      if (!Number.isFinite(current.latitude) || !Number.isFinite(current.longitude)) {
        current.latitude = Number(venue.latitude);
        current.longitude = Number(venue.longitude);
      }
    }
    groups.set(key, current);
  }

  return [...groups.values()].map((group) => {
    if (group.positionRows.length > 1) {
      group.latitude = group.positionRows.reduce((sum, row) => sum + Number(row.latitude), 0) / group.positionRows.length;
      group.longitude = group.positionRows.reduce((sum, row) => sum + Number(row.longitude), 0) / group.positionRows.length;
    }
    group.coordinateSource = sourceForRows(group.positionRows);
    group.coordinateAccuracy = group.positionRows[0]?.coordinateAccuracy || "";
    delete group.positionRows;
    return group;
  }).sort((left, right) => left.name.localeCompare(right.name));
}

function dateKey(fixture) {
  return `${fixture.date || "unplaced"}:${String(fixture.kickOff || "").slice(0, 5) || "TBC"}`;
}

export function buildVenueOperationalSummaries(groups = [], fixtures = []) {
  return (Array.isArray(groups) ? groups : []).map((group) => {
    const rows = (Array.isArray(fixtures) ? fixtures : []).filter((fixture) => group.venueIds.includes(fixture.venueId));
    const concurrent = new Map();
    for (const fixture of rows) concurrent.set(dateKey(fixture), (concurrent.get(dateKey(fixture)) || 0) + 1);
    const peakConcurrent = concurrent.size ? Math.max(...concurrent.values()) : 0;
    const capacity = Math.max(1, Number(group.capacity || 1));
    const pressureRatio = peakConcurrent / capacity;
    return {
      ...group,
      fixtures: rows,
      fixtureCount: rows.length,
      missingOfficialCount: rows.filter((row) => row.officialComplete === false).length,
      postponedCount: rows.filter((row) => row.status === "postponed").length,
      unplacedCount: rows.filter((row) => !row.date).length,
      teamCount: new Set(rows.flatMap((row) => [row.homeTeamId, row.awayTeamId]).filter(Boolean)).size,
      peakConcurrent,
      pressureRatio,
      overCapacity: peakConcurrent > capacity,
    };
  });
}

export function filterFixturesForVenueScope(fixtures = [], scope = "season", options = {}) {
  const rows = Array.isArray(fixtures) ? fixtures : [];
  if (scope === "season") return rows;
  const focusDate = String(options.focusDate || "").slice(0, 10);
  const focusMonth = String(options.focusMonth || focusDate.slice(0, 7));
  if (scope === "matchday") return rows.filter((row) => row.date === focusDate);
  if (scope === "month") return rows.filter((row) => String(row.date || "").startsWith(focusMonth));
  if (scope === "next30") {
    const start = options.today ? new Date(`${options.today}T12:00:00`) : new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + 30);
    return rows.filter((row) => {
      if (!row.date) return false;
      const date = new Date(`${row.date}T12:00:00`);
      return date >= start && date <= end;
    });
  }
  return rows;
}

export function clusterVenueMarkers(markers = [], radius = 46) {
  const clusters = [];
  for (const marker of Array.isArray(markers) ? markers : []) {
    const existing = clusters.find((cluster) => Math.hypot(cluster.x - marker.x, cluster.y - marker.y) <= radius);
    if (!existing) {
      clusters.push({ x: marker.x, y: marker.y, markers: [marker] });
      continue;
    }
    existing.markers.push(marker);
    existing.x = existing.markers.reduce((sum, row) => sum + row.x, 0) / existing.markers.length;
    existing.y = existing.markers.reduce((sum, row) => sum + row.y, 0) / existing.markers.length;
  }
  return clusters;
}
