"use client";

import { useMemo, useState } from "react";
import { createModuleRecord, deleteModuleRecord } from "@/lib/api";

type IncidentRecord = {
  id: string;
  title: string;
  data: Record<string, string>;
  created_at: string;
};

type Props = {
  workspaceId: string;
  records: IncidentRecord[];
  onRecordSaved: (record: IncidentRecord) => void;
  onRecordDeleted: (id: string) => void;
};

const INCIDENT_PREFIX = "Environment incident: ";
const UPDATE_PREFIX = "Incident update: ";

const statuses = ["Reported", "Investigating", "Action Taken", "Resolved"];
const types = ["Air pollution", "Water pollution", "Noise pollution", "Waste dumping", "Tree cutting", "Other"];

export default function EnvironmentIncidentReporting({
  workspaceId,
  records,
  onRecordSaved,
  onRecordDeleted,
}: Props) {
  const [form, setForm] = useState({
    title: "",
    type: "Air pollution",
    location: "",
    observedDate: new Date().toISOString().slice(0, 10),
    severity: "Medium",
    description: "",
    affectedArea: "",
    evidence: "",
  });
  const [filter, setFilter] = useState("All");
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [nextStatus, setNextStatus] = useState("Investigating");
  const [updateNote, setUpdateNote] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const incidents = useMemo(
    () => records.filter((r) => r.title.startsWith(INCIDENT_PREFIX)),
    [records]
  );
  const updates = useMemo(
    () => records.filter((r) => r.title.startsWith(UPDATE_PREFIX)),
    [records]
  );
  const visible = incidents.filter((r) => filter === "All" || latestStatus(r) === filter);

  const latestStatus = (incident: IncidentRecord) => {
    const history = updates
      .filter((u) => u.title === `${UPDATE_PREFIX}${incident.id}`)
      .sort((a, b) => (b.data["Update date"] || "").localeCompare(a.data["Update date"] || ""));
    return history[0]?.data["Status"] || incident.data["Status"] || "Reported";
  };
  const counts = {
    total: incidents.length,
    open: incidents.filter((r) => latestStatus(r) !== "Resolved").length,
    investigating: incidents.filter((r) => latestStatus(r) === "Investigating").length,
    resolved: incidents.filter((r) => latestStatus(r) === "Resolved").length,
  };

  async function submitIncident(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId || !form.title.trim() || !form.location.trim() || !form.description.trim()) {
      setError("Enter an incident title, location and description.");
      return;
    }
    setSaving(true); setError(""); setMessage("");
    try {
      const result = await createModuleRecord("environment", {
        workspace_id: workspaceId,
        title: `${INCIDENT_PREFIX}${form.title.trim()}`,
        data: {
          "Incident title": form.title.trim(),
          "Incident type": form.type,
          "Location": form.location.trim(),
          "Observed date": form.observedDate,
          "Severity": form.severity,
          "Description": form.description.trim(),
          "Affected area": form.affectedArea.trim(),
          "Evidence details": form.evidence.trim(),
          "Status": "Reported",
          "Reported date": new Date().toISOString().slice(0, 10),
        },
      });
      onRecordSaved(result.record);
      setForm({ title: "", type: "Air pollution", location: "", observedDate: new Date().toISOString().slice(0, 10), severity: "Medium", description: "", affectedArea: "", evidence: "" });
      setMessage("Environmental incident saved to your SARVAM workspace.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save incident.");
    } finally { setSaving(false); }
  }

  async function saveUpdate(incident: IncidentRecord) {
    if (!workspaceId) return;
    setError(""); setMessage("");
    try {
      const result = await createModuleRecord("environment", {
        workspace_id: workspaceId,
        title: `${UPDATE_PREFIX}${incident.id}`,
        data: {
          "Incident ID": incident.id,
          "Incident title": incident.data["Incident title"] || incident.title.replace(INCIDENT_PREFIX, ""),
          "Status": nextStatus,
          "Update note": updateNote.trim(),
          "Update date": new Date().toISOString().slice(0, 10),
        },
      });
      onRecordSaved(result.record);
      setUpdatingId(""); setUpdateNote(""); setMessage("Incident progress updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update incident.");
    }
  }

  async function removeIncident(incident: IncidentRecord) {
    if (!workspaceId) return;
    try {
      await deleteModuleRecord("environment", incident.id, workspaceId);
      onRecordDeleted(incident.id);
      setMessage("Incident record deleted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete incident.");
    }
  }

  return (
    <section className="mb-6 space-y-5 rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Environment response desk</p>
          <h3 className="mt-1 text-xl font-bold text-slate-900">Environmental Incident Reporting</h3>
          <p className="mt-1 text-sm text-slate-600">Register local environmental incidents and track follow-up progress in SARVAM.</p>
        </div>
        <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">{counts.total} incidents</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Total reports</p><p className="mt-1 text-2xl font-bold">{counts.total}</p></div>
        <div className="rounded-xl bg-amber-50 p-3"><p className="text-xs text-amber-800">Open</p><p className="mt-1 text-2xl font-bold text-amber-900">{counts.open}</p></div>
        <div className="rounded-xl bg-sky-50 p-3"><p className="text-xs text-sky-800">Investigating</p><p className="mt-1 text-2xl font-bold text-sky-900">{counts.investigating}</p></div>
        <div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs text-emerald-800">Resolved</p><p className="mt-1 text-2xl font-bold text-emerald-900">{counts.resolved}</p></div>
      </div>

      <form onSubmit={submitIncident} className="space-y-3 rounded-xl border border-slate-200 p-4">
        <h4 className="font-semibold text-slate-900">Report a new incident</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">Incident title *
            <input value={form.title} onChange={(e) => setForm(v => ({...v, title:e.target.value}))} required maxLength={120} placeholder="e.g. Waste dumped near canal" className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="text-sm font-medium text-slate-700">Incident type
            <select value={form.type} onChange={(e) => setForm(v => ({...v, type:e.target.value}))} className="mt-1 w-full rounded-lg border bg-white px-3 py-2">{types.map(t => <option key={t}>{t}</option>)}</select>
          </label>
          <label className="text-sm font-medium text-slate-700">Location *
            <input value={form.location} onChange={(e) => setForm(v => ({...v, location:e.target.value}))} required maxLength={180} placeholder="Area, landmark, city" className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="text-sm font-medium text-slate-700">Date observed
            <input type="date" value={form.observedDate} onChange={(e) => setForm(v => ({...v, observedDate:e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="text-sm font-medium text-slate-700">Severity
            <select value={form.severity} onChange={(e) => setForm(v => ({...v, severity:e.target.value}))} className="mt-1 w-full rounded-lg border bg-white px-3 py-2"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select>
          </label>
          <label className="text-sm font-medium text-slate-700">Affected area
            <input value={form.affectedArea} onChange={(e) => setForm(v => ({...v, affectedArea:e.target.value}))} maxLength={180} placeholder="Nearby homes, road, waterbody..." className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
        </div>
        <label className="block text-sm font-medium text-slate-700">Incident description *
          <textarea value={form.description} onChange={(e) => setForm(v => ({...v, description:e.target.value}))} required maxLength={2000} rows={3} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="Describe what happened, when it started and what you observed." />
        </label>
        <label className="block text-sm font-medium text-slate-700">Evidence details (optional)
          <input value={form.evidence} onChange={(e) => setForm(v => ({...v, evidence:e.target.value}))} maxLength={500} placeholder="Photo/video filename or evidence note; files are not uploaded here." className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <button disabled={saving} className="rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : "Save incident report"}</button>
      </form>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="font-semibold text-slate-900">Incident register</h4>
        <select aria-label="Filter incidents by status" value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-lg border bg-white px-3 py-2 text-sm">
          <option>All</option>{statuses.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {visible.length === 0 ? <p className="rounded-xl border border-dashed p-5 text-sm text-slate-500">No incidents match this filter yet.</p> : (
        <div className="space-y-3">
          {visible.map((incident) => {
            const history = updates.filter(u => u.title === `${UPDATE_PREFIX}${incident.id}`).sort((a,b) => (b.data["Update date"] || "").localeCompare(a.data["Update date"] || ""));
            const status = latestStatus(incident);
            return <article key={incident.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><h5 className="font-semibold text-slate-900">{incident.data["Incident title"] || incident.title.replace(INCIDENT_PREFIX, "")}</h5><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{status}</span><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-800">{incident.data["Severity"] || "Unspecified"}</span></div>
                  <p className="mt-1 text-sm text-slate-600">{incident.data["Incident type"]} Â· {incident.data["Location"]}</p>
                  <p className="mt-1 text-sm text-slate-500">Observed: {incident.data["Observed date"] || "Not specified"} Â· Reported: {incident.data["Reported date"] || incident.created_at.slice(0,10)}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{incident.data["Description"]}</p>
                  {incident.data["Affected area"] && <p className="mt-1 text-xs text-slate-500">Affected: {incident.data["Affected area"]}</p>}
                  {incident.data["Evidence details"] && <p className="mt-1 text-xs text-slate-500">Evidence note: {incident.data["Evidence details"]}</p>}
                  {history.length > 0 && <div className="mt-3 rounded-lg bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-700">Progress history</p>{history.map(h => <p key={h.id} className="mt-1 text-xs text-slate-600">{h.data["Update date"]}: {h.data["Status"]} {h.data["Update note"] ? `â€” ${h.data["Update note"]}` : ""}</p>)}</div>}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button type="button" onClick={() => {setUpdatingId(updatingId === incident.id ? "" : incident.id); setNextStatus(status === "Reported" ? "Investigating" : status);}} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">Update status</button>
                  <button type="button" onClick={() => void removeIncident(incident)} className="rounded-lg px-3 py-2 text-xs font-semibold text-red-600">Delete</button>
                </div>
              </div>
              {updatingId === incident.id && <div className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-[1fr_2fr_auto]">
                <select value={nextStatus} onChange={e => setNextStatus(e.target.value)} className="rounded-lg border bg-white px-3 py-2 text-sm">{statuses.map(s => <option key={s}>{s}</option>)}</select>
                <input value={updateNote} onChange={e => setUpdateNote(e.target.value)} maxLength={500} placeholder="Progress note (optional)" className="rounded-lg border px-3 py-2 text-sm" />
                <button type="button" onClick={() => void saveUpdate(incident)} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white">Save update</button>
              </div>}
            </article>;
          })}
        </div>
      )}
      <p className="text-xs leading-5 text-slate-500">This is a local SARVAM tracking record. It does not submit a complaint to a government authority, verify evidence, or confirm that an agency has investigated the incident. Avoid entering sensitive personal information.</p>
    </section>
  );
}
