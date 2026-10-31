import ModuleDashboardShell from "@/components/module-dashboard-shell";
import ServiceWorkspace from "@/components/service-workspace";

export default function GovernmentPage() {
  return (
    <ModuleDashboardShell moduleId="government">
      <ServiceWorkspace moduleId="government" />
    </ModuleDashboardShell>
  );
}
