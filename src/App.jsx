import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Plus,
  Download,
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
  RefreshCw,
  Loader2,
  Moon,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const STORAGE_KEY = "chen-policy-tracker-v1";
const REMINDER_STORAGE_KEY = "eterna-tracker-reminders-v1";

const GOOGLE_SHEET_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbxQbzGV243t3Tyfyzc7kcZuvNEmscoGf0lpdSRft5VhUIL1Y_ALEc3mA7HIO4WgF_x4/exec";

const EOD_JOTFORM_URL = "https://form.jotform.com/260420066600039";

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

const blankReminderForm = {
  title: "",
  reminderAt: "",
  note: "",
};

const resultOptions = ["PENDING", "RESOLVED", "LOST"];
const priorityOptions = ["Normal", "High", "Urgent"];
const specialistOptions = ["", "Nisha", "Rick", "Chen"];

const leadStatusOptions = [
  "",
  "NA",
  "NAA",
  "SRWT",
  "AS",
  "RTR",
  "CEP",
  "AYAR",
  "CWCC",
  "IUW",
  "UWAN",
  "UWAR",
  "UWSRWT",
];

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

function currency(value: any) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

function statusClasses(status: string) {
  const upper = String(status || "").toUpperCase();

  if (upper === "RESOLVED") {
    return "bg-[#EEF7E8] text-[#4C6B2F] border-[#BDD6A6]";
  }

  if (upper === "LOST") {
    return "bg-[#FCE8DF] text-[#9D3F23] border-[#F0B49C]";
  }

  return "bg-[#FFF1D8] text-[#9A5B12] border-[#F1C27D]";
}

function priorityClasses(priority: string) {
  if (priority === "Urgent") return "bg-[#FCE8DF] text-[#9D3F23]";
  if (priority === "High") return "bg-[#FFE6C7] text-[#A65B17]";
  return "bg-[#F7E8D6] text-[#6F4A33]";
}

