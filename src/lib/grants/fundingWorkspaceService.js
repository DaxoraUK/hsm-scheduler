import {
  Auth,
  SUPA_URL,
  SupabaseRequestError,
  getSupaKey,
  isSupaConfigured,
  supaFetch,
} from "../supabase.js";

const STORAGE_BUCKET = "funding-documents";
const LOCAL_PREFIX = "gc_funding_workspace_v1";
const LOCAL_DB = "ground-control-funding-documents";
const LOCAL_STORE = "files";
const EMPTY_FUNDING_PROFILE = Object.freeze({});
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["pdf", "doc", "docx", "xls", "xlsx", "csv", "txt", "png", "jpg", "jpeg", "webp"]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `funding_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function localKey(clubId) {
  return `${LOCAL_PREFIX}:${String(clubId || "local-club")}`;
}

function getLocalState(clubId) {
  if (typeof window === "undefined" || !window.localStorage) {
    return { projects: [], requirementRecords: [], documents: [], snapshots: [], profile: { ...EMPTY_FUNDING_PROFILE } };
  }
  try {
    const stored = JSON.parse(window.localStorage.getItem(localKey(clubId)) || "null");
    return {
      projects: asArray(stored?.projects),
      requirementRecords: asArray(stored?.requirementRecords),
      documents: asArray(stored?.documents),
      snapshots: asArray(stored?.snapshots),
      profile: stored?.profile && typeof stored.profile === "object" ? stored.profile : { ...EMPTY_FUNDING_PROFILE },
    };
  } catch {
    return { projects: [], requirementRecords: [], documents: [], snapshots: [], profile: { ...EMPTY_FUNDING_PROFILE } };
  }
}

function saveLocalState(clubId, state) {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(localKey(clubId), JSON.stringify(state));
}

function openLocalDatabase() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCAL_DB, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(LOCAL_STORE)) database.createObjectStore(LOCAL_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putLocalFile(id, file) {
  const database = await openLocalDatabase();
  if (!database) return false;
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(LOCAL_STORE, "readwrite");
    transaction.objectStore(LOCAL_STORE).put(file, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
  return true;
}

async function getLocalFile(id) {
  const database = await openLocalDatabase();
  if (!database) return null;
  const file = await new Promise((resolve, reject) => {
    const transaction = database.transaction(LOCAL_STORE, "readonly");
    const request = transaction.objectStore(LOCAL_STORE).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return file;
}

async function deleteLocalFile(id) {
  const database = await openLocalDatabase();
  if (!database) return;
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(LOCAL_STORE, "readwrite");
    transaction.objectStore(LOCAL_STORE).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

function encodeFilter(value) {
  return encodeURIComponent(String(value));
}

function encodeStoragePath(path) {
  return String(path || "")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}


function normaliseFundingProfile(row = {}) {
  const data = row.data && typeof row.data === "object" ? row.data : row;
  return {
    clubId: row.club_id || row.clubId || data.clubId || "",
    postcode: data.postcode || "",
    facilityPostcode: data.facilityPostcode || data.postcode || "",
    homeNation: data.homeNation || "",
    country: data.country || "",
    region: data.region || "",
    localAuthority: data.localAuthority || "",
    adminCounty: data.adminCounty || "",
    parliamentaryConstituency: data.parliamentaryConstituency || "",
    countyFa: data.countyFa || "",
    legalStructure: data.legalStructure || "",
    affiliation: data.affiliation || "",
    charityNumber: data.charityNumber || "",
    cascNumber: data.cascNumber || "",
    companyNumber: data.companyNumber || "",
    tenure: data.tenure || "",
    annualIncomeBand: data.annualIncomeBand || "",
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    postcodeResolvedAt: data.postcodeResolvedAt || "",
    postcodeSource: data.postcodeSource || "",
    updatedAt: row.updated_at || row.updatedAt || data.updatedAt || null,
    createdAt: row.created_at || row.createdAt || data.createdAt || null,
  };
}

function normaliseProject(row = {}) {
  const data = row.data && typeof row.data === "object" ? row.data : {};
  return {
    id: row.id || data.id || createId(),
    clubId: row.club_id || row.clubId || data.clubId || "",
    title: row.title || data.title || "",
    projectType: row.project_type || row.projectType || data.projectType || "all",
    selectedProgrammeId: row.selected_programme_id || row.selectedProgrammeId || data.selectedProgrammeId || "",
    status: row.status || data.status || "planning",
    postcode: data.postcode || "",
    estimatedCost: Number(data.estimatedCost || 0),
    targetFunding: Number(data.targetFunding || 0),
    summary: data.summary || "",
    beneficiaries: data.beneficiaries || "",
    outcomes: data.outcomes || "",
    deliveryPlan: data.deliveryPlan || "",
    legalStructure: data.legalStructure || "",
    affiliation: data.affiliation || "",
    tenure: data.tenure || "",
    updatedAt: row.updated_at || row.updatedAt || data.updatedAt || null,
    createdAt: row.created_at || row.createdAt || data.createdAt || null,
  };
}

function normaliseRequirement(row = {}) {
  return {
    id: row.id || createId(),
    clubId: row.club_id || row.clubId || "",
    projectId: row.project_id || row.projectId || "",
    requirementKey: row.requirement_key || row.requirementKey || "",
    status: row.status || "missing",
    notes: row.notes || "",
    dueDate: row.due_date || row.dueDate || "",
    updatedAt: row.updated_at || row.updatedAt || null,
  };
}

function normaliseDocument(row = {}) {
  return {
    id: row.id || createId(),
    clubId: row.club_id || row.clubId || "",
    projectId: row.project_id || row.projectId || "",
    requirementKey: row.requirement_key || row.requirementKey || "",
    fileName: row.file_name || row.fileName || "Supporting document",
    storagePath: row.storage_path || row.storagePath || "",
    mimeType: row.mime_type || row.mimeType || "application/octet-stream",
    sizeBytes: Number(row.size_bytes || row.sizeBytes || 0),
    documentType: row.document_type || row.documentType || "Supporting evidence",
    reviewDate: row.review_date || row.reviewDate || "",
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    uploadedByLabel: row.uploaded_by_label || row.uploadedByLabel || "Club member",
    local: Boolean(row.local),
  };
}

function normaliseSnapshot(row = {}) {
  return {
    id: row.id || createId(),
    clubId: row.club_id || row.clubId || "",
    projectId: row.project_id || row.projectId || "",
    programmeId: row.programme_id || row.programmeId || "",
    label: row.label || "Funding evidence snapshot",
    snapshot: row.snapshot || {},
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
  };
}

function remoteEligible(clubId) {
  return Boolean(clubId && isSupaConfigured() && Auth.getSession()?.access_token);
}

async function storageFetch(path, { method = "POST", body = null, headers = {} } = {}) {
  const session = await Auth.getValidSession();
  if (!session?.access_token) throw new SupabaseRequestError("Sign in again to continue", { status: 401, code: "AUTH_REQUIRED", path });
  const response = await fetch(`${SUPA_URL}/storage/v1/${path}`, {
    method,
    headers: {
      apikey: getSupaKey(),
      Authorization: `Bearer ${session.access_token}`,
      ...headers,
    },
    body,
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = text; }
  }
  if (!response.ok) {
    throw new SupabaseRequestError(payload?.message || payload?.error || String(payload || "Document storage request failed"), {
      status: response.status,
      code: payload?.error || "STORAGE_REQUEST_FAILED",
      details: payload,
      path,
    });
  }
  return payload;
}

async function loadRemote(clubId) {
  const club = encodeFilter(clubId);
  const profilePromise = supaFetch("GET", `funding_profiles?select=*&club_id=eq.${club}&limit=1`)
    .then((rows) => ({ rows, available: true }))
    .catch((error) => {
      const missingProfileSchema = [400, 404].includes(Number(error?.status || 0)) || /funding_profiles/i.test(String(error?.message || ""));
      if (!missingProfileSchema) throw error;
      return { rows: [], available: false };
    });
  const [projects, requirements, documents, snapshots, profileResult] = await Promise.all([
    supaFetch("GET", `funding_projects?select=*&club_id=eq.${club}&order=updated_at.desc`),
    supaFetch("GET", `funding_requirement_records?select=*&club_id=eq.${club}&order=updated_at.desc`),
    supaFetch("GET", `funding_documents?select=*&club_id=eq.${club}&order=created_at.desc`),
    supaFetch("GET", `funding_evidence_snapshots?select=*&club_id=eq.${club}&order=created_at.desc`),
    profilePromise,
  ]);
  const profileRow = asArray(profileResult.rows)[0] || null;
  return {
    mode: "remote",
    profileMode: profileResult.available ? "remote" : "local",
    reason: "Documents and funding records are securely shared in the club workspace.",
    projects: asArray(projects).map(normaliseProject),
    requirementRecords: asArray(requirements).map(normaliseRequirement),
    documents: asArray(documents).map(normaliseDocument),
    snapshots: asArray(snapshots).map(normaliseSnapshot),
    profile: profileRow ? normaliseFundingProfile(profileRow) : normaliseFundingProfile(getLocalState(clubId).profile),
  };
}

function loadLocal(clubId, reason = "Funding workspace migration is not installed. Drafts are stored only in this browser.") {
  const state = getLocalState(clubId);
  return {
    mode: "local",
    profileMode: "local",
    reason,
    projects: state.projects.map(normaliseProject),
    requirementRecords: state.requirementRecords.map(normaliseRequirement),
    documents: state.documents.map(normaliseDocument),
    snapshots: state.snapshots.map(normaliseSnapshot),
    profile: normaliseFundingProfile(state.profile),
  };
}

export async function loadFundingWorkspace(clubId) {
  if (!remoteEligible(clubId)) return loadLocal(clubId, "Local draft mode: sign in to a configured workspace to share projects and documents with the club.");
  try {
    return await loadRemote(clubId);
  } catch (error) {
    const missingSchema = [400, 404].includes(Number(error?.status || 0)) || /funding_(projects|documents|requirement|evidence)/i.test(String(error?.message || ""));
    if (!missingSchema) throw error;
    return loadLocal(clubId);
  }
}

export async function saveFundingProfile(clubId, profile, mode = "remote") {
  const now = new Date().toISOString();
  const normalised = normaliseFundingProfile({ ...profile, clubId, updatedAt: now, createdAt: profile?.createdAt || now });
  if (mode !== "remote" || !remoteEligible(clubId)) {
    const state = getLocalState(clubId);
    state.profile = normalised;
    saveLocalState(clubId, state);
    return normalised;
  }
  const payload = {
    club_id: clubId,
    data: {
      postcode: normalised.postcode,
      facilityPostcode: normalised.facilityPostcode,
      homeNation: normalised.homeNation,
      country: normalised.country,
      region: normalised.region,
      localAuthority: normalised.localAuthority,
      adminCounty: normalised.adminCounty,
      parliamentaryConstituency: normalised.parliamentaryConstituency,
      countyFa: normalised.countyFa,
      legalStructure: normalised.legalStructure,
      affiliation: normalised.affiliation,
      charityNumber: normalised.charityNumber,
      cascNumber: normalised.cascNumber,
      companyNumber: normalised.companyNumber,
      tenure: normalised.tenure,
      annualIncomeBand: normalised.annualIncomeBand,
      latitude: normalised.latitude,
      longitude: normalised.longitude,
      postcodeResolvedAt: normalised.postcodeResolvedAt,
      postcodeSource: normalised.postcodeSource,
    },
  };
  const rows = await supaFetch("POST", "funding_profiles?on_conflict=club_id", payload, {
    Prefer: "resolution=merge-duplicates,return=representation",
  });
  return normaliseFundingProfile(asArray(rows)[0] || payload);
}

export async function saveFundingProject(clubId, project, mode = "remote") {
  const now = new Date().toISOString();
  const normalised = normaliseProject({
    ...project,
    id: project?.id || createId(),
    clubId,
    updatedAt: now,
    createdAt: project?.createdAt || now,
  });

  if (mode !== "remote" || !remoteEligible(clubId)) {
    const state = getLocalState(clubId);
    state.projects = [normalised, ...state.projects.filter((item) => item.id !== normalised.id)];
    saveLocalState(clubId, state);
    return normalised;
  }

  const payload = {
    id: normalised.id,
    club_id: clubId,
    title: normalised.title || "Untitled funding project",
    project_type: normalised.projectType || "all",
    selected_programme_id: normalised.selectedProgrammeId || null,
    status: normalised.status || "planning",
    data: {
      postcode: normalised.postcode,
      estimatedCost: normalised.estimatedCost,
      targetFunding: normalised.targetFunding,
      summary: normalised.summary,
      beneficiaries: normalised.beneficiaries,
      outcomes: normalised.outcomes,
      deliveryPlan: normalised.deliveryPlan,
      legalStructure: normalised.legalStructure,
      affiliation: normalised.affiliation,
      tenure: normalised.tenure,
    },
  };
  const rows = await supaFetch("POST", "funding_projects?on_conflict=id", payload, {
    Prefer: "resolution=merge-duplicates,return=representation",
  });
  return normaliseProject(asArray(rows)[0] || payload);
}

export async function saveFundingRequirement(clubId, projectId, requirement, mode = "remote") {
  const normalised = normaliseRequirement({
    ...requirement,
    id: requirement?.id || createId(),
    clubId,
    projectId,
    updatedAt: new Date().toISOString(),
  });
  if (mode !== "remote" || !remoteEligible(clubId)) {
    const state = getLocalState(clubId);
    state.requirementRecords = [
      normalised,
      ...state.requirementRecords.filter((item) => !(item.projectId === projectId && item.requirementKey === normalised.requirementKey)),
    ];
    saveLocalState(clubId, state);
    return normalised;
  }
  const payload = {
    id: normalised.id,
    club_id: clubId,
    project_id: projectId,
    requirement_key: normalised.requirementKey,
    status: normalised.status,
    notes: normalised.notes || "",
    due_date: normalised.dueDate || null,
  };
  const rows = await supaFetch("POST", "funding_requirement_records?on_conflict=project_id,requirement_key", payload, {
    Prefer: "resolution=merge-duplicates,return=representation",
  });
  return normaliseRequirement(asArray(rows)[0] || payload);
}

function validateFile(file) {
  if (!file) throw new Error("Choose a document to upload.");
  if (file.size > MAX_FILE_SIZE) throw new Error("Documents must be 15 MB or smaller.");
  const extension = String(file.name || "").split(".").pop().toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) throw new Error("Use PDF, Word, Excel, CSV, text or image files.");
}

function safeFileName(name) {
  const cleaned = String(name || "document")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(-140);
  return cleaned || "document";
}

export async function uploadFundingDocument(clubId, projectId, requirementKey, file, details = {}, mode = "remote") {
  validateFile(file);
  const id = createId();
  const createdAt = new Date().toISOString();
  const metadata = normaliseDocument({
    id,
    clubId,
    projectId,
    requirementKey,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    documentType: details.documentType || "Supporting evidence",
    reviewDate: details.reviewDate || "",
    createdAt,
    uploadedByLabel: details.uploadedByLabel || "Club member",
    local: mode !== "remote",
  });

  if (mode !== "remote" || !remoteEligible(clubId)) {
    await putLocalFile(id, file);
    const state = getLocalState(clubId);
    state.documents = [{ ...metadata, storagePath: `local://${id}`, local: true }, ...state.documents];
    saveLocalState(clubId, state);
    return { ...metadata, storagePath: `local://${id}`, local: true };
  }

  const storagePath = `${clubId}/${projectId}/${id}-${safeFileName(file.name)}`;
  await storageFetch(`object/${STORAGE_BUCKET}/${encodeStoragePath(storagePath)}`, {
    method: "POST",
    body: file,
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "x-upsert": "false",
    },
  });
  try {
    const payload = {
      id,
      club_id: clubId,
      project_id: projectId,
      requirement_key: requirementKey,
      file_name: file.name,
      storage_path: storagePath,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      document_type: details.documentType || "Supporting evidence",
      review_date: details.reviewDate || null,
    };
    const rows = await supaFetch("POST", "funding_documents", payload, { Prefer: "return=representation" });
    return normaliseDocument(asArray(rows)[0] || payload);
  } catch (error) {
    await storageFetch(`object/${STORAGE_BUCKET}`, {
      method: "DELETE",
      body: JSON.stringify({ prefixes: [storagePath] }),
      headers: { "Content-Type": "application/json" },
    }).catch(() => {});
    throw error;
  }
}

