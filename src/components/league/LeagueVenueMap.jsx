import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  CalendarDays,
  Crosshair,
  Gauge,
  Layers3,
  MapPin,
  Minus,
  Plus,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { DB } from "../../lib/supabase.js";
import {
  buildVenueGeocodeRequest,
  buildVenueOperationalSummaries,
  clusterVenueMarkers,
  coordinateSourceLabel,
  filterFixturesForVenueScope,
  groupLeagueVenues,
} from "../../lib/league/leagueVenueIntelligence.js";

const BUTTON = "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3.5 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50";
const INPUT = "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";
const TILE_SIZE = 256;
const MIN_ZOOM = 6;
const MAX_ZOOM = 15;
const DEFAULT_MAP_SIZE = { width: 820, height: 590 };
const TILE_URL = import.meta.env.VITE_LEAGUE_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

function Panel({ children, className = "" }) {
  return <section className={`rounded-[26px] border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>;
}

function Pill({ children, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    blue: "border-sky-200 bg-sky-50 text-sky-700",
    navy: "border-slate-950 bg-slate-950 text-white",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.11em] ${tones[tone] || tones.slate}`}>{children}</span>;
}

function Metric({ icon: Icon, label, value, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    blue: "border-sky-200 bg-sky-50 text-sky-700",
  };
  return (
    <div className={`rounded-2xl border p-3 ${tones[tone] || tones.slate}`}>
      <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.14em] opacity-70"><Icon size={13} />{label}</div>
      <div className="mt-1 text-lg font-black text-slate-950">{value}</div>
    </div>
  );
}

