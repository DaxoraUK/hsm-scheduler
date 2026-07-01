import React, { useState } from "react";
import { cleanName } from "../lib/scheduler.js";

export default function CoachMessages({ games, dateLabel, club }) {
  const [copied, setCopied] = useState(null);

  const activeGames = games.filter((game) => game.status !== "postponed");

  const copyText = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      alert("Copy failed");
    }
  };

  if (!activeGames.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
        No coach messages available.
      </div>
    );
  }

  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-5 lg:grid-cols-2">
      {activeGames.map((game, index) => {
        const teamName = cleanName(game.homeTeam, club.name);
        const opposition = game.awayTeam || "TBC";
        const pitch = game.pitchLabel || game.pitch || game.pitchId || "TBC";
        const format =
          game.cfg?.format || game.manualFormat || game.format || "TBC";
        const ko = game.koTime || "TBC";
        const ref = game.referee || "TBC";
        const refStatus = game.refStatus || "TBC";

        const message = `Hi! ${teamName} are home ${dateLabel}.

KO: ${ko}
Pitch: ${pitch}
vs: ${opposition}
Format: ${format}
Referee: ${ref}

Please arrive in good time and let me know if there are any issues.`;

        return (
          <article
            key={`${teamName}-${index}`}
            className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60"
          >
            <div className="flex min-w-0 items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">
                  Coach Update
                </div>

                <h3 className="mt-2 truncate text-xl font-black tracking-tight text-slate-950">
                  {teamName}
                </h3>
              </div>

              <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700">
                {ko}
              </span>
            </div>

            <div className="mt-4 flex min-w-0 flex-wrap gap-2">
              <Chip tone="green">{pitch}</Chip>
              <Chip>{format}</Chip>
              <Chip>{refStatus}</Chip>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Info label="Opposition" value={opposition} />
              <Info label="Pitch" value={pitch} />
              <Info label="Format" value={format} />
              <Info label="Referee" value={ref} />
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="line-clamp-2 text-sm font-semibold leading-6 text-slate-600">
                Hi! {teamName} are home {dateLabel}. KO {ko} on {pitch} vs{" "}
                {opposition}.
              </p>
            </div>

            <button
              type="button"
              onClick={() => copyText(message, index)}
              className="mt-5 flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 active:scale-[0.99]"
            >
              {copied === index ? "Copied ✓" : "Copy WhatsApp →"}
            </button>
          </article>
        );
      })}
    </div>
  );
}

function Chip({ children, tone = "slate" }) {
  const cls =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700"
      : "bg-slate-100 text-slate-600";

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full px-3 py-1 text-xs font-black ${cls}`}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

function Info({ label, value }) {
  return (
    <div className="min-w-0 rounded-2xl bg-slate-50 px-4 py-3">
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-bold text-slate-800">
        {value}
      </div>
    </div>
  );
}