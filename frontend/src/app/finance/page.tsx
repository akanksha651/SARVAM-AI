import ModuleDashboardShell from "@/components/module-dashboard-shell";
import FinanceWorkspace from "@/components/finance-workspace";
import FinanceCommandCenter from "@/components/finance-command-center";

export default function FinancePage() {
  return (
    <ModuleDashboardShell moduleId="finance">
      <div className="space-y-6">
        <FinanceCommandCenter />
        <FinanceWorkspace />
      </div>
    </ModuleDashboardShell>
  );
}