function shortDate(value) {
  if (!value) return "Unplaced";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function projectWorld(latitude, longitude, zoom) {
  const scale = TILE_SIZE * (2 ** zoom);
  const latitudeRadians = Math.max(-85.05112878, Math.min(85.05112878, Number(latitude))) * Math.PI / 180;
  return {
    x: ((Number(longitude) + 180) / 360) * scale,
    y: (0.5 - (Math.log((1 + Math.sin(latitudeRadians)) / (1 - Math.sin(latitudeRadians))) / (4 * Math.PI))) * scale,
  };
}

function unprojectWorld(x, y, zoom) {
  const scale = TILE_SIZE * (2 ** zoom);
  const longitude = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const latitude = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { latitude, longitude };
}

function fitMapView(points, size = DEFAULT_MAP_SIZE) {
  if (!points.length) return { latitude: 53.6, longitude: -2.45, zoom: 8 };
  if (points.length === 1) return { latitude: points[0].latitude, longitude: points[0].longitude, zoom: 12 };
  const padding = 90;
  for (let zoom = MAX_ZOOM; zoom >= MIN_ZOOM; zoom -= 1) {
    const projected = points.map((point) => projectWorld(point.latitude, point.longitude, zoom));
    const minX = Math.min(...projected.map((point) => point.x));
    const maxX = Math.max(...projected.map((point) => point.x));
    const minY = Math.min(...projected.map((point) => point.y));
    const maxY = Math.max(...projected.map((point) => point.y));
    if (maxX - minX <= Math.max(220, size.width - padding * 2) && maxY - minY <= Math.max(220, size.height - padding * 2)) {
      return { ...unprojectWorld((minX + maxX) / 2, (minY + maxY) / 2, zoom), zoom };
    }
  }
  const latitude = points.reduce((sum, point) => sum + point.latitude, 0) / points.length;
  const longitude = points.reduce((sum, point) => sum + point.longitude, 0) / points.length;
  return { latitude, longitude, zoom: MIN_ZOOM };
}

function tileUrl(z, x, y) {
  return TILE_URL.replace("{z}", z).replace("{x}", x).replace("{y}", y);
}

function markerTone(site, layer) {
  if (layer === "officials") {
    if (!site.fixtureCount) return { bg: "#64748b", ring: "#e2e8f0", value: "0" };
    if (site.missingOfficialCount > Math.max(2, site.fixtureCount / 3)) return { bg: "#e11d48", ring: "#fecdd3", value: String(site.missingOfficialCount) };
    if (site.missingOfficialCount) return { bg: "#f59e0b", ring: "#fde68a", value: String(site.missingOfficialCount) };
    return { bg: "#059669", ring: "#a7f3d0", value: "✓" };
  }
  if (layer === "pressure") {
    if (site.overCapacity) return { bg: "#e11d48", ring: "#fecdd3", value: `${site.peakConcurrent}/${site.capacity}` };
    if (site.pressureRatio >= 0.75) return { bg: "#f59e0b", ring: "#fde68a", value: `${site.peakConcurrent}/${site.capacity}` };
    return { bg: site.fixtureCount ? "#0284c7" : "#64748b", ring: "#bae6fd", value: `${site.peakConcurrent}/${site.capacity}` };
  }
  if (!site.fixtureCount) return { bg: "#64748b", ring: "#e2e8f0", value: "0" };
  if (site.fixtureCount >= 20) return { bg: "#4338ca", ring: "#c7d2fe", value: String(site.fixtureCount) };
  if (site.fixtureCount >= 10) return { bg: "#0284c7", ring: "#bae6fd", value: String(site.fixtureCount) };
  return { bg: "#059669", ring: "#a7f3d0", value: String(site.fixtureCount) };
}

function siteTone(site, layer) {
  if (layer === "officials") return site.missingOfficialCount ? "amber" : "green";
  if (layer === "pressure") return site.overCapacity ? "rose" : site.pressureRatio >= 0.75 ? "amber" : "green";
  return site.fixtureCount ? "blue" : "slate";
}

function scopeLabel(scope, focusDate, focusMonth) {
  if (scope === "matchday") return focusDate ? `Matchday · ${shortDate(focusDate)}` : "Matchday";
  if (scope === "month") return focusMonth ? new Date(`${focusMonth}-01T12:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : "Month";
  if (scope === "next30") return "Next 30 days";
  return "Full season";
}

export default function LeagueVenueMap({ fixtures, workspace, operations, canManage, onRefreshOperations, onSelectFixture }) {
  const mapRef = useRef(null);
  const dragRef = useRef(null);
  const [mapSize, setMapSize] = useState(DEFAULT_MAP_SIZE);
  const [scope, setScope] = useState("season");
  const [layer, setLayer] = useState("fixtures");
  const [query, setQuery] = useState("");
  const dates = useMemo(() => [...new Set(fixtures.map((row) => row.date).filter(Boolean))].sort(), [fixtures]);
  const months = useMemo(() => [...new Set(dates.map((date) => date.slice(0, 7)))], [dates]);
  const [focusDate, setFocusDate] = useState(dates[0] || "");
  const [focusMonth, setFocusMonth] = useState(months[0] || "");
  const [geocoding, setGeocoding] = useState(false);

  const grouped = useMemo(() => groupLeagueVenues(workspace.venues, operations.venuePositions), [workspace.venues, operations.venuePositions]);
  const mappedGroups = useMemo(() => grouped.filter((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude)), [grouped]);
  const unmappedGroups = useMemo(() => grouped.filter((row) => !Number.isFinite(row.latitude) || !Number.isFinite(row.longitude)), [grouped]);
  const venueById = useMemo(() => new Map(workspace.venues.map((row) => [row.id, row])), [workspace.venues]);
  const geocodable = useMemo(() => buildVenueGeocodeRequest(unmappedGroups.flatMap((group) => group.venueIds.map((id) => venueById.get(id))).filter(Boolean)), [unmappedGroups, venueById]);

  const scopedFixtures = useMemo(() => filterFixturesForVenueScope(fixtures, scope, { focusDate, focusMonth }).map((fixture) => ({
    ...fixture,
    officialComplete: fixture.__officialComplete,
  })), [fixtures, scope, focusDate, focusMonth]);
  const sites = useMemo(() => buildVenueOperationalSummaries(grouped, scopedFixtures), [grouped, scopedFixtures]);
  const mappedSites = useMemo(() => sites.filter((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude)), [sites]);
  const [selectedSiteId, setSelectedSiteId] = useState(mappedSites[0]?.id || grouped[0]?.id || "");
  const selectedSite = sites.find((row) => row.id === selectedSiteId) || sites[0] || null;
  const [coords, setCoords] = useState({ latitude: selectedSite?.latitude ?? "", longitude: selectedSite?.longitude ?? "" });
  const [mapView, setMapView] = useState(() => fitMapView(mappedGroups, DEFAULT_MAP_SIZE));

  useEffect(() => {
    const node = mapRef.current;
    if (!node || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(320, Math.round(entry.contentRect.width));
      const height = Math.max(420, Math.round(entry.contentRect.height));
      setMapSize({ width, height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!dates.includes(focusDate)) setFocusDate(dates[0] || "");
  }, [dates, focusDate]);

  useEffect(() => {
    if (!months.includes(focusMonth)) setFocusMonth(months[0] || "");
  }, [months, focusMonth]);

  useEffect(() => {
    if (selectedSite && selectedSite.id !== selectedSiteId) setSelectedSiteId(selectedSite.id);
    setCoords({ latitude: selectedSite?.latitude ?? "", longitude: selectedSite?.longitude ?? "" });
  }, [selectedSite?.id, selectedSite?.latitude, selectedSite?.longitude]);

  useEffect(() => {
    if (mappedGroups.length) setMapView(fitMapView(mappedGroups, mapSize));
  }, [mappedGroups.length, mapSize.width, mapSize.height]);

  const worldCenter = projectWorld(mapView.latitude, mapView.longitude, mapView.zoom);
  const topLeft = { x: worldCenter.x - mapSize.width / 2, y: worldCenter.y - mapSize.height / 2 };
  const tiles = [];
  const tileCount = 2 ** mapView.zoom;
  for (let tileX = Math.floor(topLeft.x / TILE_SIZE); tileX <= Math.floor((topLeft.x + mapSize.width) / TILE_SIZE); tileX += 1) {
    for (let tileY = Math.floor(topLeft.y / TILE_SIZE); tileY <= Math.floor((topLeft.y + mapSize.height) / TILE_SIZE); tileY += 1) {
      if (tileY < 0 || tileY >= tileCount) continue;
      const wrappedX = ((tileX % tileCount) + tileCount) % tileCount;
      tiles.push({ key: `${mapView.zoom}:${tileX}:${tileY}`, x: tileX * TILE_SIZE - topLeft.x, y: tileY * TILE_SIZE - topLeft.y, url: tileUrl(mapView.zoom, wrappedX, tileY) });
    }
  }

  const markers = mappedSites.map((site) => {
    const point = projectWorld(site.latitude, site.longitude, mapView.zoom);
    return { ...site, x: point.x - topLeft.x, y: point.y - topLeft.y };
  }).filter((site) => site.x >= -60 && site.x <= mapSize.width + 60 && site.y >= -60 && site.y <= mapSize.height + 60);
  const clusters = clusterVenueMarkers(markers, mapView.zoom >= 12 ? 34 : mapView.zoom >= 10 ? 44 : 56);

  const sortedSites = useMemo(() => {
    const term = query.trim().toLowerCase();
    const rows = sites.filter((site) => !term || `${site.name} ${site.postcode} ${site.pitches.map((pitch) => pitch.name).join(" ")}`.toLowerCase().includes(term));
    return rows.sort((left, right) => {
      if (layer === "officials") return right.missingOfficialCount - left.missingOfficialCount || right.fixtureCount - left.fixtureCount;
      if (layer === "pressure") return Number(right.overCapacity) - Number(left.overCapacity) || right.pressureRatio - left.pressureRatio || right.fixtureCount - left.fixtureCount;
      return right.fixtureCount - left.fixtureCount || left.name.localeCompare(right.name);
    });
  }, [sites, query, layer]);

  const scopeFixtureCount = scopedFixtures.length;
  const missingOfficials = scopedFixtures.filter((row) => row.officialComplete === false).length;
  const pressureSites = sites.filter((row) => row.pressureRatio >= 0.75 && row.fixtureCount).length;

  const selectSite = (site, recenter = false) => {
    setSelectedSiteId(site.id);
    if (recenter && Number.isFinite(site.latitude) && Number.isFinite(site.longitude)) setMapView((current) => ({ latitude: site.latitude, longitude: site.longitude, zoom: Math.max(current.zoom, 12) }));
  };

  const fitAll = () => setMapView(fitMapView(mappedSites, mapSize));
  const zoomBy = (delta) => setMapView((current) => ({ ...current, zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current.zoom + delta)) }));

  const geocodeAll = async () => {
    if (!geocodable.length) return;
    setGeocoding(true);
    try {
      const result = await DB.geocodeLeagueVenuePostcodes(workspace.league.id, geocodable);
      if (result.coordinates?.length) {
        await DB.bulkUpdateLeagueVenueMapPositions(workspace.league.id, result.coordinates);
        await onRefreshOperations?.();
      }
      if (result.unmatched?.length) toast.warning(`${result.unmatched.length} postcode${result.unmatched.length === 1 ? "" : "s"} could not be matched`);
      toast.success(`${result.coordinates?.length || 0} venue location${result.coordinates?.length === 1 ? "" : "s"} mapped`);
    } catch (error) {
      toast.error("Venue postcodes could not be mapped", { description: error?.message });
    } finally {
      setGeocoding(false);
    }
  };

  const saveSitePosition = async () => {
    if (!selectedSite) return;
    try {
      await DB.bulkUpdateLeagueVenueMapPositions(workspace.league.id, selectedSite.venueIds.map((id) => ({
        id,
        latitude: Number(coords.latitude),
        longitude: Number(coords.longitude),
        source: "manual",
        accuracy: "exact",
      })));
      await onRefreshOperations?.();
      toast.success(selectedSite.venueIds.length > 1 ? "Shared-ground position saved for every pitch" : "Exact venue position saved");
    } catch (error) {
      toast.error("Venue position could not be saved", { description: error?.message });
    }
  };

  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, center: projectWorld(mapView.latitude, mapView.longitude, mapView.zoom) };
  };
  const onPointerMove = (event) => {
    if (!dragRef.current) return;
    const next = unprojectWorld(dragRef.current.center.x - (event.clientX - dragRef.current.x), dragRef.current.center.y - (event.clientY - dragRef.current.y), mapView.zoom);
    setMapView((current) => ({ ...current, ...next }));
  };
  const onPointerUp = (event) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragRef.current = null;
  };

  return (
    <div className="space-y-5">
      <Panel className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2"><Pill tone="navy">Venue intelligence</Pill><Pill tone={unmappedGroups.length ? "amber" : "green"}>{mappedGroups.length}/{grouped.length} physical sites mapped</Pill></div>
            <h3 className="mt-3 text-xl font-black text-slate-950">Ground pressure, coverage and fixture demand</h3>
            <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-500">Multiple pitches at the same ground are grouped into one operational site. Select a layer and date scope to see where attention is needed.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <label><span className="mb-1 block text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Date scope</span><select className={`${INPUT} w-full min-w-[155px]`} value={scope} onChange={(event) => setScope(event.target.value)}><option value="season">Full season</option><option value="month">One month</option><option value="matchday">One matchday</option><option value="next30">Next 30 days</option></select></label>
            {scope === "matchday" ? <label><span className="mb-1 block text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Matchday</span><select className={`${INPUT} w-full min-w-[145px]`} value={focusDate} onChange={(event) => setFocusDate(event.target.value)}>{dates.map((date) => <option key={date} value={date}>{shortDate(date)}</option>)}</select></label> : null}
            {scope === "month" ? <label><span className="mb-1 block text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Month</span><select className={`${INPUT} w-full min-w-[155px]`} value={focusMonth} onChange={(event) => setFocusMonth(event.target.value)}>{months.map((month) => <option key={month} value={month}>{new Date(`${month}-01T12:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</option>)}</select></label> : null}
            <label><span className="mb-1 block text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Map layer</span><select className={`${INPUT} w-full min-w-[165px]`} value={layer} onChange={(event) => setLayer(event.target.value)}><option value="fixtures">Fixture volume</option><option value="officials">Official gaps</option><option value="pressure">Ground pressure</option></select></label>
            <button type="button" disabled={!canManage || !geocodable.length || geocoding} onClick={geocodeAll} className={`${BUTTON} self-end bg-emerald-600 text-white`}><Sparkles size={15} className={geocoding ? "animate-pulse" : ""} />{geocoding ? "Mapping…" : geocodable.length ? `Map ${geocodable.length} pitches` : "All mapped"}</button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={CalendarDays} label={scopeLabel(scope, focusDate, focusMonth)} value={`${scopeFixtureCount} fixtures`} tone="blue" /><Metric icon={Building2} label="Physical grounds" value={`${grouped.length} sites · ${workspace.venues.length} pitches`} /><Metric icon={Gauge} label="High-pressure sites" value={pressureSites} tone={pressureSites ? "amber" : "green"} /><Metric icon={Users} label="Official gaps" value={missingOfficials} tone={missingOfficials ? "amber" : "green"} /></div>
      </Panel>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.75fr)_420px]">
        <Panel className="overflow-hidden">
          <div className="relative h-[590px] min-h-[520px] select-none overflow-hidden bg-slate-100" ref={mapRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
            {tiles.map((tile) => <img key={tile.key} src={tile.url} alt="" draggable={false} className="pointer-events-none absolute h-64 w-64 max-w-none select-none" style={{ left: tile.x, top: tile.y }} />)}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-slate-950/5" />

            {clusters.map((cluster) => {
              if (cluster.markers.length > 1) {
                const fixtureCount = cluster.markers.reduce((sum, row) => sum + row.fixtureCount, 0);
                return <button type="button" key={`cluster-${cluster.x}-${cluster.y}`} onPointerDown={(event) => event.stopPropagation()} onClick={() => { const latitude = cluster.markers.reduce((sum, row) => sum + row.latitude, 0) / cluster.markers.length; const longitude = cluster.markers.reduce((sum, row) => sum + row.longitude, 0) / cluster.markers.length; setMapView((current) => ({ latitude, longitude, zoom: Math.min(MAX_ZOOM, current.zoom + 2) })); }} className="absolute z-20 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-white bg-slate-950 text-xs font-black text-white shadow-xl ring-4 ring-slate-950/15" style={{ left: cluster.x, top: cluster.y }} title={`${cluster.markers.length} grounds · ${fixtureCount} fixtures`}>{cluster.markers.length}</button>;
              }
              const site = cluster.markers[0];
              const tone = markerTone(site, layer);
              const selected = selectedSiteId === site.id;
              return <button type="button" key={site.id} onPointerDown={(event) => event.stopPropagation()} onClick={() => selectSite(site)} className={`absolute z-20 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-white font-black text-white shadow-xl transition hover:scale-110 ${selected ? "h-14 w-14 ring-[6px]" : "h-11 w-11 ring-4"}`} style={{ left: site.x, top: site.y, backgroundColor: tone.bg, "--tw-ring-color": tone.ring }} title={`${site.name} · ${site.fixtureCount} fixtures`}>{tone.value}</button>;
            })}

            {selectedSite && Number.isFinite(selectedSite.latitude) && Number.isFinite(selectedSite.longitude) ? (() => { const point = projectWorld(selectedSite.latitude, selectedSite.longitude, mapView.zoom); const x = point.x - topLeft.x; const y = point.y - topLeft.y; return x > 80 && x < mapSize.width - 80 && y > 55 && y < mapSize.height - 55 ? <div className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-[calc(100%+38px)] rounded-xl bg-slate-950 px-3 py-2 text-center text-xs font-black text-white shadow-2xl" style={{ left: x, top: y }}><div>{selectedSite.name}</div><div className="mt-0.5 text-[9px] font-bold text-slate-300">{selectedSite.fixtureCount} fixtures · {selectedSite.pitches.length} pitch{selectedSite.pitches.length === 1 ? "" : "es"}</div></div> : null; })() : null}

            <div className="absolute left-3 top-3 z-40 flex flex-col gap-2"><button type="button" onClick={() => zoomBy(1)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-800 shadow-lg" aria-label="Zoom in"><Plus size={18} /></button><button type="button" onClick={() => zoomBy(-1)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-800 shadow-lg" aria-label="Zoom out"><Minus size={18} /></button><button type="button" onClick={fitAll} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-800 shadow-lg" aria-label="Fit all grounds"><Crosshair size={18} /></button></div>
            <div className="absolute right-3 top-3 z-40 rounded-2xl border border-white/70 bg-white/95 p-3 shadow-lg backdrop-blur"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.13em] text-slate-700"><Layers3 size={14} />{layer === "fixtures" ? "Fixture volume" : layer === "officials" ? "Official gaps" : "Peak / capacity"}</div><div className="mt-2 flex flex-wrap gap-3 text-[10px] font-bold text-slate-600">{layer === "fixtures" ? <><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-emerald-600" />1–9</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-sky-600" />10–19</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-indigo-700" />20+</span></> : layer === "officials" ? <><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-emerald-600" />Covered</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />Gaps</span></> : <><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-emerald-600" />Available</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />Busy</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-rose-600" />Over</span></>}</div></div>
            <div className="absolute bottom-2 right-2 z-40 rounded-md bg-white/90 px-2 py-1 text-[9px] font-semibold text-slate-600 shadow"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">© OpenStreetMap contributors</a></div>
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel className="overflow-hidden">
            <div className="border-b border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><div><div className="text-base font-black text-slate-950">Ground command list</div><div className="mt-1 text-xs font-semibold text-slate-500">Ranked by the active map layer.</div></div><Pill tone="slate">{sortedSites.length}</Pill></div><div className="relative mt-3"><Search size={15} className="absolute left-3 top-3 text-slate-400" /><input className={`${INPUT} w-full pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a ground or postcode" /></div></div>
            <div className="max-h-[360px] space-y-2 overflow-y-auto p-3">{sortedSites.map((site) => <button type="button" key={site.id} onClick={() => selectSite(site, true)} className={`w-full rounded-2xl border p-3 text-left transition ${selectedSiteId === site.id ? "border-slate-950 bg-slate-950 text-white shadow-lg" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate text-sm font-black">{site.name}</div><div className={`mt-1 text-[10px] font-bold ${selectedSiteId === site.id ? "text-slate-300" : "text-slate-500"}`}>{site.postcode || "Postcode missing"} · {site.pitches.length} pitch{site.pitches.length === 1 ? "" : "es"}</div></div><Pill tone={selectedSiteId === site.id ? "slate" : siteTone(site, layer)}>{layer === "officials" ? `${site.missingOfficialCount} gaps` : layer === "pressure" ? `${site.peakConcurrent}/${site.capacity}` : `${site.fixtureCount} games`}</Pill></div></button>)}</div>
          </Panel>

          {selectedSite ? <Panel className="p-5"><div className="flex items-start justify-between gap-3"><div><div className="text-lg font-black text-slate-950">{selectedSite.name}</div><div className="mt-1 text-xs font-semibold text-slate-500">{selectedSite.address || selectedSite.postcode || "Address not recorded"}</div></div><Pill tone={selectedSite.coordinateSource === "manual" ? "green" : "blue"}>{coordinateSourceLabel(selectedSite.coordinateSource)}</Pill></div><div className="mt-4 grid grid-cols-2 gap-2"><Metric icon={CalendarDays} label="Fixtures" value={selectedSite.fixtureCount} tone="blue" /><Metric icon={Gauge} label="Peak / capacity" value={`${selectedSite.peakConcurrent}/${selectedSite.capacity}`} tone={selectedSite.overCapacity ? "rose" : selectedSite.pressureRatio >= 0.75 ? "amber" : "green"} /><Metric icon={Users} label="Teams" value={selectedSite.teamCount} /><Metric icon={Users} label="Official gaps" value={selectedSite.missingOfficialCount} tone={selectedSite.missingOfficialCount ? "amber" : "green"} /></div><div className="mt-4"><div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Pitches at this site</div><div className="mt-2 flex flex-wrap gap-2">{selectedSite.pitches.map((pitch) => <Pill key={pitch.id} tone="slate">{pitch.name}</Pill>)}</div></div><div className="mt-4"><div className="flex items-center justify-between"><div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Fixtures in scope</div><span className="text-[10px] font-bold text-slate-400">{scopeLabel(scope, focusDate, focusMonth)}</span></div><div className="mt-2 max-h-[180px] space-y-2 overflow-y-auto">{selectedSite.fixtures.slice().sort((a, b) => `${a.date}${a.kickOff}`.localeCompare(`${b.date}${b.kickOff}`)).slice(0, 12).map((fixture) => <button type="button" key={`${fixture.targetType}-${fixture.targetId}`} onClick={() => onSelectFixture?.(fixture)} className="w-full rounded-xl bg-slate-50 p-2.5 text-left hover:bg-slate-100"><div className="text-xs font-black text-slate-800">{fixture.homeTeamName} v {fixture.awayTeamName}</div><div className="mt-1 text-[10px] font-bold text-slate-500">{shortDate(fixture.date)} · {fixture.kickOff || "TBC"} · {fixture.venueName}</div></button>)}{!selectedSite.fixtures.length ? <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs font-bold text-slate-400">No fixtures in this date scope.</div> : null}</div></div>{canManage ? <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"><summary className="cursor-pointer text-xs font-black text-slate-800">Refine exact site position</summary><div className="mt-3 grid grid-cols-2 gap-2"><input type="number" step="0.000001" className={`${INPUT} w-full`} value={coords.latitude} onChange={(event) => setCoords((current) => ({ ...current, latitude: event.target.value }))} placeholder="Latitude" /><input type="number" step="0.000001" className={`${INPUT} w-full`} value={coords.longitude} onChange={(event) => setCoords((current) => ({ ...current, longitude: event.target.value }))} placeholder="Longitude" /></div><button type="button" disabled={coords.latitude === "" || coords.longitude === ""} onClick={saveSitePosition} className={`${BUTTON} mt-3 w-full bg-slate-950 text-white`}><MapPin size={15} /> Save for {selectedSite.pitches.length} pitch{selectedSite.pitches.length === 1 ? "" : "es"}</button></details> : null}</Panel> : null}

          {unmappedGroups.length ? <Panel className="p-5"><div className="flex items-center justify-between"><div className="text-sm font-black text-slate-950">Unmapped physical sites</div><Pill tone="amber">{unmappedGroups.length}</Pill></div><div className="mt-3 space-y-2">{unmappedGroups.slice(0, 6).map((site) => <div key={site.id} className="rounded-xl bg-amber-50 px-3 py-2"><div className="text-xs font-black text-amber-900">{site.name}</div><div className="mt-0.5 text-[10px] font-semibold text-amber-700">{site.postcode || "Postcode missing"}</div></div>)}</div></Panel> : null}
        </div>
      </div>
    </div>
  );
}
