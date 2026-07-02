import React from "react";
import { Car, MapPinned, Plus, Star, Trash2 } from "lucide-react";
import {
  Field,
  Notice,
  PrimaryButton,
  SaveBar,
  SecondaryButton,
  SettingsPanel,
  SettingsSectionHeader,
  StatTile,
  Toggle,
  inputClass,
} from "./SettingsPrimitives.jsx";

const FORMAT_LABELS = [
  ["3v3", "3v3"],
  ["5v5", "5v5"],
  ["7v7", "7v7"],
  ["9v9", "9v9"],
  ["11v11-youth", "11v11 Youth"],
  ["11v11-small", "11v11 Small"],
  ["11v11", "11v11 Full"],
];

function slugifySiteId(value, fallback = "site") {
  const clean = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return clean || fallback;
}

function getSites(club = {}) {
  const sites = Array.isArray(club.sites) ? club.sites : [];
  if (sites.length) {
    return sites.map((site, index) => ({
      id: site.id || slugifySiteId(site.name || site.venue || `site-${index + 1}`, `site-${index + 1}`),
      name: site.name || site.venue || `Site ${index + 1}`,
      venue: site.venue || site.name || "",
      postcode: String(site.postcode || "").toUpperCase(),
      isPrimary: !!site.isPrimary || site.id === club.primarySiteId || (!club.primarySiteId && index === 0),
      carParkSpaces: Number(site.carParkSpaces ?? club.carParkSpaces ?? 0),
      weatherEnabled: site.weatherEnabled !== false,
      notes: site.notes || "",
    }));
  }
  return [{
    id: club.primarySiteId || "main-ground",
    name: club.venue || "Main Ground",
    venue: club.venue || "",
    postcode: String(club.postcode || club.weatherPostcode || "").toUpperCase(),
    isPrimary: true,
    carParkSpaces: Number(club.carParkSpaces || 0),
    weatherEnabled: true,
    notes: "Primary matchday site",
  }];
}

function normaliseSites(sites, club = {}) {
  const cleaned = sites.map((site, index) => {
    const name = site.name || site.venue || `Site ${index + 1}`;
    return {
      id: site.id || slugifySiteId(name, `site-${index + 1}`),
      name,
      venue: site.venue || name,
      postcode: String(site.postcode || "").trim().toUpperCase(),
      isPrimary: !!site.isPrimary,
      carParkSpaces: Number(site.carParkSpaces) || 0,
      weatherEnabled: site.weatherEnabled !== false,
      notes: site.notes || "",
    };
  });

  if (!cleaned.some((site) => site.isPrimary) && cleaned[0]) cleaned[0] = { ...cleaned[0], isPrimary: true };
  const primary = cleaned.find((site) => site.isPrimary) || cleaned[0];
  const weatherSite = cleaned.find((site) => site.weatherEnabled && site.postcode) || primary;

  return {
    sites: cleaned,
    primarySiteId: primary?.id || club.primarySiteId || "main-ground",
    venue: primary?.venue || club.venue || "",
    postcode: primary?.postcode || club.postcode || "",
    weatherPostcode: weatherSite?.postcode || primary?.postcode || club.weatherPostcode || "",
    carParkSpaces: primary?.carParkSpaces || club.carParkSpaces || 0,
  };
}

