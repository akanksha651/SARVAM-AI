"use client";

import { useState } from "react";
import { createModuleRecord, deleteModuleRecord } from "@/lib/api";

type EcoRecord = {
  id: string;
  title: string;
  data: Record<string, string>;
  created_at: string;
};

type Props = {
  workspaceId: string;
  records: EcoRecord[];
  onRecordSaved: (record: EcoRecord) => void;
  onRecordDeleted: (id: string) => void;
};

const categories = [
  "Tree plantation",
  "Waste segregation",
  "Plastic reduction",
  "Water conservation",
  "Energy saving",
  "Clean-up drive",
  "Recycling",
  "Other",
];

export default function EnvironmentActionTracker({
  workspaceId,
  records,
  onRecordSaved,
  onRecordDeleted,
}: Props) {
  const [category, setCategory] = useState(categories[0]);
  const [activity, setActivity] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [date, setDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [status, setStatus] = useState("Completed");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const ecoRecords = records
    .filter((record) => record.title.startsWith("Eco action: "))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  async function saveAction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!workspaceId) {
      setError("Workspace is still loading. Please try again.");
      return;
    }

    if (!activity.trim()) {
      setError("Enter an activity description.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const result = await createModuleRecord("environment", {
        workspace_id: workspaceId,
        title: `Eco action: ${activity.trim().slice(0, 150)}`,
        data: {
          "Category": category,
          "Activity": activity.trim(),
          "Quantity": quantity.trim(),
          "Unit": unit.trim(),
          "Date": date,
          "Status": status,
          "Notes": notes.trim(),
        },
      });

      onRecordSaved(result.record);

      setActivity("");
      setQuantity("");
      setUnit("");
      setNotes("");
      setStatus("Completed");
      setSuccess("Eco action saved successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save eco action."
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeAction(id: string) {
    if (!workspaceId || deleting) return;

    setDeleting(id);
    setError("");
    setSuccess("");

    try {
      await deleteModuleRecord("environment", id, workspaceId);
      onRecordDeleted(id);
      setSuccess("Eco action deleted.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete eco action."
      );
    } finally {
      setDeleting("");
    }
  }

  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-5">
      <div>
        <h2 className="text-xl font-semibold">Eco Action Tracker</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Record and monitor practical actions that help the environment.
        </p>
      </div>

      <form onSubmit={saveAction} className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Activity category</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="w-full rounded-xl border bg-background px-3 py-2.5"
          >
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Activity date</span>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="w-full rounded-xl border bg-background px-3 py-2.5"
          />
        </label>

        <label className="space-y-1 text-sm sm:col-span-2">
          <span className="font-medium">What did you do?</span>
          <input
            value={activity}
            onChange={(event) => setActivity(event.target.value)}
            placeholder="e.g. Planted native trees in the community park"
            maxLength={500}
            required
            className="w-full rounded-xl border bg-background px-3 py-2.5"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Quantity (optional)</span>
          <input
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            placeholder="e.g. 10"
            maxLength={50}
            className="w-full rounded-xl border bg-background px-3 py-2.5"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Unit (optional)</span>
          <input
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            placeholder="e.g. trees, litres, kg, hours"
            maxLength={50}
            className="w-full rounded-xl border bg-background px-3 py-2.5"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Activity status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="w-full rounded-xl border bg-background px-3 py-2.5"
          >
            <option>Planned</option>
            <option>In progress</option>
            <option>Completed</option>
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Notes (optional)</span>
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Add details or outcome"
            maxLength={500}
            className="w-full rounded-xl border bg-background px-3 py-2.5"
          />
        </label>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={saving || !workspaceId}
            className="rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save eco action"}
          </button>
        </div>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-600">{error}</p>
      )}
      {success && (
        <p role="status" className="text-sm text-green-700">{success}</p>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">Your activity history</h3>
          <span className="rounded-full border px-3 py-1 text-xs">
            {ecoRecords.length} activities
          </span>
        </div>

        {ecoRecords.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            No eco actions recorded yet. Add your first activity above.
          </p>
        ) : (
          <div className="space-y-2">
            {ecoRecords.slice(0, 20).map((record) => (
              <article
                key={record.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border p-3"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium">{record.data.Activity || record.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {record.data.Category} · {record.data.Date}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {record.data.Quantity
                      ? `${record.data.Quantity} ${record.data.Unit || ""}`
                      : "Quantity not specified"}
                    {" · "}
                    {record.data.Status}
                  </p>
                  {record.data.Notes && (
                    <p className="text-sm text-muted-foreground">
                      {record.data.Notes}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => void removeAction(record.id)}
                  disabled={deleting === record.id || !!deleting}
                  className="rounded-lg border px-3 py-2 text-xs hover:bg-muted disabled:opacity-50"
                >
                  {deleting === record.id ? "Deleting..." : "Delete"}
                </button>
              </article>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Activities are self-reported records. Quantities and environmental
        impact are not independently verified or converted into carbon credits.
      </p>
    </section>
  );
}