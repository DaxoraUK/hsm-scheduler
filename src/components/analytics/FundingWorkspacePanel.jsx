import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  Building2,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Download,
  FileArchive,
  FileCheck2,
  FileText,
  FolderOpen,
  History,
  Info,
  Loader2,
  MapPin,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Target,
  Trash2,
  Upload,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import Card from "../../ui/Card.jsx";
import ConfirmDialog from "../../ui/ConfirmDialog.jsx";
import FundingApplicationTracker from "./FundingApplicationTracker.jsx";
import FundingDocumentUploadDialog from "./FundingDocumentUploadDialog.jsx";
import FundingLocationPanel from "./FundingLocationPanel.jsx";
import FundingImpactEvidencePanel from "./FundingImpactEvidencePanel.jsx";
import ProgressBar from "../../ui/ProgressBar.jsx";
import StatusChip from "../../ui/StatusChip.jsx";
import { VERIFIED_GRANT_PROGRAMMES } from "../../lib/grants/grantProgrammeCatalogue.js";
import { buildFundingReadinessChecklist } from "../../lib/grants/fundingReadinessEngine.js";
import { summariseFundingImpactEvidence } from "../../lib/grants/fundingImpactEvidenceService.js";
import {
  FUNDING_DOCUMENT_RULES,
  createFundingSnapshot,
  deleteFundingApplication,
  deleteFundingApplicationTask,
  deleteFundingDocument,
  deleteFundingMonitoringObligation,
  loadFundingWorkspace,
  openFundingDocument,
  saveFundingApplication,
  saveFundingApplicationTask,
  saveFundingMonitoringObligation,
  saveFundingProfile,
  saveFundingProject,
  saveFundingRequirement,
  uploadFundingDocument,
} from "../../lib/grants/fundingWorkspaceService.js";

const PROJECT_STATUS_OPTIONS = [
  ["planning", "Planning"],
  ["preparing", "Preparing application"],
  ["ready_to_apply", "Ready to apply"],
  ["submitted", "Submitted"],
  ["awarded", "Awarded"],
  ["unsuccessful", "Unsuccessful"],
  ["closed", "Closed"],
];

const REQUIREMENT_STATUS_OPTIONS = [
  ["missing", "Missing"],
  ["in_progress", "In progress"],
  ["ready", "Ready"],
  ["not_applicable", "Not applicable"],
];

const STATUS_TONE = {
  missing: "danger",
  in_progress: "warning",
  ready: "success",
  not_applicable: "neutral",
};

const STATUS_LABEL = Object.fromEntries(REQUIREMENT_STATUS_OPTIONS);
const UPLOAD_DOCUMENT_LABEL = "Upload document";

const FUNDING_PRIMARY_VIEWS = [
  ["project", "Project", Building2],
  ["local", "Funding", MapPin],
  ["applications", "Applications", Send],
  ["impact", "Impact", UsersRound],
  ["readiness", "Readiness", ClipboardList],
];

const FUNDING_EVIDENCE_VIEWS = [
  ["documents", "Documents", FolderOpen],
  ["snapshots", "Snapshots", History],
];

function createProjectDraft(projectType = "all", postcode = "") {
  return {
    id: "",
    title: "",
    projectType,
    selectedProgrammeId: "",
    status: "planning",
    postcode,
    estimatedCost: 0,
    targetFunding: 0,
    summary: "",
    beneficiaries: "",
    outcomes: "",
    deliveryPlan: "",
    legalStructure: "",
    affiliation: "",
    tenure: "",
  };
}

function formatMoney(value) {
  const number = Number(value || 0);
  return number ? `£${number.toLocaleString("en-GB")}` : "Not set";
}

function formatBytes(value) {
  const size = Number(value || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value, includeTime = false) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB", includeTime
    ? { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "numeric", month: "short", year: "numeric" });
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs font-semibold leading-5 text-slate-500">{hint}</span> : null}
    </label>
  );
}

const INPUT_CLASS = "mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-500";
const TEXTAREA_CLASS = "mt-2 min-h-28 w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-500";

