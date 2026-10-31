import ModuleDashboardShell from "@/components/module-dashboard-shell";
import EducationWorkspace from "@/components/education-workspace";
import EducationLearningSuite from "@/components/education-learning-suite";
import YouTubeLectureIntelligence from "@/components/youtube-lecture-intelligence";

export default function EducationPage() {
  return (
    <ModuleDashboardShell moduleId="education">
      <div className="space-y-6">
        <YouTubeLectureIntelligence />
        <div id="education-learning-suite" className="scroll-mt-6">
          <EducationLearningSuite />
        </div>
        <EducationWorkspace />
      </div>
    </ModuleDashboardShell>
  );
}
