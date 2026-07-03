import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Building2,
  ChevronDown,
  LogOut,
  Settings,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { getRoleLabel } from "../lib/security/permissions.js";
import ProfileDialog from "../components/profile/ProfileDialog.jsx";

function getDisplayName(user) {
  return (
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Club Administrator"
  );
}

function getInitials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "GC";
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}



export default function HeaderProfile({
  session = null,
  user: userProp = null,
  clubName = "Ground Control",
  memberships = [],
  activeClubId = "",
  activeRole = "viewer",
  workspaceAccess = null,
  roleLabelOverride = "",
  platformMode = false,
  onClubChange,
  onOpenSettings,
  onProfileUpdated,
  onSignOut,
}) {
  const user = session?.user || userProp;
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const menuRef = useRef(null);

  const displayName = useMemo(() => getDisplayName(user), [user]);
  const initials = useMemo(() => getInitials(displayName), [displayName]);
  const email = user?.email || "Secure workspace account";
  const roleLabel = roleLabelOverride || getRoleLabel(activeRole);
  const canOpenSettings = Boolean(workspaceAccess?.canManageSettings);
  const canViewAccess = Boolean(workspaceAccess?.canViewAudit);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const openSettings = (tab) => {
    setOpen(false);
    onOpenSettings?.(tab);
  };

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await onSignOut?.();
    } finally {
      setSigningOut(false);
      setOpen(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label="Notifications"
        className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
      >
        <Bell size={19} strokeWidth={2.5} />
        <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
      </button>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className={`flex items-center gap-3 rounded-2xl border px-2 py-1.5 text-left transition ${
            open
              ? "border-emerald-200 bg-emerald-50 shadow-sm"
              : "border-transparent hover:border-slate-200 hover:bg-slate-50"
          }`}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-sm font-black text-white shadow-sm ring-2 ring-white">
            {initials}
          </div>

          <div className="hidden min-w-0 sm:block">
            <div className="max-w-44 truncate text-sm font-black text-slate-950">
              {displayName}
            </div>
            <div className="max-w-44 truncate text-xs font-bold text-slate-500">
              {roleLabel}
            </div>
          </div>

          <ChevronDown
            size={16}
            strokeWidth={2.5}
            className={`hidden text-slate-400 transition-transform sm:block ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 top-[calc(100%+12px)] z-50 w-[310px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.20)]"
          >
            <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-5 py-5 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-400 text-sm font-black text-slate-950 shadow-lg shadow-emerald-950/20">
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-black">{displayName}</div>
                  <div className="mt-0.5 truncate text-xs font-semibold text-slate-300">{email}</div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-emerald-300" />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-black text-white">Secure workspace</div>
                    <div className="truncate text-[11px] font-semibold text-slate-400">{roleLabel}</div>
                  </div>
                </div>
                {!platformMode && memberships.length > 1 ? (
                  <label className="mt-3 block">
                    <span className="sr-only">Select club workspace</span>
                    <span className="relative block">
                      <Building2 size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-emerald-300" />
                      <select
                        value={activeClubId}
                        onChange={(event) => {
                          setOpen(false);
                          onClubChange?.(event.target.value);
                        }}
                        className="h-10 w-full appearance-none rounded-xl border border-white/10 bg-slate-950/60 pl-9 pr-3 text-xs font-black text-white outline-none"
                      >
                        {memberships.map((membership) => (
                          <option key={membership.clubId} value={membership.clubId}>
                            {membership.club?.name || "Club workspace"}
                          </option>
                        ))}
                      </select>
                    </span>
                  </label>
                ) : (
                  <div className="mt-2 truncate text-[11px] font-semibold text-slate-300">{clubName}</div>
                )}
              </div>
            </div>

            <div className="p-2">
              <button
                type="button"
                role="menuitem"
                onClick={() => { setOpen(false); setProfileOpen(true); }}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-slate-50"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <UserRound size={18} strokeWidth={2.3} />
                </span>
                <span>
                  <span className="block text-sm font-black text-slate-900">My profile</span>
                  <span className="block text-xs font-semibold text-slate-500">Change the name shown across Ground Control</span>
                </span>
              </button>

              {platformMode ? (
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <div className="text-sm font-black text-slate-900">Daxora platform access</div>
                  <div className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                    Internal administration and support tooling. Operational club data still requires owner-approved support access.
                  </div>
                </div>
              ) : canViewAccess ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => openSettings("access")}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-slate-50"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                    <UserRound size={18} strokeWidth={2.3} />
                  </span>
                  <span>
                    <span className="block text-sm font-black text-slate-900">Access & audit</span>
                    <span className="block text-xs font-semibold text-slate-500">Review members, roles and secure activity</span>
                  </span>
                </button>
              ) : (
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <div className="text-sm font-black text-slate-900">{roleLabel} access</div>
                  <div className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                    {workspaceAccess?.isSupport
                      ? "This support session is read-only and time-limited."
                      : workspaceAccess?.isReadOnly
                        ? "You can review this workspace but cannot make changes."
                        : "You can operate matchdays without changing club administration."}
                  </div>
                </div>
              )}

              {canOpenSettings ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => openSettings("club")}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-slate-50"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                    <Settings size={18} strokeWidth={2.3} />
                  </span>
                  <span>
                    <span className="block text-sm font-black text-slate-900">Workspace settings</span>
                    <span className="block text-xs font-semibold text-slate-500">Manage club details and configuration</span>
                  </span>
                </button>
              ) : null}
            </div>

            <div className="border-t border-slate-100 p-2">
              <button
                type="button"
                role="menuitem"
                disabled={signingOut}
                onClick={signOut}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-rose-600 transition hover:bg-rose-50 disabled:cursor-wait disabled:opacity-60"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                  <LogOut size={18} strokeWidth={2.3} />
                </span>
                <span>
                  <span className="block text-sm font-black">
                    {signingOut ? "Signing out…" : "Sign out"}
                  </span>
                  <span className="block text-xs font-semibold text-rose-400">
                    Return to the Ground Control login screen
                  </span>
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
      <ProfileDialog
        open={profileOpen}
        session={session || { user }}
        onClose={() => setProfileOpen(false)}
        onUpdated={onProfileUpdated}
      />
    </div>
  );
}
