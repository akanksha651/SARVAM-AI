
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sprout, GraduationCap, HeartPulse, Wallet,
  Landmark, Leaf, LayoutDashboard, Sparkles, ArrowLeft
} from "lucide-react";

const modules = [
  { id: "agriculture", name: "Agriculture", icon: Sprout, color: "text-green-600" },
  { id: "education", name: "Education", icon: GraduationCap, color: "text-blue-600" },
  { id: "healthcare", name: "Healthcare", icon: HeartPulse, color: "text-red-600" },
  { id: "finance", name: "Finance", icon: Wallet, color: "text-amber-600" },
  { id: "government", name: "Government", icon: Landmark, color: "text-purple-600" },
  { id: "environment", name: "Environment", icon: Leaf, color: "text-teal-600" },
];

export default function ModuleDashboardShell({
  moduleId,
  children,
}: {
  moduleId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = modules.find((item) => item.id === moduleId);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 md:flex">
      <aside className="w-full shrink-0 border-b border-slate-200 bg-white p-5 md:min-h-screen md:w-64 md:border-b-0 md:border-r">
        <Link href="/" className="mb-8 flex items-center gap-3">
          <div className="rounded-xl bg-slate-900 p-3 text-white">
            <Sparkles size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold">SARVAM AI</h1>
            <p className="text-xs text-slate-500">Intelligent Platform</p>
          </div>
        </Link>

        <Link href="/" className="mb-5 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100">
          <LayoutDashboard size={18} /> Main Dashboard
        </Link>

        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
          AI Workspaces
        </p>

        <nav className="grid grid-cols-2 gap-2 md:grid-cols-1">
          {modules.map((item) => {
            const Icon = item.icon;
            const selected = pathname === `/${item.id}`;

            return (
              <Link
                key={item.id}
                href={`/${item.id}`}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                  selected
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon size={18} className={selected ? "text-white" : item.color} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 hidden rounded-2xl bg-slate-900 p-5 text-white md:block">
          <Sparkles className="mb-3 text-yellow-300" size={22} />
          <p className="font-semibold">Powered by AI</p>
          <p className="mt-2 text-xs leading-5 text-slate-300">
            Intelligent tools for real-world problems.
          </p>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-5 md:p-9">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">SARVAM AI / Workspace</p>
            <h2 className="mt-1 text-3xl font-bold">
              {active?.name ?? "Workspace"} Dashboard
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Your dedicated intelligent workspace.
            </p>
          </div>
          <Link href="/" className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-100">
            <ArrowLeft size={16} /> Home
          </Link>
        </header>

        {children}
      </main>
    </div>
  );
}
