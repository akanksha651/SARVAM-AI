"use client";

import { useMemo, useState } from "react";
import { createModuleRecord, deleteModuleRecord } from "@/lib/api";

type ComplaintRecord = {
  id: string;
  title: string;
  data: Record<string, string>;
  created_at: string;
};

type Props = {
  workspaceId: string;
  records: ComplaintRecord[];
  onRecordSaved: (record: ComplaintRecord) => void;
  onRecordDeleted: (id: string) => void;
};

const statuses = ["Registered", "Acknowledged", "Under Review", "Action Required", "Resolved", "Closed"];

export default function GovernmentComplaintTracker({ workspaceId, records, onRecordSaved, onRecordDeleted }: Props) {
  const [category, setCategory] = useState("Public services");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState("Acknowledged");
  const [reference, setReference] = useState("");
  const [updateNotes, setUpdateNotes] = useState("");
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const complaints = useMemo(() => records.filter((r) => r.title.startsWith("Complaint: ")), [records]);
  const updates = useMemo(() => records.filter((r) => r.title.startsWith("Complaint update: ")).sort((a, b) => (b.data["Update date"] || b.created_at).localeCompare(a.data["Update date"] || a.created_at)), [records]);
  const selected = complaints.find((r) => r.id === selectedId);

  async function saveComplaint(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId || !department.trim() || !location.trim() || !description.trim()) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await createModuleRecord("government", {
        workspace_id: workspaceId,
        title: `Complaint: ${department.trim()} â€” ${category}`,
        data: {
          "Complaint category": category,
          "Department / authority": department.trim(),
          "Location": location.trim(),
          "Description": description.trim(),
          "Priority": priority,
          "Complaint status": "Registered",
          "Reported date": new Date().toISOString().slice(0, 10),
        },
      });
      onRecordSaved(result.record);
      setDepartment(""); setLocation(""); setDescription("");
      setNotice("Complaint saved in your SARVAM workspace.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save complaint.");
    } finally { setSaving(false); }
  }

  async function saveUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId || !selected) return;
    setUpdating(true); setError(""); setNotice("");
    try {
      const result = await createModuleRecord("government", {
        workspace_id: workspaceId,
        title: `Complaint update: ${selected.title}`,
        data: {
          "Complaint record ID": selected.id,
          "Complaint": selected.title,
          "Department / authority": selected.data["Department / authority"] || "",
          "Status": status,
          "Reference number": reference.trim(),
          "Update date": new Date().toISOString().slice(0, 10),
          "Notes": updateNotes.trim(),
        },
      });
      onRecordSaved(result.record);
      setReference(""); setUpdateNotes("");
      setNotice("Complaint progress update saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save progress update.");
    } finally { setUpdating(false); }
  }

  async function remove(id: string) {
    if (!workspaceId || !window.confirm("Delete this saved complaint record?")) return;
    try {
      await deleteModuleRecord("government", id, workspaceId);
      onRecordDeleted(id);
      setNotice("Record deleted.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not delete record."); }
  }

  return (
    <section className="mb-6 space-y-5 rounded-2xl border border-orange-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-orange-700">Public grievance organizer</p>
        <h3 className="mt-1 text-xl font-bold text-slate-900">Government Complaint & Grievance Tracker</h3>
        <p className="mt-1 text-sm text-slate-600">Record a civic issue, keep its reference details and maintain a local progress history.</p>
      </div>

      <form onSubmit={saveComplaint} className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-medium text-slate-700">Complaint category
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5">
            <option>Public services</option><option>Roads and transport</option><option>Water supply</option><option>Electricity</option><option>Sanitation and waste</option><option>Public distribution</option><option>Education</option><option>Healthcare services</option><option>Other</option>
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">Priority
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"><option>Low</option><option>Normal</option><option>High</option><option>Urgent</option></select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700 sm:col-span-2">Department / responsible authority *
          <input required maxLength={180} value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Municipal Corporation" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700 sm:col-span-2">Issue location *
          <input required maxLength={250} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Area, ward, city" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700 sm:col-span-2">Complaint details *
          <textarea required maxLength={3000} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the issue, when it started and its impact..." className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
        </label>
        <div className="sm:col-span-2"><button disabled={saving || !workspaceId} className="rounded-xl bg-orange-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-50">{saving ? "Saving..." : "Save complaint record"}</button></div>
      </form>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-orange-50 p-3"><p className="text-xs text-orange-800">Saved complaints</p><p className="mt-1 text-2xl font-bold text-orange-950">{complaints.length}</p></div>
        <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-600">Progress updates</p><p className="mt-1 text-2xl font-bold text-slate-900">{updates.length}</p></div>
        <div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs text-emerald-800">Marked resolved</p><p className="mt-1 text-2xl font-bold text-emerald-950">{updates.filter((u) => u.data.Status === "Resolved" || u.data.Status === "Closed").length}</p></div>
      </div>

      <form onSubmit={saveUpdate} className="space-y-3 rounded-xl border border-slate-200 p-4">
        <h4 className="font-semibold text-slate-900">Update complaint progress</h4>
        <label className="block space-y-1 text-sm font-medium text-slate-700">Select complaint
          <select required value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"><option value="">Choose a saved complaint</option>{complaints.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-medium text-slate-700">Status
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5">{statuses.map((s) => <option key={s}>{s}</option>)}</select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">Official reference / ticket number
            <input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} placeholder="If you have one" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
          </label>
        </div>
        <label className="block space-y-1 text-sm font-medium text-slate-700">Update notes
          <textarea rows={2} maxLength={1500} value={updateNotes} onChange={(e) => setUpdateNotes(e.target.value)} placeholder="Record a call, visit, response or next step" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
        </label>
        <button type="submit" disabled={updating || !selected} className="rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{updating ? "Saving..." : "Save progress update"}</button>
      </form>

      <div className="space-y-3">
        <h4 className="font-semibold text-slate-900">Complaint records</h4>
        {complaints.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-sm text-slate-500">No complaints recorded yet.</p> : complaints.map((c) => (
          <article key={c.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h5 className="font-semibold text-slate-900">{c.title}</h5><p className="mt-1 text-sm text-slate-600">{c.data["Department / authority"]} Â· {c.data.Location}</p></div><span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-800">{c.data.Priority}</span></div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{c.data.Description}</p>
            <p className="mt-2 text-xs text-slate-500">Recorded: {c.data["Reported date"] || c.created_at.slice(0, 10)}</p>
            <button type="button" onClick={() => void remove(c.id)} className="mt-2 text-xs font-semibold text-red-600 hover:underline">Delete complaint</button>
          </article>
        ))}
      </div>

      <div className="space-y-3">
        <h4 className="font-semibold text-slate-900">Progress history</h4>
        {updates.length === 0 ? <p className="text-sm text-slate-500">No progress updates yet.</p> : updates.map((u) => (
          <article key={u.id} className="rounded-xl border border-slate-200 p-3"><div className="flex flex-wrap justify-between gap-2"><p className="font-medium text-slate-800">{u.data.Complaint}</p><span className="text-xs font-semibold text-blue-700">{u.data.Status}</span></div><p className="mt-1 text-xs text-slate-500">{u.data["Update date"]} {u.data["Reference number"] ? `Â· Ref: ${u.data["Reference number"]}` : ""}</p>{u.data.Notes && <p className="mt-2 text-sm text-slate-600">{u.data.Notes}</p>}<button type="button" onClick={() => void remove(u.id)} className="mt-2 text-xs font-semibold text-red-600 hover:underline">Delete update</button></article>
        ))}
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{notice}</p>}
      <p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">This is a local complaint organizer. It does not submit grievances to government departments or fetch official ticket status. Submit through the relevant official portal and enter its reference number here. Avoid storing Aadhaar, OTPs or other sensitive personal details.</p>
    </section>
  );
}
