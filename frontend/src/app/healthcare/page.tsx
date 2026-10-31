import ModuleDashboardShell from "@/components/module-dashboard-shell";
import ServiceWorkspace from "@/components/service-workspace";

export default function HealthcarePage() {
  return (
    <ModuleDashboardShell moduleId="healthcare">
      <ServiceWorkspace moduleId="healthcare" />
    </ModuleDashboardShell>
  );
}
