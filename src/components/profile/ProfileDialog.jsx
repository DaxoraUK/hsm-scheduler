import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, LoaderCircle, UserRound, X } from "lucide-react";
import { toast } from "../../lib/notifications/daxoraNotifications.js";

import { Auth, DB } from "../../lib/supabase.js";
import {
  applyDisplayNameToSession,
  getSessionDisplayName,
  validateDisplayName,
} from "../../lib/profile/profileModel.js";

const inputClass = "h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";

export default function ProfileDialog({ open, session, onClose, onUpdated }) {
  const currentName = useMemo(() => getSessionDisplayName(session), [session]);
  const [displayName, setDisplayName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    if (!open) return;
    setDisplayName(currentName);
    setErrors([]);
  }, [currentName, open]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !saving) onClose?.();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open, saving]);

  if (!open) return null;

  const save = async () => {
    if (saving) return;
    const validation = validateDisplayName(displayName);
    setErrors(validation.errors);
    if (validation.errors.length) return;

    setSaving(true);
    try {
      const profile = await DB.updateMyProfile(validation.displayName);
      const confirmedName = profile?.display_name || validation.displayName;
      const nextSession = applyDisplayNameToSession(session || Auth.getSession(), confirmedName);
      Auth.saveSession(nextSession);
      onUpdated?.(nextSession);
      toast.success("Display name updated");
      onClose?.();
    } catch (error) {
      setErrors([error?.message || "Display name could not be updated."]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close profile settings"
        className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm"
        onClick={() => !saving && onClose?.()}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-dialog-title"
        className="relative w-full max-w-lg overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-2xl"
      >
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white">
          <button
            type="button"
            aria-label="Close"
            disabled={saving}
            onClick={onClose}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            <X size={18} />
          </button>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400 text-slate-950">
            <UserRound size={23} />
          </div>
          <h2 id="profile-dialog-title" className="mt-5 text-2xl font-black">My profile</h2>
          <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-slate-300">
            Choose the name shown in Ground Control, audit history and club member lists.
          </p>
        </div>

        <div className="p-6">
          <label className="block text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Display name
            <input
              autoFocus
              value={displayName}
              maxLength={80}
              onChange={(event) => {
                setDisplayName(event.target.value);
                if (errors.length) setErrors([]);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") save();
              }}
              className={`${inputClass} mt-2 normal-case tracking-normal`}
              placeholder="Your name"
              autoComplete="name"
            />
          </label>

          <div className="mt-2 flex items-center justify-between gap-3 text-xs font-semibold text-slate-400">
            <span>Your email address and sign-in details are unchanged.</span>
            <span>{displayName.trim().length}/80</span>
          </div>

          {errors.length ? (
            <div role="alert" className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">
              {errors.map((error) => <div key={error}>{error}</div>)}
            </div>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || displayName.trim() === currentName}
              onClick={save}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <LoaderCircle className="animate-spin" size={17} /> : <CheckCircle2 size={17} />}
              Save display name
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