function toCsv(rows: any[]) {
  const headers = [
    "CLIENT NAME",
    "POLICY NUMBER",
    "AP",
    "LEAD STATUS",
    "AGENT NAME",
    "SPECIALIST NAME",
    "STATUS",
    "ACTION",
    "NOTES",
    "PRIORITY",
    "UPDATED AT",
  ];

  const escape = (value: any) => {
    const str = String(value ?? "");
    return /[",\n]/.test(str) ? `"${str.replaceAll('"', '""')}"` : str;
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

  return [headers.join(","), ...body].join("\n");
}

function EternaLogoMark({ className = "h-12 w-12" }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Eterna logo"
    >
      <g
        stroke="#6E8578"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <ellipse cx="50" cy="28" rx="20" ry="26" />
        <ellipse
          cx="32"
          cy="60"
          rx="20"
          ry="26"
          transform="rotate(60 32 60)"
        />
        <ellipse
          cx="68"
          cy="60"
          rx="20"
          ry="26"
          transform="rotate(-60 68 60)"
        />
      </g>
    </svg>
  );
}

export default function ChenTrackerApp() {
  const [rows, setRows] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [reminders, setReminders] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(REMINDER_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [reminderForm, setReminderForm] = useState(blankReminderForm);

  const [form, setForm] = useState(blankForm);
  const [editForm, setEditForm] = useState(blankForm);
  const [editModalRow, setEditModalRow] = useState<any | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [resultFilter, setResultFilter] = useState("Status");
  const [priorityFilter, setPriorityFilter] = useState("Priority");
  const [specialistFilter, setSpecialistFilter] = useState("Specialist");
  const [sortBy, setSortBy] = useState("updatedAt");

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;

  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");

  const [activeEntryTab, setActiveEntryTab] = useState("case");
  const [isLoadingSheet, setIsLoadingSheet] = useState(false);
  const [sheetMessage, setSheetMessage] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [reportRange, setReportRange] = useState("week");
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");

  useEffect(() => {
    document.title = "Eterna Retention Tracker";
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  }, [rows]);

  useEffect(() => {
    localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(reminders));
  }, [reminders]);

  useEffect(() => {
    loadFromGoogleSheet();
  }, []);

  const stats = useMemo(() => {
    const getToday = () => {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      return now.toISOString().slice(0, 10);
    };

    const today = getToday();

    const statsRows =
      specialistFilter === "Specialist"
        ? rows
        : rows.filter((row) => row.specialistName === specialistFilter);

    const hasDateFilter = Boolean(filterStartDate || filterEndDate);
    const rangeStart = filterStartDate || filterEndDate || today;
    const rangeEnd = filterEndDate || filterStartDate || today;

    const dateRows = statsRows.filter((row) => {
      const rowDate = row.updatedAt || row.createdAt || "";
      if (hasDateFilter) return rowDate >= rangeStart && rowDate <= rangeEnd;
      return rowDate === today;
    });

    const displayRows = hasDateFilter ? dateRows : statsRows;
    const total = displayRows.length;

    const pendingSaveRows = dateRows.filter(
      (r) => String(r.action || "").trim().toLowerCase() === "pending save"
    );

    const saveRows = dateRows.filter(
      (r) => String(r.action || "").trim().toLowerCase() === "save"
    );

    const uwActionResolvedRows = dateRows.filter(
      (r) =>
        String(r.action || "").trim().toLowerCase() === "uw action resolved"
    );

    const uwActionNeededRows = dateRows.filter(
      (r) => String(r.action || "").trim().toLowerCase() === "uw action needed"
    );

    const pendingSaveAp = displayRows
      .filter(
        (r) => String(r.action || "").trim().toLowerCase() === "pending save"
      )
      .reduce((sum, r) => sum + Number(r.ap || 0), 0);

    const saveAp = displayRows
      .filter((r) => String(r.action || "").trim().toLowerCase() === "save")
      .reduce((sum, r) => sum + Number(r.ap || 0), 0);

    return {
      total,
      pendingSaveToday: pendingSaveRows.length,
      saveToday: saveRows.length,
      uwActionResolvedToday: uwActionResolvedRows.length,
      uwActionNeededToday: uwActionNeededRows.length,
      pendingSaveTodayAp: pendingSaveRows.reduce(
        (sum, r) => sum + Number(r.ap || 0),
        0
      ),
      saveTodayAp: saveRows.reduce((sum, r) => sum + Number(r.ap || 0), 0),
      uwActionResolvedTodayAp: uwActionResolvedRows.reduce(
        (sum, r) => sum + Number(r.ap || 0),
        0
      ),
      uwActionNeededTodayAp: uwActionNeededRows.reduce(
        (sum, r) => sum + Number(r.ap || 0),
        0
      ),
      pendingSaveAp,
      saveAp,
      dateLabel: hasDateFilter ? `${rangeStart} to ${rangeEnd}` : today,
    };
  }, [rows, specialistFilter, filterStartDate, filterEndDate]);

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

        const rowDate = row.updatedAt || row.createdAt || "";

        return (
          (!q || searchable.includes(q)) &&
          (resultFilter === "Status" || row.result === resultFilter) &&
          (priorityFilter === "Priority" || row.priority === priorityFilter) &&
          (specialistFilter === "Specialist" ||
            row.specialistName === specialistFilter) &&
          (!filterStartDate || rowDate >= filterStartDate) &&
          (!filterEndDate || rowDate <= filterEndDate)
        );
      })
      .sort((a, b) => {
        if (sortBy === "ap") return Number(b.ap || 0) - Number(a.ap || 0);
        if (sortBy === "clientName") {
          return String(a.clientName || "").localeCompare(
            String(b.clientName || "")
          );
        }
        return String(b.updatedAt || "").localeCompare(
          String(a.updatedAt || "")
        );
      });
  }, [
    rows,
    query,
    resultFilter,
    priorityFilter,
    specialistFilter,
    filterStartDate,
    filterEndDate,
    sortBy,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));

  const paginatedRows = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    query,
    resultFilter,
    priorityFilter,
    specialistFilter,
    filterStartDate,
    filterEndDate,
    sortBy,
  ]);

  const topAgents = useMemo(() => {
    const map = new Map();

    filteredRows.forEach((row) => {
      const key = String(row.agentName || "Unassigned").trim() || "Unassigned";
      map.set(key, (map.get(key) || 0) + 1);
    });

    return [...map.entries()].sort((a: any, b: any) => b[1] - a[1]);
  }, [filteredRows]);

  const sortedReminders = useMemo(() => {
    return [...reminders].sort((a, b) =>
      String(a.reminderAt).localeCompare(String(b.reminderAt))
    );
  }, [reminders]);

  const reportStats = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    let startDate = "";
    let label = "Week-to-Date Report";
    let badge = "WTD";

    if (reportRange === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .slice(0, 10);
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

    const reportSourceRows =
      specialistFilter === "Specialist"
        ? rows
        : rows.filter((row) => row.specialistName === specialistFilter);

    const rangeRows = reportSourceRows.filter((row) => {
      const rowDate = row.updatedAt || row.createdAt || "";
      return rowDate >= selectedStartDate && rowDate <= endDate;
    });

    const totalCases = rangeRows.length;
    const pending = rangeRows.filter((row) => row.result === "PENDING").length;
    const resolved = rangeRows.filter(
      (row) => row.result === "RESOLVED"
    ).length;
    const lost = rangeRows.filter((row) => row.result === "LOST").length;

    const pendingSaveAp = rangeRows
      .filter(
        (row) =>
          String(row.action || "").trim().toLowerCase() === "pending save"
      )
      .reduce((sum, row) => sum + Number(row.ap || 0), 0);

    const saveAp = rangeRows
      .filter(
        (row) => String(row.action || "").trim().toLowerCase() === "save"
      )
      .reduce((sum, row) => sum + Number(row.ap || 0), 0);

    return {
      startDate: selectedStartDate,
      today: endDate,
      totalCases,
      pending,
      resolved,
      lost,
      pendingSaveAp,
      saveAp,
      label,
      badge,
    };
  }, [rows, specialistFilter, reportRange, reportStartDate, reportEndDate]);

  const entryTitle = activeEntryTab === "case" ? "Add new case" : "EOD";
  const entryHelper =
    activeEntryTab === "case"
      ? "Fast entry for daily tracking."
      : "Fill out your EOD Jotform inside the tracker.";

  function updateForm(field: string, value: any) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateEditForm(field: string, value: any) {
    setEditForm((current) => ({ ...current, [field]: value }));
  }

  function updateReminderForm(field: string, value: any) {
    setReminderForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setForm(blankForm);
    setEditingId(null);
  }

  function closeEditModal() {
    setEditModalRow(null);
    setEditForm(blankForm);
    setEditingId(null);
  }

  async function sendToGoogleSheet(data: any) {
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

  async function updateGoogleSheetRow(rowId: string, data: any) {
    try {
      const formData = new URLSearchParams();
      formData.append("recordType", "update");
      formData.append("rowId", rowId || "");
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
      console.error("Google Sheet update failed:", error);
    }
  }

  function isRealTrackerRow(row: any) {
    const badLabels = [
      "save",
      "pending save",
      "welcome call",
      "onboarding",
      "onboarding call",
      "uw action needed",
      "uw action resolved",
      "uw resolved",
      "lost",
      "daily counter",
      "count",
      "created at",
      "client name",
      "policy number",
      "ap",
      "lead status",
      "agent name",
      "result",
      "status",
      "action",
      "notes",
      "priority",
      "updated at",
      "specialist name",
    ];

    const clientName = String(row?.clientName || "").trim();
    const createdAt = String(row?.createdAt || "").trim();
    const updatedAt = String(row?.updatedAt || "").trim();
    const specialistName = String(row?.specialistName || "").trim();

    if (!clientName) return false;
    if (badLabels.includes(clientName.toLowerCase())) return false;
    if (badLabels.includes(createdAt.toLowerCase())) return false;

    if (
      !specialistName ||
      !["Nisha", "Rick", "Chen", "Unassigned"].includes(specialistName)
    ) {
      return false;
    }

    const hasValidDate =
      /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(createdAt) ||
      /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(updatedAt);

    return hasValidDate;
  }

  async function loadFromGoogleSheet() {
    setIsLoadingSheet(true);
    setSheetMessage("Refreshing data...");

    try {
      const response = await fetch(GOOGLE_SHEET_WEB_APP_URL);
      const data = await response.json();

      if (data.success && Array.isArray(data.rows)) {
        const cleanRows = data.rows.filter(isRealTrackerRow);
        setRows(cleanRows);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanRows));
        setLastRefreshed(
          new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        );
        setSheetMessage("Data refreshed successfully.");
      } else {
        setSheetMessage("Could not refresh data from Google Sheets.");
      }
    } catch (error) {
      console.error("Failed to load Google Sheet data:", error);
      setSheetMessage("Refresh failed. Please check the Google Sheet connection.");
    } finally {
      setIsLoadingSheet(false);
    }
  }

  function submitForm(event: any) {
    event.preventDefault();
    if (!form.clientName.trim()) return;

    const policyNumberInput = form.policyNumber.trim().toLowerCase();

    const duplicatePolicy =
      policyNumberInput &&
      rows.some((row) => {
        if (editingId && row.id === editingId) return false;
        return (
          String(row.policyNumber || "").trim().toLowerCase() ===
          policyNumberInput
        );
      });

    if (duplicatePolicy) {
      const shouldContinue = window.confirm(
        "This policy number already exists. Continue anyway?"
      );
      if (!shouldContinue) return;
    }

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

    const newCase = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString().slice(0, 10),
      ...payload,
    };

    setRows((current) => [newCase, ...current]);
    setSheetMessage("Case added successfully. Syncing to Google Sheets...");
    sendToGoogleSheet(newCase);

    setTimeout(() => setSheetMessage(""), 4000);
    resetForm();
  }

  function editRow(row: any) {
    setEditModalRow(row);
    setEditingId(row.id);

    setEditForm({
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

  function saveEditModal(event: any) {
    event.preventDefault();

    if (!editModalRow || !editForm.clientName.trim()) return;

    const payload = {
      ...editForm,
      ap: Number(editForm.ap || 0),
      clientName: editForm.clientName.trim(),
      policyNumber: editForm.policyNumber.trim(),
      leadStatus: editForm.leadStatus.trim().toUpperCase(),
      agentName: editForm.agentName.trim(),
      specialistName: editForm.specialistName.trim(),
      result: editForm.result.toUpperCase(),
    };

    setRows((current) =>
      current.map((row) =>
        row.id === editModalRow.id ? { ...row, ...payload } : row
      )
    );

    updateGoogleSheetRow(editModalRow.id, payload);
    setSheetMessage("Client details updated. Syncing update to Google Sheets...");
    setTimeout(() => setSheetMessage(""), 2500);
    closeEditModal();
  }

  function deleteRow(id: string) {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  function quickStatus(id: string, result: string) {
    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              result,
              updatedAt: new Date().toISOString().slice(0, 10),
            }
          : row
      )
    );
  }

  async function copyClientSummary(row: any) {
    const summary = [
      `Client: ${row.clientName || "—"}`,
      `Policy Number: ${row.policyNumber || "—"}`,
      `AP: ${currency(row.ap)}`,
      `Lead Status: ${row.leadStatus || "—"}`,
      `Agent: ${row.agentName || "—"}`,
      `Specialist: ${row.specialistName || "—"}`,
      `Status: ${row.result || "—"}`,
      `Priority: ${row.priority || "—"}`,
      `Action: ${row.action || "—"}`,
      `Notes: ${row.notes || "—"}`,
      `Updated At: ${row.updatedAt || "—"}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(summary);
      setSheetMessage("Client summary copied.");
      setTimeout(() => setSheetMessage(""), 2500);
    } catch (error) {
      console.error("Failed to copy client summary:", error);
      setSheetMessage("Could not copy client summary.");
      setTimeout(() => setSheetMessage(""), 2500);
    }
  }

  function exportDateRangeCsv() {
    if (!exportStartDate || !exportEndDate) return;

    const rangeRows = rows.filter((row) => {
      const rowDate = row.updatedAt || row.createdAt || "";
      return rowDate >= exportStartDate && rowDate <= exportEndDate;
    });

    const blob = new Blob([toCsv(rangeRows)], {
      type: "text/csv;charset=utf-8;",
    });

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

    const blob = new Blob([toCsv(reportRows)], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `chen-tracker-${reportStats.badge.toLowerCase()}-${
      reportStats.startDate
    }-to-${reportStats.today}.csv`;
    a.click();

    URL.revokeObjectURL(url);
  }

  function addReminder(event: any) {
    event.preventDefault();

    if (!reminderForm.title.trim() || !reminderForm.reminderAt) return;

    const newReminder = {
      id: crypto.randomUUID(),
      title: reminderForm.title.trim(),
      reminderAt: reminderForm.reminderAt,
      note: reminderForm.note.trim(),
      isDone: false,
      createdAt: new Date().toISOString(),
    };

    setReminders((current) => [newReminder, ...current]);
    setReminderForm(blankReminderForm);
  }

  function toggleReminderDone(id: string) {
    setReminders((current) =>
      current.map((reminder) =>
        reminder.id === id
          ? { ...reminder, isDone: !reminder.isDone }
          : reminder
      )
    );
  }

  function deleteReminder(id: string) {
    setReminders((current) =>
      current.filter((reminder) => reminder.id !== id)
    );
  }

  function clearFilters() {
    setQuery("");
    setResultFilter("Status");
    setPriorityFilter("Priority");
    setSpecialistFilter("Specialist");
    setSortBy("updatedAt");
    setFilterStartDate("");
    setFilterEndDate("");
  }

  return (
    <div
      className={
        isDarkMode
          ? "relative min-h-screen overflow-x-hidden bg-[#111A16] text-[#2B1A12]"
          : "relative min-h-screen overflow-x-hidden bg-[#EDE5D7] text-[#2B1A12]"
      }
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {isDarkMode ? (
          <>
            <div className="absolute inset-0 bg-[linear-gradient(135deg,_#111A16_0%,_#1E2D26_48%,_#2A2119_100%)]" />
            <div className="absolute -left-28 top-0 h-96 w-96 rounded-full bg-[#6E8578]/20 blur-3xl" />
            <div className="absolute right-[-120px] bottom-[-60px] h-[420px] w-[420px] rounded-full bg-[#B7863B]/12 blur-3xl" />
            <div className="absolute left-1/2 top-24 h-64 w-64 rounded-full bg-[#A7B9AD]/10 blur-3xl" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-[linear-gradient(135deg,_#F6EFE4_0%,_#E7DCCB_45%,_#D6C8B5_100%)]" />
            <div className="absolute -left-28 top-0 h-96 w-96 rounded-full bg-[#6E8578]/28 blur-3xl" />
            <div className="absolute right-[-120px] bottom-[-60px] h-[420px] w-[420px] rounded-full bg-[#A7B9AD]/25 blur-3xl" />
            <div className="absolute left-1/2 top-24 h-64 w-64 rounded-full bg-[#B7863B]/12 blur-3xl" />
          </>
        )}
      </div>

      <div className="relative z-10 mx-auto max-w-[1440px] px-4 py-5">
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
              style={{
                clipPath: "polygon(0 0, 75% 0, 45% 100%, 0% 100%)",
              }}
            />
            <div
              className="absolute left-[10px] top-0 h-full w-[220px] bg-[#5F7F70]"
              style={{
                clipPath: "polygon(0 0, 72% 0, 42% 100%, 0% 100%)",
              }}
            />
            <div
              className="absolute left-[55px] top-0 h-full w-[190px] bg-[#355F50]"
              style={{
                clipPath: "polygon(0 0, 68% 0, 38% 100%, 0% 100%)",
              }}
            />

            <div className="relative z-10 flex min-h-[150px] items-center justify-between gap-4 px-6 py-5">
              <div className="max-w-2xl pl-0 md:pl-[170px]">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#BFAE98] bg-[#F4EEE3]/90 px-3 py-1 text-xs font-medium text-[#5A6F63]">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Policy tracker app
                </div>

                <h1 className="text-3xl font-bold tracking-tight text-[#2E443A]">
                  Eterna Retention Tracker
                </h1>

                <p className="mt-1 text-sm text-[#6D6256]">
                  Track clients, policies, AP, agent assignments, pending saves,
                  welcome calls, onboarding, rewrites, and lost cases.
                </p>
              </div>

              <div className="hidden shrink-0 items-center gap-3 sm:flex">
                <EternaLogoMark className="h-14 w-14" />

                <div className="text-right">
                  <div className="text-2xl font-semibold tracking-[0.32em] text-[#4D6659]">
                    ETERNA
                  </div>
                  <div className="text-xs text-[#8A7A67]">
                    Retention dashboard
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-[#D4C3AD] bg-[#EFE6D8] px-5 py-3">
            <div className="flex w-full flex-wrap items-center gap-2">
              <select
                value={specialistFilter}
                onChange={(e) => setSpecialistFilter(e.target.value)}
                className="h-9 rounded-2xl border border-[#CDBAA3] bg-white px-3 text-xs text-[#2B1A12] outline-none focus:border-[#5C7768]"
                title="Select user"
              >
                <option value="Specialist">All Users</option>
                <option value="Nisha">Nisha</option>
                <option value="Rick">Rick</option>
                <option value="Chen">Chen</option>
              </select>

              <Button
                type="button"
                onClick={() => setIsDarkMode((current) => !current)}
                className="h-9 rounded-2xl bg-[#03071A] px-4 text-xs text-white hover:bg-[#10142B]"
              >
                {isDarkMode ? (
                  <Sun className="mr-2 h-4 w-4" />
                ) : (
                  <Moon className="mr-2 h-4 w-4" />
                )}
                {isDarkMode ? "Light Mode" : "Dark Mode"}
              </Button>

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

              <div className="ml-auto flex justify-end">
                <Button
                  onClick={loadFromGoogleSheet}
                  disabled={isLoadingSheet}
                  className="h-9 rounded-2xl bg-[#5C7768] px-4 text-xs text-white hover:bg-[#466153] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isLoadingSheet ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  {isLoadingSheet ? "Refreshing..." : "Refresh Data"}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="mb-3 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <StatCard
            icon={<Users />}
            label="Total Cases"
            value={stats.total}
            helper={stats.dateLabel}
            isDarkMode={isDarkMode}
          />
          <StatCard
            icon={<Clock3 />}
            label="Pending Save"
            value={stats.pendingSaveToday}
            helper={currency(stats.pendingSaveTodayAp)}
            tone="amber"
            isDarkMode={isDarkMode}
          />
          <StatCard
            icon={<CheckCircle2 />}
            label="Save"
            value={stats.saveToday}
            helper={currency(stats.saveTodayAp)}
            tone="emerald"
            isDarkMode={isDarkMode}
          />
          <StatCard
            icon={<CheckCircle2 />}
            label="UW Action Resolved"
            value={stats.uwActionResolvedToday}
            helper={currency(stats.uwActionResolvedTodayAp)}
            tone="emerald"
            isDarkMode={isDarkMode}
          />
          <StatCard
            icon={<AlertTriangle />}
            label="UW Action Needed"
            value={stats.uwActionNeededToday}
            helper={currency(stats.uwActionNeededTodayAp)}
            tone="amber"
            isDarkMode={isDarkMode}
          />
          <StatCard
            icon={<DollarSign />}
            label="Pending Save AP"
            value={currency(stats.pendingSaveAp)}
            helper="Action: Pending Save"
            tone="amber"
            isDarkMode={isDarkMode}
          />
          <StatCard
            icon={<DollarSign />}
            label="Save AP"
            value={currency(stats.saveAp)}
            helper="Action: Save"
            tone="emerald"
            isDarkMode={isDarkMode}
          />
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-[390px_1fr]">
          <Card className="h-fit self-start rounded-[1.6rem] border border-[#D4C3AD] bg-[#FCF8F2] shadow-md">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="mb-2 inline-flex rounded-2xl border border-[#D4C3AD] bg-[#EFE6D8] p-1">
                    <button
                      type="button"
                      onClick={() => setActiveEntryTab("case")}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
                        activeEntryTab === "case"
                          ? "bg-[#5B3320] text-white"
                          : "text-[#5B3320]"
                      }`}
                    >
                      Add new case
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveEntryTab("eod")}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
                        activeEntryTab === "eod"
                          ? "bg-[#5B3320] text-white"
                          : "text-[#5B3320]"
                      }`}
                    >
                      EOD
                    </button>
                  </div>

                  <h2 className="text-lg font-bold text-[#2B1A12]">
                    {entryTitle}
                  </h2>
                  <p className="text-xs text-[#8A6A55]">{entryHelper}</p>
                </div>
              </div>

              {sheetMessage && (
                <div className="mb-3 rounded-2xl border border-[#D4C3AD] bg-[#F6EEE3] px-3 py-2 text-xs font-medium text-[#5B3320]">
                  {sheetMessage}
                </div>
              )}

              {activeEntryTab === "case" ? (
                <form onSubmit={submitForm} className="space-y-2">
                  <Input
                    label="Client name"
                    value={form.clientName}
                    onChange={(v: any) => updateForm("clientName", v)}
                    required
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="Policy number"
                      value={form.policyNumber}
                      onChange={(v: any) => updateForm("policyNumber", v)}
                    />
                    <Input
                      label="AP"
                      type="number"
                      value={form.ap}
                      onChange={(v: any) => updateForm("ap", v)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      label="Lead status"
                      value={form.leadStatus}
                      onChange={(v: any) => updateForm("leadStatus", v)}
                      options={leadStatusOptions}
                    />
                    <Input
                      label="Agent name"
                      value={form.agentName}
                      onChange={(v: any) => updateForm("agentName", v)}
                    />
                  </div>

                  <Select
                    label="Specialist name"
                    value={form.specialistName}
                    onChange={(v: any) => updateForm("specialistName", v)}
                    options={specialistOptions}
                  />

                  <div className="grid grid-cols-3 gap-2">
                    <Select
                      label="Status"
                      value={form.result}
                      onChange={(v: any) => updateForm("result", v)}
                      options={resultOptions}
                    />
                    <Select
                      label="Priority"
                      value={form.priority}
                      onChange={(v: any) => updateForm("priority", v)}
                      options={priorityOptions}
                    />
                    <Input
                      label="Updated"
                      type="date"
                      value={form.updatedAt}
                      onChange={(v: any) => updateForm("updatedAt", v)}
                    />
                  </div>

                  <Select
                    label="Action"
                    value={form.action}
                    onChange={(v: any) => updateForm("action", v)}
                    options={actionOptions}
                  />

                  <Textarea
                    label="Notes"
                    value={form.notes}
                    onChange={(v: any) => updateForm("notes", v)}
                    placeholder="Callback time, issue, next step..."
                  />

                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <Button
                      type="submit"
                      className="h-11 rounded-2xl bg-[#03071A] text-white hover:bg-[#10142B]"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add case
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetForm}
                      className="h-11 rounded-2xl border-[#D4C3AD] px-4 text-xs text-[#5B3320]"
                    >
                      Clear form
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-[#D4C3AD] bg-[#F6EEE3]">
                  <iframe
                    title="EOD Jotform"
                    src={EOD_JOTFORM_URL}
                    className="h-[720px] w-full bg-white"
                    frameBorder="0"
                    allowFullScreen
                  />
                </div>
              )}

              <div className="mt-4 rounded-[1.4rem] border border-[#D4C3AD] bg-[#F6EEE3] p-4">
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
                        className={`rounded-xl px-3 py-1 text-[10px] font-bold ${
                          reportRange === "week"
                            ? "bg-[#5B3320] text-white"
                            : "text-[#5B3320]"
                        }`}
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
                        className={`rounded-xl px-3 py-1 text-[10px] font-bold ${
                          reportRange === "month"
                            ? "bg-[#5B3320] text-white"
                            : "text-[#5B3320]"
                        }`}
                      >
                        Month to date
                      </button>
                    </div>

                    <h3 className="text-sm font-bold text-[#2B1A12]">
                      {reportStats.label}
                    </h3>

                    <p className="text-[11px] text-[#8A6A55]">
                      {reportStats.startDate} to {reportStats.today}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        onClick={exportReportCsv}
                        className="h-8 rounded-2xl bg-[#03071A] px-3 text-[10px] font-bold text-white hover:bg-[#10142B]"
                      >
                        <Download className="mr-1 h-3.5 w-3.5" /> Export CSV
                      </Button>

                      <span className="rounded-full bg-[#5B3320] px-3 py-1 text-[10px] font-bold text-white">
                        {reportStats.badge}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <input
                        type="date"
                        value={reportStats.startDate}
                        onChange={(e) => setReportStartDate(e.target.value)}
                        className="h-8 rounded-2xl border border-[#D4C3AD] bg-white px-2 text-[11px] text-[#2B1A12] outline-none focus:border-[#5C7768]"
                      />

                      <span className="text-[11px] font-semibold text-[#8A6A55]">
                        to
                      </span>

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
                  <ReportItem
                    label="Pending Save AP"
                    value={currency(reportStats.pendingSaveAp)}
                  />
                  <ReportItem label="Save AP" value={currency(reportStats.saveAp)} />
                </div>
              </div>

              <div className="mt-4 rounded-[1.4rem] border border-[#D4C3AD] bg-[#F6EEE3] p-4">
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-[#2B1A12]">
                  <BarChart3 className="h-4 w-4" /> Agent load
                </h3>

                <div className="max-h-[160px] space-y-2 overflow-y-auto pr-1">
                  {topAgents.map(([agent, count]: any) => {
                    const agentWidth = filteredRows.length
                      ? Math.max(
                          8,
                          Math.round((count / filteredRows.length) * 100)
                        )
                      : 0;

                    return (
                      <div key={agent}>
                        <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                          <span
                            className="truncate font-semibold text-[#5B3320]"
                            title={agent}
                          >
                            {agent}
                          </span>
                          <span className="text-[#8A6A55]">{count}</span>
                        </div>

                        <div className="h-1.5 overflow-hidden rounded-full bg-[#E9DECC]">
                          <div
                            className="h-full rounded-full bg-[#5C7768]"
                            style={{ width: agentWidth + "%" }}
                          />
                        </div>
                      </div>
                    );
                  })}

                  {!topAgents.length && (
                    <p className="text-xs text-[#8A6A55]">No agent data yet.</p>
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-[1.4rem] border border-[#D4C3AD] bg-[#F6EEE3] p-4">
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-[#2B1A12]">
                  <Clock3 className="h-4 w-4" /> Personal Reminders
                </h3>

                <form onSubmit={addReminder} className="space-y-2">
                  <input
                    type="text"
                    value={reminderForm.title}
                    onChange={(e) =>
                      updateReminderForm("title", e.target.value)
                    }
                    placeholder="Reminder title..."
                    className="h-9 w-full rounded-2xl border border-[#D4C3AD] bg-white px-3 text-xs text-[#2B1A12] outline-none focus:border-[#5C7768]"
                  />

                  <input
                    type="datetime-local"
                    value={reminderForm.reminderAt}
                    onChange={(e) =>
                      updateReminderForm("reminderAt", e.target.value)
                    }
                    className="h-9 w-full rounded-2xl border border-[#D4C3AD] bg-white px-3 text-xs text-[#2B1A12] outline-none focus:border-[#5C7768]"
                  />

                  <textarea
                    value={reminderForm.note}
                    onChange={(e) => updateReminderForm("note", e.target.value)}
                    placeholder="Self note / reminder details..."
                    rows={2}
                    className="w-full resize-none rounded-2xl border border-[#D4C3AD] bg-white px-3 py-2 text-xs text-[#2B1A12] outline-none focus:border-[#5C7768]"
                  />

                  <Button
                    type="submit"
                    className="h-9 w-full rounded-2xl bg-[#03071A] text-xs text-white hover:bg-[#10142B]"
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add reminder
                  </Button>
                </form>

                <div className="mt-4 max-h-[220px] space-y-2 overflow-y-auto pr-1">
                  {sortedReminders.map((reminder) => (
                    <div
                      key={reminder.id}
                      className={`rounded-2xl border border-[#D4C3AD] bg-[#FCF8F2] p-3 text-xs ${
                        reminder.isDone ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-[#2B1A12]">
                            {reminder.title}
                          </div>
                          <div className="mt-0.5 text-[11px] text-[#8A6A55]">
                            {new Date(reminder.reminderAt).toLocaleString()}
                          </div>
                        </div>

                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => toggleReminderDone(reminder.id)}
                            className="h-7 w-7 rounded-xl"
                            title="Mark done"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteReminder(reminder.id)}
                            className="h-7 w-7 rounded-xl text-[#B44A2B]"
                            title="Delete reminder"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {reminder.note && (
                        <div className="mt-2 rounded-xl bg-[#F6EEE3] p-2 text-[11px] text-[#5B3320]">
                          {reminder.note}
                        </div>
                      )}
                    </div>
                  ))}

                  {!sortedReminders.length && (
                    <p className="text-xs text-[#8A6A55]">
                      No personal reminders yet.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="h-fit min-w-0 self-start">
            <Card className="h-fit max-h-fit min-w-0 self-start rounded-[1.4rem] border border-[#D4C3AD] bg-[#FCF8F2] shadow-md">
              <CardContent className="p-2.5">
                <div className="grid items-center gap-2 lg:grid-cols-[115px_1fr_105px_105px_110px_110px_112px_112px_64px]">
                  <div>
                    <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#2B1A12]">
                      <Filter className="h-4 w-4" /> Search
                    </h2>

                    <p className="text-[10px] leading-3 text-[#8A6A55]">
                      {lastRefreshed
                        ? `Last refreshed: ${lastRefreshed}`
                        : "Search & filter."}
                    </p>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#B28A6B]" />

                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search client, policy, agent, specialist, notes..."
                      className="h-8 w-full rounded-2xl border border-[#D4C3AD] bg-white pl-9 pr-3 text-xs text-[#2B1A12] outline-none focus:border-[#5C7768]"
                    />
                  </div>

                  <MiniSelect
                    value={resultFilter}
                    onChange={setResultFilter}
                    options={["Status", ...resultOptions]}
                  />
                  <MiniSelect
                    value={priorityFilter}
                    onChange={setPriorityFilter}
                    options={["Priority", ...priorityOptions]}
                  />
                  <MiniSelect
                    value={specialistFilter}
                    onChange={setSpecialistFilter}
                    options={["Specialist", "Nisha", "Rick", "Chen"]}
                  />
                  <MiniSelect
                    value={sortBy}
                    onChange={setSortBy}
                    options={["updatedAt", "ap", "clientName"]}
                  />

                  <input
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="h-8 rounded-2xl border border-[#D4C3AD] bg-white px-2 text-xs text-[#2B1A12] outline-none focus:border-[#5C7768]"
                    title="From date"
                  />

                  <input
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="h-8 rounded-2xl border border-[#D4C3AD] bg-white px-2 text-xs text-[#2B1A12] outline-none focus:border-[#5C7768]"
                    title="To date"
                  />

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                    className="h-8 rounded-2xl px-2 text-xs"
                  >
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="mt-3 grid h-fit content-start items-start gap-3 self-start">
              <Card className="h-fit min-w-0 self-start rounded-[1.6rem] border border-[#D4C3AD] bg-[#FCF8F2] shadow-md">
                <CardContent className="p-0">
                  <div className="w-full overflow-visible rounded-[1.6rem]">
                    <table className="w-full min-w-[920px] table-fixed text-left text-[11px]">
                      <thead className="sticky top-0 z-10 bg-[#F7E8D6] text-[11px] uppercase tracking-wide text-[#8A6A55]">
                        <tr>
                          <th className="w-[14%] px-3 py-3">Client</th>
                          <th className="w-[11%] px-2 py-3">Policy</th>
                          <th className="w-[9%] px-2 py-3">AP</th>
                          <th className="w-[8%] px-2 py-3">Stage</th>
                          <th className="w-[13%] px-2 py-3">Agent</th>
                          <th className="w-[11%] px-2 py-3">Status</th>
                          <th className="w-[24%] px-2 py-3">Action / Notes</th>
                          <th className="w-[10%] px-2 py-3 text-right">
                            Tools
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-[#EEDBC6]">
                        {paginatedRows.map((row) => (
                          <tr
                            key={row.id}
                            className="bg-white align-top hover:bg-[#F6EEE3]"
                          >
                            <td className="break-words px-3 py-3">
                              <div className="font-semibold text-[#2B1A12]">
                                {row.clientName}
                              </div>

                              <div className="mt-1 flex items-center gap-2 text-[11px] text-[#8A6A55]">
                                {row.updatedAt}
                                <span
                                  className={`rounded-full px-2 py-0.5 ${priorityClasses(
                                    row.priority
                                  )}`}
                                >
                                  {row.priority}
                                </span>
                              </div>
                            </td>

                            <td className="break-words px-2 py-3 font-mono text-[10px] text-[#6F4A33]">
                              {row.policyNumber}
                            </td>

                            <td className="break-words px-2 py-3 font-semibold text-[#2B1A12]">
                              {currency(row.ap)}
                            </td>

                            <td className="px-2 py-3">
                              <span className="rounded-full bg-[#F7E8D6] px-1.5 py-0.5 text-[10px] font-semibold text-[#5B3320]">
                                {row.leadStatus || "—"}
                              </span>
                            </td>

                            <td className="break-words px-2 py-3 text-[#5B3320]">
                              {row.agentName || "—"}
                            </td>

                            <td className="px-2 py-3">
                              <span
                                className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${statusClasses(
                                  row.result
                                )}`}
                              >
                                {row.result === "RESOLVED" && (
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                )}
                                {row.result === "PENDING" && (
                                  <Clock3 className="mr-1 h-3 w-3" />
                                )}
                                {row.result === "LOST" && (
                                  <XCircle className="mr-1 h-3 w-3" />
                                )}
                                {row.result}
                              </span>
                            </td>

                            <td className="break-words px-2 py-3">
                              <div className="font-medium text-[#3A2417]">
                                {row.action || "—"}
                              </div>
                              {row.notes && <NotesHover text={row.notes} />}
                            </td>

                            <td className="px-2 py-3">
                              <div className="flex flex-nowrap justify-end gap-0.5">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 rounded-xl"
                                  onClick={() => quickStatus(row.id, "RESOLVED")}
                                  title="Mark resolved"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                </Button>

                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 rounded-xl"
                                  onClick={() => copyClientSummary(row)}
                                  title="Copy summary"
                                >
                                  <FileSpreadsheet className="h-3.5 w-3.5" />
                                </Button>

                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 rounded-xl"
                                  onClick={() => editRow(row)}
                                  title="Edit"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </Button>

                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 rounded-xl text-[#B44A2B] hover:text-[#8F321D]"
                                  onClick={() => deleteRow(row.id)}
                                  title="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {!filteredRows.length && (
                      <div className="flex h-auto flex-col items-center justify-center bg-white px-6 py-3 text-center">
                        <AlertTriangle className="mb-1 h-5 w-5 text-[#F3D9BC]" />
                        <h3 className="text-sm font-bold">No cases found</h3>
                        <p className="mt-0.5 text-xs text-[#8A6A55]">
                          Try changing your search or filters.
                        </p>
                      </div>
                    )}
                  </div>

                  {filteredRows.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#D4C3AD] bg-[#FCF8F2] px-4 py-3 text-xs text-[#5B3320]">
                      <div>
                        Showing {(currentPage - 1) * rowsPerPage + 1} -{" "}
                        {Math.min(currentPage * rowsPerPage, filteredRows.length)}{" "}
                        of {filteredRows.length}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={currentPage === 1}
                          onClick={() =>
                            setCurrentPage((page) => Math.max(1, page - 1))
                          }
                          className="h-8 rounded-2xl border-[#D4C3AD] px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Previous
                        </Button>

                        <span className="rounded-full bg-[#F6EEE3] px-3 py-1 font-semibold">
                          Page {currentPage} of {totalPages}
                        </span>

                        <Button
                          type="button"
                          variant="outline"
                          disabled={currentPage >= totalPages}
                          onClick={() =>
                            setCurrentPage((page) =>
                              Math.min(totalPages, page + 1)
                            )
                          }
                          className="h-8 rounded-2xl border-[#D4C3AD] px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {editModalRow && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[1.8rem] border border-[#D4C3AD] bg-[#FCF8F2] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-[#2B1A12]">
                  Edit client details
                </h2>
                <p className="text-xs text-[#8A6A55]">
                  Update the client information below.
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={closeEditModal}
                className="rounded-xl"
              >
                <X className="mr-1 h-4 w-4" /> Close
              </Button>
            </div>

            <form onSubmit={saveEditModal} className="space-y-3">
              <Input
                label="Client name"
                value={editForm.clientName}
                onChange={(v: any) => updateEditForm("clientName", v)}
                required
              />

              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  label="Policy number"
                  value={editForm.policyNumber}
                  onChange={(v: any) => updateEditForm("policyNumber", v)}
                />
                <Input
                  label="AP"
                  type="number"
                  value={editForm.ap}
                  onChange={(v: any) => updateEditForm("ap", v)}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Select
                  label="Lead status"
                  value={editForm.leadStatus}
                  onChange={(v: any) => updateEditForm("leadStatus", v)}
                  options={leadStatusOptions}
                />
                <Input
                  label="Agent name"
                  value={editForm.agentName}
                  onChange={(v: any) => updateEditForm("agentName", v)}
                />
              </div>

              <Select
                label="Specialist name"
                value={editForm.specialistName}
                onChange={(v: any) => updateEditForm("specialistName", v)}
                options={specialistOptions}
              />

              <div className="grid gap-3 md:grid-cols-3">
                <Select
                  label="Status"
                  value={editForm.result}
                  onChange={(v: any) => updateEditForm("result", v)}
                  options={resultOptions}
                />
                <Select
                  label="Priority"
                  value={editForm.priority}
                  onChange={(v: any) => updateEditForm("priority", v)}
                  options={priorityOptions}
                />
                <Input
                  label="Updated"
                  type="date"
                  value={editForm.updatedAt}
                  onChange={(v: any) => updateEditForm("updatedAt", v)}
                />
              </div>

              <Select
                label="Action"
                value={editForm.action}
                onChange={(v: any) => updateEditForm("action", v)}
                options={actionOptions}
              />

              <Textarea
                label="Notes"
                value={editForm.notes}
                onChange={(v: any) => updateEditForm("notes", v)}
                placeholder="Callback time, issue, next step..."
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeEditModal}
                  className="rounded-2xl border-[#D4C3AD] text-[#5B3320]"
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  className="rounded-2xl bg-[#03071A] text-white hover:bg-[#10142B]"
                >
                  <Save className="mr-2 h-4 w-4" /> Save changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  helper,
  tone = "slate",
  isDarkMode = false,
}: any) {
  const tones: any = {
    slate: "bg-[#5B3320] text-white",
    amber: "bg-[#D8913D] text-white",
    emerald: "bg-[#6F8A3A] text-white",
  };

  return (
    <Card
      className={`rounded-[1.4rem] border shadow-md ${
        isDarkMode
          ? "border-[#31463C] bg-[#FCF8F2]"
          : "border-[#D4C3AD] bg-[#FCF8F2]"
      }`}
    >
      <CardContent className="p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p
              className={
                isDarkMode
                  ? "text-xs font-medium text-[#7C5A45]"
                  : "text-xs font-medium text-[#8A6A55]"
              }
            >
              {label}
            </p>

            <div className="mt-1 text-xl font-bold tracking-tight text-[#2B1A12]">
              {value}
            </div>

            <p
              className={
                isDarkMode
                  ? "mt-0.5 text-xs text-[#7C5A45]"
                  : "mt-0.5 text-xs text-[#8A6A55]"
              }
            >
              {helper}
            </p>
          </div>

          <div className={`rounded-2xl p-2.5 ${tones[tone]}`}>
            {React.cloneElement(icon, { className: "h-4 w-4" })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NotesHover({ text }: any) {
  const [position, setPosition] = useState({ top: 0, left: 0 });

  async function copyNotes() {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error("Failed to copy notes:", error);
    }
  }

  function updatePopupPosition(event: any) {
    const rect = event.currentTarget.getBoundingClientRect();
    const popupWidth = 360;
    const left = Math.min(
      Math.max(12, rect.left),
      window.innerWidth - popupWidth - 12
    );
    const top = Math.max(12, rect.top - 118);
    setPosition({ top, left });
  }

  return (
    <div
      className="group relative mt-1 inline-block overflow-visible"
      onMouseEnter={updatePopupPosition}
    >
      <button
        type="button"
        onMouseEnter={updatePopupPosition}
        onClick={copyNotes}
        className="rounded-full border border-[#D4C3AD] bg-[#F6EEE3] px-2 py-0.5 text-[10px] font-semibold text-[#5B3320] hover:bg-[#E9DECC]"
        title="Hover to view notes. Click to copy."
      >
        Notes
      </button>

      <div
        className="fixed z-[99999] hidden w-[360px] rounded-2xl border border-[#D4C3AD] bg-white p-3 text-[11px] leading-4 text-[#3A2417] shadow-2xl group-hover:block"
        style={{ top: position.top, left: position.left }}
      >
        <div className="mb-1 font-bold text-[#5B3320]">Notes</div>
        <div className="max-h-40 overflow-y-auto whitespace-pre-wrap select-text pr-1">
          {text}
        </div>

        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={copyNotes}
            className="rounded-lg border border-[#D4C3AD] bg-[#F6EEE3] px-2 py-1 text-[10px] font-semibold text-[#5B3320] hover:bg-[#E9DECC]"
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportItem({ label, value }: any) {
  return (
    <div className="rounded-2xl border border-[#D4C3AD] bg-[#FCF8F2] p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[#8A6A55]">
        {label}
      </div>
      <div className="mt-1 text-sm font-bold text-[#2B1A12]">{value}</div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder = "",
}: any) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#8A6A55]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="h-9 w-full rounded-2xl border border-[#D4C3AD] bg-white px-3 text-xs text-[#2B1A12] outline-none focus:border-[#5C7768]"
      />
    </label>
  );
}

function Textarea({ label, value, onChange, placeholder = "" }: any) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#8A6A55]">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full resize-none rounded-2xl border border-[#D4C3AD] bg-white px-3 py-2 text-xs text-[#2B1A12] outline-none focus:border-[#5C7768]"
      />
    </label>
  );
}

function Select({ label, value, onChange, options }: any) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#8A6A55]">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-2xl border border-[#D4C3AD] bg-white px-2 text-xs text-[#2B1A12] outline-none focus:border-[#5C7768]"
      >
        {options.map((option: string, index: number) => (
          <option key={label + "-" + option + "-" + index} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function MiniSelect({ value, onChange, options }: any) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-2xl border border-[#D4C3AD] bg-white px-2 text-xs text-[#2B1A12] outline-none focus:border-[#5C7768]"
    >
      {options.map((option: string) => {
        const optionLabel =
          option === "updatedAt"
            ? "Latest update"
            : option === "clientName"
            ? "Client A-Z"
            : option === "ap"
            ? "Highest AP"
            : option;

        return (
          <option key={option} value={option}>
            {optionLabel}
          </option>
        );
      })}
    </select>
  );
}