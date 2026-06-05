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
  DollarSign,
  Users,
  FileSpreadsheet,
  CalendarDays,
  Moon,
  Sun,
  RefreshCw,
  Save,
  X,
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const STORAGE_KEY = "eterna-retention-tracker-v2";
const INBOUND_CANCELLATION_STORAGE_KEY = "eterna-inbound-cancellations-v2";
const REMINDER_STORAGE_KEY = "eterna-personal-reminders-v2";
const WHATS_NEW_STORAGE_KEY = "eterna-whats-new-v8";
const WHATS_NEW_VERSION = "2026-06-05-full-dark-inbound-search";

const blankInboundCancellationForm = {
  clientName: "",
  phoneNumber: "",
  agentName: "",
  specialistName: "",
  resolved: "No",
  agentInformed: "No",
  notes: "",
};

const blankReminderForm = {
  title: "",
  reminderAt: "",
  note: "",
};

const GOOGLE_SHEET_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxbNbAYvCGjA2oNLjEa_qVi_p4RWxMo9vHm9hXicdHcuIzZIYb_nGzXo9xzVHE_Bfc9/exec";
const GOOGLE_SHEET_VIEW_URL = "https://docs.google.com/spreadsheets/d/1ZTk5rV-4qFQWTxC0VYovD45Y8bHtHDI8dA1tfREge0A/edit?usp=sharing";
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
    specialistName: find("specialist"),
    result: find("status", "result"),
    action: find("action"),
    notes: find("note"),
    priority: find("priority"),
    updatedAt: find("updated", "date"),
  };

  return lines.slice(1).map((line) => {
    const parts = line.split(",").map((p) => p.trim());
    return {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      clientName: parts[indexMap.clientName] || "",
      policyNumber: parts[indexMap.policyNumber] || "",
      ap: parts[indexMap.ap] || "",
      leadStatus: parts[indexMap.leadStatus] || "",
      agentName: parts[indexMap.agentName] || "",
      specialistName: parts[indexMap.specialistName] || "",
      result: parts[indexMap.result] || "PENDING",
      action: parts[indexMap.action] || "",
      notes: parts[indexMap.notes] || "",
      priority: parts[indexMap.priority] || "Normal",
      updatedAt: parts[indexMap.updatedAt] || new Date().toISOString().slice(0, 10),
    };
  });
}

function downloadCsv(filename, rows) {
  const headers = [
    "Client Name",
    "Policy Number",
    "AP",
    "Lead Status",
    "Agent Name",
    "Specialist Name",
    "Status",
    "Action",
    "Notes",
    "Priority",
    "Updated At",
  ];

  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [
    headers.join(","),
    ...rows.map((row) =>
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
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function EternaBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[#EDE5D7]" />
      <div className="absolute -left-24 top-[-120px] h-80 w-80 rounded-full bg-[#5C7768]/25 blur-3xl" />
      <div className="absolute right-[-120px] top-24 h-96 w-96 rounded-full bg-[#D8913D]/20 blur-3xl" />
      <div className="absolute bottom-[-180px] left-1/3 h-[28rem] w-[28rem] rounded-full bg-[#B8896A]/20 blur-3xl" />
      <div className="absolute inset-0 opacity-[0.18]">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="soft-grid" width="42" height="42" patternUnits="userSpaceOnUse">
              <path d="M 42 0 L 0 0 0 42" fill="none" stroke="#BFAE98" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#soft-grid)" />
        </svg>
      </div>
    </div>
  );
}

function EternaDarkBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[#0E1B16]" />
      <div className="absolute -left-24 top-[-120px] h-80 w-80 rounded-full bg-[#5C7768]/20 blur-3xl" />
      <div className="absolute right-[-120px] top-24 h-96 w-96 rounded-full bg-[#D8913D]/10 blur-3xl" />
      <div className="absolute bottom-[-180px] left-1/3 h-[28rem] w-[28rem] rounded-full bg-[#B8896A]/10 blur-3xl" />
      <div className="absolute inset-0 opacity-[0.12]">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="dark-grid" width="42" height="42" patternUnits="userSpaceOnUse">
              <path d="M 42 0 L 0 0 0 42" fill="none" stroke="#C8B58A" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dark-grid)" />
        </svg>
      </div>
    </div>
  );
}

