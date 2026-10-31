"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createFarmAction,
  getFarmActions,
  updateFarmAction,
  type FarmAction,
} from "@/lib/api";

type Props = {
  conversationId: string | null;
  refreshToken?: number;
};

type Filter = "all" | "pending" | "in_progress" | "completed";

const statusLabels: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
};

export default function FarmTaskTracker({
  conversationId,
  refreshToken = 0,
}: Props) {
  const [tasks, setTasks] = useState<FarmAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  const loadTasks = useCallback(async () => {
    if (!conversationId) {
      setTasks([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await getFarmActions(conversationId);
      setTasks(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load farm tasks."
      );
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks, refreshToken]);

  async function handleCreateTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!conversationId || !title.trim()) return;

    setSaving(true);
    setError("");

    try {
      await createFarmAction(conversationId, {
        title: title.trim(),
        description: description.trim(),
        due_date: dueDate || null,
      });

      setTitle("");
      setDescription("");
      setDueDate("");

      await loadTasks();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create task."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(
    task: FarmAction,
    status: FarmAction["status"]
  ) {
    if (!conversationId || task.status === status) return;

    setError("");

    try {
      await updateFarmAction(task.id, {
        conversation_id: conversationId,
        status,
      });

      await loadTasks();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update task."
      );
    }
  }

  const filteredTasks =
    filter === "all"
      ? tasks
      : tasks.filter((task) => task.status === filter);

  const counts = {
    all: tasks.length,
    pending: tasks.filter((task) => task.status === "pending").length,
    in_progress: tasks.filter((task) => task.status === "in_progress").length,
    completed: tasks.filter((task) => task.status === "completed").length,
  };

  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-lg">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">
            Farm Task Tracker
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            Organize and monitor your farming activities.
          </p>
        </div>

        <span className="rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-sm text-green-400">
          {counts.completed}/{counts.all} Completed
        </span>
      </div>

      {!conversationId ? (
        <div className="rounded-xl border border-dashed border-white/15 p-6 text-center">
          <p className="font-medium text-gray-300">
            Start an agriculture conversation to manage farm tasks.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Your tasks will be saved with that conversation.
          </p>
        </div>
      ) : (
        <>
          <form
            onSubmit={handleCreateTask}
            className="mb-6 space-y-3 rounded-xl border border-white/10 bg-black/20 p-4"
          >
            <h3 className="font-semibold text-white">Create a New Task</h3>

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title (e.g. Inspect tomato crop)"
              required
              maxLength={200}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-gray-500 focus:border-green-500"
            />

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Task description..."
              rows={2}
              className="w-full resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-gray-500 focus:border-green-500"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="text-sm text-gray-400">
                Due date:
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="ml-2 rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-sm text-white"
                />
              </label>

              <button
                type="submit"
                disabled={saving || !title.trim()}
                className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Creating..." : "+ Add Task"}
              </button>
            </div>
          </form>

          <div className="mb-4 flex flex-wrap gap-2">
            {(
              ["all", "pending", "in_progress", "completed"] as Filter[]
            ).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  filter === item
                    ? "bg-green-600 text-white"
                    : "border border-white/10 bg-white/5 text-gray-400 hover:bg-white/10"
                }`}
              >
                {item === "all" ? "All" : statusLabels[item]} (
                {counts[item]})
              </button>
            ))}
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400"
            >
              {error}
            </div>
          )}

          {loading ? (
            <p className="py-6 text-center text-sm text-gray-400">
              Loading farm tasks...
            </p>
          ) : filteredTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
              <p className="text-sm text-gray-400">
                {tasks.length === 0
                  ? "No farm tasks yet. Create your first task above."
                  : "No tasks found in this category."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => (
                <article
                  key={task.id}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      <h3
                        className={`font-semibold ${
                          task.status === "completed"
                            ? "text-gray-500 line-through"
                            : "text-white"
                        }`}
                      >
                        {task.title}
                      </h3>

                      {task.description && (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-400">
                          {task.description}
                        </p>
                      )}

                      {task.due_date && (
                        <p className="mt-2 text-xs text-gray-500">
                          Due: {task.due_date}
                        </p>
                      )}
                    </div>

                    <select
                      aria-label={`Status for ${task.title}`}
                      value={task.status}
                      onChange={(e) =>
                        void handleStatusChange(
                          task,
                          e.target.value as FarmAction["status"]
                        )
                      }
                      className="rounded-lg border border-white/10 bg-gray-900 px-3 py-2 text-xs text-white outline-none focus:border-green-500"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
