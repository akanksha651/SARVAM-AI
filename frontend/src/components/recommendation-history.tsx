"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AgricultureRecommendation,
  getAgricultureRecommendations,
  saveAgricultureRecommendation,
  approveAgricultureRecommendation,
  convertAgricultureRecommendation,
} from "@/lib/api";

type Props = {
  conversationId: string | null;
  refreshToken?: number;
  onTaskCreated?: () => void;
};

export default function RecommendationHistory({
  conversationId,
  refreshToken = 0,
  onTaskCreated,
}: Props) {
  const [items, setItems] = useState<AgricultureRecommendation[]>([]);
  const [recommendation, setRecommendation] = useState("");
  const [taskTitles, setTaskTitles] = useState<Record<string, string>>({});
  const [dueDates, setDueDates] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadRecommendations = useCallback(async () => {
    if (!conversationId) {
      setItems([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await getAgricultureRecommendations(conversationId);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load recommendations.");
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations, refreshToken]);

  async function handleSave() {
    if (!conversationId || !recommendation.trim() || saving) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await saveAgricultureRecommendation(
        conversationId,
        recommendation.trim(),
        "chat"
      );
      setRecommendation("");
      setNotice("Recommendation saved successfully.");
      await loadRecommendations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save recommendation.");
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove(id: string) {
    if (!conversationId) return;

    setError("");
    setNotice("");

    try {
      await approveAgricultureRecommendation(id, conversationId);
      setNotice("Recommendation approved.");
      await loadRecommendations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve recommendation.");
    }
  }

  async function handleConvert(item: AgricultureRecommendation) {
    if (!conversationId) return;

    const title = (taskTitles[item.id] || item.recommendation)
      .trim()
      .slice(0, 200);

    if (!title) {
      setError("Please enter a task title.");
      return;
    }

    setError("");
    setNotice("");

    try {
      await convertAgricultureRecommendation(
        item.id,
        conversationId,
        title,
        dueDates[item.id] || undefined
      );

      setNotice("Recommendation converted into a farm task.");
      await loadRecommendations();
      onTaskCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create farm task.");
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-green-700">
          Farmer Decision Support
        </p>
        <h3 className="mt-1 text-lg font-bold text-slate-900">
          Recommendation History
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Save AI recommendations, review them and approve actions before adding them to your farm tasks.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <label className="mb-2 block text-sm font-semibold text-slate-700">
          Save a recommendation
        </label>
        <textarea
          value={recommendation}
          onChange={(event) => setRecommendation(event.target.value)}
          maxLength={10000}
          rows={4}
          placeholder="Paste an AI recommendation here..."
          className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm outline-none focus:border-green-600"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400">
            {recommendation.length}/10000 characters
          </span>
          <button
            type="button"
            onClick={handleSave}
            disabled={!conversationId || !recommendation.trim() || saving}
            className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-40"
          >
            {saving ? "Saving..." : "Save Recommendation"}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {notice && (
        <p role="status" className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-700">
          {notice}
        </p>
      )}

      <div className="mt-5 flex items-center justify-between">
        <h4 className="font-semibold text-slate-800">
          Saved recommendations ({items.length})
        </h4>
        <button
          type="button"
          onClick={loadRecommendations}
          disabled={loading || !conversationId}
          className="text-xs font-semibold text-green-700 hover:underline disabled:opacity-40"
        >
          Refresh
        </button>
      </div>

      {!conversationId && (
        <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
          Start an Agriculture AI conversation to save recommendations.
        </p>
      )}

      {loading && (
        <p className="mt-3 text-sm text-slate-500">Loading recommendations...</p>
      )}

      {!loading && conversationId && items.length === 0 && (
        <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
          No recommendations saved yet.
        </p>
      )}

      <div className="mt-3 space-y-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-xl border border-slate-200 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase text-slate-400">
                Source: {item.source}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                item.status === "converted"
                  ? "bg-blue-100 text-blue-700"
                  : item.status === "approved"
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700"
              }`}>
                {item.status.replace("_", " ")}
              </span>
            </div>

            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {item.recommendation}
            </p>

            <p className="mt-3 text-xs text-slate-400">
              Saved: {new Date(item.created_at).toLocaleString()}
            </p>

            {item.status === "saved" && (
              <button
                type="button"
                onClick={() => handleApprove(item.id)}
                className="mt-3 rounded-lg bg-green-700 px-4 py-2 text-xs font-semibold text-white hover:bg-green-800"
              >
                Approve Recommendation
              </button>
            )}

            {item.status === "approved" && (
              <div className="mt-4 space-y-3 rounded-lg bg-green-50 p-3">
                <p className="text-sm font-semibold text-green-800">
                  Approved � ready to become a Farm Task
                </p>
                <input
                  value={taskTitles[item.id] ?? item.recommendation.slice(0, 200)}
                  onChange={(event) =>
                    setTaskTitles((previous) => ({
                      ...previous,
                      [item.id]: event.target.value,
                    }))
                  }
                  maxLength={200}
                  placeholder="Farm task title"
                  className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm"
                />
                <input
                  type="date"
                  value={dueDates[item.id] || ""}
                  onChange={(event) =>
                    setDueDates((previous) => ({
                      ...previous,
                      [item.id]: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm"
                />
                <button
                  type="button"
                  onClick={() => handleConvert(item)}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                >
                  Convert to Farm Task
                </button>
              </div>
            )}

            {item.status === "converted" && (
              <p className="mt-3 text-xs font-medium text-blue-700">
                Converted to Farm Task
                {item.linked_action_id ? ` � ${item.linked_action_id}` : ""}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