export default function VenueSettingsPanel({ club = {}, setClub, AVG_CARS = {}, saveTab, savedTab }) {
  const sites = getSites(club);
  const primary = sites.find((site) => site.isPrimary) || sites[0];
  const totalParking = sites.reduce((sum, site) => sum + (Number(site.carParkSpaces) || 0), 0);

  const updateSites = (nextSites) => {
    const next = normaliseSites(nextSites, club);
    setClub((current) => ({ ...current, ...next }));
  };

  const updateSite = (index, field, value) => {
    updateSites(sites.map((site, rowIndex) => {
      if (rowIndex !== index) return site;
      const next = { ...site, [field]: value };
      if (field === "name" && (!site.id || site.id.startsWith("site-"))) next.id = slugifySiteId(value, site.id || `site-${index + 1}`);
      return next;
    }));
  };

  const addSite = () => {
    const number = sites.length + 1;
    updateSites([...sites, {
      id: `site-${number}`,
      name: `Site ${number}`,
      venue: "",
      postcode: "",
      isPrimary: false,
      carParkSpaces: 0,
      weatherEnabled: true,
      notes: "",
    }]);
  };

  return (
    <div className="space-y-5">
      <SettingsPanel>
        <SettingsSectionHeader
          icon={MapPinned}
          eyebrow="Locations"
          title="Venues & sites"
          description="Every pitch belongs to a site. Accurate postcodes and parking capacity power weather and congestion intelligence."
          action={<PrimaryButton icon={Plus} onClick={addSite}>Add site</PrimaryButton>}
        />

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Sites" value={sites.length} tone="green" />
          <StatTile label="Primary" value={primary?.name || "Unset"} tone="blue" />
          <StatTile label="Parking" value={`${totalParking} spaces`} tone="slate" />
          <StatTile label="Weather location" value={club.weatherPostcode || primary?.postcode || "Missing"} tone={club.weatherPostcode || primary?.postcode ? "blue" : "amber"} />
        </div>

        <div className="mt-6 space-y-4">
          {sites.map((site, index) => (
            <div key={`${site.id}-${index}`} className={`rounded-[24px] border p-5 ${site.isPrimary ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-white"}`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-slate-950">{site.name || `Site ${index + 1}`}</h3>
                    {site.isPrimary ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700"><Star size={12} /> Primary</span> : null}
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{site.venue || "Address not set"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!site.isPrimary ? <SecondaryButton icon={Star} onClick={() => updateSites(sites.map((row, rowIndex) => ({ ...row, isPrimary: rowIndex === index })))}>Make primary</SecondaryButton> : null}
                  {sites.length > 1 && !site.isPrimary ? <SecondaryButton icon={Trash2} onClick={() => updateSites(sites.filter((_, rowIndex) => rowIndex !== index))}>Remove</SecondaryButton> : null}
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Site name"><input className={inputClass} value={site.name} onChange={(event) => updateSite(index, "name", event.target.value)} /></Field>
                <Field label="Venue / address"><input className={inputClass} value={site.venue} onChange={(event) => updateSite(index, "venue", event.target.value)} /></Field>
                <Field label="Postcode"><input className={inputClass} value={site.postcode} onChange={(event) => updateSite(index, "postcode", event.target.value.toUpperCase())} placeholder="BL6 7QE" /></Field>
                <Field label="Parking spaces"><input type="number" min={0} className={inputClass} value={site.carParkSpaces} onChange={(event) => updateSite(index, "carParkSpaces", Number(event.target.value))} /></Field>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
                <Field label="Operational notes"><input className={inputClass} value={site.notes} onChange={(event) => updateSite(index, "notes", event.target.value)} placeholder="Access, overflow or site notes" /></Field>
                <Toggle checked={site.weatherEnabled !== false} onChange={(value) => updateSite(index, "weatherEnabled", value)} label="Use for weather intelligence" description="The first enabled site with a postcode becomes the weather location." />
              </div>
            </div>
          ))}
        </div>

        <SaveBar onSave={() => saveTab?.("venues", { club })} saved={savedTab === "venues"} label="Save venues">
          Changes update venue, postcode and parking assumptions across Operations.
        </SaveBar>
      </SettingsPanel>

      <SettingsPanel>
        <SettingsSectionHeader
          icon={Car}
          eyebrow="Parking intelligence"
          title="Estimated vehicles per fixture"
          description="Set realistic averages by format. Ground Control uses them to predict arrival waves and capacity pressure."
        />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {FORMAT_LABELS.map(([format, label]) => (
            <Field key={format} label={label}>
              <input
                type="number"
                min={0}
                max={250}
                className={inputClass}
                value={club.avgCars?.[format] ?? AVG_CARS[format] ?? 0}
                onChange={(event) => setClub((current) => ({ ...current, avgCars: { ...(current.avgCars || AVG_CARS), [format]: Number(event.target.value) || 0 } }))}
              />
            </Field>
          ))}
        </div>
        <Notice tone="neutral">These are club-wide defaults. Site capacity is configured above and can differ between grounds.</Notice>
        <SaveBar onSave={() => saveTab?.("venues", { club })} saved={savedTab === "venues"} label="Save venue settings">
          Saves sites, parking capacity, weather locations and vehicle assumptions together.
        </SaveBar>
      </SettingsPanel>
    </div>
  );
}
