"use client";

import { useEffect, useState } from "react";
import {
  calculateFinanceEMI,
  analyzeFinanceBudget,
  calculateFinanceSavingsGoal,
  getModuleRecords,
  createModuleRecord,
  deleteModuleRecord,
} from "@/lib/api";

export default function FinanceWorkspace() {
  const [tool, setTool] = useState("emi");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);

  const [principal, setPrincipal] = useState("1000000");
  const [rate, setRate] = useState("8.5");
  const [months, setMonths] = useState("240");
  const [income, setIncome] = useState("50000");
  const [expenses, setExpenses] = useState({
    Housing: "12000",
    Food: "8000",
    Transport: "3000",
    Utilities: "2500",
    Other: "4000",
  });
  const [target, setTarget] = useState("100000");
  const [current, setCurrent] = useState("20000");
  const [savingMonths, setSavingMonths] = useState("12");

  const [workspaceId, setWorkspaceId] = useState("");
  const [expenseRecords, setExpenseRecords] = useState<any[]>([]);
  const [entryType, setEntryType] = useState("expense");
  const [entryTitle, setEntryTitle] = useState("");
  const [entryCategory, setEntryCategory] = useState("Food");
  const [entryAmount, setEntryAmount] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState("");
  const [recordsMessage, setRecordsMessage] = useState("");

  useEffect(() => {
    let id = localStorage.getItem("sarvam_finance_workspace_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("sarvam_finance_workspace_id", id);
    }
    setWorkspaceId(id);
    setRecordsLoading(true);
    getModuleRecords("finance", id)
      .then((response) => setExpenseRecords(response.records || []))
      .catch((error) => setRecordsError(error instanceof Error ? error.message : "Could not load entries"))
      .finally(() => setRecordsLoading(false));
  }, []);

  async function saveEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId || !entryTitle.trim() || !entryAmount || Number(entryAmount) <= 0) {
      setRecordsError("Enter a title and a valid amount greater than zero.");
      return;
    }

    setRecordsError("");
    setRecordsMessage("");
    setRecordsLoading(true);
    try {
      const response = await createModuleRecord("finance", {
        workspace_id: workspaceId,
        title: entryTitle.trim(),
        data: {
          type: entryType,
          category: entryCategory,
          amount: entryAmount,
          date: entryDate,
        },
      });
      setExpenseRecords((previous) => [response.record, ...previous]);
      setEntryTitle("");
      setEntryAmount("");
      setRecordsMessage("Entry saved to SARVAM database.");
    } catch (error) {
      setRecordsError(error instanceof Error ? error.message : "Could not save entry");
    } finally {
      setRecordsLoading(false);
    }
  }

  async function removeEntry(recordId: string) {
    if (!workspaceId) return;
    try {
      await deleteModuleRecord("finance", recordId, workspaceId);
      setExpenseRecords((previous) => previous.filter((record) => record.id !== recordId));
      setRecordsMessage("Entry deleted.");
    } catch (error) {
      setRecordsError(error instanceof Error ? error.message : "Could not delete entry");
    }
  }

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyEntries = expenseRecords.filter(
    (record) => String(record.data?.date || "").startsWith(currentMonth)
  );
  const monthlyIncome = monthlyEntries
    .filter((record) => record.data?.type === "income")
    .reduce((sum, record) => sum + Number(record.data?.amount || 0), 0);
  const monthlyExpenses = monthlyEntries
    .filter((record) => record.data?.type === "expense")
    .reduce((sum, record) => sum + Number(record.data?.amount || 0), 0);
  const monthlyBalance = monthlyIncome - monthlyExpenses;
  const categoryTotals = monthlyEntries
    .filter((record) => record.data?.type === "expense")
    .reduce((totals: Record<string, number>, record) => {
      const category = String(record.data?.category || "Other");
      totals[category] = (totals[category] || 0) + Number(record.data?.amount || 0);
      return totals;
    }, {});
  const categoryRanking = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const highestCategory = categoryRanking[0];
  const maxCategoryExpense = Math.max(1, ...categoryRanking.map((item) => item[1]));
  const savingsRate = monthlyIncome > 0
    ? (monthlyBalance / monthlyIncome) * 100
    : 0;


  const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900";
  const labelClass = "mb-1.5 block text-sm font-medium text-slate-700";

  function Field({ label, value, onChange }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
  }) {
    return (
      <label className="block">
        <span className={labelClass}>{label}</span>
        <input
          type="number"
          min="0"
          className={inputClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    );
  }

  async function calculate() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      let data;
      if (tool === "emi") {
        data = await calculateFinanceEMI({
          principal: Number(principal),
          annual_rate: Number(rate),
          months: Number(months),
        });
      } else if (tool === "budget") {
        data = await analyzeFinanceBudget({
          income: Number(income),
          expenses: Object.fromEntries(
            Object.entries(expenses).map(([key, value]) => [key, Number(value)])
          ),
        });
      } else {
        data = await calculateFinanceSavingsGoal({
          target_amount: Number(target),
          current_savings: Number(current),
          months: Number(savingMonths),
        });
      }
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Calculation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">SARVAM AI · FINANCE</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900">Personal Finance Workspace</h2>
        <p className="mt-1 text-sm text-slate-500">Plan loans, monthly budgets and savings goals.</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          ["emi", "EMI Calculator"],
          ["budget", "Budget Planner"],
          ["savings", "Savings Goal"],
          ["expenses", "Expense Tracker"],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() => { setTool(value); setResult(null); setError(""); }}
            className={`rounded-xl px-2 py-3 text-xs font-semibold sm:text-sm ${
              tool === value ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tool === "emi" && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Loan Amount (₹)" value={principal} onChange={setPrincipal} />
          <Field label="Annual Interest Rate (%)" value={rate} onChange={setRate} />
          <Field label="Duration (Months)" value={months} onChange={setMonths} />
        </div>
      )}

      {tool === "budget" && (
        <div className="space-y-4">
          <Field label="Monthly Income (₹)" value={income} onChange={setIncome} />
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries(expenses).map(([key, value]) => (
              <Field
                key={key}
                label={`${key} Expenses (₹)`}
                value={value}
                onChange={(next) => setExpenses((old) => ({ ...old, [key]: next }))}
              />
            ))}
          </div>
        </div>
      )}

      {tool === "savings" && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Target Amount (₹)" value={target} onChange={setTarget} />
          <Field label="Current Savings (₹)" value={current} onChange={setCurrent} />
          <Field label="Duration (Months)" value={savingMonths} onChange={setSavingMonths} />
        </div>
      )}

      {tool !== "expenses" && (
        <button
          onClick={calculate}
          disabled={loading}
          className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Calculating..." : "Calculate"}
        </button>
      )}

      {tool === "expenses" && (
        <div className="space-y-5">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Finance Expense Tracker</h3>
            <p className="text-sm text-slate-500">Record income and expenses. Monthly totals are calculated from saved entries.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-sm text-slate-600">This month ? Income</p>
              <p className="mt-1 text-xl font-bold text-emerald-700">?{monthlyIncome.toLocaleString("en-IN")}</p>
            </div>
            <div className="rounded-xl bg-red-50 p-4">
              <p className="text-sm text-slate-600">This month ? Expenses</p>
              <p className="mt-1 text-xl font-bold text-red-700">?{monthlyExpenses.toLocaleString("en-IN")}</p>
            </div>
            <div className="rounded-xl bg-blue-50 p-4">
              <p className="text-sm text-slate-600">This month ? Balance</p>
              <p className="mt-1 text-xl font-bold text-blue-700">?{monthlyBalance.toLocaleString("en-IN")}</p>
            </div>
          </div>

          <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-600">SARVAM AI ? FINANCIAL INSIGHTS</p>
              <h3 className="mt-1 text-xl font-bold text-slate-900">Monthly Analytics Dashboard</h3>
              <p className="text-sm text-slate-500">Automatically calculated from your saved transactions</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Savings rate</p>
                <p className="mt-1 text-2xl font-bold text-blue-700">{monthlyIncome > 0 ? `${savingsRate.toFixed(1)}%` : "N/A"}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Highest spending category</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{highestCategory?.[0] || "No data"}</p>
                {highestCategory && <p className="text-sm text-slate-500">?{highestCategory[1].toLocaleString("en-IN")}</p>}
              </div>
            </div>

            <div>
              <h4 className="mb-3 font-semibold text-slate-900">Income vs Expenses</h4>
              <div className="space-y-4 rounded-xl bg-slate-50 p-4">
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>Income</span>
                    <strong>?{monthlyIncome.toLocaleString("en-IN")}</strong>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${monthlyIncome > 0 ? 100 : 0}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>Expenses</span>
                    <strong>?{monthlyExpenses.toLocaleString("en-IN")}</strong>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-red-500" style={{ width: `${monthlyIncome > 0 ? Math.min(100, monthlyExpenses / monthlyIncome * 100) : monthlyExpenses > 0 ? 100 : 0}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="mb-3 font-semibold text-slate-900">Category-wise Spending</h4>
              {categoryRanking.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Add expense transactions to see your category breakdown.</p>
              ) : (
                <div className="space-y-4">
                  {categoryRanking.map(([category, amount]) => (
                    <div key={category}>
                      <div className="mb-1 flex justify-between gap-2 text-sm">
                        <span className="font-medium text-slate-700">{category}</span>
                        <strong className="text-slate-900">?{amount.toLocaleString("en-IN")}</strong>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-blue-600" style={{ width: `${amount / maxCategoryExpense * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-slate-400">Period: Current calendar month ? Based on saved entries in this workspace.</p>
          </section>

          <form onSubmit={saveEntry} className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Entry type
              <select value={entryType} onChange={(e) => setEntryType(e.target.value)} className={inputClass + " mt-1"}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Category
              <select value={entryCategory} onChange={(e) => setEntryCategory(e.target.value)} className={inputClass + " mt-1"}>
                {["Food", "Housing", "Transport", "Healthcare", "Education", "Shopping", "Salary", "Business", "Other"].map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Description
              <input required value={entryTitle} onChange={(e) => setEntryTitle(e.target.value)} placeholder="e.g. Grocery shopping" className={inputClass + " mt-1"} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Amount (?)
              <input required type="number" min="0.01" step="0.01" value={entryAmount} onChange={(e) => setEntryAmount(e.target.value)} className={inputClass + " mt-1"} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Date
              <input required type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className={inputClass + " mt-1"} />
            </label>
            <div className="flex items-end">
              <button disabled={recordsLoading} className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50">
                {recordsLoading ? "Please wait..." : "Save entry"}
              </button>
            </div>
          </form>

          {recordsError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{recordsError}</p>}
          {recordsMessage && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{recordsMessage}</p>}

          <div>
            <h4 className="mb-3 font-bold text-slate-900">Saved transactions</h4>
            {recordsLoading && expenseRecords.length === 0 ? (
              <p className="text-sm text-slate-500">Loading transactions...</p>
            ) : expenseRecords.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No transactions yet. Add your first income or expense above.</p>
            ) : (
              <div className="space-y-2">
                {expenseRecords.map((record) => (
                  <div key={record.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                    <div>
                      <p className="font-semibold text-slate-900">{record.title}</p>
                      <p className="text-xs text-slate-500">{record.data?.category} ? {record.data?.date} ? {record.data?.type}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <strong className={record.data?.type === "income" ? "text-emerald-700" : "text-red-700"}>
                        {record.data?.type === "income" ? "+" : "-"}?{Number(record.data?.amount || 0).toLocaleString("en-IN")}
                      </strong>
                      <button type="button" onClick={() => void removeEntry(record.id)} className="text-xs font-semibold text-red-600 hover:underline">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500">Records are stored in the SARVAM backend database for this browser workspace. This is not a bank account integration.</p>
        </div>
      )}

      {error && tool !== "expenses" && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {result && tool !== "expenses" && (() => {
        const details = result.calculation || result.analysis || result.savings_plan || result;
        const labels: Record<string, string> = {
          monthly_emi: "Monthly EMI",
          principal: "Loan Amount",
          total_interest: "Total Interest",
          total_payment: "Total Payment",
          duration_months: "Duration",
          total_expenses: "Total Expenses",
          remaining_balance: "Remaining Balance",
          savings_rate: "Savings Rate",
          monthly_saving: "Monthly Savings Required",
          target_amount: "Target Amount",
          current_savings: "Current Savings",
        };
        return (
          <div className="space-y-4 rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-700">SARVAM AI ? RESULTS</p>
              <h3 className="mt-1 text-xl font-bold text-slate-900">
                {tool === "emi" ? "Loan Breakdown" : tool === "budget" ? "Budget Analysis" : "Savings Plan"}
              </h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(details).filter(([, value]) => typeof value !== "object").map(([key, value]) => (
                <div key={key} className="rounded-xl bg-white p-4 shadow-sm">
                  <p className="text-sm text-slate-500">{labels[key] || key.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</p>
                  <p className="mt-2 break-words text-xl font-bold text-slate-900">
                    {typeof value === "number" ? (key.includes("rate") ? `${value}%` : `?${value.toLocaleString("en-IN", {maximumFractionDigits: 2})}`) : String(value)}
                    {key === "duration_months" ? " months" : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </section>
  );
}
