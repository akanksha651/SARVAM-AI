"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  getModuleRecords,
  createModuleRecord,
  deleteModuleRecord,
} from "@/lib/api";

type RecordItem = {
  id: string;
  title: string;
  data: Record<string, any>;
};

type Entry = {
  id: string;
  kind: "income" | "expense";
  category: string;
  amount: number;
  date: string;
  note: string;
};

type Debt = {
  id: string;
  name: string;
  balance: number;
  rate: number;
  payment: number;
};

type Goal = {
  id: string;
  name: string;
  target: number;
  saved: number;
  monthly: number;
  due: string;
};

const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

export default function FinanceCommandCenter() {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [tab, setTab] = useState("overview");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const [income, setIncome] = useState({
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    note: "",
  });

  const [expense, setExpense] = useState({
    category: "Food",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    note: "",
  });

  const [debt, setDebt] = useState({
    name: "",
    balance: "",
    rate: "",
    payment: "",
  });

  const [goal, setGoal] = useState({
    name: "",
    target: "",
    saved: "",
    monthly: "",
    due: "",
  });

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        let id = localStorage.getItem("sarvam_finance_workspace_id");

        if (!id) {
          id = crypto.randomUUID();
          localStorage.setItem("sarvam_finance_workspace_id", id);
        }

        if (!active) return;
        setWorkspaceId(id);

        const response = await getModuleRecords("finance", id);

        if (active) {
          setRecords(response.records || []);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Could not load financial records."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, []);

  const entries: Entry[] = records
    .filter((r) => ["income", "expense"].includes(r.data?.type))
    .map((r) => ({
      id: r.id,
      kind: r.data.type,
      category: String(r.data.category || "Other"),
      amount: Number(r.data.amount || 0),
      date: String(r.data.date || ""),
      note: String(r.data.note || ""),
    }));

  const debts: Debt[] = records
    .filter((r) => r.data?.type === "debt")
    .map((r) => ({
      id: r.id,
      name: String(r.data.name || r.title),
      balance: Number(r.data.balance || 0),
      rate: Number(r.data.rate || 0),
      payment: Number(r.data.payment || 0),
    }));

  const goals: Goal[] = records
    .filter((r) => r.data?.type === "goal")
    .map((r) => ({
      id: r.id,
      name: String(r.data.name || r.title),
      target: Number(r.data.target || 0),
      saved: Number(r.data.saved || 0),
      monthly: Number(r.data.monthly || 0),
      due: String(r.data.due || ""),
    }));

  const month = new Date().toISOString().slice(0, 7);

  const current = entries.filter((e) => e.date.startsWith(month));

  const totalIncome = current
    .filter((e) => e.kind === "income")
    .reduce((s, e) => s + e.amount, 0);

  const totalExpense = current
    .filter((e) => e.kind === "expense")
    .reduce((s, e) => s + e.amount, 0);

  const net = totalIncome - totalExpense;

  const savingsRate =
    totalIncome > 0 ? Math.round((net / totalIncome) * 100) : 0;

  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>();

    current
      .filter((e) => e.kind === "expense")
      .forEach((e) =>
        map.set(e.category, (map.get(e.category) || 0) + e.amount)
      );

    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [records, month]);

  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);

  const totalGoalGap = goals.reduce(
    (s, g) => s + Math.max(0, g.target - g.saved),
    0
  );

  async function saveRecord(title: string, data: Record<string, string>) {
    if (!workspaceId) {
      setError("Finance workspace is not ready. Refresh and try again.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await createModuleRecord("finance", {
        workspace_id: workspaceId,
        title,
        data,
      });

      setRecords((previous) => [response.record, ...previous]);
      setNotice("Record successfully saved to SARVAM database.");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save record.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function removeRecord(id: string) {
    if (!workspaceId) return;

    setError("");
    setNotice("");

    try {
      await deleteModuleRecord("finance", id, workspaceId);
      setRecords((previous) => previous.filter((r) => r.id !== id));
      setNotice("Record deleted from SARVAM database.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete record.");
    }
  }

  async function addEntry(
    kind: "income" | "expense",
    data: { amount: string; date: string; note: string; category?: string }
  ) {
    const amount = Number(data.amount);

    if (!Number.isFinite(amount) || amount <= 0 || !data.date) {
      setError("Enter a valid positive amount and date.");
      return;
    }

    const success = await saveRecord(
      kind === "income" ? "Income entry" : "Expense entry",
      {
        type: kind,
        category: kind === "income" ? "Income" : data.category || "Other",
        amount: String(amount),
        date: data.date,
        note: data.note.trim(),
      }
    );

    if (success) {
      if (kind === "income") {
        setIncome((v) => ({ ...v, amount: "", note: "" }));
      } else {
        setExpense((v) => ({ ...v, amount: "", note: "" }));
      }
    }
  }

  async function addDebt(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const balance = Number(debt.balance);
    const rate = Number(debt.rate);
    const payment = Number(debt.payment);

    if (
      !debt.name.trim() ||
      !Number.isFinite(balance) ||
      balance <= 0 ||
      !Number.isFinite(rate) ||
      rate < 0 ||
      !Number.isFinite(payment) ||
      payment <= 0
    ) {
      setError("Enter valid debt details and monthly payment.");
      return;
    }

    const success = await saveRecord(debt.name.trim(), {
      type: "debt",
      name: debt.name.trim(),
      balance: String(balance),
      rate: String(rate),
      payment: String(payment),
    });

    if (success) {
      setDebt({ name: "", balance: "", rate: "", payment: "" });
    }
  }

  async function addGoal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const target = Number(goal.target);
    const saved = Number(goal.saved);
    const monthly = Number(goal.monthly);

    if (
      !goal.name.trim() ||
      !Number.isFinite(target) ||
      target <= 0 ||
      !Number.isFinite(saved) ||
      saved < 0 ||
      saved > target ||
      !Number.isFinite(monthly) ||
      monthly <= 0
    ) {
      setError("Check goal name, target, current savings and contribution.");
      return;
    }

    const success = await saveRecord(goal.name.trim(), {
      type: "goal",
      name: goal.name.trim(),
      target: String(target),
      saved: String(saved),
      monthly: String(monthly),
      due: goal.due,
    });

    if (success) {
      setGoal({
        name: "",
        target: "",
        saved: "",
        monthly: "",
        due: "",
      });
    }
  }

  function debtMonths(d: Debt) {
    const monthlyRate = d.rate / 1200;

    if (d.payment <= d.balance * monthlyRate) return null;
    if (monthlyRate === 0) return Math.ceil(d.balance / d.payment);

    return Math.ceil(
      -Math.log(1 - (d.balance * monthlyRate) / d.payment) /
        Math.log(1 + monthlyRate)
    );
  }

  function exportReport() {
    const rows = [
      ["SARVAM Finance Report", new Date().toLocaleString()],
      ["Month", month],
      ["Income", totalIncome],
      ["Expenses", totalExpense],
      ["Net cash flow", net],
      ["Savings rate (%)", savingsRate],
      [],
      ["Date", "Type", "Category", "Amount (INR)", "Note"],
      ...entries.map((e) => [
        e.date,
        e.kind,
        e.category,
        e.amount,
        e.note,
      ]),
      [],
      ["Debt", "Outstanding balance", "Annual interest (%)", "Monthly payment", "Estimated months"],
      ...debts.map((d) => [
        d.name,
        d.balance,
        d.rate,
        d.payment,
        debtMonths(d) ?? "Payment too low",
      ]),
      [],
      ["Savings goal", "Target", "Saved", "Monthly contribution", "Remaining"],
      ...goals.map((g) => [
        g.name,
        g.target,
        g.saved,
        g.monthly,
        Math.max(0, g.target - g.saved),
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `SARVAM-Finance-Report-${month}.csv`;
    a.click();

    URL.revokeObjectURL(url);
  }

  async function askFinanceAI(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!question.trim()) return;

    setBusy(true);
    setError("");
    setAnswer("");

    try {
      const base =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

      const response = await fetch(`${base}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `You are SARVAM financial literacy assistant. Explain concepts in simple language. Do basic educational calculations only. Never promise returns or give personalized regulated investment, tax or legal advice.

User question: ${question}

User-entered financial summary:
Monthly income: ${totalIncome} INR
Monthly expenses: ${totalExpense} INR
Net cash flow: ${net} INR
Total listed debt: ${totalDebt} INR
Savings goal gap: ${totalGoalGap} INR

Treat these figures as user-entered estimates.`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "AI request failed.");
      }

      setAnswer(data.reply || "No answer returned.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not contact Finance AI."
      );
    } finally {
      setBusy(false);
    }
  }

  const tabs = [
    { id: "overview", label: "Financial Health" },
    { id: "cashflow", label: "Cash Flow" },
    { id: "debt", label: "Debt Planner" },
    { id: "goals", label: "Savings Goals" },
    { id: "coach", label: "Financial Literacy AI" },
  ];

  return (
    <section className="mt-6 space-y-5 rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
            Personal finance command center
          </p>
          <h3 className="mt-1 text-xl font-bold text-slate-900">
            SARVAM Financial Health Dashboard
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Manage cash flow, debt and savings using your shared SARVAM
            financial workspace.
          </p>
        </div>

        <button
          type="button"
          onClick={exportReport}
          disabled={loading}
          className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-900 disabled:opacity-50"
        >
          Export monthly CSV
        </button>
      </div>

      {loading && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Loading financial records...
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-emerald-50 p-3">
          <p className="text-xs text-emerald-700">This month income</p>
          <p className="mt-1 text-xl font-bold text-emerald-950">
            {money(totalIncome)}
          </p>
        </div>

        <div className="rounded-xl bg-rose-50 p-3">
          <p className="text-xs text-rose-700">This month expenses</p>
          <p className="mt-1 text-xl font-bold text-rose-950">
            {money(totalExpense)}
          </p>
        </div>

        <div className={`rounded-xl p-3 ${net >= 0 ? "bg-blue-50" : "bg-red-50"}`}>
          <p className="text-xs text-slate-600">Net cash flow</p>
          <p className="mt-1 text-xl font-bold">{money(net)}</p>
        </div>

        <div className="rounded-xl bg-violet-50 p-3">
          <p className="text-xs text-violet-700">Savings rate</p>
          <p className="mt-1 text-xl font-bold text-violet-950">
            {savingsRate}%
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              tab === t.id
                ? "bg-amber-700 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {notice && (
        <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          {notice}
        </p>
      )}

      {tab === "overview" && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border p-4">
            <h4 className="font-semibold">Financial snapshot</h4>
            <p className="mt-2 text-sm text-slate-600">
              Listed debt: <strong>{money(totalDebt)}</strong>
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Remaining savings goals: <strong>{money(totalGoalGap)}</strong>
            </p>
            <p className="mt-3 text-xs text-slate-500">
              All figures are calculated from the shared SARVAM Finance
              database workspace.
            </p>
          </div>

          <div className="rounded-xl border p-4">
            <h4 className="font-semibold">Largest spending categories</h4>
            {categoryTotals.length ? (
              categoryTotals.slice(0, 5).map(([name, value]) => (
                <div key={name} className="mt-3">
                  <div className="flex justify-between text-sm">
                    <span>{name}</span>
                    <strong>{money(value)}</strong>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-amber-500"
                      style={{
                        width: `${totalExpense ? Math.max(2, (value / totalExpense) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                Add expenses to see category insights.
              </p>
            )}
          </div>
        </div>
      )}

      {tab === "cashflow" && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addEntry("income", income);
              }}
              className="space-y-3 rounded-xl border p-4"
            >
              <h4 className="font-semibold text-emerald-800">Add income</h4>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                placeholder="Amount (INR)"
                value={income.amount}
                onChange={(e) => setIncome((v) => ({ ...v, amount: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2"
              />
              <input
                type="date"
                required
                value={income.date}
                onChange={(e) => setIncome((v) => ({ ...v, date: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2"
              />
              <input
                placeholder="Source / note"
                value={income.note}
                onChange={(e) => setIncome((v) => ({ ...v, note: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2"
              />
              <button
                disabled={busy || loading}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Save income
              </button>
            </form>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                addEntry("expense", expense);
              }}
              className="space-y-3 rounded-xl border p-4"
            >
              <h4 className="font-semibold text-rose-800">Add expense</h4>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                placeholder="Amount (INR)"
                value={expense.amount}
                onChange={(e) => setExpense((v) => ({ ...v, amount: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2"
              />
              <select
                value={expense.category}
                onChange={(e) => setExpense((v) => ({ ...v, category: e.target.value }))}
                className="w-full rounded-lg border bg-white px-3 py-2"
              >
                {[
                  "Food", "Housing", "Transport", "Utilities", "Education",
                  "Healthcare", "Shopping", "EMI / Debt", "Entertainment", "Other",
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <input
                type="date"
                required
                value={expense.date}
                onChange={(e) => setExpense((v) => ({ ...v, date: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2"
              />
              <input
                placeholder="Note"
                value={expense.note}
                onChange={(e) => setExpense((v) => ({ ...v, note: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2"
              />
              <button
                disabled={busy || loading}
                className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Save expense
              </button>
            </form>
          </div>

          <div className="rounded-xl border p-4">
            <h4 className="font-semibold">Recent cash-flow entries</h4>
            {entries.length ? (
              entries.slice(0, 20).map((e) => (
                <div
                  key={e.id}
                  className="flex flex-wrap justify-between gap-2 border-b py-2 text-sm last:border-0"
                >
                  <span>
                    {e.date} · {e.category}{" "}
                    {e.note && <span className="text-slate-500">— {e.note}</span>}
                  </span>
                  <span className={e.kind === "income" ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
                    {e.kind === "income" ? "+" : "−"}{money(e.amount)}
                    <button
                      type="button"
                      onClick={() => removeRecord(e.id)}
                      className="ml-2 text-xs text-slate-400"
                    >
                      Delete
                    </button>
                  </span>
                </div>
              ))
            ) : (
              <p className="mt-2 text-sm text-slate-500">No entries yet.</p>
            )}
          </div>
        </div>
      )}

      {tab === "debt" && (
        <div className="space-y-4">
          <form onSubmit={addDebt} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
            <h4 className="sm:col-span-2 font-semibold">Add a debt or loan</h4>
            <input required placeholder="Loan name" value={debt.name} onChange={(e) => setDebt((v) => ({ ...v, name: e.target.value }))} className="rounded-lg border px-3 py-2" />
            <input required type="number" min="0.01" step="0.01" placeholder="Outstanding balance (INR)" value={debt.balance} onChange={(e) => setDebt((v) => ({ ...v, balance: e.target.value }))} className="rounded-lg border px-3 py-2" />
            <input required type="number" min="0" step="0.01" placeholder="Annual interest rate (%)" value={debt.rate} onChange={(e) => setDebt((v) => ({ ...v, rate: e.target.value }))} className="rounded-lg border px-3 py-2" />
            <input required type="number" min="0.01" step="0.01" placeholder="Monthly payment (INR)" value={debt.payment} onChange={(e) => setDebt((v) => ({ ...v, payment: e.target.value }))} className="rounded-lg border px-3 py-2" />
            <button disabled={busy || loading} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white sm:col-span-2 disabled:opacity-50">
              Add debt plan
            </button>
          </form>

          {debts.map((d) => {
            const months = debtMonths(d);
            return (
              <article key={d.id} className="rounded-xl border p-4">
                <div className="flex justify-between gap-2">
                  <strong>{d.name}</strong>
                  <button type="button" onClick={() => removeRecord(d.id)} className="text-xs text-red-600">Remove</button>
                </div>
                <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
                  <p>Balance: <strong>{money(d.balance)}</strong></p>
                  <p>Rate: <strong>{d.rate}% p.a.</strong></p>
                  <p>Monthly payment: <strong>{money(d.payment)}</strong></p>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {months === null
                    ? "Payment does not cover estimated monthly interest; increase payment or verify rate."
                    : `Estimated payoff: ${months} months (assuming rate and payment remain constant).`}
                </p>
              </article>
            );
          })}

          {!debts.length && <p className="text-sm text-slate-500">No debt plans added.</p>}
        </div>
      )}

      {tab === "goals" && (
        <div className="space-y-4">
          <form onSubmit={addGoal} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
            <h4 className="sm:col-span-2 font-semibold">Create a savings goal</h4>
            <input required placeholder="Goal name" value={goal.name} onChange={(e) => setGoal((v) => ({ ...v, name: e.target.value }))} className="rounded-lg border px-3 py-2" />
            <input required type="number" min="0.01" step="0.01" placeholder="Target amount (INR)" value={goal.target} onChange={(e) => setGoal((v) => ({ ...v, target: e.target.value }))} className="rounded-lg border px-3 py-2" />
            <input required type="number" min="0" placeholder="Already saved (INR)" value={goal.saved} onChange={(e) => setGoal((v) => ({ ...v, saved: e.target.value }))} className="rounded-lg border px-3 py-2" />
            <input required type="number" min="0.01" step="0.01" placeholder="Monthly contribution (INR)" value={goal.monthly} onChange={(e) => setGoal((v) => ({ ...v, monthly: e.target.value }))} className="rounded-lg border px-3 py-2" />
            <label className="text-sm text-slate-600">
              Target date (optional)
              <input type="date" value={goal.due} onChange={(e) => setGoal((v) => ({ ...v, due: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2" />
            </label>
            <button disabled={busy || loading} className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              Save goal
            </button>
          </form>

          {goals.map((g) => {
            const gap = Math.max(0, g.target - g.saved);
            return (
              <article key={g.id} className="rounded-xl border p-4">
                <div className="flex justify-between gap-2">
                  <strong>{g.name}</strong>
                  <button type="button" onClick={() => removeRecord(g.id)} className="text-xs text-red-600">Remove</button>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {money(g.saved)} saved of {money(g.target)} · {g.due || "No target date"}
                </p>
                <div className="mt-2 h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-violet-600" style={{ width: `${Math.min(100, (g.saved / g.target) * 100)}%` }} />
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Remaining: {money(gap)} · Approx. {Math.ceil(gap / g.monthly)} months at current contribution.
                </p>
              </article>
            );
          })}

          {!goals.length && <p className="text-sm text-slate-500">No savings goals added.</p>}
        </div>
      )}

      {tab === "coach" && (
        <div className="space-y-3">
          <form onSubmit={askFinanceAI} className="space-y-2">
            <label className="block text-sm font-medium">Ask a financial literacy question</label>
            <textarea
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. What is the difference between simple and compound interest?"
              className="w-full rounded-lg border px-3 py-2"
            />
            <button
              disabled={busy || !question.trim()}
              className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Thinking..." : "Ask Finance AI"}
            </button>
          </form>

          {answer && (
            <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-slate-800">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => (
                    <h1 className="mb-3 mt-4 text-2xl font-bold text-slate-950 first:mt-0">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="mb-2 mt-5 text-xl font-bold text-slate-950">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="mb-2 mt-4 text-lg font-semibold text-slate-900">{children}</h3>
                  ),
                  p: ({ children }) => (
                    <p className="mb-3 last:mb-0">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="mb-3 list-disc space-y-1 pl-6">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="mb-3 list-decimal space-y-1 pl-6">{children}</ol>
                  ),
                  li: ({ children }) => <li className="pl-1">{children}</li>,
                  strong: ({ children }) => (
                    <strong className="font-bold text-slate-950">{children}</strong>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="my-3 border-l-4 border-amber-500 pl-4 italic text-slate-700">{children}</blockquote>
                  ),
                  table: ({ children }) => (
                    <div className="my-4 w-full overflow-x-auto rounded-lg border border-amber-200">
                      <table className="w-full min-w-[480px] border-collapse text-left text-sm">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-amber-100">{children}</thead>
                  ),
                  th: ({ children }) => (
                    <th className="border-b border-amber-200 px-3 py-2 font-bold">{children}</th>
                  ),
                  td: ({ children }) => (
                    <td className="border-b border-amber-100 px-3 py-2">{children}</td>
                  ),
                  hr: () => <hr className="my-4 border-amber-200" />,
                  code: ({ children }) => (
                    <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-sm">{children}</code>
                  ),
                }}
              >
                {answer}
              </ReactMarkdown>
            </div>
          )}
        </div>
      )}

      <p className="text-xs leading-5 text-slate-500">
        Finance records are stored in the SARVAM backend workspace. This is an
        educational organizer, not a bank connection or regulated financial
        advice. Debt estimates assume fixed rates and payments. Never enter
        account numbers, card details, PINs or passwords.
      </p>
    </section>
  );
}