function SummaryMetric({ label, value, detail, icon: Icon, tone = "slate" }) {
  const styles = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    sky: "border-sky-200 bg-sky-50 text-sky-800",
    slate: "border-slate-200 bg-slate-50 text-slate-800",
  }[tone];
  return (
    <div className={`rounded-[24px] border p-5 ${styles}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">{label}</div>
          <div className="mt-2 text-3xl font-black">{value}</div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70 ring-1 ring-black/5"><Icon size={19} /></div>
      </div>
      <p className="mt-3 text-xs font-bold leading-5 opacity-80">{detail}</p>
    </div>
  );
}

function RequirementCard({ item, canManage, busyKey, onSave, onUpload }) {
  const [status, setStatus] = useState(item.status);
  const [notes, setNotes] = useState(item.notes || "");
  const [dueDate, setDueDate] = useState(item.dueDate || "");

  useEffect(() => {
    setStatus(item.status);
    setNotes(item.notes || "");
    setDueDate(item.dueDate || "");
  }, [item.dueDate, item.notes, item.status]);

  const dirty = status !== item.status || notes !== (item.notes || "") || dueDate !== (item.dueDate || "");
  const busy = busyKey === item.key;

  return (
    <details className="group overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm" open={item.status === "missing"}>
      <summary className="flex cursor-pointer list-none items-start gap-4 p-5 marker:hidden">
        <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${item.status === "ready" ? "bg-emerald-100 text-emerald-700" : item.status === "in_progress" ? "bg-amber-100 text-amber-700" : item.status === "not_applicable" ? "bg-slate-100 text-slate-500" : "bg-rose-100 text-rose-700"}`}>
          {item.status === "ready" ? <CheckCircle2 size={20} /> : item.status === "in_progress" ? <Loader2 size={20} /> : item.status === "not_applicable" ? <Info size={20} /> : <AlertTriangle size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{item.category}</span>
            <StatusChip status={STATUS_TONE[item.status] || "neutral"} size="sm">{STATUS_LABEL[item.status] || item.status}</StatusChip>
            {item.documents?.length ? <StatusChip status="info" size="sm">{item.documents.length} document{item.documents.length === 1 ? "" : "s"}</StatusChip> : null}
          </div>
          <h4 className="mt-2 text-base font-black leading-6 text-slate-950">{item.title}</h4>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{item.evidence || item.nextAction}</p>
        </div>
        <ChevronDown size={19} className="mt-2 shrink-0 text-slate-400 transition group-open:rotate-180" />
      </summary>

      <div className="border-t border-slate-100 bg-slate-50/70 p-5">
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-700">Why this matters</div>
            <p className="mt-2 text-sm font-semibold leading-6 text-sky-950">{item.guidance.why}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Evidence to attach</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {item.guidance.acceptedEvidence.map((evidence) => <span key={evidence} className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-emerald-900 ring-1 ring-emerald-200">{evidence}</span>)}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">How to complete it</div>
          <ol className="mt-3 space-y-2">
            {item.guidance.steps.map((step, index) => (
              <li key={step} className="flex items-start gap-3 text-sm font-semibold leading-6 text-slate-700">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-950 text-[10px] font-black text-white">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-3 text-xs font-bold text-slate-500">Review cycle: {item.guidance.refresh}</div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[180px_180px_1fr_auto]">
          <Field label="Status">
            <select className={INPUT_CLASS} value={status} onChange={(event) => setStatus(event.target.value)} disabled={!canManage || item.automatic && item.category === "Operational evidence"}>
              {REQUIREMENT_STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Target date">
            <input className={INPUT_CLASS} type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} disabled={!canManage} />
          </Field>
          <Field label="Notes" hint="Record ownership, limitations or the next practical step.">
            <input className={INPUT_CLASS} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add a concise progress note" disabled={!canManage} />
          </Field>
          <div className="flex items-end gap-2">
            {item.allowsUpload ? (
              <button type="button" onClick={() => onUpload(item)} disabled={!canManage || busy} className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
                <Upload size={16} /> Attach evidence
              </button>
            ) : null}
            <button type="button" onClick={() => onSave(item, { status, notes, dueDate })} disabled={!canManage || busy || !dirty} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
            </button>
          </div>
        </div>
      </div>
    </details>
  );
}

export default function FundingWorkspacePanel({
  clubId,
  canManage = true,
  club = {},
  model,
  projectType,
  onProjectTypeChange,
  onImpactEvidenceChange,
  impactEvidence = [],
  onActiveProjectChange,
}) {
  const [workspace, setWorkspace] = useState({ mode: "loading", profileMode: "local", trackerMode: "local", reason: "", projects: [], requirementRecords: [], documents: [], snapshots: [], applications: [], applicationTasks: [], monitoringObligations: [], profile: {} });
  const [activeProjectId, setActiveProjectId] = useState("");
  const [draft, setDraft] = useState(() => createProjectDraft(projectType, club.postcode || club.weatherPostcode || ""));
  const [view, setView] = useState("project");
  const [savingProject, setSavingProject] = useState(false);
  const [busyKey, setBusyKey] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [uploadTargetKey, setUploadTargetKey] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const resolvedClubId = clubId || String(club.id || club.name || "local-club").toLowerCase().replace(/[^a-z0-9]+/g, "-");



  useEffect(() => {
    let cancelled = false;
    loadFundingWorkspace(resolvedClubId)
      .then((loaded) => {
        if (cancelled) return;
        setWorkspace(loaded);
        const first = loaded.projects[0];
        if (first) {
          setActiveProjectId(first.id);
          setDraft(first);
          if (first.projectType && first.projectType !== projectType) onProjectTypeChange?.(first.projectType);
        } else {
          setDraft(createProjectDraft(projectType, club.postcode || club.weatherPostcode || ""));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setWorkspace((current) => ({ ...current, mode: "error", reason: error?.message || "Funding workspace could not be loaded." }));
          toast.error("Funding workspace unavailable", { description: error?.message || "Try again." });
        }
      });
    return () => { cancelled = true; };
  }, [resolvedClubId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeProject = workspace.projects.find((project) => project.id === activeProjectId) || null;

  useEffect(() => {
    onActiveProjectChange?.(activeProject);
  }, [activeProject, onActiveProjectChange]);
  const selectedProgramme = useMemo(() => {
    const id = draft.selectedProgrammeId || activeProject?.selectedProgrammeId;
    return model.funding.programmes.find((programme) => programme.id === id)
      || VERIFIED_GRANT_PROGRAMMES.find((programme) => programme.id === id)
      || null;
  }, [activeProject?.selectedProgrammeId, draft.selectedProgrammeId, model.funding.programmes]);

  const projectRequirements = workspace.requirementRecords.filter((record) => record.projectId === activeProjectId);
  const projectDocuments = workspace.documents.filter((document) => document.projectId === activeProjectId);
  const projectSnapshots = workspace.snapshots.filter((snapshot) => snapshot.projectId === activeProjectId);
  const checklist = useMemo(
    () => buildFundingReadinessChecklist({
      programme: selectedProgramme,
      framework: model.framework,
      project: draft,
      requirementRecords: projectRequirements,
      documents: projectDocuments,
    }),
    [draft, model.framework, projectDocuments, projectRequirements, selectedProgramme]
  );

  const setField = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  const selectProject = (projectId) => {
    const project = workspace.projects.find((item) => item.id === projectId);
    setActiveProjectId(projectId);
    if (project) {
      setDraft(project);
      if (project.projectType !== projectType) onProjectTypeChange?.(project.projectType);
    }
  };

  const startNewProject = () => {
    setActiveProjectId("");
    setDraft(createProjectDraft(projectType, club.postcode || club.weatherPostcode || ""));
    setView("project");
  };

  const saveProject = async () => {
    if (!draft.title.trim()) {
      toast.error("Project title required", { description: "Give the funding project a clear working title." });
      return;
    }
    setSavingProject(true);
    try {
      const saved = await saveFundingProject(resolvedClubId, draft, workspace.mode);
      setActiveProjectId(saved.id);
      setDraft(saved);
      setWorkspace((current) => ({ ...current, projects: [saved, ...current.projects.filter((item) => item.id !== saved.id)] }));
      if (saved.projectType !== projectType) onProjectTypeChange?.(saved.projectType);
      toast.success("Funding project saved", { description: workspace.mode === "remote" ? "The club workspace has been updated." : "Saved as a local browser draft." });
    } catch (error) {
      toast.error("Project could not be saved", { description: error?.message || "Try again." });
    } finally {
      setSavingProject(false);
    }
  };

  const saveRequirement = async (item, changes) => {
    if (!activeProjectId) {
      toast.error("Save the project first", { description: "Requirements and documents must belong to a saved funding project." });
      return;
    }
    setBusyKey(item.key);
    try {
      const existing = projectRequirements.find((record) => record.requirementKey === item.key);
      const saved = await saveFundingRequirement(resolvedClubId, activeProjectId, { ...existing, requirementKey: item.key, ...changes }, workspace.mode);
      setWorkspace((current) => ({
        ...current,
        requirementRecords: [saved, ...current.requirementRecords.filter((record) => !(record.projectId === activeProjectId && record.requirementKey === item.key))],
      }));
      toast.success("Requirement updated");
    } catch (error) {
      toast.error("Requirement could not be updated", { description: error?.message || "Try again." });
    } finally {
      setBusyKey("");
    }
  };

  const openUpload = (item = null) => {
    if (!activeProjectId) {
      toast.error("Save the project first", { description: "Documents must belong to a saved funding project." });
      setView("project");
      return;
    }
    setUploadTargetKey(item?.key || "");
    setUploadOpen(true);
  };

  const uploadDocument = async ({ requirementKey, file, documentType, reviewDate }) => {
    if (!activeProjectId) {
      toast.error("Save the project first", { description: "Documents must belong to a saved funding project." });
      return;
    }
    const item = checklist.items.find((candidate) => candidate.key === requirementKey);
    setBusyKey("upload");
    try {
      const document = await uploadFundingDocument(
        resolvedClubId,
        activeProjectId,
        requirementKey,
        file,
        { documentType: documentType || item?.title || "Supporting evidence", reviewDate },
        workspace.mode
      );
      setWorkspace((current) => ({ ...current, documents: [document, ...current.documents] }));
      const existing = projectRequirements.find((record) => record.requirementKey === requirementKey);
      if (!existing || existing.status === "missing") {
        const saved = await saveFundingRequirement(resolvedClubId, activeProjectId, {
          ...existing,
          requirementKey,
          status: "in_progress",
          notes: existing?.notes || `Evidence uploaded for review: ${file.name}`,
          dueDate: existing?.dueDate || "",
        }, workspace.mode);
        setWorkspace((current) => ({
          ...current,
          requirementRecords: [saved, ...current.requirementRecords.filter((record) => !(record.projectId === activeProjectId && record.requirementKey === requirementKey))],
        }));
      }
      setUploadOpen(false);
      setUploadTargetKey("");
      toast.success("Document uploaded and linked", { description: workspace.mode === "remote" ? "Stored securely in the club workspace. Review the requirement before marking it Ready." : "Stored in this browser only. Review the requirement before marking it Ready." });
    } catch (error) {
      toast.error("Document could not be uploaded", { description: error?.message || "Try again." });
    } finally {
      setBusyKey("");
    }
  };

  const saveProfile = async (profile) => {
    setSavingProfile(true);
    try {
      const saved = await saveFundingProfile(resolvedClubId, profile, workspace.profileMode || workspace.mode);
      setWorkspace((current) => ({ ...current, profile: saved }));
      toast.success("Funding profile saved", { description: workspace.profileMode === "remote" ? "The location and organisation profile is shared with the club workspace." : "Saved locally until the funding profile migration is applied." });
    } catch (error) {
      toast.error("Funding profile could not be saved", { description: error?.message || "Try again." });
    } finally {
      setSavingProfile(false);
    }
  };

  const saveApplication = async (application) => {
    if (!activeProjectId) {
      toast.error("Save the project first", { description: "Applications must belong to a saved funding project." });
      return null;
    }
    setBusyKey(application?.id ? `application:${application.id}` : "application");
    try {
      const saved = await saveFundingApplication(
        resolvedClubId,
        activeProjectId,
        { ...application, programmeId: application.programmeId || selectedProgramme?.id || draft.selectedProgrammeId || "" },
        workspace.trackerMode || workspace.mode
      );
      setWorkspace((current) => ({ ...current, applications: [saved, ...current.applications.filter((item) => item.id !== saved.id)] }));
      toast.success("Application tracker updated");
      return saved;
    } catch (error) {
      toast.error("Application could not be saved", { description: error?.message || "Try again." });
      return null;
    } finally {
      setBusyKey("");
    }
  };

  const removeApplication = async (application) => {
    setBusyKey("delete");
    try {
      await deleteFundingApplication(resolvedClubId, application.id, workspace.trackerMode || workspace.mode);
      setWorkspace((current) => ({
        ...current,
        applications: current.applications.filter((item) => item.id !== application.id),
        applicationTasks: current.applicationTasks.filter((item) => item.applicationId !== application.id),
        monitoringObligations: current.monitoringObligations.filter((item) => item.applicationId !== application.id),
      }));
      toast.success("Application removed");
      return true;
    } catch (error) {
      toast.error("Application could not be removed", { description: error?.message || "Try again." });
      return false;
    } finally {
      setBusyKey("");
    }
  };

  const saveApplicationTask = async (task) => {
    if (!task?.applicationId) return null;
    setBusyKey(task.id ? `task:${task.id}` : "task:new");
    try {
      const saved = await saveFundingApplicationTask(resolvedClubId, task.applicationId, task, workspace.trackerMode || workspace.mode);
      setWorkspace((current) => ({ ...current, applicationTasks: [saved, ...current.applicationTasks.filter((item) => item.id !== saved.id)] }));
      toast.success(task.id ? "Application task updated" : "Application task added");
      return saved;
    } catch (error) {
      toast.error("Task could not be saved", { description: error?.message || "Try again." });
      return null;
    } finally {
      setBusyKey("");
    }
  };

  const removeApplicationTask = async (task) => {
    setBusyKey("delete");
    try {
      await deleteFundingApplicationTask(resolvedClubId, task.id, workspace.trackerMode || workspace.mode);
      setWorkspace((current) => ({ ...current, applicationTasks: current.applicationTasks.filter((item) => item.id !== task.id) }));
      toast.success("Application task removed");
      return true;
    } catch (error) {
      toast.error("Task could not be removed", { description: error?.message || "Try again." });
      return false;
    } finally {
      setBusyKey("");
    }
  };

  const saveMonitoringObligation = async (obligation) => {
    if (!obligation?.applicationId) return null;
    setBusyKey(obligation.id ? `obligation:${obligation.id}` : "obligation:new");
    try {
      const saved = await saveFundingMonitoringObligation(resolvedClubId, obligation.applicationId, obligation, workspace.trackerMode || workspace.mode);
      setWorkspace((current) => ({ ...current, monitoringObligations: [saved, ...current.monitoringObligations.filter((item) => item.id !== saved.id)] }));
      toast.success(obligation.id ? "Monitoring requirement updated" : "Monitoring requirement added");
      return saved;
    } catch (error) {
      toast.error("Monitoring requirement could not be saved", { description: error?.message || "Try again." });
      return null;
    } finally {
      setBusyKey("");
    }
  };

  const removeMonitoringObligation = async (obligation) => {
    setBusyKey("delete");
    try {
      await deleteFundingMonitoringObligation(resolvedClubId, obligation.id, workspace.trackerMode || workspace.mode);
      setWorkspace((current) => ({ ...current, monitoringObligations: current.monitoringObligations.filter((item) => item.id !== obligation.id) }));
      toast.success("Monitoring requirement removed");
      return true;
    } catch (error) {
      toast.error("Monitoring requirement could not be removed", { description: error?.message || "Try again." });
      return false;
    } finally {
      setBusyKey("");
    }
  };

  const openDocument = async (document) => {
    try {
      await openFundingDocument(document, workspace.mode);
    } catch (error) {
      toast.error("Document could not be opened", { description: error?.message || "Try again." });
    }
  };

  const confirmDeleteDocument = async () => {
    if (!deleteTarget) return;
    setBusyKey(deleteTarget.id);
    try {
      await deleteFundingDocument(resolvedClubId, deleteTarget, workspace.mode);
      setWorkspace((current) => ({ ...current, documents: current.documents.filter((document) => document.id !== deleteTarget.id) }));
      toast.success("Document removed");
      setDeleteTarget(null);
    } catch (error) {
      toast.error("Document could not be removed", { description: error?.message || "Try again." });
    } finally {
      setBusyKey("");
    }
  };

  const createSnapshot = async () => {
    if (!activeProjectId) {
      toast.error("Save the project first");
      return;
    }
    setBusyKey("snapshot");
    try {
      const snapshot = await createFundingSnapshot(
        resolvedClubId,
        activeProjectId,
        selectedProgramme?.id || "",
        `${draft.title} — ${formatDate(new Date().toISOString())}`,
        {
          createdAt: new Date().toISOString(),
          project: draft,
          programme: selectedProgramme ? {
            id: selectedProgramme.id,
            funder: selectedProgramme.funder,
            name: selectedProgramme.name,
            lastVerified: selectedProgramme.lastVerified,
            officialUrl: selectedProgramme.officialUrl,
          } : null,
          readiness: { score: checklist.score, counts: checklist.counts, total: checklist.total },
          requirements: checklist.items.map((item) => ({
            key: item.key,
            category: item.category,
            title: item.title,
            status: item.status,
            evidence: item.evidence,
            notes: item.notes,
            dueDate: item.dueDate,
            documentIds: item.documents.map((document) => document.id),
          })),
          documents: projectDocuments.map((document) => ({ id: document.id, fileName: document.fileName, requirementKey: document.requirementKey, createdAt: document.createdAt })),
          applications: workspace.applications
            .filter((application) => application.projectId === activeProjectId)
            .map((application) => ({
              ...application,
              tasks: workspace.applicationTasks.filter((task) => task.applicationId === application.id),
              monitoringObligations: workspace.monitoringObligations.filter((obligation) => obligation.applicationId === application.id),
            })),
          operationalEvidence: {
            qualityScore: model.quality.score,
            frameworkScore: model.framework.score,
            metrics: model.metrics,
            evidencePeriod: model.filters.periodOptions.find((option) => option.value === model.filters.selectedPeriod)?.label || model.filters.selectedPeriod,
          },
          impactEvidence: summariseFundingImpactEvidence(impactEvidence),
          disclaimer: model.funding.disclaimer,
        },
        workspace.mode
      );
      setWorkspace((current) => ({ ...current, snapshots: [snapshot, ...current.snapshots] }));
      toast.success("Evidence snapshot created", { description: "This freezes the current project, checklist, application tracker and source-record summary for auditability." });
    } catch (error) {
      toast.error("Snapshot could not be created", { description: error?.message || "Try again." });
    } finally {
      setBusyKey("");
    }
  };

  if (workspace.mode === "loading") {
    return <Card eyebrow="Funding workspace" title="Loading project and document records"><div className="flex items-center gap-3 py-8 text-sm font-bold text-slate-600"><Loader2 size={20} className="animate-spin text-emerald-600" /> Preparing the club funding workspace…</div></Card>;
  }

  return (
    <>
      <Card
        eyebrow="Funding workspace"
        title={activeProject?.title || "Build a grant-ready project"}
        subtitle="Keep the project brief, eligibility evidence, applications and supporting records together without overstating what the data proves."
        action={
          <div
            title={workspace.reason}
            className={`inline-flex min-h-10 items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-black ${workspace.mode === "remote" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : workspace.mode === "error" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}
          >
            {workspace.mode === "remote" ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
            <span>{workspace.mode === "remote" ? "Secure storage" : workspace.mode === "error" ? "Storage issue" : "Local draft"}</span>
          </div>
        }
      >
        <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <Field label="Funding project">
                <select
                  className={INPUT_CLASS}
                  value={activeProjectId}
                  onChange={(event) => selectProject(event.target.value)}
                  aria-label="Funding project"
                >
                  <option value="">New unsaved project</option>
                  {workspace.projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
                </select>
              </Field>
              <button
                type="button"
                onClick={startNewProject}
                disabled={!canManage}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              >
                <Plus size={16} /> New project
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
              {activeProject ? (
                <>
                  <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">{PROJECT_STATUS_OPTIONS.find(([value]) => value === draft.status)?.[1] || "Planning"}</span>
                  <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">{projectDocuments.length} document{projectDocuments.length === 1 ? "" : "s"}</span>
                  <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">{projectSnapshots.length} snapshot{projectSnapshots.length === 1 ? "" : "s"}</span>
                </>
              ) : (
                <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">Save the brief to unlock evidence tools</span>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <nav
              className="flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5"
              aria-label="Funding workspace sections"
              role="tablist"
            >
              {FUNDING_PRIMARY_VIEWS.map(([id, label, Icon]) => (
                <button
                  id={`funding-tab-${id}`}
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={view === id}
                  onClick={() => setView(id)}
                  className={`inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 text-sm font-black transition ${view === id ? "bg-slate-950 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"}`}
                >
                  <Icon size={16} /> {label}
                </button>
              ))}
            </nav>

            <div className="flex max-w-full items-center gap-2 overflow-x-auto" aria-label="Funding project evidence actions">
              <button
                type="button"
                onClick={() => openUpload()}
                disabled={!canManage || !activeProjectId}
                title={!activeProjectId ? "Save the project before uploading evidence" : "Upload a supporting document"}
                className="inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-emerald-600 px-3.5 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Upload size={16} /> {UPLOAD_DOCUMENT_LABEL}
              </button>
              {FUNDING_EVIDENCE_VIEWS.map(([id, label, Icon]) => (
                <button
                  id={`funding-tab-${id}`}
                  key={id}
                  type="button"
                  aria-pressed={view === id}
                  onClick={() => setView(id)}
                  disabled={!activeProjectId}
                  className={`inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3.5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${view === id ? "border-sky-300 bg-sky-50 text-sky-900" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}
                >
                  <Icon size={16} /> {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {view === "project" ? (
          <div className="mt-6 space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Project title"><input className={INPUT_CLASS} value={draft.title} onChange={(event) => setField("title", event.target.value)} placeholder="e.g. Grass pitch drainage improvement" disabled={!canManage} /></Field>
              <Field label="Funding area"><select className={INPUT_CLASS} value={draft.projectType} onChange={(event) => { setDraft((current) => ({ ...current, projectType: event.target.value, selectedProgrammeId: "" })); onProjectTypeChange?.(event.target.value); }} disabled={!canManage}>{model.funding.filters.projectTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
              <Field label="Project status"><select className={INPUT_CLASS} value={draft.status} onChange={(event) => setField("status", event.target.value)} disabled={!canManage}>{PROJECT_STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
              <Field label="Project postcode" hint="Used later for local and place-based opportunity matching."><input className={INPUT_CLASS} value={draft.postcode} onChange={(event) => setField("postcode", event.target.value.toUpperCase())} placeholder="BL6 7QE" disabled={!canManage} /></Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Estimated total cost"><input className={INPUT_CLASS} type="number" min="0" step="100" value={draft.estimatedCost || ""} onChange={(event) => setField("estimatedCost", Number(event.target.value || 0))} disabled={!canManage} /></Field>
              <Field label="Target grant request"><input className={INPUT_CLASS} type="number" min="0" step="100" value={draft.targetFunding || ""} onChange={(event) => setField("targetFunding", Number(event.target.value || 0))} disabled={!canManage} /></Field>
              <Field label="Legal structure"><input className={INPUT_CLASS} value={draft.legalStructure} onChange={(event) => setField("legalStructure", event.target.value)} placeholder="e.g. Constituted club / charity / CIC" disabled={!canManage} /></Field>
              <Field label="Affiliation or accreditation"><input className={INPUT_CLASS} value={draft.affiliation} onChange={(event) => setField("affiliation", event.target.value)} placeholder="e.g. Lancashire FA affiliation" disabled={!canManage} /></Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Selected programme" hint="Choose the opportunity whose exact requirements should drive the checklist.">
                <select className={INPUT_CLASS} value={draft.selectedProgrammeId} onChange={(event) => setField("selectedProgrammeId", event.target.value)} disabled={!canManage}>
                  <option value="">No programme selected yet</option>
                  {model.funding.programmes.map((programme) => <option key={programme.id} value={programme.id}>{programme.funder} — {programme.name}</option>)}
                </select>
              </Field>
              <Field label="Site tenure"><input className={INPUT_CLASS} value={draft.tenure} onChange={(event) => setField("tenure", event.target.value)} placeholder="e.g. 15-year lease ending 2041" disabled={!canManage} /></Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Need and proposed solution"><textarea className={TEXTAREA_CLASS} value={draft.summary} onChange={(event) => setField("summary", event.target.value)} placeholder="What is the problem, what evidence supports it and what will the project change?" disabled={!canManage} /></Field>
              <Field label="Beneficiaries"><textarea className={TEXTAREA_CLASS} value={draft.beneficiaries} onChange={(event) => setField("beneficiaries", event.target.value)} placeholder="Who currently benefits, who is excluded or waiting, and how many additional people should benefit?" disabled={!canManage} /></Field>
              <Field label="Measurable outcomes"><textarea className={TEXTAREA_CLASS} value={draft.outcomes} onChange={(event) => setField("outcomes", event.target.value)} placeholder="e.g. 20 additional playable hours per month and 30% fewer weather postponements." disabled={!canManage} /></Field>
              <Field label="Delivery plan"><textarea className={TEXTAREA_CLASS} value={draft.deliveryPlan} onChange={(event) => setField("deliveryPlan", event.target.value)} placeholder="Milestones, people responsible, permissions, procurement and target completion date." disabled={!canManage} /></Field>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-600"><strong className="text-slate-950">Funding package:</strong> {formatMoney(draft.targetFunding)} requested against {formatMoney(draft.estimatedCost)} total cost.</div>
              <button type="button" onClick={saveProject} disabled={!canManage || savingProject} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-50">{savingProject ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />} Save project</button>
            </div>
          </div>
        ) : null}

        {view === "local" ? (
          <FundingLocationPanel
            profile={{
              ...club,
              ...workspace.profile,
              postcode: workspace.profile?.postcode || club.postcode || club.weatherPostcode || draft.postcode || "",
              facilityPostcode: workspace.profile?.facilityPostcode || draft.postcode || club.postcode || club.weatherPostcode || "",
              legalStructure: workspace.profile?.legalStructure || draft.legalStructure || "",
              affiliation: workspace.profile?.affiliation || draft.affiliation || "",
              tenure: workspace.profile?.tenure || draft.tenure || "",
            }}
            projectType={draft.projectType || projectType}
            canManage={canManage}
            saving={savingProfile}
            onSave={saveProfile}
          />
        ) : null}

        {view === "applications" ? (
          <FundingApplicationTracker
            project={activeProject}
            programme={selectedProgramme}
            applications={workspace.applications}
            tasks={workspace.applicationTasks}
            obligations={workspace.monitoringObligations}
            canManage={canManage}
            trackerMode={workspace.trackerMode || "local"}
            busyKey={busyKey}
            onSaveApplication={saveApplication}
            onDeleteApplication={removeApplication}
            onSaveTask={saveApplicationTask}
            onDeleteTask={removeApplicationTask}
            onSaveObligation={saveMonitoringObligation}
            onDeleteObligation={removeMonitoringObligation}
          />
        ) : null}

        {view === "readiness" ? (
          <div className="mt-6">
            {!activeProjectId ? (
              <div className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-950 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/80 ring-1 ring-amber-200"><AlertTriangle size={19} /></div>
                  <div>
                    <h3 className="text-base font-black">Create the project brief first</h3>
                    <p className="mt-1 text-sm font-semibold leading-5 text-amber-900/80">Save the basic project details before adding readiness evidence, documents or snapshots.</p>
                  </div>
                </div>
                <button type="button" onClick={() => setView("project")} className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-amber-900 px-4 text-sm font-black text-white transition hover:bg-amber-950">Open project</button>
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <SummaryMetric label="Readiness" value={`${checklist.score}%`} detail={`${checklist.counts.ready} of ${checklist.total} requirements ready.`} icon={Target} tone={checklist.score >= 80 ? "emerald" : checklist.score >= 50 ? "amber" : "rose"} />
                  <SummaryMetric label="Missing" value={checklist.counts.missing} detail="Requirements needing a clear owner and next step." icon={AlertTriangle} tone={checklist.counts.missing ? "rose" : "emerald"} />
                  <SummaryMetric label="In progress" value={checklist.counts.in_progress} detail="Evidence being prepared or awaiting confirmation." icon={Loader2} tone="amber" />
                  <SummaryMetric label="Documents" value={projectDocuments.length} detail={`${FUNDING_DOCUMENT_RULES.maxFileSizeLabel} maximum per file; private club storage in production.`} icon={FileArchive} tone="sky" />
                </div>

                <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Application checklist</div>
                      <h3 className="mt-1 text-xl font-black text-slate-950">{selectedProgramme ? `${selectedProgramme.funder} — ${selectedProgramme.name}` : "Project requirements"}</h3>
                      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Missing items are shown first. Expand any item for exact steps, suggested evidence, ownership notes and document upload.</p>
                    </div>
                    <div className="min-w-48"><ProgressBar value={checklist.score} tone={checklist.score >= 80 ? "success" : checklist.score >= 50 ? "warning" : "danger"} /></div>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  {checklist.groups.map((group) => (
                    <section key={group.category}>
                      <div className="mb-3 flex items-center justify-between gap-3 px-1">
                        <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">{group.category}</h3>
                        <span className="text-xs font-black text-slate-400">{group.items.filter((item) => item.status === "ready").length}/{group.items.length} ready</span>
                      </div>
                      <div className="space-y-3">
                        {group.items.map((item) => <RequirementCard key={item.key} item={item} canManage={canManage} busyKey={busyKey} onSave={saveRequirement} onUpload={openUpload} />)}
                      </div>
                    </section>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : null}

        {view === "impact" ? (
          <FundingImpactEvidencePanel
            clubId={resolvedClubId}
            projectId={activeProjectId}
            canManage={canManage}
            onEvidenceChange={onImpactEvidenceChange}
          />
        ) : null}

        {view === "documents" ? (
          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Evidence library</div><h3 className="mt-1 text-xl font-black text-slate-950">{projectDocuments.length} supporting document{projectDocuments.length === 1 ? "" : "s"}</h3><p className="mt-2 text-sm font-semibold text-slate-600">Upload here or from a checklist requirement. Every file must be linked to the evidence item it supports.</p></div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-2xl bg-white px-4 py-3 text-xs font-bold text-slate-500 ring-1 ring-slate-200">Accepted: PDF, Word, Excel, CSV, text and images · {FUNDING_DOCUMENT_RULES.maxFileSizeLabel}</div>
                <button type="button" onClick={() => openUpload()} disabled={!canManage || !activeProjectId} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-40"><Upload size={16} /> Upload document</button>
              </div>
            </div>
            {projectDocuments.length ? (
              <div className="mt-5 overflow-hidden rounded-[24px] border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-[900px] w-full text-left">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500"><tr><th className="px-4 py-3">Document</th><th className="px-4 py-3">Supports</th><th className="px-4 py-3">Uploaded</th><th className="px-4 py-3">Size</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {projectDocuments.map((document) => {
                        const requirement = checklist.items.find((item) => item.key === document.requirementKey);
                        return (
                          <tr key={document.id}>
                            <td className="px-4 py-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-700"><FileText size={19} /></div><div><div className="max-w-sm truncate text-sm font-black text-slate-950">{document.fileName}</div><div className="mt-1 text-xs font-semibold text-slate-500">{document.documentType}</div></div></div></td>
                            <td className="px-4 py-4 text-sm font-semibold text-slate-600">{requirement?.title || document.requirementKey}</td>
                            <td className="px-4 py-4 text-sm font-semibold text-slate-600">{formatDate(document.createdAt, true)}</td>
                            <td className="px-4 py-4 text-sm font-semibold text-slate-600">{formatBytes(document.sizeBytes)}</td>
                            <td className="px-4 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => openDocument(document)} className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-700 hover:bg-slate-50"><Download size={14} /> Open</button><button type="button" onClick={() => setDeleteTarget(document)} disabled={!canManage} className="inline-flex h-9 items-center gap-2 rounded-xl border border-rose-200 px-3 text-xs font-black text-rose-700 hover:bg-rose-50 disabled:opacity-40"><Trash2 size={14} /> Remove</button></div></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-[24px] border border-dashed border-slate-300 p-10 text-center"><FolderOpen size={32} className="mx-auto text-slate-300" /><h3 className="mt-3 text-lg font-black text-slate-900">No documents attached</h3><p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-500">Upload the first document and choose the requirement it supports. You can also attach evidence directly from an expanded readiness item.</p><button type="button" onClick={() => openUpload()} disabled={!canManage || !activeProjectId} className="mt-4 inline-flex h-11 items-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-40"><Upload size={16} /> Upload first document</button></div>
            )}
          </div>
        ) : null}

        {view === "snapshots" ? (
          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Evidence history</div><h3 className="mt-1 text-xl font-black text-slate-950">Immutable application snapshots</h3><p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">Create a dated record before submission. It freezes the project brief, programme, checklist, document manifest and operational evidence summary without copying private document contents.</p></div>
              <button type="button" onClick={createSnapshot} disabled={!canManage || !activeProjectId || busyKey === "snapshot"} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-40">{busyKey === "snapshot" ? <Loader2 size={17} className="animate-spin" /> : <Archive size={17} />} Create snapshot</button>
            </div>
            <div className="mt-5 space-y-3">
              {projectSnapshots.map((snapshot) => (
                <div key={snapshot.id} className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-4"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><FileCheck2 size={21} /></div><div><div className="text-sm font-black text-slate-950">{snapshot.label}</div><div className="mt-1 text-xs font-semibold text-slate-500">Created {formatDate(snapshot.createdAt, true)} · Readiness {snapshot.snapshot?.readiness?.score ?? 0}% · {snapshot.snapshot?.documents?.length ?? 0} documents referenced</div></div></div>
                  <StatusChip status="success" size="sm">Locked evidence record</StatusChip>
                </div>
              ))}
              {!projectSnapshots.length ? <div className="rounded-[24px] border border-dashed border-slate-300 p-10 text-center"><History size={32} className="mx-auto text-slate-300" /><h3 className="mt-3 text-lg font-black text-slate-900">No evidence snapshot yet</h3><p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-500">Create one when the project and checklist reach a meaningful milestone, especially immediately before submitting an application.</p></div> : null}
            </div>
          </div>
        ) : null}
      </Card>

      <FundingDocumentUploadDialog
        open={uploadOpen}
        requirements={checklist.items.filter((item) => item.allowsUpload)}
        initialRequirementKey={uploadTargetKey}
        busy={busyKey === "upload"}
        onSubmit={uploadDocument}
        onCancel={() => { if (busyKey !== "upload") { setUploadOpen(false); setUploadTargetKey(""); } }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        eyebrow="Remove supporting document"
        title={deleteTarget ? `Remove ${deleteTarget.fileName}?` : "Remove document?"}
        description="This removes the document from the funding workspace. Existing evidence snapshots retain only the historical file reference, not the file itself."
        confirmLabel="Remove document"
        cancelLabel="Keep document"
        tone="danger"
        busy={Boolean(deleteTarget && busyKey === deleteTarget.id)}
        initialFocus="cancel"
        onConfirm={confirmDeleteDocument}
        onCancel={() => !(deleteTarget && busyKey === deleteTarget.id) && setDeleteTarget(null)}
      />
    </>
  );
}