export async function openFundingDocument(document, mode = "remote") {
  if (document?.local || mode !== "remote" || String(document?.storagePath || "").startsWith("local://")) {
    const file = await getLocalFile(document.id);
    if (!file) throw new Error("This local document is no longer available in this browser.");
    const url = URL.createObjectURL(file);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  }
  const payload = await storageFetch(`object/sign/${STORAGE_BUCKET}/${encodeStoragePath(document.storagePath)}`, {
    method: "POST",
    body: JSON.stringify({ expiresIn: 300 }),
    headers: { "Content-Type": "application/json" },
  });
  const signed = payload?.signedURL || payload?.signedUrl;
  if (!signed) throw new Error("A secure document link could not be created.");
  window.open(signed.startsWith("http") ? signed : `${SUPA_URL}${signed}`, "_blank", "noopener,noreferrer");
  return true;
}

export async function deleteFundingDocument(clubId, document, mode = "remote") {
  if (document?.local || mode !== "remote" || !remoteEligible(clubId)) {
    await deleteLocalFile(document.id);
    const state = getLocalState(clubId);
    state.documents = state.documents.filter((item) => item.id !== document.id);
    saveLocalState(clubId, state);
    return true;
  }
  await supaFetch("DELETE", `funding_documents?id=eq.${encodeFilter(document.id)}&club_id=eq.${encodeFilter(clubId)}`, null, {
    Prefer: "return=minimal",
  });
  await storageFetch(`object/${STORAGE_BUCKET}`, {
    method: "DELETE",
    body: JSON.stringify({ prefixes: [document.storagePath] }),
    headers: { "Content-Type": "application/json" },
  });
  return true;
}

export async function createFundingSnapshot(clubId, projectId, programmeId, label, snapshot, mode = "remote") {
  const normalised = normaliseSnapshot({
    id: createId(),
    clubId,
    projectId,
    programmeId,
    label: label || "Funding evidence snapshot",
    snapshot,
    createdAt: new Date().toISOString(),
  });
  if (mode !== "remote" || !remoteEligible(clubId)) {
    const state = getLocalState(clubId);
    state.snapshots = [normalised, ...state.snapshots];
    saveLocalState(clubId, state);
    return normalised;
  }
  const payload = {
    id: normalised.id,
    club_id: clubId,
    project_id: projectId,
    programme_id: programmeId || null,
    label: normalised.label,
    snapshot: snapshot || {},
  };
  const rows = await supaFetch("POST", "funding_evidence_snapshots", payload, { Prefer: "return=representation" });
  return normaliseSnapshot(asArray(rows)[0] || payload);
}

export const FUNDING_DOCUMENT_RULES = Object.freeze({
  maxFileSize: MAX_FILE_SIZE,
  maxFileSizeLabel: "15 MB",
  acceptedExtensions: [...ALLOWED_EXTENSIONS],
  accept: ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp",
});
