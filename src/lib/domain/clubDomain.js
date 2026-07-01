/**
 * Club Domain
 *
 * Centralises club configuration lookups so pages and engines stop poking at
 * raw settings structures directly. These helpers are deliberately small and
 * safe; they can be expanded as Settings Centre becomes the source of truth.
 */

export function getClubName(club = {}) {
  return club?.name || club?.clubName || "Ground Control Club";
}

export function getClubSites(club = {}) {
  const sites = Array.isArray(club?.sites) ? club.sites : [];

  if (sites.length > 0) {
    return sites.map((site, index) => ({
      id: site.id || site.key || `site-${index + 1}`,
      name: site.name || site.label || `Site ${index + 1}`,
      postcode: site.postcode || site.weatherPostcode || "",
      isPrimary: Boolean(site.isPrimary || site.primary),
      parkingCapacity: Number(site.parkingCapacity || site.spaces || 0),
      raw: site,
    }));
  }

  return [
    {
      id: "primary",
      name: club?.venue || club?.groundName || "Primary",
      postcode: club?.weatherPostcode || club?.postcode || "",
      isPrimary: true,
      parkingCapacity: Number(club?.parkingCapacity || club?.carParkSpaces || 0),
      raw: club,
    },
  ];
}

export function getPrimarySite(club = {}) {
  const sites = getClubSites(club);
  return sites.find((site) => site.isPrimary) || sites[0] || null;
}

export function getWeatherPostcode(club = {}) {
  const primary = getPrimarySite(club);
  return (
    club?.weatherPostcode ||
    primary?.postcode ||
    club?.postcode ||
    club?.venuePostcode ||
    ""
  );
}

export function getParkingCapacity(club = {}, fallback = 0) {
  const primary = getPrimarySite(club);
  const capacity = Number(
    club?.parkingCapacity ||
      club?.carParkSpaces ||
      primary?.parkingCapacity ||
      fallback ||
      0
  );

  return Number.isFinite(capacity) ? capacity : 0;
}
