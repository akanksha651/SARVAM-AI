"use client";

import { useCallback, useEffect, useState } from "react";
import HealthcareAIChat from "@/components/healthcare-ai-chat";
import EnvironmentAIChat from "@/components/environment-ai-chat";
import EnvironmentAqiGuidance from "@/components/environment-aqi-guidance";
import EnvironmentActionTracker from "@/components/environment-action-tracker";
import EnvironmentIncidentReporting from "@/components/environment-incident-reporting";
import GovernmentAIChat from "@/components/government-ai-chat";
import GovernmentComplaintTracker from "@/components/government-complaint-tracker";
import {
  createModuleRecord,
  getModuleRecords,
  deleteModuleRecord,
  updateModuleRecord,
  getLiveAirQuality,
} from "@/lib/api";

type ModuleId = "healthcare" | "government" | "environment";
type RecordItem = {
  id: string;
  title: string;
  data: Record<string, string>;
  created_at: string;
};

type AirQualityData = {
  current?: Record<string, unknown> & {
    us_aqi?: number | string;
    category?: string;
  };
  readings?: Record<string, unknown>;
  us_aqi?: number | string;
  category?: string;
};

const configs = {
  healthcare: {
    title: "Healthcare Workspace",
    description: "Organize appointments and prepare information for healthcare visits.",
    fields: ["Patient name", "Hospital or doctor", "Appointment date", "Reason for visit"],
    action: "Save appointment record",
  },
  government: {
    title: "Government Services Workspace",
    description: "Organize scheme applications and their required information.",
    fields: ["Scheme name", "Applicant name", "State", "Application purpose"],
    action: "Save application record",
  },
  environment: {
    title: "Environment Action Workspace",
    description: "Record local environmental problems for follow-up.",
    fields: ["Issue type", "Location", "Date observed", "Problem description"],
    action: "Save environmental report",
  },
};

