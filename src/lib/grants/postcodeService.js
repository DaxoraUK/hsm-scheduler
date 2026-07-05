const POSTCODE_LOOKUP_ENDPOINT = "https://api.postcodes.io/postcodes";

export function normaliseUkPostcode(value) {
  const compact = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!compact) return "";
  if (compact.length <= 3) return compact;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export function isPlausibleUkPostcode(value) {
  return /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i.test(String(value || "").trim());
}

export function homeNationFromPostcodeResult(result = {}) {
  const country = String(result.country || result.european_electoral_region || "").toLowerCase();
  if (country.includes("scotland")) return "scotland";
  if (country.includes("wales")) return "wales";
  if (country.includes("northern ireland")) return "northern-ireland";
  return "england";
}

export async function resolveFundingPostcode(postcode, { fetchImpl = globalThis.fetch, timeoutMs = 8000 } = {}) {
  const normalised = normaliseUkPostcode(postcode);
  if (!isPlausibleUkPostcode(normalised)) {
    throw new Error("Enter a complete UK postcode, for example BL6 7QE.");
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("Postcode lookup is unavailable in this environment.");
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeout = controller ? globalThis.setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetchImpl(`${POSTCODE_LOOKUP_ENDPOINT}/${encodeURIComponent(normalised)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller?.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.result) {
      if (response.status === 404) throw new Error("That postcode could not be found.");
      throw new Error(payload?.error || "Postcode details could not be resolved.");
    }

    const result = payload.result;
    return {
      postcode: normaliseUkPostcode(result.postcode || normalised),
      homeNation: homeNationFromPostcodeResult(result),
      country: result.country || "",
      region: result.region || result.european_electoral_region || "",
      localAuthority: result.admin_district || result.admin_ward || "",
      adminCounty: result.admin_county || "",
      parliamentaryConstituency: result.parliamentary_constituency || "",
      latitude: Number.isFinite(Number(result.latitude)) ? Number(result.latitude) : null,
      longitude: Number.isFinite(Number(result.longitude)) ? Number(result.longitude) : null,
      codes: result.codes || {},
      resolvedAt: new Date().toISOString(),
      source: "Postcodes.io / ONS Postcode Directory",
    };
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Postcode lookup timed out. Try again.");
    throw error;
  } finally {
    if (timeout) globalThis.clearTimeout(timeout);
  }
}

export default resolveFundingPostcode;
