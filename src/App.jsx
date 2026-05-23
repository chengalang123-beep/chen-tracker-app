import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Plus,
  Download,
  Upload,
  Trash2,
  Edit3,
  CheckCircle2,
  Clock3,
  XCircle,
  AlertTriangle,
  BarChart3,
  FileSpreadsheet,
  Users,
  DollarSign,
  Filter,
  Save,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const STORAGE_KEY = "chen-policy-tracker-v1";
const GOOGLE_SHEET_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxQbzGV243t3Tyfyzc7kcZuvNEmscoGf0lpdSRft5VhUIL1Y_ALEc3mA7HIO4WgF_x4/exec";
const EOD_JOTFORM_URL = "https://form.jotform.com/261417629759470";

const blankForm = {
  clientName: "",
  policyNumber: "",
  ap: "",
  leadStatus: "",
  agentName: "",
  specialistName: "",
  result: "PENDING",
  action: "",
  notes: "",
  priority: "Normal",
  updatedAt: new Date().toISOString().slice(0, 10),
};

const resultOptions = ["PENDING", "RESOLVED", "LOST"];
const priorityOptions = ["Normal", "High", "Urgent"];
const specialistOptions = ["", "Nisha", "Rick", "Chen"];
const leadStatusOptions = ["", "NA", "NAA", "SRWT", "AS", "RTR", "CEP", "AYAR", "CWCC", "IUW", "UWAN", "UWAR", "UWSRWT"];
const actionOptions = [
  "",
  "Pending",
  "Pending Save",
  "Welcome Call",
  "Onboarding Call",
  "Pending Agent Assist",
  "Save",
  "UW Action Needed",
  "UW Action Resolved",
  "Lost",
  "Hang up",
];

