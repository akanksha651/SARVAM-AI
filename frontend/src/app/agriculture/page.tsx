import ModuleDashboardShell from "@/components/module-dashboard-shell";
import AgricultureDashboard from "@/components/agriculture-dashboard";

export default function AgriculturePage() {
  return (
    <ModuleDashboardShell moduleId="agriculture">
      <AgricultureDashboard />
    </ModuleDashboardShell>
  );
}
