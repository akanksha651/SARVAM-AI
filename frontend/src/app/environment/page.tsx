import ModuleDashboardShell from "@/components/module-dashboard-shell";
import ServiceWorkspace from "@/components/service-workspace";

export default function EnvironmentPage() {
  return (
    <ModuleDashboardShell moduleId="environment">
      <ServiceWorkspace moduleId="environment" />
    </ModuleDashboardShell>
  );
}
