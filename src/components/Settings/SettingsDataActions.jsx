import React, { useRef, useState } from "react";
import { Download, FileDown, FileUp, Plus, RefreshCw, X } from "lucide-react";
import { downloadCsv, downloadJson, mapImportedRows, readImportFile } from "../../lib/settings/dataExchange.js";
import { SecondaryButton } from "./SettingsPrimitives.jsx";

export default function SettingsDataActions({
  label,
  rows = [],
  columns = [],
  filename,
  templateRows = [],
  normaliseRow = (row) => row,
  onImport,
}) {
  const inputRef = useRef(null);
  const [pending, setPending] = useState(null);
  const [message, setMessage] = useState("");

  const importFile = async (file) => {
    if (!file) return;
    try {
      const raw = await readImportFile(file);
      const mapped = mapImportedRows(raw, columns)
        .map((row, index) => normaliseRow(row, index))
        .filter(Boolean);
      if (!mapped.length) throw new Error("No valid records were found in that file.");
      setPending({ fileName: file.name, rows: mapped });
      setMessage("");
    } catch (error) {
      setPending(null);
      setMessage(error?.message || "The file could not be imported.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const applyImport = (mode) => {
    if (!pending) return;
    onImport?.(pending.rows, mode);
    setMessage(`${pending.rows.length} ${label.toLowerCase()} ${mode === "append" ? "added" : "imported"}.`);
    setPending(null);
  };

  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-sm font-black text-slate-950">Import and export</div>
          <div className="mt-1 text-xs font-semibold leading-5 text-slate-500">
            Move {label.toLowerCase()} between clubs or prepare data in a spreadsheet before importing it.
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.json,text/csv,application/json"
            className="hidden"
            onChange={(event) => importFile(event.target.files?.[0])}
          />
          <SecondaryButton icon={FileUp} onClick={() => inputRef.current?.click()}>Import CSV / JSON</SecondaryButton>
          <SecondaryButton icon={FileDown} onClick={() => downloadCsv(`${filename}.csv`, rows, columns)} disabled={!rows.length}>Export CSV</SecondaryButton>
          <SecondaryButton icon={Download} onClick={() => downloadJson(`${filename}.json`, rows)} disabled={!rows.length}>Export JSON</SecondaryButton>
          <SecondaryButton icon={FileDown} onClick={() => downloadCsv(`${filename}-template.csv`, templateRows, columns)}>CSV template</SecondaryButton>
        </div>
      </div>

      {pending ? (
        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <div className="text-sm font-black text-blue-950">{pending.fileName}</div>
          <div className="mt-1 text-sm font-semibold text-blue-800">
            {pending.rows.length} valid {label.toLowerCase()} found. Choose how to apply them.
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <SecondaryButton icon={RefreshCw} onClick={() => applyImport("replace")}>Replace current</SecondaryButton>
            <SecondaryButton icon={Plus} onClick={() => applyImport("append")}>Add to current</SecondaryButton>
            <SecondaryButton icon={X} onClick={() => setPending(null)}>Cancel</SecondaryButton>
          </div>
        </div>
      ) : null}

      {message ? <div className="mt-3 text-sm font-bold text-slate-600">{message}</div> : null}
    </div>
  );
}