const governmentSchemeResources = [
  {
    id: "myscheme",
    name: "myScheme â€” National Scheme Finder",
    category: "All schemes",
    scope: "Central + State",
    description: "Discover government schemes using keywords, categories and personal eligibility details. Review benefits, eligibility, documents and application guidance.",
    url: "https://www.myscheme.gov.in/",
    keywords: "scheme finder benefits eligibility central state government",
  },
  {
    id: "india",
    name: "National Portal of India â€” Schemes",
    category: "All schemes",
    scope: "Central + State",
    description: "Browse government scheme information across public welfare, education, health, agriculture and other categories.",
    url: "https://www.india.gov.in/my-government/schemes",
    keywords: "india portal government welfare public schemes",
  },
  {
    id: "scholarship",
    name: "National Scholarship Portal",
    category: "Education",
    scope: "Central + State",
    description: "Official portal for student scholarship services, scheme information, applications and application-related services.",
    url: "https://scholarships.gov.in/",
    keywords: "student scholarship education financial assistance nsp",
  },
  {
    id: "pmkisan",
    name: "PM-KISAN",
    category: "Agriculture",
    scope: "Central",
    description: "Official portal for PM-KISAN scheme services, farmer registration and beneficiary-related information.",
    url: "https://pmkisan.gov.in/",
    keywords: "farmer agriculture income support pm kisan",
  },
];
export default function ServiceWorkspace({ moduleId }: { moduleId: ModuleId }) {
  const config = configs[moduleId];
  const [schemeSearch, setSchemeSearch] = useState("");
  const [schemeCategory, setSchemeCategory] = useState("All");
  const [schemeScope, setSchemeScope] = useState("All");

  const filteredGovernmentSchemes = governmentSchemeResources.filter((scheme) => {
    const query = schemeSearch.trim().toLowerCase();
    const matchesSearch = !query ||
      `${scheme.name} ${scheme.description} ${scheme.keywords}`.toLowerCase().includes(query);
    const matchesCategory = schemeCategory === "All" || scheme.category === schemeCategory;
    const matchesScope = schemeScope === "All" ||
      scheme.scope.includes(schemeScope);
    return matchesSearch && matchesCategory && matchesScope;
  });

  const [governmentPreparation, setGovernmentPreparation] = useState<string[]>([]);

  const governmentPreparationItems = [
    "I have checked the official scheme eligibility conditions.",
    "I have checked the latest application dates and deadlines.",
    "I have reviewed the required document list.",
    "My documents are readable and details are consistent.",
    "I have checked the official application portal URL.",
    "I have saved the application acknowledgement after submission.",
  ];

  const [values, setValues] = useState(["", "", "", ""]);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [latitude, setLatitude] = useState("26.4499");
  const [longitude, setLongitude] = useState("80.3319");
  const [aqiData, setAqiData] = useState<AirQualityData | null>(null);
  const [aqiLoading, setAqiLoading] = useState(false);
  const [aqiError, setAqiError] = useState("");
  const [medication, setMedication] = useState({
    name: "",
    dosage: "",
    frequency: "",
    timing: "",
    start_date: "",
    end_date: "",
    instructions: "",
  });
  const [savingMedication, setSavingMedication] = useState(false);


  async function checkAirQuality(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAqiLoading(true);
    setAqiError("");
    setAqiData(null);
    try {
      const result = await getLiveAirQuality(
        Number(latitude),
        Number(longitude)
      );
      setAqiData(result);
    } catch (err) {
      setAqiError(err instanceof Error ? err.message : "Air quality lookup failed");
    } finally {
      setAqiLoading(false);
    }
  }


  async function saveMedication(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!workspaceId || !medication.name.trim() ||
        !medication.dosage.trim() || !medication.frequency.trim()) {
      setError("Enter medicine name, prescribed dosage and frequency.");
      return;
    }

    setSavingMedication(true);
    setError("");
    setMessage("");

    try {
      const result = await createModuleRecord("healthcare", {
        workspace_id: workspaceId,
        title: `Medication: ${medication.name.trim()}`,
        data: {
          "Medicine name": medication.name.trim(),
          "Prescribed dosage": medication.dosage.trim(),
          "Frequency": medication.frequency.trim(),
          "Timing": medication.timing.trim(),
          "Start date": medication.start_date,
          "End date": medication.end_date,
          "Doctor or pharmacist instructions": medication.instructions.trim(),
        },
      });

      setRecords((previous) => [result.record, ...previous]);
      setMedication({
        name: "",
        dosage: "",
        frequency: "",
        timing: "",
        start_date: "",
        end_date: "",
        instructions: "",
      });
      setMessage("Medication record saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save medication.");
    } finally {
      setSavingMedication(false);
    }
  }
  const loadRecords = useCallback(async (id: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await getModuleRecords(moduleId, id);
      setRecords(response.records || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load records");
    } finally {
      setLoading(false);
    }
  }, [moduleId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      let id = localStorage.getItem(`sarvam_${moduleId}_workspace_id`);
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(`sarvam_${moduleId}_workspace_id`, id);
      }
      setWorkspaceId(id);
      void loadRecords(id);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadRecords, moduleId]);

  async function saveRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId || values.some((value) => !value.trim())) {
      setError("Please complete all fields.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const result = await createModuleRecord(moduleId, {
        workspace_id: workspaceId,
        title: values[0],
        data: Object.fromEntries(
          config.fields.map((field, index) => [field, values[index]])
        ),
      });
      setRecords((previous) => [result.record, ...previous]);
      setValues(["", "", "", ""]);
      setMessage("Record saved successfully to SARVAM database.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save record");
    } finally {
      setSaving(false);
    }
  }

  async function removeRecord(recordId: string) {
    if (!workspaceId) return;
    try {
      await deleteModuleRecord(moduleId, recordId, workspaceId);
      setRecords((previous) => previous.filter((item) => item.id !== recordId));
      setMessage("Record deleted successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete record");
    }
  }

  async function editRecord(record: RecordItem) {
    if (!workspaceId) return;

    const title = window.prompt("Edit record title:", record.title);
    if (title === null || !title.trim()) return;

    const json = window.prompt(
      "Edit record data (valid JSON):",
      JSON.stringify(record.data, null, 2)
    );
    if (json === null) return;

    let data: Record<string, string>;
    try {
      data = JSON.parse(json);
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("Data must be a JSON object");
      }
      if (Object.values(data).some((value) => typeof value !== "string")) {
        throw new Error("All record values must be text");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Invalid JSON");
      return;
    }

    try {
      setError("");
      const result = await updateModuleRecord(moduleId, record.id, {
        workspace_id: workspaceId,
        title: title.trim(),
        data,
      });
      setRecords((previous) =>
        previous.map((item) => item.id === record.id ? result.record : item)
      );
      setMessage("Record updated successfully.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not update record");
    }
  }

  const [healthRecordForm, setHealthRecordForm] = useState({
    name: "",
    type: "Lab Report",
    recordDate: "",
    provider: "",
    notes: "",
  });
  const [savingHealthRecord, setSavingHealthRecord] = useState(false);

  const savedHealthRecords = moduleId === "healthcare"
    ? records.filter((record) => record.title.startsWith("Health record: "))
    : [];

  const saveHealthRecord = async () => {
    if (!healthRecordForm.name.trim() || !healthRecordForm.recordDate) return;

    setSavingHealthRecord(true);
    try {
      const result = await createModuleRecord("healthcare", {
        workspace_id: workspaceId,
        title: `Health record: ${healthRecordForm.name.trim()}`,
        data: {
          "Record name": healthRecordForm.name.trim(),
          "Record type": healthRecordForm.type,
          "Record date": healthRecordForm.recordDate,
          "Hospital or laboratory": healthRecordForm.provider.trim(),
          "Notes": healthRecordForm.notes.trim(),
        },
      });

      setRecords((current) => [result, ...current]);
      setHealthRecordForm({
        name: "",
        type: "Lab Report",
        recordDate: "",
        provider: "",
        notes: "",
      });
    } catch (error) {
      console.error("Could not save health record:", error);
      alert("Could not save this record. Please try again.");
    } finally {
      setSavingHealthRecord(false);
    }
  };
  const healthcareAppointments = moduleId === "healthcare"
    ? records.filter(
        (record) =>
          !record.title.startsWith("Medication: ") &&
          !record.title.startsWith("Health record: ")
      )
    : [];

  const getAppointmentDate = (record: RecordItem) =>
    record.data["Appointment date"] || "";

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const todayAppointments = healthcareAppointments.filter(
    (record) => getAppointmentDate(record) === todayKey
  );

  const upcomingAppointments = healthcareAppointments
    .filter((record) => getAppointmentDate(record) > todayKey)
    .sort((a, b) => getAppointmentDate(a).localeCompare(getAppointmentDate(b)));

  const pastAppointments = healthcareAppointments
    .filter((record) => getAppointmentDate(record) && getAppointmentDate(record) < todayKey)
    .sort((a, b) => getAppointmentDate(b).localeCompare(getAppointmentDate(a)));
  const healthHistoryTimeline = moduleId === "healthcare"
    ? records
        .map((record) => {
          if (record.title.startsWith("Medication: ")) {
            return {
              id: record.id,
              category: "Medication",
              title: record.data["Medicine name"] || record.title.replace("Medication: ", ""),
              date: record.data["Start date"] || record.data["start_date"] || record.created_at.slice(0, 10),
              details: [
                record.data["Dosage"] || record.data["dosage"],
                record.data["Frequency"] || record.data["frequency"],
                record.data["Timing"] || record.data["timing"],
              ].filter(Boolean).join(" Â· "),
            };
          }

          if (record.title.startsWith("Health record: ")) {
            return {
              id: record.id,
              category: "Medical record",
              title: record.data["Record name"] || record.title.replace("Health record: ", ""),
              date: record.data["Record date"] || record.created_at.slice(0, 10),
              details: [
                record.data["Record type"],
                record.data["Hospital or laboratory"],
                record.data["Notes"],
              ].filter(Boolean).join(" Â· "),
            };
          }

          return {
            id: record.id,
            category: "Appointment",
            title: record.data["Hospital or doctor"] || record.title,
            date: record.data["Appointment date"] || record.created_at.slice(0, 10),
            details: [
              record.data["Patient name"] ? `Patient: ${record.data["Patient name"]}` : "",
              record.data["Reason for visit"],
            ].filter(Boolean).join(" Â· "),
          };
        })
        .sort((a, b) => b.date.localeCompare(a.date))
    : [];

  const exportDoctorVisitSummary = () => {
    const lines = [
      "SARVAM AI - DOCTOR VISIT SUMMARY",
      `Generated: ${new Date().toLocaleString()}`,
      "",
      "IMPORTANT: This is a user-organized summary, not a verified medical record or diagnosis.",
      "",
      "APPOINTMENTS",
      ...healthHistoryTimeline
        .filter((item) => item.category === "Appointment")
        .map((item) => `- ${item.date} | ${item.title} | ${item.details || "No additional details"}`),
      "",
      "MEDICATION DETAILS",
      ...healthHistoryTimeline
        .filter((item) => item.category === "Medication")
        .map((item) => `- ${item.date} | ${item.title} | ${item.details || "No additional details"}`),
      "",
      "MEDICAL RECORDS",
      ...healthHistoryTimeline
        .filter((item) => item.category === "Medical record")
        .map((item) => `- ${item.date} | ${item.title} | ${item.details || "No additional details"}`),
      "",
      "Please verify all information with your healthcare professional.",
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `SARVAM-Doctor-Visit-Summary-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };
  const [governmentUpdate, setGovernmentUpdate] = useState({
    scheme: "",
    status: "Draft",
    reference: "",
    updatedDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [savingGovernmentUpdate, setSavingGovernmentUpdate] = useState(false);
  const [governmentChecklist, setGovernmentChecklist] = useState<string[]>([]);

  const governmentApplications = moduleId === "government"
    ? records.filter((record) => !record.title.startsWith("Gov update: ") && !record.title.startsWith("Complaint: ") && !record.title.startsWith("Complaint update: "))
    : [];

  const governmentProgressLogs = moduleId === "government"
    ? records
        .filter((record) => record.title.startsWith("Gov update: "))
        .sort((a, b) =>
          (b.data["Update date"] || b.created_at).localeCompare(
            a.data["Update date"] || a.created_at
          )
        )
    : [];

  const saveGovernmentUpdate = async () => {
    if (!workspaceId || !governmentUpdate.scheme.trim()) {
      setError("Select an application before saving its progress update.");
      return;
    }

    setSavingGovernmentUpdate(true);
    setError("");

    try {
      const result = await createModuleRecord("government", {
        workspace_id: workspaceId,
        title: `Gov update: ${governmentUpdate.scheme.trim()}`,
        data: {
          "Scheme name": governmentUpdate.scheme.trim(),
          "Application status": governmentUpdate.status,
          "Reference number": governmentUpdate.reference.trim(),
          "Update date": governmentUpdate.updatedDate,
          "Update notes": governmentUpdate.notes.trim(),
        },
      });

      setRecords((previous) => [result.record, ...previous]);
      setGovernmentUpdate((previous) => ({
        ...previous,
        notes: "",
      }));
      setMessage("Application progress update saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save application update.");
    } finally {
      setSavingGovernmentUpdate(false);
    }
  };

  const governmentDocuments = [
    "Identity proof (as required by the scheme)",
    "Address or residence proof (if required)",
    "Income certificate (if applicable)",
    "Category certificate (if applicable)",
    "Bank account details or passbook (if required)",
    "Recent photograph (if required)",
    "Scheme-specific supporting documents",
  ];
  return (
    <>
      {moduleId === "environment" && (
        <EnvironmentIncidentReporting
          workspaceId={workspaceId}
          records={records}
          onRecordSaved={(record) =>
            setRecords((previous) => [record, ...previous])
          }
          onRecordDeleted={(id) =>
            setRecords((previous) => previous.filter((record) => record.id !== id))
          }
        />
      )}
      {moduleId === "government" && (
        <GovernmentAIChat records={records} />
      )}
      {moduleId === "environment" && (
        <>
          <EnvironmentAIChat records={records} />
          <EnvironmentAqiGuidance aqiData={aqiData} />
          <EnvironmentActionTracker
            workspaceId={workspaceId}
            records={records}
            onRecordSaved={(record) =>
              setRecords((previous) => [record, ...previous])
            }
            onRecordDeleted={(id) =>
              setRecords((previous) => previous.filter((record) => record.id !== id))
            }
          />
        </>
      )}
      {moduleId === "healthcare" && (
        <HealthcareAIChat workspaceId={workspaceId} records={records} />
      )}
      {moduleId === "environment" && (
        <section className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
          <h3 className="text-xl font-semibold text-slate-900">Live Air Quality Monitor</h3>
          <p className="mt-1 text-sm text-slate-600">
            Get current air-quality readings for a location using Open-Meteo.
          </p>
          <form onSubmit={checkAirQuality} className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="text-sm text-slate-700">
              Latitude
              <input type="number" step="any" min="-90" max="90" required
                value={latitude} onChange={(e) => setLatitude(e.target.value)}
                className="mt-1 w-full rounded-lg border bg-white px-3 py-2" />
            </label>
            <label className="text-sm text-slate-700">
              Longitude
              <input type="number" step="any" min="-180" max="180" required
                value={longitude} onChange={(e) => setLongitude(e.target.value)}
                className="mt-1 w-full rounded-lg border bg-white px-3 py-2" />
            </label>
            <div className="flex items-end">
              <button type="submit" disabled={aqiLoading}
                className="w-full rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white disabled:opacity-60">
                {aqiLoading ? "Checking..." : "Check air quality"}
              </button>
            </div>
          </form>
          {aqiError && <p className="mt-3 text-sm text-red-700">{aqiError}</p>}
          {aqiData && (
            <div className="mt-5 rounded-xl border bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-slate-500">Current US AQI</p>
                  <p className="text-4xl font-bold text-slate-900">
                    {aqiData.current?.us_aqi ?? aqiData.us_aqi ?? "N/A"}
                  </p>
                </div>
                <p className="font-semibold text-emerald-700">
                  {aqiData.category ?? aqiData.current?.category ?? "Air quality reading"}
                </p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Object.entries(aqiData.current ?? aqiData.readings ?? {}).map(([key, value]) => (
                  <div key={key} className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs uppercase text-slate-500">{key.replaceAll("_", " ")}</p>
                    <p className="mt-1 font-semibold text-slate-900">{String(value ?? "N/A")}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Source: Open-Meteo Air Quality API. Readings depend on the selected coordinates.
              </p>
            </div>
          )}
        </section>
      )}

    <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
          SARVAM AI Â· {moduleId}
        </p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900">{config.title}</h2>
        <p className="mt-2 text-sm text-slate-500">{config.description}</p>
      </div>
      {moduleId === "healthcare" && (
        <section className="rounded-2xl border border-red-100 bg-gradient-to-br from-red-50 to-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-red-600">Healthcare toolkit</p>
          <h3 className="mt-2 text-xl font-bold text-slate-900">Your Health Organization Workspace</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Organize appointment details, medical visit notes and medication information in one workspace.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-red-100 bg-white p-3">
              <p className="text-sm font-semibold text-slate-800">Appointments</p>
              <p className="mt-1 text-xs text-slate-500">Prepare and organize doctor visits.</p>
            </div>
            <div className="rounded-xl border border-red-100 bg-white p-3">
              <p className="text-sm font-semibold text-slate-800">Medical Records</p>
              <p className="mt-1 text-xs text-slate-500">Keep visit information organized.</p>
            </div>
            <div className="rounded-xl border border-red-100 bg-white p-3">
              <p className="text-sm font-semibold text-slate-800">Health History</p>
              <p className="mt-1 text-xs text-slate-500">Review saved workspace entries.</p>
            </div>
          </div>
        </section>
      )}
      {moduleId === "healthcare" && (
        <section className="space-y-5 rounded-2xl border border-sky-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-sky-700">
                Healthcare scheduling
              </p>
              <h3 className="mt-1 text-xl font-bold text-slate-900">
                Appointment Overview
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Appointments organized automatically using their saved dates.
              </p>
            </div>
            <span className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700">
              {healthcareAppointments.length} total
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-800">Today</p>
              <p className="mt-2 text-3xl font-bold text-amber-900">{todayAppointments.length}</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-sm font-medium text-emerald-800">Upcoming</p>
              <p className="mt-2 text-3xl font-bold text-emerald-900">{upcomingAppointments.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-600">Past</p>
              <p className="mt-2 text-3xl font-bold text-slate-800">{pastAppointments.length}</p>
            </div>
          </div>

          {[
            { title: "Today's appointments", items: todayAppointments },
            { title: "Upcoming appointments", items: upcomingAppointments },
            { title: "Past appointments", items: pastAppointments },
          ].map((group) => (
            <div key={group.title}>
              <h4 className="mb-3 font-semibold text-slate-800">{group.title}</h4>
              {group.items.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  No appointments in this section.
                </p>
              ) : (
                <div className="space-y-3">
                  {group.items.map((record) => (
                    <article key={record.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h5 className="font-semibold text-slate-900">
                            {record.data["Hospital or doctor"] || record.title}
                          </h5>
                          <p className="mt-1 text-sm text-slate-600">
                            Patient: {record.data["Patient name"] || "Not specified"}
                          </p>
                          <p className="mt-1 break-words text-sm text-slate-600">
                            {record.data["Reason for visit"] || "No visit purpose provided"}
                          </p>
                          <p className="mt-2 text-xs font-semibold text-sky-700">
                            {getAppointmentDate(record)
                              ? new Date(getAppointmentDate(record) + "T00:00:00").toLocaleDateString()
                              : "Date not provided"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void removeRecord(record.id)}
                          className="shrink-0 text-xs font-semibold text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="rounded-xl border border-sky-100 bg-sky-50 p-4">
            <h4 className="font-semibold text-slate-900">Doctor visit preparation</h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
              <li>Keep previous prescriptions and relevant reports ready.</li>
              <li>Write down symptoms and when they started.</li>
              <li>Prepare questions about tests and follow-up.</li>
              <li>Carry your existing medication list.</li>
            </ul>
          </div>
        </section>
      )}
      {moduleId === "healthcare" && (
        <section className="space-y-5 rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">
              Personal health library
            </p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">
              Medical Records Organizer
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Keep a structured history of reports, prescriptions and investigations.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium text-slate-700">
              Record name *
              <input
                value={healthRecordForm.name}
                onChange={(e) => setHealthRecordForm((v) => ({ ...v, name: e.target.value }))}
                placeholder="e.g. Complete Blood Count"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500"
              />
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              Record category
              <select
                value={healthRecordForm.type}
                onChange={(e) => setHealthRecordForm((v) => ({ ...v, type: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"
              >
                <option>Lab Report</option>
                <option>Prescription</option>
                <option>Scan / Imaging</option>
                <option>Discharge Summary</option>
                <option>Vaccination</option>
                <option>Other</option>
              </select>
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              Record date *
              <input
                type="date"
                value={healthRecordForm.recordDate}
                onChange={(e) => setHealthRecordForm((v) => ({ ...v, recordDate: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
              />
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              Hospital / laboratory
              <input
                value={healthRecordForm.provider}
                onChange={(e) => setHealthRecordForm((v) => ({ ...v, provider: e.target.value }))}
                placeholder="Provider name"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
              />
            </label>
          </div>

          <label className="block space-y-1 text-sm font-medium text-slate-700">
            Notes
            <textarea
              value={healthRecordForm.notes}
              onChange={(e) => setHealthRecordForm((v) => ({ ...v, notes: e.target.value }))}
              rows={2}
              placeholder="Optional notes about this record"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
            />
          </label>

          <button
            type="button"
            disabled={savingHealthRecord || !healthRecordForm.name.trim() || !healthRecordForm.recordDate}
            onClick={() => void saveHealthRecord()}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingHealthRecord ? "Saving..." : "Save medical record"}
          </button>

          <div className="border-t border-slate-100 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="font-semibold text-slate-900">Saved health records</h4>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                {savedHealthRecords.length} records
              </span>
            </div>

            {savedHealthRecords.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                Your saved medical record details will appear here.
              </p>
            ) : (
              <div className="space-y-3">
                {savedHealthRecords.map((record) => (
                  <article key={record.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-4">
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-slate-900">
                        {record.data["Record name"] || record.title}
                      </p>
                      <p className="mt-1 text-xs font-medium text-indigo-700">
                        {record.data["Record type"]} Â· {record.data["Record date"]}
                      </p>
                      {record.data["Hospital or laboratory"] && (
                        <p className="mt-1 text-sm text-slate-600">
                          {record.data["Hospital or laboratory"]}
                        </p>
                      )}
                      {record.data["Notes"] && (
                        <p className="mt-1 break-words text-sm text-slate-500">
                          {record.data["Notes"]}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void removeRecord(record.id)}
                      className="shrink-0 text-xs font-semibold text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-slate-500">
            This organizer stores record details only. It does not upload or securely store medical documents.
          </p>
        </section>
      )}
      {moduleId === "healthcare" && (
        <section className="space-y-5 rounded-2xl border border-teal-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-teal-700">
                Your healthcare journey
              </p>
              <h3 className="mt-1 text-xl font-bold text-slate-900">
                Health History Timeline
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Appointments, medication entries and medical records in one chronological view.
              </p>
            </div>
            <button
              type="button"
              onClick={exportDoctorVisitSummary}
              disabled={healthHistoryTimeline.length === 0}
              className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Export doctor summary
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-sky-50 p-3">
              <p className="text-xs font-medium text-sky-700">Appointments</p>
              <p className="mt-1 text-2xl font-bold text-sky-900">
                {healthHistoryTimeline.filter((item) => item.category === "Appointment").length}
              </p>
            </div>
            <div className="rounded-xl bg-violet-50 p-3">
              <p className="text-xs font-medium text-violet-700">Medicines</p>
              <p className="mt-1 text-2xl font-bold text-violet-900">
                {healthHistoryTimeline.filter((item) => item.category === "Medication").length}
              </p>
            </div>
            <div className="rounded-xl bg-indigo-50 p-3">
              <p className="text-xs font-medium text-indigo-700">Records</p>
              <p className="mt-1 text-2xl font-bold text-indigo-900">
                {healthHistoryTimeline.filter((item) => item.category === "Medical record").length}
              </p>
            </div>
          </div>

          {healthHistoryTimeline.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
              <p className="font-semibold text-slate-800">Your health timeline is empty</p>
              <p className="mt-1 text-sm text-slate-500">
                Add an appointment, medication or medical record to start building your history.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {healthHistoryTimeline.map((item, index) => (
                <div key={item.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className={`mt-1 h-3 w-3 rounded-full ${
                      item.category === "Appointment"
                        ? "bg-sky-500"
                        : item.category === "Medication"
                          ? "bg-violet-500"
                          : "bg-indigo-500"
                    }`} />
                    {index !== healthHistoryTimeline.length - 1 && (
                      <span className="mt-1 min-h-10 w-px flex-1 bg-slate-200" />
                    )}
                  </div>
                  <article className="mb-1 min-w-0 flex-1 rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-teal-700">
                        {item.category}
                      </span>
                      <span className="text-xs text-slate-500">
                        {item.date ? new Date(item.date + "T00:00:00").toLocaleDateString() : "Date unavailable"}
                      </span>
                    </div>
                    <h4 className="mt-2 break-words font-semibold text-slate-900">
                      {item.title}
                    </h4>
                    {item.details && (
                      <p className="mt-1 break-words text-sm leading-6 text-slate-600">
                        {item.details}
                      </p>
                    )}
                  </article>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-slate-500">
            Timeline entries are based on information saved in this workspace. Confirm dates and details with your healthcare professional.
          </p>
        </section>
      )}
      {moduleId === "healthcare" && (
        <section className="space-y-5 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/70 to-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-violet-700">
                Personal health organizer
              </p>
              <h3 className="mt-1 text-xl font-bold text-slate-900">
                Medication Manager
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Organize medicines and instructions provided by your doctor or pharmacist.
              </p>
            </div>
            <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800">
              {records.filter((r) => r.title.startsWith("Medication: ")).length} saved
            </span>
          </div>

          <form onSubmit={saveMedication} className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Medicine name *
              </span>
              <input
                required
                maxLength={150}
                value={medication.name}
                onChange={(e) => setMedication((old) => ({ ...old, name: e.target.value }))}
                placeholder="Enter medicine name"
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-violet-500"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Prescribed dosage *
              </span>
              <input
                required
                maxLength={100}
                value={medication.dosage}
                onChange={(e) => setMedication((old) => ({ ...old, dosage: e.target.value }))}
                placeholder="As written by your clinician"
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-violet-500"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Frequency *
              </span>
              <input
                required
                maxLength={100}
                value={medication.frequency}
                onChange={(e) => setMedication((old) => ({ ...old, frequency: e.target.value }))}
                placeholder="As prescribed"
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-violet-500"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Timing
              </span>
              <input
                maxLength={150}
                value={medication.timing}
                onChange={(e) => setMedication((old) => ({ ...old, timing: e.target.value }))}
                placeholder="Only as instructed by clinician"
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-violet-500"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Start date
              </span>
              <input
                type="date"
                value={medication.start_date}
                onChange={(e) => setMedication((old) => ({ ...old, start_date: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-violet-500"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                End date
              </span>
              <input
                type="date"
                min={medication.start_date || undefined}
                value={medication.end_date}
                onChange={(e) => setMedication((old) => ({ ...old, end_date: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-violet-500"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Doctor / pharmacist instructions
              </span>
              <textarea
                rows={3}
                maxLength={1000}
                value={medication.instructions}
                onChange={(e) => setMedication((old) => ({ ...old, instructions: e.target.value }))}
                placeholder="Record the instructions provided by your healthcare professional..."
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-violet-500"
              />
            </label>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={savingMedication || !workspaceId}
                className="rounded-xl bg-violet-700 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
              >
                {savingMedication ? "Saving..." : "Save medication"}
              </button>
            </div>
          </form>

          <div className="border-t border-violet-100 pt-4">
            <h4 className="mb-3 font-semibold text-slate-900">
              Saved medications
            </h4>
            {loading ? (
              <p className="text-sm text-slate-500">Loading medications...</p>
            ) : records.filter((r) => r.title.startsWith("Medication: ")).length === 0 ? (
              <div className="rounded-xl border border-dashed border-violet-200 bg-white p-5 text-center">
                <p className="text-sm font-medium text-slate-700">
                  No medication records yet
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Add details from your existing prescription or clinician instructions.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {records
                  .filter((record) => record.title.startsWith("Medication: "))
                  .map((record) => (
                    <article
                      key={record.id}
                      className="rounded-xl border border-violet-100 bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h5 className="font-semibold text-slate-900">
                          {record.data["Medicine name"] || record.title.replace("Medication: ", "")}
                        </h5>
                        <button
                          type="button"
                          onClick={() => void removeRecord(record.id)}
                          className="text-xs font-semibold text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                      <div className="mt-3 space-y-1.5 text-sm text-slate-600">
                        <p><strong>Dosage:</strong> {record.data["Prescribed dosage"]}</p>
                        <p><strong>Frequency:</strong> {record.data["Frequency"]}</p>
                        {record.data["Timing"] && <p><strong>Timing:</strong> {record.data["Timing"]}</p>}
                        {record.data["Start date"] && <p><strong>Start:</strong> {record.data["Start date"]}</p>}
                        {record.data["End date"] && <p><strong>End:</strong> {record.data["End date"]}</p>}
                        {record.data["Doctor or pharmacist instructions"] && (
                          <p className="break-words">
                            <strong>Instructions:</strong> {record.data["Doctor or pharmacist instructions"]}
                          </p>
                        )}
                      </div>
                      <p className="mt-3 text-xs text-slate-400">
                        Saved {new Date(record.created_at).toLocaleDateString()}
                      </p>
                    </article>
                  ))}
              </div>
            )}
          </div>
          <p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">
            This is a record organizer, not a medication reminder or prescription service.
            Follow your clinician&apos;s instructions. No notifications are sent.
          </p>
        </section>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-sm text-slate-500">Saved records</p>
          <p className="mt-1 text-2xl font-bold">{records.length}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-sm text-slate-500">Database</p>
          <p className="mt-1 font-semibold">Backend SQLite</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-sm text-slate-500">Connection</p>
          <p className="mt-1 font-semibold">{loading ? "Loading..." : error ? "Check connection" : "Ready"}</p>
        </div>
      </div>

      {moduleId === "government" && (
        <GovernmentComplaintTracker
          workspaceId={workspaceId}
          records={records}
          onRecordSaved={(record) => setRecords((previous) => [record, ...previous])}
          onRecordDeleted={(id) => setRecords((previous) => previous.filter((record) => record.id !== id))}
        />
      )}      {moduleId === "government" && (
        <section className="mb-6 space-y-5 rounded-2xl border border-cyan-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-cyan-700">
              Official government resources
            </p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">
              Government Scheme Explorer
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Search verified government discovery and service portals from one workspace.
            </p>
          </div>

          <input
            value={schemeSearch}
            onChange={(e) => setSchemeSearch(e.target.value)}
            placeholder="Search schemes, scholarships, farmers, benefits..."
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium text-slate-700">
              Category
              <select
                value={schemeCategory}
                onChange={(e) => setSchemeCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"
              >
                <option>All</option>
                <option>All schemes</option>
                <option>Education</option>
                <option>Agriculture</option>
              </select>
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              Government level
              <select
                value={schemeScope}
                onChange={(e) => setSchemeScope(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"
              >
                <option>All</option>
                <option>Central</option>
                <option>State</option>
              </select>
            </label>
          </div>

          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-slate-900">Official portals</h4>
            <span className="text-xs text-slate-500">
              {filteredGovernmentSchemes.length} resources
            </span>
          </div>

          {filteredGovernmentSchemes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center">
              <p className="font-medium text-slate-700">No matching portal found</p>
              <p className="mt-1 text-sm text-slate-500">
                Try another keyword or category.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {filteredGovernmentSchemes.map((scheme) => (
                <article key={scheme.id} className="flex flex-col rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-800">
                      {scheme.category}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      {scheme.scope}
                    </span>
                  </div>
                  <h4 className="mt-3 font-semibold text-slate-900">{scheme.name}</h4>
                  <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">
                    {scheme.description}
                  </p>
                  <a
                    href={scheme.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-800 hover:underline"
                  >
                    Visit official portal <span aria-hidden="true">â†—</span>
                  </a>
                </article>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold text-slate-900">Application preparation checklist</h4>
              <span className="text-xs font-medium text-cyan-800">
                {governmentPreparation.length}/{governmentPreparationItems.length} completed
              </span>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-cyan-600 transition-all"
                style={{ width: `${(governmentPreparation.length / governmentPreparationItems.length) * 100}%` }}
              />
            </div>

            <div className="mt-4 space-y-3">
              {governmentPreparationItems.map((item) => (
                <label key={item} className="flex items-start gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={governmentPreparation.includes(item)}
                    onChange={(e) => setGovernmentPreparation((previous) =>
                      e.target.checked
                        ? [...previous, item]
                        : previous.filter((entry) => entry !== item)
                    )}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300"
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </div>

          <p className="text-xs leading-5 text-slate-500">
            Portal links are external official resources. Search filters only organize the listed portals; they do not query a live government scheme database or determine eligibility. Always verify current conditions with the relevant department.
          </p>
        </section>
      )}
      {moduleId === "government" && (
        <section className="mb-6 space-y-5 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
              Application management
            </p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">
              Government Application Tracker
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Maintain application references, progress updates and document preparation.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-blue-50 p-4">
              <p className="text-sm font-medium text-blue-700">Saved applications</p>
              <p className="mt-2 text-3xl font-bold text-blue-900">{governmentApplications.length}</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-700">Progress updates</p>
              <p className="mt-2 text-3xl font-bold text-amber-900">{governmentProgressLogs.length}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-sm font-medium text-emerald-700">Checklist completed</p>
              <p className="mt-2 text-3xl font-bold text-emerald-900">
                {governmentChecklist.length}/{governmentDocuments.length}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-blue-100 p-4">
            <h4 className="font-semibold text-slate-900">Update application progress</h4>

            {governmentApplications.length === 0 ? (
              <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                First save an application using the application form below. Then you can track its progress here.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                <label className="block space-y-1 text-sm font-medium text-slate-700">
                  Select application
                  <select
                    value={governmentUpdate.scheme}
                    onChange={(e) => setGovernmentUpdate((v) => ({ ...v, scheme: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"
                  >
                    <option value="">Choose saved application</option>
                    {governmentApplications.map((record) => (
                      <option key={record.id} value={record.title}>
                        {record.title} â€” {record.data["Applicant name"] || "Applicant"}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm font-medium text-slate-700">
                    Application status
                    <select
                      value={governmentUpdate.status}
                      onChange={(e) => setGovernmentUpdate((v) => ({ ...v, status: e.target.value }))}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"
                    >
                      <option>Draft</option>
                      <option>Submitted</option>
                      <option>Under Review</option>
                      <option>Documents Required</option>
                      <option>Approved</option>
                      <option>Rejected</option>
                    </select>
                  </label>

                  <label className="space-y-1 text-sm font-medium text-slate-700">
                    Update date
                    <input
                      type="date"
                      value={governmentUpdate.updatedDate}
                      onChange={(e) => setGovernmentUpdate((v) => ({ ...v, updatedDate: e.target.value }))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                    />
                  </label>
                </div>

                <label className="block space-y-1 text-sm font-medium text-slate-700">
                  Application / acknowledgement number
                  <input
                    value={governmentUpdate.reference}
                    onChange={(e) => setGovernmentUpdate((v) => ({ ...v, reference: e.target.value }))}
                    placeholder="Enter reference number if available"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                  />
                </label>

                <label className="block space-y-1 text-sm font-medium text-slate-700">
                  Progress notes
                  <textarea
                    rows={2}
                    value={governmentUpdate.notes}
                    onChange={(e) => setGovernmentUpdate((v) => ({ ...v, notes: e.target.value }))}
                    placeholder="Describe the latest application update..."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                  />
                </label>

                <button
                  type="button"
                  disabled={savingGovernmentUpdate || !governmentUpdate.scheme}
                  onClick={() => void saveGovernmentUpdate()}
                  className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  {savingGovernmentUpdate ? "Saving..." : "Save progress update"}
                </button>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <h4 className="font-semibold text-slate-900">Document preparation checklist</h4>
            <p className="mt-1 text-xs text-slate-500">
              These are common preparation categories, not mandatory documents for every scheme. Check the official scheme requirements.
            </p>
            <div className="mt-3 space-y-3">
              {governmentDocuments.map((document) => (
                <label key={document} className="flex items-start gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={governmentChecklist.includes(document)}
                    onChange={(e) => setGovernmentChecklist((previous) =>
                      e.target.checked
                        ? [...previous, document]
                        : previous.filter((item) => item !== document)
                    )}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300"
                  />
                  <span>{document}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <h4 className="font-semibold text-slate-900">Application progress history</h4>
            {governmentProgressLogs.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                No progress updates yet. Save an update to build your application history.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {governmentProgressLogs.map((record) => (
                  <article key={record.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h5 className="font-semibold text-slate-900">
                        {record.data["Scheme name"] || record.title}
                      </h5>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                        {record.data["Application status"]}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Updated: {record.data["Update date"] || "Date unavailable"}
                    </p>
                    {record.data["Reference number"] && (
                      <p className="mt-1 break-all text-sm text-slate-600">
                        Reference: {record.data["Reference number"]}
                      </p>
                    )}
                    {record.data["Update notes"] && (
                      <p className="mt-2 break-words text-sm text-slate-600">
                        {record.data["Update notes"]}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => void removeRecord(record.id)}
                      className="mt-3 text-xs font-semibold text-red-600 hover:underline"
                    >
                      Delete update
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-slate-500">
            This tracker stores information you enter. It does not submit applications, verify eligibility, or retrieve live government application status.
          </p>
        </section>
      )}
      <form onSubmit={saveRecord} className="space-y-4">
        <h3 className="font-bold text-slate-900">Create a new record</h3>
        {config.fields.map((field, index) => (
          <label key={field} className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">{field}</span>
            {index === 3 ? (
              <textarea
                required
                rows={3}
                value={values[index]}
                onChange={(e) => setValues((old) => old.map((v, i) => i === index ? e.target.value : v))}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500"
              />
            ) : (
              <input
                required
                type={(moduleId === "healthcare" || moduleId === "environment") && index === 2 ? "date" : "text"}
                value={values[index]}
                onChange={(e) => setValues((old) => old.map((v, i) => i === index ? e.target.value : v))}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500"
              />
            )}
          </label>
        ))}

        <button
          disabled={saving}
          className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : config.action}
        </button>
      </form>

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-700">{message}</p>}

      <div className="border-t border-slate-100 pt-5">
        <h3 className="mb-3 font-bold text-slate-900">Saved records</h3>
        {loading ? (
          <p className="text-sm text-slate-500">Loading records...</p>
        ) : (moduleId === "healthcare" ? records.filter((r) => !r.title.startsWith("Medication: ")).length : records.length) === 0 ? (
          <p className="text-sm text-slate-500">No records saved yet.</p>
        ) : (
          <div className="space-y-3">
            {(moduleId === "healthcare" ? records.filter((r) => !r.title.startsWith("Medication: ")) : records).map((record) => (
              <article key={record.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    {Object.entries(record.data).map(([key, value]) => (
                      <p key={key} className="break-words text-sm text-slate-700">
                        <strong>{key}:</strong> {value}
                      </p>
                    ))}
                    <p className="pt-2 text-xs text-slate-400">
                      Saved: {new Date(record.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-3">
                    <button
                      type="button"
                      onClick={() => void editRecord(record)}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeRecord(record.id)}
                      className="text-xs font-semibold text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
        These records are stored in the backend database. This prototype does not yet
        provide user authentication or private medical-record security. Do not enter
        sensitive medical information.
      </p>
    </section>
    </>
  );
}