function currency(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

function statusClasses(status) {
  const upper = String(status || "").toUpperCase();
  if (upper === "RESOLVED") return "bg-[#EEF7E8] text-[#4C6B2F] border-[#BDD6A6]";
  if (upper === "LOST") return "bg-[#FCE8DF] text-[#9D3F23] border-[#F0B49C]";
  return "bg-[#FFF1D8] text-[#9A5B12] border-[#F1C27D]";
}

function priorityClasses(priority) {
  if (priority === "Urgent") return "bg-[#FCE8DF] text-[#9D3F23]";
  if (priority === "High") return "bg-[#FFE6C7] text-[#A65B17]";
  return "bg-[#F7E8D6] text-[#6F4A33]";
}

function parseCsv(text) {
  const lines = text.split(new RegExp("\r?\n")).filter(Boolean);
  if (!lines.length) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const find = (...keys) => headers.findIndex((h) => keys.some((k) => h.includes(k)));

  const indexMap = {
    clientName: find("client", "name"),
    policyNumber: find("policy"),
    ap: find("ap"),
    leadStatus: find("lead", "stage"),
    agentName: find("agent"),
    result: find("pending", "resolved", "result", "status"),
    action: find("add", "action"),
    notes: find("note"),
  };

  return lines.slice(1).map((line) => {
    const parts = line.split(",").map((p) => p.trim());
    return {
      id: crypto.randomUUID(),
      clientName: parts[indexMap.clientName] || "",
      policyNumber: parts[indexMap.policyNumber] || "",
      ap: Number(parts[indexMap.ap] || 0),
      leadStatus: parts[indexMap.leadStatus] || "",
      agentName: parts[indexMap.agentName] || "",
      specialistName: "",
      result: (parts[indexMap.result] || "PENDING").toUpperCase(),
      action: parts[indexMap.action] || "",
      notes: parts[indexMap.notes] || "",
      priority: "Normal",
      updatedAt: new Date().toISOString().slice(0, 10),
    };
  });
}

function toCsv(rows) {
  const headers = [
    "CLIENT NAME",
    "POLICY NUMBER",
    "AP",
    "LEAD STATUS (STAGE MOVED)",
    "AGENT NAME",
    "SPECIALIST NAME",
    "STATUS",
    "ACTION",
    "NOTES",
    "PRIORITY",
    "UPDATED AT",
  ];

  const escape = (value) => {
    const str = String(value ?? "");
    return new RegExp('[",\n]').test(str) ? `"${str.replaceAll('"', '""')}"` : str;
  };

  const body = rows.map((row) =>
    [
      row.clientName,
      row.policyNumber,
      row.ap,
      row.leadStatus,
      row.agentName,
      row.specialistName,
      row.result,
      row.action,
      row.notes,
      row.priority,
      row.updatedAt,
    ]
      .map(escape)
      .join(",")
  );

  return [headers.join(","), ...body].join(String.fromCharCode(10));
}

export default function ChenTrackerApp() {
  const [rows, setRows] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [form, setForm] = useState(blankForm);
  const [editingId, setEditingId] = useState(null);
  const [query, setQuery] = useState("");
  const [resultFilter, setResultFilter] = useState("Status");
  const [priorityFilter, setPriorityFilter] = useState("Priority");
  const [specialistFilter, setSpecialistFilter] = useState("Specialist");
  const [sortBy, setSortBy] = useState("updatedAt");
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [activeEntryTab, setActiveEntryTab] = useState("case");
  const [reportRange, setReportRange] = useState("week");
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  }, [rows]);

  const stats = useMemo(() => {
    const total = rows.length;
    const pending = rows.filter((r) => r.result === "PENDING").length;
    const resolved = rows.filter((r) => r.result === "RESOLVED").length;
    const lost = rows.filter((r) => r.result === "LOST").length;
    const totalAp = rows.reduce((sum, r) => sum + Number(r.ap || 0), 0);
    const pendingAp = rows.filter((r) => r.result === "PENDING").reduce((sum, r) => sum + Number(r.ap || 0), 0);
    const completionRate = total ? Math.round((resolved / total) * 100) : 0;
    return { total, pending, resolved, lost, totalAp, pendingAp, completionRate };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((row) => {
        const searchable = [
          row.clientName,
          row.policyNumber,
          row.agentName,
          row.specialistName,
          row.leadStatus,
          row.result,
          row.action,
          row.notes,
        ]
          .join(" ")
          .toLowerCase();
        const matchesQuery = !q || searchable.includes(q);
        const matchesResult = resultFilter === "Status" || row.result === resultFilter;
        const matchesPriority = priorityFilter === "Priority" || row.priority === priorityFilter;
        const matchesSpecialist = specialistFilter === "Specialist" || row.specialistName === specialistFilter;
        return matchesQuery && matchesResult && matchesPriority && matchesSpecialist;
      })
      .sort((a, b) => {
        if (sortBy === "ap") return Number(b.ap || 0) - Number(a.ap || 0);
        if (sortBy === "clientName") return a.clientName.localeCompare(b.clientName);
        return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
      });
  }, [rows, query, resultFilter, priorityFilter, specialistFilter, sortBy]);

  const topAgents = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      const key = row.agentName || "Unassigned";
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [rows]);

  const reportStats = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    let startDate = "";
    let label = "Week-to-Date Report";
    let badge = "WTD";

    if (reportRange === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      label = "Month-to-Date Report";
      badge = "MTD";
    } else {
      const day = now.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diffToMonday);
      startDate = monday.toISOString().slice(0, 10);
    }

    const endDate = reportEndDate || today;
    const selectedStartDate = reportStartDate || startDate;

    const rangeRows = rows.filter((row) => {
      const rowDate = row.updatedAt || row.createdAt || "";
      return rowDate >= selectedStartDate && rowDate <= endDate;
    });

    const totalCases = rangeRows.length;
    const pending = rangeRows.filter((row) => row.result === "PENDING").length;
    const resolved = rangeRows.filter((row) => row.result === "RESOLVED").length;
    const lost = rangeRows.filter((row) => row.result === "LOST").length;
    const totalAp = rangeRows.reduce((sum, row) => sum + Number(row.ap || 0), 0);
    const savedAp = rangeRows
      .filter((row) => row.result === "RESOLVED" || row.action === "Save")
      .reduce((sum, row) => sum + Number(row.ap || 0), 0);

    return { startDate: selectedStartDate, today: endDate, totalCases, pending, resolved, lost, totalAp, savedAp, label, badge };
  }, [rows, reportRange, reportStartDate, reportEndDate]);

  const entryTitle = activeEntryTab === "case" ? (editingId ? "Edit case" : "Add new case") : "EOD";
  const entryHelper = activeEntryTab === "case" ? "Fast entry for daily tracking." : "Fill out your EOD Jotform inside the tracker.";

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setForm(blankForm);
    setEditingId(null);
  }

  async function sendToGoogleSheet(data) {
    try {
      const formData = new URLSearchParams();
      formData.append("createdAt", data.createdAt || "");
      formData.append("clientName", data.clientName || "");
      formData.append("policyNumber", data.policyNumber || "");
      formData.append("ap", data.ap || "");
      formData.append("leadStatus", data.leadStatus || "");
      formData.append("agentName", data.agentName || "");
      formData.append("result", data.result || "");
      formData.append("action", data.action || "");
      formData.append("notes", data.notes || "");
      formData.append("priority", data.priority || "");
      formData.append("updatedAt", data.updatedAt || "");
      formData.append("specialistName", data.specialistName || "");

      await fetch(GOOGLE_SHEET_WEB_APP_URL, {
        method: "POST",
        mode: "no-cors",
        body: formData,
      });
    } catch (error) {
      console.error("Google Sheet sync failed:", error);
    }
  }

  function submitForm(event) {
    event.preventDefault();
    if (!form.clientName.trim()) return;

    const payload = {
      ...form,
      ap: Number(form.ap || 0),
      clientName: form.clientName.trim(),
      policyNumber: form.policyNumber.trim(),
      leadStatus: form.leadStatus.trim().toUpperCase(),
      agentName: form.agentName.trim(),
      specialistName: form.specialistName.trim(),
      result: form.result.toUpperCase(),
    };

    if (editingId) {
      setRows((current) => current.map((row) => (row.id === editingId ? { ...row, ...payload } : row)));
    } else {
      const newCase = { id: crypto.randomUUID(), createdAt: new Date().toISOString().slice(0, 10), ...payload };
      setRows((current) => [newCase, ...current]);
      sendToGoogleSheet(newCase);
    }
    resetForm();
  }

  function editRow(row) {
    setActiveEntryTab("case");
    setEditingId(row.id);
    setForm({
      clientName: row.clientName || "",
      policyNumber: row.policyNumber || "",
      ap: row.ap || "",
      leadStatus: row.leadStatus || "",
      agentName: row.agentName || "",
      specialistName: row.specialistName || "",
      result: row.result || "PENDING",
      action: row.action || "",
      notes: row.notes || "",
      priority: row.priority || "Normal",
      updatedAt: row.updatedAt || new Date().toISOString().slice(0, 10),
    });
  }

  function deleteRow(id) {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  function quickStatus(id, result) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, result, updatedAt: new Date().toISOString().slice(0, 10) } : row))
    );
  }

  function exportCsv() {
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chen-tracker-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportTodayCsv() {
    const today = new Date().toISOString().slice(0, 10);
    const todayRows = rows.filter((row) => (row.createdAt || row.updatedAt) === today);
    const blob = new Blob([toCsv(todayRows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chen-tracker-added-today-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportDateRangeCsv() {
    if (!exportStartDate || !exportEndDate) return;

    const rangeRows = rows.filter((row) => {
      const rowDate = row.updatedAt || row.createdAt || "";
      return rowDate >= exportStartDate && rowDate <= exportEndDate;
    });

    const blob = new Blob([toCsv(rangeRows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chen-tracker-${exportStartDate}-to-${exportEndDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportReportCsv() {
    const reportRows = rows.filter((row) => {
      const rowDate = row.updatedAt || row.createdAt || "";
      return rowDate >= reportStats.startDate && rowDate <= reportStats.today;
    });

    const blob = new Blob([toCsv(reportRows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chen-tracker-${reportStats.badge.toLowerCase()}-${reportStats.startDate}-to-${reportStats.today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importCsv(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const imported = parseCsv(String(reader.result || ""));
      if (imported.length) setRows((current) => [...imported, ...current]);
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function clearFilters() {
    setQuery("");
    setResultFilter("Status");
    setPriorityFilter("Priority");
    setSpecialistFilter("Specialist");
    setSortBy("updatedAt");
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-[#F3EEE2] via-[#E9E0D0] to-[#DCCFBB] text-[#2B1A12]">
      <div className="mx-auto max-w-[1440px] px-4 py-5">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-3 overflow-hidden rounded-[1.8rem] border border-[#D4C3AD] bg-[#E9DECC] shadow-lg"
        >
          <div className="relative min-h-[150px] w-full overflow-hidden">
            <div className="absolute inset-0 bg-[#E9DECC]" />

            <div
              className="absolute left-[-40px] top-0 h-full w-[260px] bg-[#7C9A8B]"
              style={{ clipPath: "polygon(0 0, 75% 0, 45% 100%, 0% 100%)" }}
            />
            <div
              className="absolute left-[10px] top-0 h-full w-[220px] bg-[#5F7F70]"
              style={{ clipPath: "polygon(0 0, 72% 0, 42% 100%, 0% 100%)" }}
            />
            <div
              className="absolute left-[55px] top-0 h-full w-[190px] bg-[#355F50]"
              style={{ clipPath: "polygon(0 0, 68% 0, 38% 100%, 0% 100%)" }}
            />

            <div className="relative z-10 flex min-h-[150px] items-center justify-between gap-4 px-6 py-5">
              <div className="max-w-2xl pl-0 md:pl-[170px]">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#BFAE98] bg-[#F4EEE3]/90 px-3 py-1 text-xs font-medium text-[#5A6F63]">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Policy tracker app
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-[#2E443A]">Eterna Retention Tracker</h1>
                <p className="mt-1 text-sm text-[#6D6256]">
                  Track clients, policies, AP, agent assignments, pending saves, welcome calls, onboarding, rewrites, and lost cases.
                </p>
              </div>

              <div className="hidden shrink-0 items-center gap-3 sm:flex">
                <div className="relative flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#5F7F70]">
                  <div className="absolute h-8 w-8 rounded-full border-2 border-[#5F7F70]" />
                  <div className="absolute h-8 w-8 rotate-60 rounded-full border-2 border-[#5F7F70]" />
                  <div className="absolute h-8 w-8 -rotate-60 rounded-full border-2 border-[#5F7F70]" />
                </div>
                <div className="text-right">
                  <div className="text-2xl font-semibold tracking-[0.28em] text-[#4D6659]">ETERNA</div>
                  <div className="text-xs text-[#8A7A67]">Retention dashboard</div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-[#D4C3AD] bg-[#EFE6D8] px-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button onClick={exportTodayCsv} className="rounded-2xl bg-[#5C7768] text-white hover:bg-[#466153]">
                  <Download className="mr-2 h-4 w-4" /> Export Today
                </Button>
                <Button onClick={exportCsv} className="rounded-2xl bg-[#5C7768] text-white hover:bg-[#466153]">
                  <Download className="mr-2 h-4 w-4" /> Export All
                </Button>
                <label className="inline-flex h-10 cursor-pointer items-center rounded-2xl bg-[#5C7768] px-4 text-sm font-medium text-white hover:bg-[#466153]">
                  <Upload className="mr-2 h-4 w-4" /> Import CSV
                  <input type="file" accept=".csv" className="hidden" onChange={importCsv} />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-[#6D6256]">Export date range</span>
                <input
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                  className="h-9 rounded-2xl border border-[#CDBAA3] bg-white px-3 text-xs text-[#2B1A12] outline-none focus:border-[#5C7768]"
                />
                <input
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                  className="h-9 rounded-2xl border border-[#CDBAA3] bg-white px-3 text-xs text-[#2B1A12] outline-none focus:border-[#5C7768]"
                />
                <Button
                  onClick={exportDateRangeCsv}
                  disabled={!exportStartDate || !exportEndDate}
                  className="h-9 rounded-2xl bg-[#B7863B] px-4 text-xs text-white hover:bg-[#996E2E] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="mr-2 h-4 w-4" /> Export Range
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="mb-3 grid gap-3 md:grid-cols-4">
          <StatCard icon={<Users />} label="Total Cases" value={stats.total} helper={`${stats.completionRate}% resolved`} />
          <StatCard icon={<Clock3 />} label="Pending" value={stats.pending} helper={currency(stats.pendingAp)} tone="amber" />
          <StatCard icon={<CheckCircle2 />} label="Resolved" value={stats.resolved} helper="Completed cases" tone="emerald" />
          <StatCard icon={<DollarSign />} label="Total AP" value={currency(stats.totalAp)} helper={`${stats.lost} lost cases`} tone="slate" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[390px_1fr]">
          <Card className="h-fit self-start rounded-[1.6rem] border border-[#D4C3AD] bg-[#F8F3EA] shadow-md">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="mb-2 inline-flex rounded-2xl border border-[#D4C3AD] bg-[#EFE6D8] p-1">
                    <button
                      type="button"
                      onClick={() => setActiveEntryTab("case")}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold ${activeEntryTab === "case" ? "bg-[#5B3320] text-white" : "text-[#5B3320]"}`}
                    >
                      Add new case
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveEntryTab("eod")}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold ${activeEntryTab === "eod" ? "bg-[#5B3320] text-white" : "text-[#5B3320]"}`}
                    >
                      EOD
                    </button>
                  </div>
                  <h2 className="text-lg font-bold">{entryTitle}</h2>
                  <p className="text-xs text-[#8A6A55]">{entryHelper}</p>
                </div>
                {editingId && activeEntryTab === "case" && (
                  <Button variant="ghost" size="sm" onClick={resetForm} className="rounded-xl">
                    <X className="mr-1 h-4 w-4" /> Cancel
                  </Button>
                )}
              </div>

              {activeEntryTab === "case" ? (
                <form onSubmit={submitForm} className="space-y-2">
                  <Input label="Client name" value={form.clientName} onChange={(v) => updateForm("clientName", v)} required />
                  <div className="grid grid-cols-2 gap-2">
                    <Input label="Policy number" value={form.policyNumber} onChange={(v) => updateForm("policyNumber", v)} />
                    <Input label="AP" type="number" value={form.ap} onChange={(v) => updateForm("ap", v)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select label="Lead status" value={form.leadStatus} onChange={(v) => updateForm("leadStatus", v)} options={leadStatusOptions} />
                    <Input label="Agent name" value={form.agentName} onChange={(v) => updateForm("agentName", v)} />
                  </div>
                  <Select label="Specialist name" value={form.specialistName} onChange={(v) => updateForm("specialistName", v)} options={specialistOptions} />
                  <div className="grid grid-cols-3 gap-2">
                    <Select label="Status" value={form.result} onChange={(v) => updateForm("result", v)} options={resultOptions} />
                    <Select label="Priority" value={form.priority} onChange={(v) => updateForm("priority", v)} options={priorityOptions} />
                    <Input label="Updated" type="date" value={form.updatedAt} onChange={(v) => updateForm("updatedAt", v)} />
                  </div>
                  <Select label="Action" value={form.action} onChange={(v) => updateForm("action", v)} options={actionOptions} />
                  <Textarea label="Notes" value={form.notes} onChange={(v) => updateForm("notes", v)} placeholder="Callback time, issue, next step..." />
                  <Button type="submit" className="h-11 w-full rounded-2xl bg-[#03071A] text-white hover:bg-[#10142B]">
                    {editingId ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                    {editingId ? "Save changes" : "Add case"}
                  </Button>
                </form>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-[#D4C3AD] bg-[#F2E9DC]">
                  <iframe
                    title="EOD Jotform"
                    src={EOD_JOTFORM_URL}
                    className="h-[720px] w-full bg-white"
                    frameBorder="0"
                    allowFullScreen
                  />
                </div>
              )}

              <div className="mt-4 rounded-[1.4rem] border border-[#D4C3AD] bg-[#F2E9DC] p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-2 inline-flex rounded-2xl border border-[#D4C3AD] bg-[#EFE6D8] p-1">
                      <button
                        type="button"
                        onClick={() => {
                          setReportRange("week");
                          setReportStartDate("");
                          setReportEndDate("");
                        }}
                        className={`rounded-xl px-3 py-1 text-[10px] font-bold ${reportRange === "week" ? "bg-[#5B3320] text-white" : "text-[#5B3320]"}`}
                      >
                        Week to date
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReportRange("month");
                          setReportStartDate("");
                          setReportEndDate("");
                        }}
                        className={`rounded-xl px-3 py-1 text-[10px] font-bold ${reportRange === "month" ? "bg-[#5B3320] text-white" : "text-[#5B3320]"}`}
                      >
                        Month to date
                      </button>
                    </div>
                    <h3 className="mt-2 text-sm font-bold text-[#2B1A12]">{reportStats.label}</h3>
                    <p className="text-[11px] text-[#8A6A55]">
                      {reportStats.startDate} to {reportStats.today}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        onClick={exportReportCsv}
                        className="h-8 rounded-2xl bg-[#D8913D] px-3 text-[10px] font-bold text-white hover:bg-[#B87428]"
                      >
                        <Download className="mr-1 h-3.5 w-3.5" /> Export CSV
                      </Button>
                      <span className="rounded-full bg-[#5B3320] px-3 py-1 text-[10px] font-bold text-white">{reportStats.badge}</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <input
                        type="date"
                        value={reportStats.startDate}
                        onChange={(e) => setReportStartDate(e.target.value)}
                        className="h-8 rounded-2xl border border-[#D4C3AD] bg-white px-2 text-[11px] text-[#2B1A12] outline-none focus:border-[#5C7768]"
                      />
                      <span className="text-[11px] font-semibold text-[#8A6A55]">to</span>
                      <input
                        type="date"
                        value={reportStats.today}
                        onChange={(e) => setReportEndDate(e.target.value)}
                        className="h-8 rounded-2xl border border-[#D4C3AD] bg-white px-2 text-[11px] text-[#2B1A12] outline-none focus:border-[#5C7768]"
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <ReportItem label="Total Cases" value={reportStats.totalCases} />
                  <ReportItem label="Resolved" value={reportStats.resolved} />
                  <ReportItem label="Pending" value={reportStats.pending} />
                  <ReportItem label="Lost" value={reportStats.lost} />
                  <ReportItem label="Total AP" value={currency(reportStats.totalAp)} />
                  <ReportItem label="Saved AP" value={currency(reportStats.savedAp)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3">
            <Card className="rounded-[1.4rem] border border-[#D4C3AD] bg-[#F8F3EA] shadow-md lg:mr-[192px]">
              <CardContent className="p-2.5">
                <div className="grid items-center gap-2 lg:grid-cols-[115px_1fr_105px_105px_110px_110px_64px]">
                  <div>
                    <h2 className="flex items-center gap-1.5 text-sm font-bold">
                      <Filter className="h-4 w-4" /> Work queue
                    </h2>
                    <p className="text-[10px] leading-3 text-[#8A6A55]">Search & filter.</p>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#B28A6B]" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search client, policy, agent, specialist, notes..."
                      className="h-8 w-full rounded-2xl border border-[#D4C3AD] bg-white pl-9 pr-3 text-xs outline-none focus:border-[#5C7768]"
                    />
                  </div>
                  <MiniSelect value={resultFilter} onChange={setResultFilter} options={["Status", ...resultOptions]} />
                  <MiniSelect value={priorityFilter} onChange={setPriorityFilter} options={["Priority", ...priorityOptions]} />
                  <MiniSelect value={specialistFilter} onChange={setSpecialistFilter} options={["Specialist", "Nisha", "Rick", "Chen"]} />
                  <MiniSelect value={sortBy} onChange={setSortBy} options={["updatedAt", "ap", "clientName"]} />
                  <Button variant="outline" size="sm" onClick={clearFilters} className="h-8 rounded-2xl px-2 text-xs">
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
              <Card className="rounded-[1.6rem] border border-[#D4C3AD] bg-[#F8F3EA] shadow-md">
                <CardContent className="p-0">
                  <div className="overflow-hidden rounded-[1.6rem]">
                    <table className="w-full table-fixed text-left text-[11px]">
                      <thead className="sticky top-0 z-10 bg-[#F7E8D6] text-[11px] uppercase tracking-wide text-[#8A6A55]">
                        <tr>
                          <th className="w-[17%] px-3 py-3">Client</th>
                          <th className="w-[13%] px-2 py-3">Policy</th>
                          <th className="w-[10%] px-2 py-3">AP</th>
                          <th className="w-[9%] px-2 py-3">Stage</th>
                          <th className="w-[14%] px-2 py-3">Agent</th>
                          <th className="w-[12%] px-2 py-3">Status</th>
                          <th className="w-[17%] px-2 py-3">Action / Notes</th>
                          <th className="w-[8%] px-2 py-3 text-right">Tools</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EEDBC6]">
                        {filteredRows.map((row) => (
                          <tr key={row.id} className="bg-white align-top hover:bg-[#F2E9DC]">
                            <td className="break-words px-3 py-3">
                              <div className="font-semibold text-[#2B1A12]">{row.clientName}</div>
                              <div className="mt-1 flex items-center gap-2 text-[11px] text-[#8A6A55]">
                                {row.updatedAt}
                                <span className={`rounded-full px-2 py-0.5 ${priorityClasses(row.priority)}`}>{row.priority}</span>
                              </div>
                            </td>
                            <td className="break-words px-2 py-3 font-mono text-[10px] text-[#6F4A33]">{row.policyNumber}</td>
                            <td className="break-words px-2 py-3 font-semibold">{currency(row.ap)}</td>
                            <td className="px-2 py-3">
                              <span className="rounded-full bg-[#F7E8D6] px-1.5 py-0.5 text-[10px] font-semibold text-[#5B3320]">{row.leadStatus || "—"}</span>
                            </td>
                            <td className="break-words px-2 py-3 text-[#5B3320]">{row.agentName || "—"}</td>
                            <td className="px-2 py-3">
                              <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${statusClasses(row.result)}`}>
                                {row.result === "RESOLVED" && <CheckCircle2 className="mr-1 h-3 w-3" />}
                                {row.result === "PENDING" && <Clock3 className="mr-1 h-3 w-3" />}
                                {row.result === "LOST" && <XCircle className="mr-1 h-3 w-3" />}
                                {row.result}
                              </span>
                            </td>
                            <td className="break-words px-2 py-3">
                              <div className="font-medium text-[#3A2417]">{row.action || "—"}</div>
                              {row.notes && <div className="mt-0.5 text-[10px] leading-4 text-[#8A6A55]">{row.notes}</div>}
                            </td>
                            <td className="px-2 py-3">
                              <div className="flex justify-end gap-0.5">
                                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-xl" onClick={() => quickStatus(row.id, "RESOLVED")} title="Mark resolved">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-xl" onClick={() => editRow(row)} title="Edit">
                                  <Edit3 className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl text-[#B44A2B] hover:text-[#8F321D]" onClick={() => deleteRow(row.id)} title="Delete">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!filteredRows.length && (
                      <div className="flex min-h-[320px] flex-col items-center justify-center bg-white px-6 text-center">
                        <AlertTriangle className="mb-3 h-10 w-10 text-[#F3D9BC]" />
                        <h3 className="text-lg font-bold">No cases found</h3>
                        <p className="mt-1 text-sm text-[#8A6A55]">Try changing your search or filters.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="h-fit self-start rounded-[1.4rem] border border-[#D4C3AD] bg-[#F8F3EA] shadow-md">
                <CardContent className="p-2.5">
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold">
                    <BarChart3 className="h-3.5 w-3.5" /> Agent load
                  </h3>
                  <div className="space-y-1.5">
                    {topAgents.map(([agent, count]) => {
                      const width = stats.total ? Math.max(8, Math.round((count / stats.total) * 100)) : 0;
                      return (
                        <div key={agent}>
                          <div className="mb-1 flex items-center justify-between gap-1 text-[10px]">
                            <span className="max-w-[125px] truncate font-medium text-[#5B3320]" title={agent}>
                              {agent}
                            </span>
                            <span className="text-[#8A6A55]">{count}</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-[#F7E8D6]">
                            <div className="h-full rounded-full bg-[#7A4A2A]" style={{ width: `${width}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, helper, tone = "slate" }) {
  const tones = {
    slate: "bg-[#5B3320] text-white",
    amber: "bg-[#D8913D] text-white",
    emerald: "bg-[#6F8A3A] text-white",
  };
  return (
    <Card className="rounded-[1.4rem] border border-[#D4C3AD] bg-[#F8F3EA] shadow-md">
      <CardContent className="p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-[#8A6A55]">{label}</p>
            <div className="mt-1 text-xl font-bold tracking-tight">{value}</div>
            <p className="mt-0.5 text-xs text-[#8A6A55]">{helper}</p>
          </div>
          <div className={`rounded-2xl p-2.5 ${tones[tone]}`}>{React.cloneElement(icon, { className: "h-4 w-4" })}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReportItem({ label, value }) {
  return (
    <div className="rounded-2xl border border-[#D4C3AD] bg-[#F8F3EA] p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[#8A6A55]">{label}</div>
      <div className="mt-1 text-sm font-bold text-[#2B1A12]">{value}</div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", required = false, placeholder = "" }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#8A6A55]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="h-9 w-full rounded-2xl border border-[#D4C3AD] bg-white px-3 text-xs outline-none focus:border-[#5C7768]"
      />
    </label>
  );
}

function Textarea({ label, value, onChange, placeholder = "" }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#8A6A55]">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full resize-none rounded-2xl border border-[#D4C3AD] bg-white px-3 py-2 text-xs outline-none focus:border-[#5C7768]"
      />
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#8A6A55]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-2xl border border-[#D4C3AD] bg-white px-2 text-xs outline-none focus:border-[#5C7768]"
      >
        {options.map((option, index) => (
          <option key={`${label}-${option}-${index}`} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function MiniSelect({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-2xl border border-[#D4C3AD] bg-white px-2 text-xs outline-none focus:border-[#5C7768]"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option === "updatedAt" ? "Latest update" : option === "clientName" ? "Client A-Z" : option === "ap" ? "Highest AP" : option}
        </option>
      ))}
    </select>
  );
}