function HeaderDecor() {
  return (
    <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 1200 260">
      <defs>
        <linearGradient id="headerGrad" x1="0" x2="1">
          <stop offset="0%" stopColor="#355F50" />
          <stop offset="45%" stopColor="#7C9A8B" />
          <stop offset="100%" stopColor="#E9DECC" />
        </linearGradient>
      </defs>
      <rect width="1200" height="260" fill="url(#headerGrad)" />
      <path d="M0 40 C180 120 290 -20 460 70 C660 180 790 50 1200 120 L1200 260 L0 260 Z" fill="#F6EEE3" opacity="0.55" />
      <path d="M0 150 C210 80 350 250 560 155 C740 75 920 175 1200 90 L1200 260 L0 260 Z" fill="#5B3320" opacity="0.08" />
      <g fill="none" stroke="#FFFFFF" strokeOpacity="0.45" strokeWidth="3">
        <ellipse cx="1030" cy="70" rx="55" ry="22" transform="rotate(-20 1030 70)" />
        <ellipse cx="1080" cy="120" rx="75" ry="30" transform="rotate(18 1080 120)" />
        <ellipse cx="935" cy="125" rx="46" ry="18" transform="rotate(40 935 125)" />
      </g>
      <g fill="none" stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="2">
        <ellipse cx="80" cy="60" rx="28" ry="40" transform="rotate(45 80 60)" />
        <ellipse cx="68" cy="60" rx="20" ry="26" transform="rotate(-60 68 60)" />
      </g>
    </svg>
  );
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
  const [inboundCancellationForm, setInboundCancellationForm] = useState(blankInboundCancellationForm);
  const [inboundCancellations, setInboundCancellations] = useState(() => {
    try {
      const saved = localStorage.getItem(INBOUND_CANCELLATION_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [editInboundCancellationRow, setEditInboundCancellationRow] = useState(null);
  const [editInboundCancellationForm, setEditInboundCancellationForm] = useState(blankInboundCancellationForm);
  const [inboundSearchQuery, setInboundSearchQuery] = useState("");
  const [inboundResolvedFilter, setInboundResolvedFilter] = useState("All");
  const [inboundAgentInformedFilter, setInboundAgentInformedFilter] = useState("All");
  const [editForm, setEditForm] = useState(blankForm);
  const [editModalRow, setEditModalRow] = useState(null);
  const [editingId, setEditingId] = useState(null);

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

  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isWhatsNewOpen, setIsWhatsNewOpen] = useState(() => {
    try {
      return localStorage.getItem(WHATS_NEW_STORAGE_KEY) !== WHATS_NEW_VERSION;
    } catch {
      return true;
    }
  });

  const [reminders, setReminders] = useState(() => {
    try {
      const saved = localStorage.getItem(REMINDER_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [reminderForm, setReminderForm] = useState(blankReminderForm);
  const [reminderMonth, setReminderMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [isReminderSoundEnabled, setIsReminderSoundEnabled] = useState(false);
  const [alertedReminderIds, setAlertedReminderIds] = useState([]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  }, [rows]);

  useEffect(() => {
    localStorage.setItem(INBOUND_CANCELLATION_STORAGE_KEY, JSON.stringify(inboundCancellations));
  }, [inboundCancellations]);

  useEffect(() => {
    localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(reminders));
  }, [reminders]);

  useEffect(() => {
    function checkReminderSounds() {
      if (!isReminderSoundEnabled) return;

      const now = Date.now();
      const upcomingWindow = now + 5 * 60 * 1000;

      const freshReminders = reminders.filter((reminder) => {
        if (!reminder.reminderAt) return false;
        const time = new Date(reminder.reminderAt).getTime();
        return time >= now && time <= upcomingWindow && !alertedReminderIds.includes(reminder.id);
      });

      if (!freshReminders.length) return;

      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
        gain.gain.setValueAtTime(0.001, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.3, audioContext.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.8);

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.85);
      } catch (error) {
        console.error("Reminder sound failed:", error);
      }

      setAlertedReminderIds((current) => [...current, ...freshReminders.map((r) => r.id)]);

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Eterna reminder", {
          body: freshReminders[0].note || freshReminders[0].title,
        });
      }
    }

    checkReminderSounds();
    const timer = window.setInterval(checkReminderSounds, 30000);
    return () => window.clearInterval(timer);
  }, [reminders, isReminderSoundEnabled, alertedReminderIds]);

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
    const statsRows = specialistFilter === "Specialist"
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

    const todayRows = statsRows.filter((row) => (row.updatedAt || row.createdAt || "") === today);

    const pendingSaveTodayRows = todayRows.filter((row) => String(row.action || "").trim().toLowerCase() === "pending save");
    const saveTodayRows = todayRows.filter((row) => String(row.action || "").trim().toLowerCase() === "save");
    const uwActionResolvedTodayRows = todayRows.filter((row) => String(row.action || "").trim().toLowerCase() === "uw action resolved");
    const uwActionNeededTodayRows = todayRows.filter((row) => String(row.action || "").trim().toLowerCase() === "uw action needed");

    const pendingSaveToday = pendingSaveTodayRows.length;
    const saveToday = saveTodayRows.length;
    const uwActionResolvedToday = uwActionResolvedTodayRows.length;
    const uwActionNeededToday = uwActionNeededTodayRows.length;
    const lost = displayRows.filter((row) => row.result === "LOST" || String(row.action || "").toLowerCase() === "lost").length;

    const pendingSaveTodayAp = pendingSaveTodayRows.reduce((sum, row) => sum + Number(row.ap || 0), 0);
    const saveTodayAp = saveTodayRows.reduce((sum, row) => sum + Number(row.ap || 0), 0);
    const uwActionResolvedTodayAp = uwActionResolvedTodayRows.reduce((sum, row) => sum + Number(row.ap || 0), 0);
    const uwActionNeededTodayAp = uwActionNeededTodayRows.reduce((sum, row) => sum + Number(row.ap || 0), 0);

    const pendingSaveAp = statsRows
      .filter((row) => String(row.action || "").trim().toLowerCase() === "pending save")
      .reduce((sum, row) => sum + Number(row.ap || 0), 0);

    const saveAp = statsRows
      .filter((row) => String(row.action || "").trim().toLowerCase() === "save")
      .reduce((sum, row) => sum + Number(row.ap || 0), 0);

    const completionRate = total ? Math.round((saveToday / total) * 100) : 0;

    return {
      total,
      pendingSaveToday,
      saveToday,
      uwActionResolvedToday,
      uwActionNeededToday,
      lost,
      pendingSaveTodayAp,
      saveTodayAp,
      uwActionResolvedTodayAp,
      uwActionNeededTodayAp,
      pendingSaveAp,
      saveAp,
      completionRate,
      today,
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

        const matchesQuery = !q || searchable.includes(q);
        const matchesResult = resultFilter === "Status" || row.result === resultFilter;
        const matchesPriority = priorityFilter === "Priority" || row.priority === priorityFilter;
        const matchesSpecialist = specialistFilter === "Specialist" || row.specialistName === specialistFilter;

        const rowDate = row.updatedAt || row.createdAt || "";
        const matchesStartDate = !filterStartDate || rowDate >= filterStartDate;
        const matchesEndDate = !filterEndDate || rowDate <= filterEndDate;

        return matchesQuery && matchesResult && matchesPriority && matchesSpecialist && matchesStartDate && matchesEndDate;
      })
      .sort((a, b) => {
        if (sortBy === "ap") return Number(b.ap || 0) - Number(a.ap || 0);
        if (sortBy === "clientName") return a.clientName.localeCompare(b.clientName);
        return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
      });
  }, [rows, query, resultFilter, priorityFilter, specialistFilter, filterStartDate, filterEndDate, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));

  const paginatedRows = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, currentPage, totalPages]);

  const filteredInboundCancellations = useMemo(() => {
    const q = inboundSearchQuery.trim().toLowerCase();

    return inboundCancellations.filter((item) => {
      const searchable = [
        item.clientName,
        item.phoneNumber,
        item.agentName,
        item.specialistName,
        item.resolved,
        item.agentInformed,
        item.notes,
        item.createdAt,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !q || searchable.includes(q);

      const matchesResolved =
        inboundResolvedFilter === "All" || item.resolved === inboundResolvedFilter;

      const matchesAgentInformed =
        inboundAgentInformedFilter === "All" ||
        item.agentInformed === inboundAgentInformedFilter;

      return matchesSearch && matchesResolved && matchesAgentInformed;
    });
  }, [
    inboundCancellations,
    inboundSearchQuery,
    inboundResolvedFilter,
    inboundAgentInformedFilter,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, resultFilter, priorityFilter, specialistFilter, filterStartDate, filterEndDate, sortBy]);

  const topAgents = useMemo(() => {
    const map = new Map();

    filteredRows.forEach((row) => {
      const key = String(row.agentName || "Unassigned").trim() || "Unassigned";
      map.set(key, (map.get(key) || 0) + 1);
    });

    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [filteredRows]);

  const sortedReminders = useMemo(() => {
    return [...reminders].sort((a, b) => String(a.reminderAt).localeCompare(String(b.reminderAt)));
  }, [reminders]);

  const dueReminders = useMemo(() => {
    const now = Date.now();
    const upcoming = now + 5 * 60 * 1000;
    return reminders.filter((reminder) => {
      if (!reminder.reminderAt) return false;
      const time = new Date(reminder.reminderAt).getTime();
      return time >= now && time <= upcoming;
    });
  }, [reminders]);

  const reminderCalendarDays = useMemo(() => {
    const [year, month] = reminderMonth.split("-").map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const start = new Date(firstDay);
    start.setDate(firstDay.getDate() - firstDay.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = date.toISOString().slice(0, 10);
      const dayReminders = reminders.filter((reminder) => String(reminder.reminderAt || "").slice(0, 10) === key);
      return {
        date,
        key,
        isCurrentMonth: date.getMonth() === month - 1,
        reminders: dayReminders,
      };
    });
  }, [reminderMonth, reminders]);

  const report = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let startDate = today;
    let label = "Week-to-Date Report";
    let badge = "WTD";

    if (reportRange === "month") {
      startDate = today.slice(0, 8) + "01";
      label = "Month-to-Date Report";
      badge = "MTD";
    } else {
      const now = new Date();
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diff);
      startDate = monday.toISOString().slice(0, 10);
    }

    const endDate = reportEndDate || today;
    const selectedStartDate = reportStartDate || startDate;

    const reportSourceRows = specialistFilter === "Specialist"
      ? rows
      : rows.filter((row) => row.specialistName === specialistFilter);

    const rangeRows = reportSourceRows.filter((row) => {
      const rowDate = row.updatedAt || row.createdAt || "";
      return rowDate >= selectedStartDate && rowDate <= endDate;
    });

    const totalCases = rangeRows.length;
    const pending = rangeRows.filter((row) => row.result === "PENDING").length;
    const resolved = rangeRows.filter((row) => row.result === "RESOLVED").length;
    const lost = rangeRows.filter((row) => row.result === "LOST").length;

    const pendingSaveAp = rangeRows
      .filter((row) => String(row.action || "").trim().toLowerCase() === "pending save")
      .reduce((sum, row) => sum + Number(row.ap || 0), 0);

    const saveAp = rangeRows
      .filter((row) => String(row.action || "").trim().toLowerCase() === "save")
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

  const entryTitle = activeEntryTab === "case"
    ? (editingId ? "Edit case" : "Add new case")
    : activeEntryTab === "inbound"
      ? "Inbound cancellation"
      : "EOD";

  const entryHelper = activeEntryTab === "case"
    ? "Fast entry for daily tracking."
    : activeEntryTab === "inbound"
      ? "Log inbound cancellation calls and agent updates."
      : "Fill out your EOD Jotform inside the tracker.";

  function closeWhatsNew() {
    try {
      localStorage.setItem(WHATS_NEW_STORAGE_KEY, WHATS_NEW_VERSION);
    } catch {
      // Ignore localStorage errors.
    }
    setIsWhatsNewOpen(false);
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateInboundCancellationForm(field, value) {
    setInboundCancellationForm((current) => ({ ...current, [field]: value }));
  }

  function submitInboundCancellation() {
    const clientName = String(inboundCancellationForm.clientName || "").trim();

    if (!clientName) {
      setSheetMessage("Please enter the client name before saving.");
      setTimeout(() => setSheetMessage(""), 2500);
      return;
    }

    if (!String(inboundCancellationForm.specialistName || "").trim()) {
      setSheetMessage("Please select a specialist before saving inbound cancellation.");
      setTimeout(() => setSheetMessage(""), 2500);
      return;
    }

    const newInboundCancellation = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      clientName,
      phoneNumber: String(inboundCancellationForm.phoneNumber || "").trim(),
      agentName: String(inboundCancellationForm.agentName || "").trim(),
      specialistName: String(inboundCancellationForm.specialistName || "").trim(),
      resolved: inboundCancellationForm.resolved || "No",
      agentInformed: inboundCancellationForm.agentInformed || "No",
      notes: String(inboundCancellationForm.notes || "").trim(),
    };

    setInboundCancellations((current) => [newInboundCancellation, ...current]);
    setInboundCancellationForm(blankInboundCancellationForm);
    setSheetMessage("Inbound cancellation saved to the Inbound Cancellations list. Syncing to Google Sheets...");
    sendInboundCancellationToGoogleSheet(newInboundCancellation);
    setTimeout(() => setSheetMessage(""), 3000);
  }

  function deleteInboundCancellation(id) {
    setInboundCancellations((current) => current.filter((item) => item.id !== id));
  }

  function editInboundCancellation(item) {
    setEditInboundCancellationRow(item);
    setEditInboundCancellationForm({
      clientName: item.clientName || "",
      phoneNumber: item.phoneNumber || "",
      agentName: item.agentName || "",
      specialistName: item.specialistName || "",
      resolved: item.resolved || "No",
      agentInformed: item.agentInformed || "No",
      notes: item.notes || "",
    });
  }

  function updateEditInboundCancellationForm(field, value) {
    setEditInboundCancellationForm((current) => ({ ...current, [field]: value }));
  }

  function closeInboundCancellationEditModal() {
    setEditInboundCancellationRow(null);
    setEditInboundCancellationForm(blankInboundCancellationForm);
  }

  function saveInboundCancellationEditModal(event) {
    event.preventDefault();

    if (!editInboundCancellationRow || !String(editInboundCancellationForm.clientName || "").trim()) {
      return;
    }

    const updatedInboundCancellation = {
      ...editInboundCancellationRow,
      clientName: String(editInboundCancellationForm.clientName || "").trim(),
      phoneNumber: String(editInboundCancellationForm.phoneNumber || "").trim(),
      agentName: String(editInboundCancellationForm.agentName || "").trim(),
      specialistName: String(editInboundCancellationForm.specialistName || "").trim(),
      resolved: editInboundCancellationForm.resolved || "No",
      agentInformed: editInboundCancellationForm.agentInformed || "No",
      notes: String(editInboundCancellationForm.notes || "").trim(),
      updatedAt: new Date().toISOString(),
    };

    setInboundCancellations((current) =>
      current.map((item) =>
        item.id === editInboundCancellationRow.id ? updatedInboundCancellation : item
      )
    );

    updateInboundCancellationInGoogleSheet(editInboundCancellationRow, updatedInboundCancellation);

    setSheetMessage("Inbound cancellation updated. Syncing changes to Google Sheets...");
    setTimeout(() => setSheetMessage(""), 3000);
    closeInboundCancellationEditModal();
  }

  function updateEditForm(field, value) {
    setEditForm((current) => ({ ...current, [field]: value }));
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

  async function sendInboundCancellationToGoogleSheet(data) {
    try {
      const formData = new URLSearchParams();

      formData.append("recordType", "inboundCancellation");
      formData.append("forceSheet", "Inbound Cancellations");
      formData.append("inboundOnly", "true");

      formData.append("createdAt", data.createdAt || "");
      formData.append("clientName", data.clientName || "");
      formData.append("phoneNumber", data.phoneNumber || "");
      formData.append("agentName", data.agentName || "");

      formData.append("inboundSpecialist", data.specialistName || "");
      formData.append("selectedSpecialist", data.specialistName || "");
      formData.append("specialist", data.specialistName || "");
      formData.append("inboundCancellationSpecialist", data.specialistName || "");

      formData.append("resolved", data.resolved || "No");
      formData.append("agentInformed", data.agentInformed || "No");
      formData.append("notes", data.notes || "");

      await fetch(GOOGLE_SHEET_WEB_APP_URL, {
        method: "POST",
        mode: "no-cors",
        body: formData,
      });
    } catch (error) {
      console.error("Inbound cancellation sync failed:", error);
    }
  }

  async function updateInboundCancellationInGoogleSheet(originalData, updatedData) {
    try {
      const formData = new URLSearchParams();

      formData.append("recordType", "updateInboundCancellation");
      formData.append("forceSheet", "Inbound Cancellations");
      formData.append("inboundOnly", "true");

      formData.append("originalCreatedAt", originalData.createdAt || "");
      formData.append("originalClientName", originalData.clientName || "");
      formData.append("originalPhoneNumber", originalData.phoneNumber || "");
      formData.append("originalAgentName", originalData.agentName || "");

      formData.append("createdAt", updatedData.createdAt || originalData.createdAt || "");
      formData.append("clientName", updatedData.clientName || "");
      formData.append("phoneNumber", updatedData.phoneNumber || "");
      formData.append("agentName", updatedData.agentName || "");
      formData.append("inboundSpecialist", updatedData.specialistName || "");
      formData.append("selectedSpecialist", updatedData.specialistName || "");
      formData.append("specialist", updatedData.specialistName || "");
      formData.append("resolved", updatedData.resolved || "No");
      formData.append("agentInformed", updatedData.agentInformed || "No");
      formData.append("notes", updatedData.notes || "");

      await fetch(GOOGLE_SHEET_WEB_APP_URL, {
        method: "POST",
        mode: "no-cors",
        body: formData,
      });
    } catch (error) {
      console.error("Inbound cancellation update failed:", error);
    }
  }

  async function updateGoogleSheetRow(rowId, data) {
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

  async function loadFromGoogleSheet() {
    setIsLoadingSheet(true);
    try {
      const response = await fetch(GOOGLE_SHEET_WEB_APP_URL);
      const data = await response.json();

      if (data?.success && Array.isArray(data.rows)) {
        const normalizedRows = data.rows.map((row) => ({
          id: row.id || crypto.randomUUID(),
          createdAt: row.createdAt || "",
          clientName: row.clientName || "",
          policyNumber: row.policyNumber || "",
          ap: row.ap || "",
          leadStatus: row.leadStatus || "",
          agentName: row.agentName || "",
          result: row.result || "PENDING",
          action: row.action || "",
          notes: row.notes || "",
          priority: row.priority || "Normal",
          updatedAt: row.updatedAt || "",
          specialistName: row.specialistName || "",
        }));

        setRows(normalizedRows);
        setSheetMessage("Data refreshed successfully.");
        setLastRefreshed(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        setTimeout(() => setSheetMessage(""), 3000);
      } else {
        setSheetMessage("Unable to refresh data from Google Sheets.");
        setTimeout(() => setSheetMessage(""), 3000);
      }
    } catch (error) {
      console.error("Google Sheet load failed:", error);
      setSheetMessage("Google Sheet connection failed.");
      setTimeout(() => setSheetMessage(""), 3000);
    } finally {
      setIsLoadingSheet(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!form.clientName.trim()) return;

    const payload = {
      ...form,
      id: editingId || crypto.randomUUID(),
      createdAt: editingId
        ? rows.find((row) => row.id === editingId)?.createdAt || new Date().toISOString()
        : new Date().toISOString(),
    };

    if (editingId) {
      setRows((current) => current.map((row) => (row.id === editingId ? payload : row)));
      updateGoogleSheetRow(editingId, payload);
    } else {
      setRows((current) => [payload, ...current]);
      sendToGoogleSheet(payload);
    }

    setSheetMessage(editingId ? "Case updated. Syncing changes to Google Sheets..." : "Case added. Syncing to Google Sheets...");
    setTimeout(() => setSheetMessage(""), 3000);
    resetForm();
  }

  function editRow(row) {
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

  function saveEditModal(event) {
    event.preventDefault();

    if (!editingId || !editForm.clientName.trim()) return;

    const originalRow = rows.find((row) => row.id === editingId);
    const payload = {
      ...editForm,
      id: editingId,
      createdAt: originalRow?.createdAt || new Date().toISOString(),
    };

    setRows((current) => current.map((row) => (row.id === editingId ? payload : row)));
    updateGoogleSheetRow(editingId, payload);
    setSheetMessage("Case updated. Syncing changes to Google Sheets...");
    setTimeout(() => setSheetMessage(""), 3000);
    closeEditModal();
  }

  function deleteRow(id) {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  function quickStatus(id, status) {
    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              result: status,
              updatedAt: new Date().toISOString().slice(0, 10),
            }
          : row
      )
    );
  }

  function copyClientSummary(row) {
    const summary = [
      `Client: ${row.clientName}`,
      `Policy: ${row.policyNumber}`,
      `AP: ${currency(row.ap)}`,
      `Stage: ${row.leadStatus}`,
      `Agent: ${row.agentName}`,
      `Specialist: ${row.specialistName}`,
      `Status: ${row.result}`,
      `Action: ${row.action}`,
      `Notes: ${row.notes}`,
    ].join("\n");

    navigator.clipboard?.writeText(summary);
  }

  function handleCsvUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const parsedRows = parseCsv(String(reader.result || ""));
      setRows((current) => [...parsedRows, ...current]);
    };
    reader.readAsText(file);
  }

  function exportRangeRows() {
    const start = exportStartDate || filterStartDate;
    const end = exportEndDate || filterEndDate;
    const sourceRows = filteredRows.filter((row) => {
      const rowDate = row.updatedAt || row.createdAt || "";
      const matchesStart = !start || rowDate >= start;
      const matchesEnd = !end || rowDate <= end;
      return matchesStart && matchesEnd;
    });

    downloadCsv("eterna-retention-tracker-export.csv", sourceRows);
  }

  function addReminder(event) {
    event.preventDefault();

    if (!reminderForm.title.trim() || !reminderForm.reminderAt) return;

    const reminder = {
      id: crypto.randomUUID(),
      ...reminderForm,
      createdAt: new Date().toISOString(),
    };

    setReminders((current) => [reminder, ...current]);
    setReminderForm(blankReminderForm);
    setReminderMonth(reminder.reminderAt.slice(0, 7));
  }

  function deleteReminder(id) {
    setReminders((current) => current.filter((reminder) => reminder.id !== id));
    setAlertedReminderIds((current) => current.filter((reminderId) => reminderId !== id));
  }

  async function enableReminderSound() {
    setIsReminderSoundEnabled((current) => !current);

    if ("Notification" in window && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        // Ignore notification permission errors.
      }
    }
  }

  function moveReminderMonth(offset) {
    const [year, month] = reminderMonth.split("-").map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    setReminderMonth(date.toISOString().slice(0, 7));
  }

  const pageStart = filteredRows.length ? (Math.min(currentPage, totalPages) - 1) * rowsPerPage + 1 : 0;
  const pageEnd = Math.min(Math.min(currentPage, totalPages) * rowsPerPage, filteredRows.length);

  const darkPanel = isDarkMode ? "border-[#425549] bg-[#102019] text-[#F6EEE3]" : "border-[#D4C3AD] bg-[#FCF8F2] text-[#2B1A12]";
  const darkSubPanel = isDarkMode ? "border-[#425549] bg-[#13251D] text-[#F6EEE3]" : "border-[#D4C3AD] bg-[#F6EEE3] text-[#2B1A12]";
  const darkText = isDarkMode ? "text-[#F6EEE3]" : "text-[#2B1A12]";
  const darkMuted = isDarkMode ? "text-[#D9C9B4]" : "text-[#8A6A55]";
  const darkInput = isDarkMode ? "border-[#52685B] bg-[#0D1A15] text-[#F6EEE3] placeholder:text-[#BBAA94]" : "border-[#D4C3AD] bg-white text-[#2B1A12] placeholder:text-[#8A6A55]";
  const darkTableHeader = isDarkMode ? "bg-[#162A21] text-[#EAD9C4]" : "bg-[#F7E8D6] text-[#8A6A55]";
  const darkRow = isDarkMode ? "bg-[#0F1F18] hover:bg-[#172A21]" : "bg-white hover:bg-[#F6EEE3]";
  const darkDivider = isDarkMode ? "divide-[#31463C]" : "divide-[#EEDBC6]";

  return (
    <div className={isDarkMode ? "relative min-h-screen overflow-x-hidden bg-[#0E1B16] text-[#F6EEE3]" : "relative min-h-screen overflow-x-hidden bg-[#EDE5D7] text-[#2B1A12]"}>
      {isDarkMode ? <EternaDarkBackground /> : <EternaBackground />}

      <main className="mx-auto max-w-[1440px] px-3 py-4">
        <section className={`relative mb-4 overflow-hidden rounded-[2rem] border shadow-xl ${isDarkMode ? "border-[#425549] bg-[#102019]" : "border-[#D4C3AD] bg-[#F6EEE3]"}`}>
          <div className="absolute inset-0 opacity-90">
            <HeaderDecor />
          </div>
          <div className="relative grid gap-4 p-6 md:grid-cols-[1.3fr_0.7fr] md:p-8">
            <div>
              <div className="mb-3 inline-flex items-center rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs font-semibold text-[#355F50] backdrop-blur">
                <ClipboardList className="mr-2 h-4 w-4" /> Policy tracker app
              </div>
              <h1 className="text-3xl font-black tracking-tight text-[#2E443A] md:text-5xl">
                Eterna Retention Tracker
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-[#4D5D53] md:text-base">
                Track clients, policies, AP, agent assignments, pending saves, welcome calls, onboarding, rewrites, and lost cases.
              </p>
            </div>
            <div className="grid content-end gap-2 text-sm text-[#2E443A]">
              <div className="rounded-2xl bg-white/65 p-3 backdrop-blur">
                <div className="text-xs uppercase tracking-wide text-[#6D6256]">Current view</div>
                <div className="mt-1 font-bold">{specialistFilter === "Specialist" ? "All specialists" : specialistFilter}</div>
              </div>
              <div className="rounded-2xl bg-white/65 p-3 backdrop-blur">
                <div className="text-xs uppercase tracking-wide text-[#6D6256]">Last refreshed</div>
                <div className="mt-1 font-bold">{lastRefreshed || "Not yet"}</div>
              </div>
            </div>
          </div>
        </section>

        <section className={`sticky top-0 z-30 mb-3 rounded-[1.6rem] border p-2 shadow-md backdrop-blur ${isDarkMode ? "border-[#425549] bg-[#102019]/95" : "border-[#D4C3AD] bg-[#EFE6D8]/95"}`}>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={specialistFilter}
              onChange={(event) => setSpecialistFilter(event.target.value)}
              className={`h-10 rounded-2xl border px-3 text-xs outline-none ${darkInput}`}
            >
              <option>Specialist</option>
              <option value="Specialist">All Users</option>
              <option>Nisha</option>
              <option>Rick</option>
              <option>Chen</option>
            </select>

            <Button
              type="button"
              onClick={() => setIsDarkMode((current) => !current)}
              className="h-10 rounded-2xl bg-[#03071A] px-4 text-xs font-bold text-white hover:bg-[#10142B]"
            >
              {isDarkMode ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
              {isDarkMode ? "Light Mode" : "Dark Mode"}
            </Button>

            <input
              type="date"
              value={filterStartDate}
              onChange={(event) => setFilterStartDate(event.target.value)}
              className={`h-10 rounded-2xl border px-3 text-xs outline-none ${darkInput}`}
            />
            <input
              type="date"
              value={filterEndDate}
              onChange={(event) => setFilterEndDate(event.target.value)}
              className={`h-10 rounded-2xl border px-3 text-xs outline-none ${darkInput}`}
            />

            <Button type="button" onClick={exportRangeRows} className="h-10 rounded-2xl bg-[#6F6F6F] px-4 text-xs font-bold text-white hover:bg-[#5F5F5F]">
              <Download className="mr-2 h-4 w-4" /> Export Range
            </Button>

            <Button type="button" onClick={() => setIsReminderOpen(true)} className="ml-auto h-10 rounded-2xl bg-[#5B3320] px-4 text-xs font-bold text-white hover:bg-[#4A2818]">
              {dueReminders.length ? <BellRing className="mr-2 h-4 w-4" /> : <Bell className="mr-2 h-4 w-4" />}
              Reminders
            </Button>

            <Button type="button" onClick={() => setIsSheetOpen(true)} className="h-10 rounded-2xl bg-[#355F50] px-4 text-xs font-bold text-white hover:bg-[#2E443A]">
              <Eye className="mr-2 h-4 w-4" /> View Sheet
            </Button>

            <Button type="button" onClick={loadFromGoogleSheet} disabled={isLoadingSheet} className="h-10 rounded-2xl bg-[#03071A] px-4 text-xs font-bold text-white hover:bg-[#10142B]">
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingSheet ? "animate-spin" : ""}`} />
              Refresh Data
            </Button>
          </div>
        </section>

        <section className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-7">
          <StatCard icon={<Users />} label="Total Cases" value={stats.total} helper={stats.dateLabel} tone="slate" isDarkMode={isDarkMode} />
          <StatCard icon={<Clock3 />} label="Pending Save" value={stats.pendingSaveToday} helper={currency(stats.pendingSaveTodayAp)} tone="amber" isDarkMode={isDarkMode} />
          <StatCard icon={<CheckCircle2 />} label="Save" value={stats.saveToday} helper={currency(stats.saveTodayAp)} tone="emerald" isDarkMode={isDarkMode} />
          <StatCard icon={<CheckCircle2 />} label="UW Action Resolved" value={stats.uwActionResolvedToday} helper={currency(stats.uwActionResolvedTodayAp)} tone="emerald" isDarkMode={isDarkMode} />
          <StatCard icon={<AlertTriangle />} label="UW Action Needed" value={stats.uwActionNeededToday} helper={currency(stats.uwActionNeededTodayAp)} tone="amber" isDarkMode={isDarkMode} />
          <StatCard icon={<DollarSign />} label="Pending Save AP" value={currency(stats.pendingSaveAp)} helper="Action: Pending Save" tone="amber" isDarkMode={isDarkMode} />
          <StatCard icon={<DollarSign />} label="Save AP" value={currency(stats.saveAp)} helper="Action: Save" tone="emerald" isDarkMode={isDarkMode} />
        </section>

        <section className="grid gap-4 lg:grid-cols-[390px_minmax(0,1fr)]">
          <div className={`rounded-[1.8rem] border p-4 shadow-md ${darkPanel}`}>
            <div className={`mb-4 inline-flex rounded-2xl border p-1 ${isDarkMode ? "border-[#52685B] bg-[#0D1A15]" : "border-[#D4C3AD] bg-[#EFE6D8]"}`}>
              <button
                type="button"
                onClick={() => setActiveEntryTab("case")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
                  activeEntryTab === "case"
                    ? "bg-[#5B3320] text-white"
                    : isDarkMode
                      ? "text-[#F6EEE3]"
                      : "text-[#5B3320]"
                }`}
              >
                Add new case
              </button>
              <button
                type="button"
                onClick={() => setActiveEntryTab("inbound")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
                  activeEntryTab === "inbound"
                    ? "bg-[#5B3320] text-white"
                    : isDarkMode
                      ? "text-[#F6EEE3]"
                      : "text-[#5B3320]"
                }`}
              >
                Inbound cancellation
              </button>
              <button
                type="button"
                onClick={() => setActiveEntryTab("eod")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
                  activeEntryTab === "eod"
                    ? "bg-[#5B3320] text-white"
                    : isDarkMode
                      ? "text-[#F6EEE3]"
                      : "text-[#5B3320]"
                }`}
              >
                EOD
              </button>
            </div>

            <h2 className={`text-xl font-black ${darkText}`}>{entryTitle}</h2>
            <p className={`mb-4 text-xs ${darkMuted}`}>{entryHelper}</p>

            {sheetMessage && (
              <div className={`mb-3 rounded-2xl border px-3 py-2 text-xs ${isDarkMode ? "border-[#52685B] bg-[#13251D] text-[#F6EEE3]" : "border-[#D4C3AD] bg-[#F6EEE3] text-[#8A6A55]"}`}>
                {sheetMessage}
              </div>
            )}

            {activeEntryTab === "case" ? (
              <form onSubmit={handleSubmit} className="space-y-3">
                <Input label="Client name" value={form.clientName} onChange={(v) => updateForm("clientName", v)} required isDarkMode={isDarkMode} />
                <div className="grid grid-cols-2 gap-2">
                  <Input label="Policy number" value={form.policyNumber} onChange={(v) => updateForm("policyNumber", v)} isDarkMode={isDarkMode} />
                  <Input label="AP" value={form.ap} onChange={(v) => updateForm("ap", v)} isDarkMode={isDarkMode} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Select label="Lead status" value={form.leadStatus} onChange={(v) => updateForm("leadStatus", v)} options={leadStatusOptions} isDarkMode={isDarkMode} />
                  <Input label="Agent name" value={form.agentName} onChange={(v) => updateForm("agentName", v)} isDarkMode={isDarkMode} />
                </div>
                <Select label="Specialist name" value={form.specialistName} onChange={(v) => updateForm("specialistName", v)} options={specialistOptions} isDarkMode={isDarkMode} />
                <div className="grid grid-cols-3 gap-2">
                  <Select label="Status" value={form.result} onChange={(v) => updateForm("result", v)} options={resultOptions} isDarkMode={isDarkMode} />
                  <Select label="Priority" value={form.priority} onChange={(v) => updateForm("priority", v)} options={priorityOptions} isDarkMode={isDarkMode} />
                  <Input label="Updated" type="date" value={form.updatedAt} onChange={(v) => updateForm("updatedAt", v)} isDarkMode={isDarkMode} />
                </div>
                <Select label="Action" value={form.action} onChange={(v) => updateForm("action", v)} options={actionOptions} isDarkMode={isDarkMode} />
                <Textarea label="Notes" value={form.notes} onChange={(v) => updateForm("notes", v)} placeholder="Callback time, issue, next step..." isDarkMode={isDarkMode} />
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <Button type="submit" className="h-11 rounded-2xl bg-[#03071A] text-white hover:bg-[#10142B]">
                    {editingId ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                    {editingId ? "Save changes" : "Add case"}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm} className={`h-11 rounded-2xl px-4 text-xs ${isDarkMode ? "border-[#52685B] text-[#F6EEE3]" : "border-[#D4C3AD] text-[#5B3320]"}`}>
                    Clear form
                  </Button>
                </div>
              </form>
            ) : activeEntryTab === "inbound" ? (
              <div className="space-y-3">
                <Input label="Client name" value={inboundCancellationForm.clientName} onChange={(v) => updateInboundCancellationForm("clientName", v)} isDarkMode={isDarkMode} />
                <Input label="Phone number" value={inboundCancellationForm.phoneNumber} onChange={(v) => updateInboundCancellationForm("phoneNumber", v)} placeholder="Client phone number" isDarkMode={isDarkMode} />
                <Input label="Agent" value={inboundCancellationForm.agentName} onChange={(v) => updateInboundCancellationForm("agentName", v)} placeholder="Agent name" isDarkMode={isDarkMode} />
                <Select label="Specialist" value={inboundCancellationForm.specialistName} onChange={(v) => updateInboundCancellationForm("specialistName", v)} options={specialistOptions} isDarkMode={isDarkMode} />
                <div className="grid grid-cols-2 gap-2">
                  <Select label="Resolved" value={inboundCancellationForm.resolved} onChange={(v) => updateInboundCancellationForm("resolved", v)} options={["No", "Yes"]} isDarkMode={isDarkMode} />
                  <Select label="Agent informed with updates" value={inboundCancellationForm.agentInformed} onChange={(v) => updateInboundCancellationForm("agentInformed", v)} options={["No", "Yes"]} isDarkMode={isDarkMode} />
                </div>
                <Textarea
                  label="Notes"
                  value={inboundCancellationForm.notes}
                  onChange={(v) => updateInboundCancellationForm("notes", v)}
                  placeholder="Add cancellation details, next steps, or agent update notes..."
                  isDarkMode={isDarkMode}
                />
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <Button type="button" onClick={submitInboundCancellation} className="h-11 rounded-2xl bg-[#03071A] text-white hover:bg-[#10142B]">
                    <Plus className="mr-2 h-4 w-4" /> Save inbound cancellation
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setInboundCancellationForm(blankInboundCancellationForm)}
                    className={`h-11 rounded-2xl px-4 text-xs ${isDarkMode ? "border-[#52685B] text-[#F6EEE3]" : "border-[#D4C3AD] text-[#5B3320]"}`}
                  >
                    Clear
                  </Button>
                </div>
                <div className={`rounded-[1.2rem] border p-3 text-xs ${isDarkMode ? "border-[#52685B] bg-[#13251D] text-[#D9C9B4]" : "border-[#D4C3AD] bg-[#F6EEE3] text-[#8A6A55]"}`}>
                  Saved inbound cancellations will appear in their own list on the right side.
                </div>
              </div>
            ) : (
              <div className={`overflow-hidden rounded-2xl border ${isDarkMode ? "border-[#52685B] bg-[#13251D]" : "border-[#D4C3AD] bg-[#F6EEE3]"}`}>
                <iframe
                  title="EOD Jotform"
                  src={EOD_JOTFORM_URL}
                  className="h-[720px] w-full bg-white"
                  frameBorder="0"
                  allowFullScreen
                />
              </div>
            )}

            <div className={`mt-4 rounded-[1.4rem] border p-4 ${darkSubPanel}`}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className={`mb-2 inline-flex rounded-2xl border p-1 ${isDarkMode ? "border-[#52685B] bg-[#0D1A15]" : "border-[#D4C3AD] bg-[#EFE6D8]"}`}>
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
                          : isDarkMode
                            ? "text-[#F6EEE3]"
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
                          : isDarkMode
                            ? "text-[#F6EEE3]"
                            : "text-[#5B3320]"
                      }`}
                    >
                      Month to date
                    </button>
                  </div>
                  <h3 className={`text-sm font-black ${darkText}`}>{report.label}</h3>
                  <p className={`text-xs ${darkMuted}`}>{report.startDate} to {report.today}</p>
                </div>
                <div className="rounded-full bg-[#5B3320] px-3 py-1 text-xs font-bold text-white">{report.badge}</div>
              </div>

              <div className="mb-3 grid grid-cols-2 gap-2">
                <Input label="From" type="date" value={reportStartDate} onChange={setReportStartDate} isDarkMode={isDarkMode} />
                <Input label="To" type="date" value={reportEndDate} onChange={setReportEndDate} isDarkMode={isDarkMode} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <ReportItem label="Total cases" value={report.totalCases} isDarkMode={isDarkMode} />
                <ReportItem label="Resolved" value={report.resolved} isDarkMode={isDarkMode} />
                <ReportItem label="Pending" value={report.pending} isDarkMode={isDarkMode} />
                <ReportItem label="Lost" value={report.lost} isDarkMode={isDarkMode} />
                <ReportItem label="Pending Save AP" value={currency(report.pendingSaveAp)} isDarkMode={isDarkMode} />
                <ReportItem label="Save AP" value={currency(report.saveAp)} isDarkMode={isDarkMode} />
              </div>

              <div className="mt-4">
                <h3 className={`mb-2 flex items-center gap-2 text-sm font-black ${darkText}`}>
                  <Users className="h-4 w-4" /> Agent load
                </h3>
                <div className="space-y-2">
                  {topAgents.map(([agent, count]) => {
                    const width = Math.max(8, Math.min(100, (count / Math.max(1, topAgents[0]?.[1] || 1)) * 100));
                    return (
                      <div key={agent}>
                        <div className={`mb-1 flex items-center justify-between text-xs ${darkText}`}>
                          <span className="truncate pr-2">{agent}</span>
                          <span>{count}</span>
                        </div>
                        <div className={`h-2 overflow-hidden rounded-full ${isDarkMode ? "bg-[#23382E]" : "bg-[#E9DECC]"}`}>
                          <div className="h-full rounded-full bg-[#5C7768]" style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    );
                  })}

                  {!topAgents.length && <p className={`text-xs ${darkMuted}`}>No agent load data yet.</p>}
                </div>
              </div>
            </div>
          </div>

          <div className="min-w-0 space-y-4">
            {activeEntryTab === "inbound" ? (
              <Card className={`h-fit min-w-0 self-start rounded-[1.6rem] border shadow-md ${darkPanel}`}>
                <CardContent className="p-0">
                  <div className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 ${isDarkMode ? "border-[#425549] bg-[#13251D]" : "border-[#D4C3AD] bg-[#F6EEE3]"}`}>
                    <div>
                      <h2 className={`flex items-center gap-1.5 text-sm font-bold ${darkText}`}>
                        <XCircle className="h-4 w-4" /> Inbound cancellation list
                      </h2>
                      <p className={`text-[10px] leading-3 ${darkMuted}`}>
                        Separate list for inbound cancellation calls only.
                      </p>
                    </div>
                    <div className="rounded-full bg-[#5B3320] px-3 py-1 text-xs font-bold text-white">
                      {filteredInboundCancellations.length} of {inboundCancellations.length} total
                    </div>
                  </div>

                  <div className={`border-b px-4 py-3 ${isDarkMode ? "border-[#425549] bg-[#102019]" : "border-[#D4C3AD] bg-[#FCF8F2]"}`}>
                    <div className="grid gap-2 md:grid-cols-[1fr_150px_190px_auto]">
                      <label className="relative block">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A6A55]" />
                        <input
                          type="text"
                          value={inboundSearchQuery}
                          onChange={(e) => setInboundSearchQuery(e.target.value)}
                          placeholder="Search inbound cancellations..."
                          className={`h-10 w-full rounded-2xl border pl-9 pr-3 text-xs outline-none focus:border-[#5C7768] ${darkInput}`}
                        />
                      </label>

                      <select
                        value={inboundResolvedFilter}
                        onChange={(e) => setInboundResolvedFilter(e.target.value)}
                        className={`h-10 rounded-2xl border px-3 text-xs outline-none focus:border-[#5C7768] ${darkInput}`}
                      >
                        <option value="All">All Resolved</option>
                        <option value="Yes">Resolved: Yes</option>
                        <option value="No">Resolved: No</option>
                      </select>

                      <select
                        value={inboundAgentInformedFilter}
                        onChange={(e) => setInboundAgentInformedFilter(e.target.value)}
                        className={`h-10 rounded-2xl border px-3 text-xs outline-none focus:border-[#5C7768] ${darkInput}`}
                      >
                        <option value="All">All Agent Updates</option>
                        <option value="Yes">Agent informed: Yes</option>
                        <option value="No">Agent informed: No</option>
                      </select>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setInboundSearchQuery("");
                          setInboundResolvedFilter("All");
                          setInboundAgentInformedFilter("All");
                        }}
                        className={`h-10 rounded-2xl px-4 text-xs ${isDarkMode ? "border-[#52685B] text-[#F6EEE3]" : "border-[#D4C3AD] text-[#5B3320]"}`}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>

                  <div className="w-full overflow-x-auto rounded-b-[1.6rem]">
                    <table className="w-full min-w-[1120px] table-fixed text-left text-[11px]">
                      <thead className={darkTableHeader}>
                        <tr>
                          <th className="w-[16%] px-3 py-3">Client</th>
                          <th className="w-[13%] px-2 py-3">Phone</th>
                          <th className="w-[14%] px-2 py-3">Agent</th>
                          <th className="w-[12%] px-2 py-3">Specialist</th>
                          <th className="w-[12%] px-2 py-3">Resolved</th>
                          <th className="w-[14%] px-2 py-3">Agent informed</th>
                          <th className="w-[18%] px-2 py-3">Notes</th>
                          <th className="w-[9%] px-2 py-3">Date</th>
                          <th className="w-[7%] px-2 py-3 text-right">Tools</th>
                        </tr>
                      </thead>

                      <tbody className={`divide-y ${darkDivider}`}>
                        {filteredInboundCancellations.map((item) => (
                          <tr key={item.id} className={`${darkRow} align-top`}>
                            <td className="break-words px-3 py-3">
                              <div className={`font-semibold ${darkText}`}>{item.clientName}</div>
                            </td>
                            <td className={`break-words px-2 py-3 ${isDarkMode ? "text-[#F6EEE3]" : "text-[#5B3320]"}`}>{item.phoneNumber || "—"}</td>
                            <td className={`break-words px-2 py-3 ${isDarkMode ? "text-[#F6EEE3]" : "text-[#5B3320]"}`}>{item.agentName || "—"}</td>
                            <td className={`break-words px-2 py-3 ${isDarkMode ? "text-[#F6EEE3]" : "text-[#5B3320]"}`}>{item.specialistName || "—"}</td>
                            <td className="px-2 py-3">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${item.resolved === "Yes" ? "bg-[#EEF7E8] text-[#4C6B2F]" : "bg-[#FFF1D8] text-[#9A5B12]"}`}>
                                {item.resolved}
                              </span>
                            </td>
                            <td className="px-2 py-3">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${item.agentInformed === "Yes" ? "bg-[#EEF7E8] text-[#4C6B2F]" : "bg-[#FFF1D8] text-[#9A5B12]"}`}>
                                {item.agentInformed}
                              </span>
                            </td>
                            <td className="break-words px-2 py-3">
                              {item.notes ? <NotesHover text={item.notes} /> : <span className={darkMuted}>—</span>}
                            </td>
                            <td className={`break-words px-2 py-3 text-[10px] ${darkMuted}`}>
                              {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "—"}
                            </td>
                            <td className="px-2 py-3">
                              <div className="flex justify-end gap-1">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => editInboundCancellation(item)}
                                  className={`h-7 w-7 rounded-xl ${isDarkMode ? "text-[#D9C9B4] hover:text-white" : "text-[#5C7768] hover:text-[#2E443A]"}`}
                                  title="Edit inbound cancellation"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => deleteInboundCancellation(item.id)}
                                  className="h-7 w-7 rounded-xl text-[#B44A2B] hover:text-[#8F321D]"
                                  title="Delete inbound cancellation"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {!filteredInboundCancellations.length && (
                      <div className={`flex h-auto flex-col items-center justify-center px-6 py-10 text-center ${isDarkMode ? "bg-[#0F1F18]" : "bg-white"}`}>
                        <AlertTriangle className="mb-2 h-6 w-6 text-[#F3D9BC]" />
                        <h3 className={`text-sm font-bold ${darkText}`}>No inbound cancellations found</h3>
                        <p className={`mt-1 text-xs ${darkMuted}`}>Use the form on the left to add one, or clear the search filters.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className={`h-fit max-h-fit min-w-0 self-start rounded-[1.4rem] border shadow-md ${darkPanel}`}>
                  <CardContent className="p-2.5">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <div className="relative min-w-[150px] flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A6A55]" />
                        <input
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                          placeholder="Search client, policy, agent..."
                          className={`h-9 w-full rounded-2xl border pl-9 pr-3 text-xs outline-none ${darkInput}`}
                        />
                      </div>
                      <MiniSelect value={resultFilter} onChange={setResultFilter} options={["Status", ...resultOptions]} isDarkMode={isDarkMode} />
                      <MiniSelect value={priorityFilter} onChange={setPriorityFilter} options={["Priority", ...priorityOptions]} isDarkMode={isDarkMode} />
                      <MiniSelect value={sortBy} onChange={setSortBy} options={["updatedAt", "ap", "clientName"]} isDarkMode={isDarkMode} />
                    </div>

                    <div className={`mb-2 flex items-center justify-between rounded-2xl border px-3 py-2 text-xs ${darkSubPanel}`}>
                      <span>
                        Showing {pageStart} - {pageEnd} of {filteredRows.length}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button type="button" size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} className={`h-8 rounded-xl ${isDarkMode ? "border-[#52685B] text-[#F6EEE3]" : "border-[#D4C3AD] text-[#5B3320]"}`}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span>
                          Page {Math.min(currentPage, totalPages)} / {totalPages}
                        </span>
                        <Button type="button" size="sm" variant="outline" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} className={`h-8 rounded-xl ${isDarkMode ? "border-[#52685B] text-[#F6EEE3]" : "border-[#D4C3AD] text-[#5B3320]"}`}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="max-h-[540px] min-w-0 overflow-auto rounded-[1.4rem] border border-[#D4C3AD]">
                      <table className="w-full min-w-[920px] table-fixed text-left text-[11px]">
                        <thead className={`sticky top-0 z-10 ${darkTableHeader}`}>
                          <tr>
                            <th className="w-[14%] px-3 py-3">Client</th>
                            <th className="w-[11%] px-2 py-3">Policy</th>
                            <th className="w-[9%] px-2 py-3">AP</th>
                            <th className="w-[8%] px-2 py-3">Stage</th>
                            <th className="w-[13%] px-2 py-3">Agent</th>
                            <th className="w-[11%] px-2 py-3">Status</th>
                            <th className="w-[24%] px-2 py-3">Action / Notes</th>
                            <th className="w-[10%] px-2 py-3 text-right">Tools</th>
                          </tr>
                        </thead>
                        <tbody className={`divide-y ${darkDivider}`}>
                          {paginatedRows.map((row) => (
                            <tr key={row.id} className={`${darkRow} align-top`}>
                              <td className="break-words px-3 py-3">
                                <div className={`font-semibold ${darkText}`}>{row.clientName}</div>
                                <div className={`mt-1 flex items-center gap-2 text-[11px] ${darkMuted}`}>
                                  {row.updatedAt}
                                  <span className={`rounded-full px-2 py-0.5 ${priorityClasses(row.priority)}`}>{row.priority}</span>
                                </div>
                              </td>
                              <td className={`break-words px-2 py-3 font-mono text-[10px] ${isDarkMode ? "text-[#D9C9B4]" : "text-[#6F4A33]"}`}>{row.policyNumber}</td>
                              <td className={`break-words px-2 py-3 font-semibold ${darkText}`}>{currency(row.ap)}</td>
                              <td className="px-2 py-3">
                                <span className="rounded-full bg-[#F7E8D6] px-1.5 py-0.5 text-[10px] font-semibold text-[#5B3320]">{row.leadStatus || "—"}</span>
                              </td>
                              <td className={`break-words px-2 py-3 ${isDarkMode ? "text-[#F6EEE3]" : "text-[#5B3320]"}`}>{row.agentName || "—"}</td>
                              <td className="px-2 py-3">
                                <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${statusClasses(row.result)}`}>
                                  {row.result === "RESOLVED" && <CheckCircle2 className="mr-1 h-3 w-3" />}
                                  {row.result === "PENDING" && <Clock3 className="mr-1 h-3 w-3" />}
                                  {row.result === "LOST" && <XCircle className="mr-1 h-3 w-3" />}
                                  {row.result}
                                </span>
                              </td>
                              <td className="break-words px-2 py-3">
                                <div className={`font-medium ${isDarkMode ? "text-[#F6EEE3]" : "text-[#3A2417]"}`}>{row.action || "—"}</div>
                                {row.notes && <NotesHover text={row.notes} />}
                              </td>
                              <td className="px-2 py-3">
                                <div className="flex flex-nowrap justify-end gap-0.5">
                                  <Button size="icon" variant="ghost" className={`h-7 w-7 rounded-xl ${isDarkMode ? "text-[#F6EEE3]" : ""}`} onClick={() => quickStatus(row.id, "RESOLVED")} title="Mark resolved">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className={`h-7 w-7 rounded-xl ${isDarkMode ? "text-[#F6EEE3]" : ""}`} onClick={() => copyClientSummary(row)} title="Copy summary">
                                    <FileSpreadsheet className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className={`h-7 w-7 rounded-xl ${isDarkMode ? "text-[#F6EEE3]" : ""}`} onClick={() => editRow(row)} title="Edit">
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
                        <div className={`flex h-auto flex-col items-center justify-center px-6 py-3 text-center ${isDarkMode ? "bg-[#0F1F18]" : "bg-white"}`}>
                          <AlertTriangle className="mb-1 h-5 w-5 text-[#F3D9BC]" />
                          <h3 className={`text-sm font-bold ${darkText}`}>No cases found</h3>
                          <p className={`mt-0.5 text-xs ${darkMuted}`}>Try changing your search or filters.</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </section>
      </main>

      {isReminderOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 py-6">
          <div className={`max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] border p-5 shadow-2xl ${darkPanel}`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className={`text-2xl font-black ${darkText}`}>Personal Reminders</h2>
                <p className={`text-xs ${darkMuted}`}>Calendar, notes, and sound alerts for your own reminders.</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsReminderOpen(false)} className={`rounded-xl ${darkText}`}>
                <X className="mr-1 h-4 w-4" /> Close
              </Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
              <form onSubmit={addReminder} className={`rounded-[1.5rem] border p-4 ${darkSubPanel}`}>
                <h3 className={`mb-3 text-sm font-bold ${darkText}`}>Add reminder</h3>
                <div className="space-y-3">
                  <Input label="Title" value={reminderForm.title} onChange={(v) => setReminderForm((c) => ({ ...c, title: v }))} isDarkMode={isDarkMode} />
                  <Input label="Date and time" type="datetime-local" value={reminderForm.reminderAt} onChange={(v) => setReminderForm((c) => ({ ...c, reminderAt: v }))} isDarkMode={isDarkMode} />
                  <Textarea label="Notes" value={reminderForm.note} onChange={(v) => setReminderForm((c) => ({ ...c, note: v }))} isDarkMode={isDarkMode} />
                  <Button type="submit" className="w-full rounded-2xl bg-[#03071A] text-white">
                    <Plus className="mr-2 h-4 w-4" /> Add reminder
                  </Button>
                  <Button type="button" variant="outline" onClick={enableReminderSound} className={`w-full rounded-2xl ${isDarkMode ? "border-[#52685B] text-[#F6EEE3]" : "border-[#D4C3AD] text-[#5B3320]"}`}>
                    {isReminderSoundEnabled ? <Volume2 className="mr-2 h-4 w-4" /> : <VolumeX className="mr-2 h-4 w-4" />}
                    {isReminderSoundEnabled ? "Sound On" : "Sound Off"}
                  </Button>
                </div>
              </form>

              <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
                <div className={`rounded-[1.5rem] border p-4 ${darkSubPanel}`}>
                  <div className="mb-3 flex items-center justify-between">
                    <Button type="button" variant="ghost" size="sm" onClick={() => moveReminderMonth(-1)} className={darkText}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <input
                      type="month"
                      value={reminderMonth}
                      onChange={(e) => setReminderMonth(e.target.value)}
                      className={`rounded-xl border px-3 py-2 text-sm font-bold ${darkInput}`}
                    />
                    <Button type="button" variant="ghost" size="sm" onClick={() => moveReminderMonth(1)} className={darkText}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wide text-[#8A6A55]">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                      <div key={day}>{day}</div>
                    ))}
                  </div>

                  <div className="mt-2 grid grid-cols-7 gap-1">
                    {reminderCalendarDays.map((day) => {
                      const hasReminder = day.reminders.length > 0;
                      const isDueSoon = day.reminders.some((reminder) => dueReminders.some((due) => due.id === reminder.id));

                      return (
                        <div
                          key={day.key}
                          className={`min-h-[70px] rounded-xl border p-1 text-xs ${
                            isDarkMode
                              ? "border-[#425549] bg-[#0D1A15]"
                              : "border-[#D4C3AD] bg-white"
                          } ${!day.isCurrentMonth ? "opacity-40" : ""}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={darkText}>{day.date.getDate()}</span>
                            {hasReminder && (
                              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${isDueSoon ? "bg-[#D8913D] text-white" : "bg-[#5C7768] text-white"}`}>
                                {day.reminders.length}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 space-y-1">
                            {day.reminders.slice(0, 2).map((reminder) => (
                              <div key={reminder.id} className="truncate rounded bg-[#5C7768]/20 px-1 py-0.5 text-[9px] text-[#F6EEE3]">
                                {reminder.title}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className={`rounded-[1.5rem] border p-4 ${darkSubPanel}`}>
                  <h3 className={`mb-3 text-sm font-bold ${darkText}`}>Reminder list</h3>
                  <div className="space-y-2">
                    {sortedReminders.map((reminder) => {
                      const isDueSoon = dueReminders.some((due) => due.id === reminder.id);
                      return (
                        <div key={reminder.id} className={`rounded-2xl border p-3 ${isDarkMode ? "border-[#425549] bg-[#0D1A15]" : "border-[#D4C3AD] bg-white"}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className={`text-sm font-bold ${darkText}`}>{reminder.title}</div>
                              <div className={`text-[10px] ${darkMuted}`}>{reminder.reminderAt}</div>
                              {isDueSoon && <div className="mt-1 inline-flex rounded-full bg-[#D8913D] px-2 py-0.5 text-[9px] font-bold text-white">Upcoming soon</div>}
                            </div>
                            <Button type="button" size="icon" variant="ghost" onClick={() => deleteReminder(reminder.id)} className="h-7 w-7 text-[#B44A2B]">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          {reminder.note && <div className={`mt-2 rounded-xl p-2 text-[11px] ${isDarkMode ? "bg-[#13251D] text-[#D9C9B4]" : "bg-white/70 text-[#5B3320]"}`}>{reminder.note}</div>}
                        </div>
                      );
                    })}
                    {!sortedReminders.length && <p className={`text-xs ${darkMuted}`}>No reminders yet.</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isSheetOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 py-6">
          <div className={`max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-[2rem] border shadow-2xl ${darkPanel}`}>
            <div className={`flex items-center justify-between border-b px-5 py-4 ${isDarkMode ? "border-[#425549]" : "border-[#D4C3AD]"}`}>
              <div>
                <h2 className={`text-xl font-black ${darkText}`}>Google Sheet Viewer</h2>
                <p className={`text-xs ${darkMuted}`}>View the connected Google Sheet without leaving the tracker.</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsSheetOpen(false)} className={darkText}>
                <X className="mr-1 h-4 w-4" /> Close
              </Button>
            </div>
            {GOOGLE_SHEET_VIEW_URL ? (
              <iframe title="Google Sheet" src={GOOGLE_SHEET_VIEW_URL} className="h-[720px] w-full bg-white" frameBorder="0" allowFullScreen />
            ) : (
              <div className="flex h-[360px] flex-col items-center justify-center p-8 text-center">
                <ExternalLink className="mb-3 h-8 w-8 text-[#8A6A55]" />
                <h3 className={`text-lg font-bold ${darkText}`}>Google Sheet link not added yet</h3>
                <p className={`mt-2 max-w-lg text-sm ${darkMuted}`}>Add your Google Sheet share link to GOOGLE_SHEET_VIEW_URL inside the tracker code.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {isWhatsNewOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 px-4 py-6">
          <div className={`w-full max-w-xl rounded-[2rem] border p-5 shadow-2xl ${darkPanel}`}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className={`text-2xl font-black ${darkText}`}>What’s New</h2>
                <p className={`text-xs ${darkMuted}`}>Recent tracker updates added for your workflow.</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={closeWhatsNew} className={darkText}>
                <X className="mr-1 h-4 w-4" /> Close
              </Button>
            </div>

            <ul className={`space-y-2 text-sm leading-6 ${darkMuted}`}>
              <li><strong>Full Dark Mode:</strong> Cards, forms, tables, inputs, popups, and text now adjust properly in dark mode.</li>
              <li><strong>Inbound cancellation:</strong> Separate inbound cancellation tab and list added.</li>
              <li><strong>Inbound cancellation search:</strong> Added search and filters for the inbound cancellation list.</li>
              <li><strong>Inbound notes hover:</strong> Added a Notes field for inbound cancellations and a hover Notes button in the inbound list.</li>
              <li><strong>Inbound edit sync:</strong> Editing inbound cancellation records now sends the update back to Google Sheets.</li>
              <li><strong>Reminder calendar:</strong> Added personal reminders with calendar badges.</li>
              <li><strong>Reminder sound:</strong> Sound alerts can notify you for upcoming reminders.</li>
              <li><strong>View Sheet:</strong> Added a Google Sheet viewer button near Refresh Data.</li>
            </ul>

            <Button type="button" onClick={closeWhatsNew} className="mt-5 w-full rounded-2xl bg-[#03071A] text-white">
              Got it
            </Button>
          </div>
        </div>
      )}

      {editInboundCancellationRow && (
        <div className="fixed inset-0 z-[102] flex items-center justify-center bg-black/40 px-4 py-6">
          <div className={`max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[1.8rem] border p-5 shadow-2xl ${darkPanel}`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className={`text-xl font-bold ${darkText}`}>Edit inbound cancellation</h2>
                <p className={`text-xs ${darkMuted}`}>Update the inbound cancellation details below.</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={closeInboundCancellationEditModal} className={`rounded-xl ${darkText}`}>
                <X className="mr-1 h-4 w-4" /> Close
              </Button>
            </div>

            <form onSubmit={saveInboundCancellationEditModal} className="space-y-3">
              <Input
                label="Client name"
                value={editInboundCancellationForm.clientName}
                onChange={(v) => updateEditInboundCancellationForm("clientName", v)}
                required
                isDarkMode={isDarkMode}
              />

              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  label="Phone number"
                  value={editInboundCancellationForm.phoneNumber}
                  onChange={(v) => updateEditInboundCancellationForm("phoneNumber", v)}
                  isDarkMode={isDarkMode}
                />
                <Input
                  label="Agent"
                  value={editInboundCancellationForm.agentName}
                  onChange={(v) => updateEditInboundCancellationForm("agentName", v)}
                  isDarkMode={isDarkMode}
                />
              </div>

              <Select
                label="Specialist"
                value={editInboundCancellationForm.specialistName}
                onChange={(v) => updateEditInboundCancellationForm("specialistName", v)}
                options={["", "Nisha", "Rick", "Chen"]}
                isDarkMode={isDarkMode}
              />

              <div className="grid gap-3 md:grid-cols-2">
                <Select
                  label="Resolved"
                  value={editInboundCancellationForm.resolved}
                  onChange={(v) => updateEditInboundCancellationForm("resolved", v)}
                  options={["No", "Yes"]}
                  isDarkMode={isDarkMode}
                />
                <Select
                  label="Agent informed with updates"
                  value={editInboundCancellationForm.agentInformed}
                  onChange={(v) => updateEditInboundCancellationForm("agentInformed", v)}
                  options={["No", "Yes"]}
                  isDarkMode={isDarkMode}
                />
              </div>

              <Textarea
                label="Notes"
                value={editInboundCancellationForm.notes}
                onChange={(v) => updateEditInboundCancellationForm("notes", v)}
                placeholder="Add cancellation details, next steps, or agent update notes..."
                isDarkMode={isDarkMode}
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={closeInboundCancellationEditModal} className={`rounded-2xl ${isDarkMode ? "border-[#52685B] text-[#F6EEE3]" : "border-[#D4C3AD] text-[#5B3320]"}`}>
                  Cancel
                </Button>
                <Button type="submit" className="rounded-2xl bg-[#03071A] text-white hover:bg-[#10142B]">
                  <Save className="mr-2 h-4 w-4" /> Save changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editModalRow && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 py-6">
          <div className={`max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[1.8rem] border p-5 shadow-2xl ${darkPanel}`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className={`text-xl font-bold ${darkText}`}>Edit client details</h2>
                <p className={`text-xs ${darkMuted}`}>Update the client information below.</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={closeEditModal} className={`rounded-xl ${darkText}`}>
                <X className="mr-1 h-4 w-4" /> Close
              </Button>
            </div>

            <form onSubmit={saveEditModal} className="space-y-3">
              <Input label="Client name" value={editForm.clientName} onChange={(v) => updateEditForm("clientName", v)} required isDarkMode={isDarkMode} />
              <div className="grid gap-3 md:grid-cols-2">
                <Input label="Policy number" value={editForm.policyNumber} onChange={(v) => updateEditForm("policyNumber", v)} isDarkMode={isDarkMode} />
                <Input label="AP" value={editForm.ap} onChange={(v) => updateEditForm("ap", v)} isDarkMode={isDarkMode} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Select label="Lead status" value={editForm.leadStatus} onChange={(v) => updateEditForm("leadStatus", v)} options={leadStatusOptions} isDarkMode={isDarkMode} />
                <Input label="Agent name" value={editForm.agentName} onChange={(v) => updateEditForm("agentName", v)} isDarkMode={isDarkMode} />
              </div>
              <Select label="Specialist name" value={editForm.specialistName} onChange={(v) => updateEditForm("specialistName", v)} options={specialistOptions} isDarkMode={isDarkMode} />
              <div className="grid gap-3 md:grid-cols-3">
                <Select label="Status" value={editForm.result} onChange={(v) => updateEditForm("result", v)} options={resultOptions} isDarkMode={isDarkMode} />
                <Select label="Priority" value={editForm.priority} onChange={(v) => updateEditForm("priority", v)} options={priorityOptions} isDarkMode={isDarkMode} />
                <Input label="Updated" type="date" value={editForm.updatedAt} onChange={(v) => updateEditForm("updatedAt", v)} isDarkMode={isDarkMode} />
              </div>
              <Select label="Action" value={editForm.action} onChange={(v) => updateEditForm("action", v)} options={actionOptions} isDarkMode={isDarkMode} />
              <Textarea label="Notes" value={editForm.notes} onChange={(v) => updateEditForm("notes", v)} placeholder="Callback time, issue, next step..." isDarkMode={isDarkMode} />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={closeEditModal} className={`rounded-2xl ${isDarkMode ? "border-[#52685B] text-[#F6EEE3]" : "border-[#D4C3AD] text-[#5B3320]"}`}>
                  Cancel
                </Button>
                <Button type="submit" className="rounded-2xl bg-[#03071A] text-white hover:bg-[#10142B]">
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

function StatCard({ icon, label, value, helper, tone = "slate", isDarkMode = false }) {
  const toneClasses = {
    slate: "bg-[#5B3320]",
    amber: "bg-[#D8913D]",
    emerald: "bg-[#6F8A3A]",
  };

  return (
    <Card className={`rounded-[1.4rem] border shadow-md ${isDarkMode ? "border-[#425549] bg-[#102019] text-[#F6EEE3]" : "border-[#D4C3AD] bg-[#FCF8F2] text-[#2B1A12]"}`}>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className={`text-xs font-medium ${isDarkMode ? "text-[#D9C9B4]" : "text-[#8A6A55]"}`}>{label}</p>
          <p className={`mt-2 truncate text-2xl font-black ${isDarkMode ? "text-[#F6EEE3]" : "text-[#2B1A12]"}`}>{value}</p>
          <p className={`mt-1 text-xs ${isDarkMode ? "text-[#D9C9B4]" : "text-[#8A6A55]"}`}>{helper}</p>
        </div>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-white ${toneClasses[tone] || toneClasses.slate}`}>
          {React.cloneElement(icon, { className: "h-5 w-5" })}
        </div>
      </CardContent>
    </Card>
  );
}

function ReportItem({ label, value, isDarkMode = false }) {
  return (
    <div className={`rounded-2xl border p-3 ${isDarkMode ? "border-[#425549] bg-[#0D1A15]" : "border-[#D4C3AD] bg-[#FCF8F2]"}`}>
      <div className={`text-[10px] font-semibold uppercase tracking-wide ${isDarkMode ? "text-[#D9C9B4]" : "text-[#8A6A55]"}`}>{label}</div>
      <div className={`mt-1 text-sm font-bold ${isDarkMode ? "text-[#F6EEE3]" : "text-[#2B1A12]"}`}>{value}</div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", required = false, placeholder = "", isDarkMode = false }) {
  return (
    <label className="block">
      <span className={`mb-1 block text-[10px] font-semibold uppercase tracking-wide ${isDarkMode ? "text-[#D9C9B4]" : "text-[#8A6A55]"}`}>{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`h-9 w-full rounded-2xl border px-3 text-xs outline-none focus:border-[#5C7768] ${
          isDarkMode
            ? "border-[#52685B] bg-[#0D1A15] text-[#F6EEE3] placeholder:text-[#BBAA94]"
            : "border-[#D4C3AD] bg-white text-[#2B1A12] placeholder:text-[#8A6A55]"
        }`}
      />
    </label>
  );
}

function Textarea({ label, value, onChange, placeholder = "", isDarkMode = false }) {
  return (
    <label className="block">
      <span className={`mb-1 block text-[10px] font-semibold uppercase tracking-wide ${isDarkMode ? "text-[#D9C9B4]" : "text-[#8A6A55]"}`}>{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={2}
        className={`w-full resize-none rounded-2xl border px-3 py-2 text-xs outline-none focus:border-[#5C7768] ${
          isDarkMode
            ? "border-[#52685B] bg-[#0D1A15] text-[#F6EEE3] placeholder:text-[#BBAA94]"
            : "border-[#D4C3AD] bg-white text-[#2B1A12] placeholder:text-[#8A6A55]"
        }`}
      />
    </label>
  );
}

function Select({ label, value, onChange, options, isDarkMode = false }) {
  return (
    <label className="block">
      <span className={`mb-1 block text-[10px] font-semibold uppercase tracking-wide ${isDarkMode ? "text-[#D9C9B4]" : "text-[#8A6A55]"}`}>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`h-9 w-full rounded-2xl border px-2 text-xs outline-none focus:border-[#5C7768] ${
          isDarkMode
            ? "border-[#52685B] bg-[#0D1A15] text-[#F6EEE3]"
            : "border-[#D4C3AD] bg-white text-[#2B1A12]"
        }`}
      >
        {options.map((option, index) => (
          <option key={label + "-" + option + "-" + index} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function MiniSelect({ value, onChange, options, isDarkMode = false }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`h-8 rounded-2xl border px-2 text-xs outline-none focus:border-[#5C7768] ${
        isDarkMode
          ? "border-[#52685B] bg-[#0D1A15] text-[#F6EEE3]"
          : "border-[#D4C3AD] bg-white text-[#2B1A12]"
      }`}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function NotesHover({ text }) {
  const [position, setPosition] = React.useState({ top: 0, left: 0 });

  async function copyNotes() {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error("Failed to copy notes:", error);
    }
  }

  function updatePopupPosition(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const popupWidth = 360;
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - popupWidth - 12);
    const top = Math.max(12, rect.top - 118);
    setPosition({ top, left });
  }

  return (
    <div className="group relative mt-1 inline-block overflow-visible" onMouseEnter={updatePopupPosition}>
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
        <div className="max-h-40 overflow-y-auto whitespace-pre-wrap select-text pr-1">{text}</div>
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