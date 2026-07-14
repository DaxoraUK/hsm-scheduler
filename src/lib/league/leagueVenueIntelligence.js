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
