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
  RefreshCw,
  Loader2,
  Moon,
  Sun,
  Bell,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const STORAGE_KEY = "chen-policy-tracker-v1";
const WHATS_NEW_STORAGE_KEY = "eterna-whats-new-seen-v1";
const WHATS_NEW_VERSION = "2026-06-05-full-dark-mode-inbound-edit";
const REMINDER_STORAGE_KEY = "eterna-personal-reminders-v1";
const REMINDER_SOUND_STORAGE_KEY = "eterna-reminder-sound-enabled-v1";
const REMINDER_ALERTED_STORAGE_KEY = "eterna-reminder-alerted-ids-v1";
const INBOUND_CANCELLATION_STORAGE_KEY = "eterna-inbound-cancellations-v1";
const EOD_TEST_STORAGE_KEY = "eterna-eod-test-entries-v1";

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

const blankEodTestForm = {
  specialistName: "",
  date: new Date().toISOString().slice(0, 10),
  totalDials: "",
  totalTalkTime: "",
  clientsReached: "",
  welcomeCallsCompleted: "",
  atRiskResolvedPre: "",
  atRiskResolvedConfirmed: "",
  apSavedPre: "",
  apSavedConfirmed: "",
  uwPoliciesResolved: "",
  pendingResolution: "",
  savedPendingConfirmation: "",
  savedConfirmed: "",
  uwResolvedNotConfirmedDetails: "",
  uwConfirmedResolvedDetails: "",
  escalationsAgentActionNeeded: "",
};

const GOOGLE_SHEET_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxbNbAYvCGjA2oNLjEa_qVi_p4RWxMo9vHm9hXicdHcuIzZIYb_nGzXo9xzVHE_Bfc9/exec";
// Paste your Google Sheet share/edit link here to view the live sheet inside the tracker.
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
const specialistOptions = ["", "Nisha", "Rick", "Chen", "Fernando", "Angie"];
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

function EternaLogoMark({ className = "h-12 w-12" }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Eterna logo"
    >
      <g stroke="#6E8578" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="50" cy="28" rx="20" ry="26" />
        <ellipse cx="32" cy="60" rx="20" ry="26" transform="rotate(60 32 60)" />
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

  const [eodTestForm, setEodTestForm] = useState(blankEodTestForm);
  const [eodTestEntries, setEodTestEntries] = useState(() => {
    try {
      const saved = localStorage.getItem(EOD_TEST_STORAGE_KEY);
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
  const [reminderCalendarMonth, setReminderCalendarMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [isReminderSoundEnabled, setIsReminderSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem(REMINDER_SOUND_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [alertedReminderIds, setAlertedReminderIds] = useState(() => {
    try {
      const saved = localStorage.getItem(REMINDER_ALERTED_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  }, [rows]);

  useEffect(() => {
    localStorage.setItem(INBOUND_CANCELLATION_STORAGE_KEY, JSON.stringify(inboundCancellations));
  }, [inboundCancellations]);

  useEffect(() => {
    localStorage.setItem(EOD_TEST_STORAGE_KEY, JSON.stringify(eodTestEntries));
  }, [eodTestEntries]);

  useEffect(() => {
    localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(reminders));
  }, [reminders]);

  useEffect(() => {
    localStorage.setItem(REMINDER_SOUND_STORAGE_KEY, String(isReminderSoundEnabled));
  }, [isReminderSoundEnabled]);

  useEffect(() => {
    localStorage.setItem(REMINDER_ALERTED_STORAGE_KEY, JSON.stringify(alertedReminderIds));
  }, [alertedReminderIds]);

  useEffect(() => {
    if (!isReminderSoundEnabled) return;

    function checkReminderSounds() {
      const now = Date.now();
      const upcomingWindow = 5 * 60 * 1000;

      const upcomingReminders = reminders.filter((reminder) => {
        if (reminder.isDone || !reminder.reminderAt) return false;
        const reminderTime = new Date(reminder.reminderAt).getTime();
        return reminderTime >= now - 60 * 1000 && reminderTime <= now + upcomingWindow;
      });

      const freshReminders = upcomingReminders.filter((reminder) => !alertedReminderIds.includes(reminder.id));

      if (freshReminders.length) {
        playReminderSound();
        setAlertedReminderIds((current) => [...new Set([...current, ...freshReminders.map((reminder) => reminder.id)])]);
        setSheetMessage(`Reminder coming up: ${freshReminders[0].title}`);
        setTimeout(() => setSheetMessage(""), 5000);

        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Eterna reminder", {
            body: freshReminders[0].note || freshReminders[0].title,
          });
        }
      }
    }

    checkReminderSounds();
    const timer = window.setInterval(checkReminderSounds, 30000);
    return () => window.clearInterval(timer);
  }, [reminders, isReminderSoundEnabled, alertedReminderIds]);

  useEffect(() => {
    loadFromGoogleSheet();
  }, []);

  useEffect(() => {
    if (activeEntryTab === "eodTest") {
      loadFromGoogleSheet();
    }
  }, [activeEntryTab]);

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

    const pendingSaveRows = dateRows.filter((r) => String(r.action || "").trim().toLowerCase() === "pending save");
    const saveRows = dateRows.filter((r) => String(r.action || "").trim().toLowerCase() === "save");
    const uwActionResolvedRows = dateRows.filter((r) => String(r.action || "").trim().toLowerCase() === "uw action resolved");
    const uwActionNeededRows = dateRows.filter((r) => String(r.action || "").trim().toLowerCase() === "uw action needed");

    const lost = displayRows.filter((r) => r.result === "LOST").length;
    const pendingSaveToday = pendingSaveRows.length;
    const saveToday = saveRows.length;
    const uwActionResolvedToday = uwActionResolvedRows.length;
    const uwActionNeededToday = uwActionNeededRows.length;
    const pendingSaveTodayAp = pendingSaveRows.reduce((sum, r) => sum + Number(r.ap || 0), 0);
    const saveTodayAp = saveRows.reduce((sum, r) => sum + Number(r.ap || 0), 0);
    const uwActionResolvedTodayAp = uwActionResolvedRows.reduce((sum, r) => sum + Number(r.ap || 0), 0);
    const uwActionNeededTodayAp = uwActionNeededRows.reduce((sum, r) => sum + Number(r.ap || 0), 0);

    const pendingSaveAp = displayRows
      .filter((r) => String(r.action || "").trim().toLowerCase() === "pending save")
      .reduce((sum, r) => sum + Number(r.ap || 0), 0);
    const saveAp = displayRows
      .filter((r) => String(r.action || "").trim().toLowerCase() === "save")
      .reduce((sum, r) => sum + Number(r.ap || 0), 0);

    const completionRate = total ? Math.round((saveToday / total) * 100) : 0;
    const dateLabel = hasDateFilter ? `${rangeStart} to ${rangeEnd}` : today;

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
      dateLabel,
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
        inboundAgentInformedFilter === "All" || item.agentInformed === inboundAgentInformedFilter;

      return matchesSearch && matchesResolved && matchesAgentInformed;
    });
  }, [inboundCancellations, inboundSearchQuery, inboundResolvedFilter, inboundAgentInformedFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, resultFilter, priorityFilter, specialistFilter, filterStartDate, filterEndDate, sortBy]);

  const topAgents = useMemo(() => {
    const map = new Map();

    filteredRows.forEach((row) => {
      const key = String(row.agentName || "Unassigned").trim() || "Unassigned";
      map.set(key, (map.get(key) || 0) + 1);
    });

    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [filteredRows]);

  const sortedReminders = useMemo(() => {
    return [...reminders].sort((a, b) => String(a.reminderAt).localeCompare(String(b.reminderAt)));
  }, [reminders]);

  const dueReminders = useMemo(() => {
    return reminders.filter((reminder) => {
      if (reminder.isDone || !reminder.reminderAt) return false;
      return new Date(reminder.reminderAt).getTime() <= Date.now();
    });
  }, [reminders]);

  const reminderCalendarMap = useMemo(() => {
    const map = new Map();

    reminders.forEach((reminder) => {
      if (!reminder.reminderAt) return;
      const dateKey = String(reminder.reminderAt).slice(0, 10);
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey).push(reminder);
    });

    return map;
  }, [reminders]);

  const reminderCalendarDays = useMemo(() => {
    const [year, month] = reminderCalendarMonth.split("-").map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const leadingBlanks = firstDay.getDay();
    const days = [];

    for (let i = 0; i < leadingBlanks; i++) {
      days.push({ blank: true, key: "blank-" + i });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayReminders = reminderCalendarMap.get(dateKey) || [];
      const hasDueReminder = dayReminders.some((reminder) => {
        if (reminder.isDone || !reminder.reminderAt) return false;
        return new Date(reminder.reminderAt).getTime() <= Date.now();
      });

      days.push({
        blank: false,
        key: dateKey,
        day,
        dateKey,
        reminders: dayReminders,
        hasDueReminder,
      });
    }

    return days;
  }, [reminderCalendarMonth, reminderCalendarMap]);

  const reminderCalendarTitle = useMemo(() => {
    const [year, month] = reminderCalendarMonth.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleString("en-US", {
      month: "long",
      year: "numeric",
    });
  }, [reminderCalendarMonth]);

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

    return { startDate: selectedStartDate, today: endDate, totalCases, pending, resolved, lost, pendingSaveAp, saveAp, label, badge };
  }, [rows, specialistFilter, reportRange, reportStartDate, reportEndDate]);

  const entryTitle = activeEntryTab === "case"
    ? (editingId ? "Edit case" : "Add new case")
    : activeEntryTab === "inbound"
      ? "Inbound cancellation"
      : activeEntryTab === "eodTest"
        ? "EOD Test"
        : "EOD";

  const entryHelper = activeEntryTab === "case"
    ? "Fast entry for daily tracking."
    : activeEntryTab === "inbound"
      ? "Log inbound cancellation calls and agent updates."
      : activeEntryTab === "eodTest"
        ? "Fill out the daily EOD test form."
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

  function updateEodTestForm(field, value) {
    setEodTestForm((current) => ({ ...current, [field]: value }));
  }

  function submitEodTestForm(event) {
    event.preventDefault();

    if (!String(eodTestForm.specialistName || "").trim()) {
      setSheetMessage("Please select a specialist before saving EOD Test.");
      setTimeout(() => setSheetMessage(""), 3000);
      return;
    }

    if (!String(eodTestForm.date || "").trim()) {
      setSheetMessage("Please select a date before saving EOD Test.");
      setTimeout(() => setSheetMessage(""), 3000);
      return;
    }

    const newEodTestEntry = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...eodTestForm,
    };

    setEodTestEntries((current) => [newEodTestEntry, ...current]);
    setEodTestForm({
      ...blankEodTestForm,
      specialistName: eodTestForm.specialistName || "",
      date: new Date().toISOString().slice(0, 10),
    });

    setSheetMessage("EOD Test saved. Syncing shared list so everyone can see it.");
    sendEodTestToGoogleSheet(newEodTestEntry);
    setTimeout(() => {
      loadFromGoogleSheet();
    }, 2500);
    setTimeout(() => setSheetMessage(""), 6000);
  }

  function deleteEodTestEntry(id) {
    setEodTestEntries((current) => current.filter((entry) => entry.id !== id));
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
    setTimeout(() => {
      loadFromGoogleSheet();
    }, 1200);
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
    setTimeout(() => {
      loadFromGoogleSheet();
    }, 1200);
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

      // HARD route: this is NOT a normal client/case record.
      // Google Apps Script must put this ONLY in the Inbound Cancellations sheet.
      formData.append("recordType", "inboundCancellation");
      formData.append("forceSheet", "Inbound Cancellations");
      formData.append("inboundOnly", "true");

      formData.append("createdAt", data.createdAt || "");
      formData.append("clientName", data.clientName || "");
      formData.append("phoneNumber", data.phoneNumber || "");
      formData.append("agentName", data.agentName || "");

      // Send the specialist under inbound-specific names only.
      // Do NOT send specialistName here, because specialistName is used by normal cases.
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

      // Match fields help Apps Script find the original row.
      formData.append("originalCreatedAt", originalData.createdAt || "");
      formData.append("originalClientName", originalData.clientName || "");
      formData.append("originalPhoneNumber", originalData.phoneNumber || "");
      formData.append("originalAgentName", originalData.agentName || "");

      // Updated values.
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

  async function sendEodTestToGoogleSheet(data) {
    try {
      const formData = new URLSearchParams();

      formData.append("recordType", "eodTest");
      formData.append("forceSheet", "EOD Test");

      Object.entries(data).forEach(([key, value]) => {
        formData.append(key, value ?? "");
      });

      await fetch(GOOGLE_SHEET_WEB_APP_URL, {
        method: "POST",
        mode: "no-cors",
        body: formData,
      });
    } catch (error) {
      console.error("EOD Test sync failed:", error);
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

  function isRealTrackerRow(row) {
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
    if (!specialistName || !["Nisha", "Rick", "Chen", "Fernando", "Angie", "Unassigned"].includes(specialistName)) return false;

    const hasValidDate = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(createdAt) || /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(updatedAt);
    if (!hasValidDate) return false;

    return true;
  }

  function dedupeTrackerRows(sourceRows) {
    const map = new Map();

    sourceRows.forEach((row) => {
      const policyNumber = String(row.policyNumber || "").trim().toLowerCase();
      const clientName = String(row.clientName || "").trim().toLowerCase();
      const specialistName = String(row.specialistName || "").trim().toLowerCase();
      const ap = String(row.ap || "").trim();

      const key = policyNumber
        ? `policy:${policyNumber}`
        : `client:${clientName}|specialist:${specialistName}|ap:${ap}`;

      const existing = map.get(key);

      if (!existing) {
        map.set(key, row);
        return;
      }

      const existingDate = String(existing.updatedAt || existing.createdAt || "");
      const rowDate = String(row.updatedAt || row.createdAt || "");

      if (rowDate >= existingDate) {
        map.set(key, row);
      }
    });

    return Array.from(map.values());
  }


  async function loadFromGoogleSheet() {
    setIsLoadingSheet(true);
    setSheetMessage("Refreshing data...");

    try {
      const response = await fetch(GOOGLE_SHEET_WEB_APP_URL);
      const data = await response.json();

      if (data.success && Array.isArray(data.rows)) {
        const cleanRows = dedupeTrackerRows(data.rows.filter(isRealTrackerRow));
        setRows(cleanRows);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanRows));

        if (Array.isArray(data.inboundCancellations)) {
          const cleanInboundCancellations = data.inboundCancellations.map((item) => ({
            id: item.id || crypto.randomUUID(),
            createdAt: item.createdAt || "",
            clientName: item.clientName || "",
            phoneNumber: item.phoneNumber || "",
            agentName: item.agentName || "",
            specialistName: item.specialistName || "",
            resolved: item.resolved || "No",
            agentInformed: item.agentInformed || "No",
            notes: item.notes || "",
          }));

          setInboundCancellations(cleanInboundCancellations);
          localStorage.setItem(INBOUND_CANCELLATION_STORAGE_KEY, JSON.stringify(cleanInboundCancellations));
        }

        if (Array.isArray(data.eodTestEntries)) {
          const cleanEodTestEntries = data.eodTestEntries.map((entry) => ({
            id: entry.id || crypto.randomUUID(),
            createdAt: entry.createdAt || "",
            specialistName: entry.specialistName || "",
            date: entry.date || "",
            totalDials: entry.totalDials || "",
            totalTalkTime: entry.totalTalkTime || "",
            clientsReached: entry.clientsReached || "",
            welcomeCallsCompleted: entry.welcomeCallsCompleted || "",
            atRiskResolvedPre: entry.atRiskResolvedPre || "",
            atRiskResolvedConfirmed: entry.atRiskResolvedConfirmed || "",
            apSavedPre: entry.apSavedPre || "",
            apSavedConfirmed: entry.apSavedConfirmed || "",
            uwPoliciesResolved: entry.uwPoliciesResolved || "",
            pendingResolution: entry.pendingResolution || "",
            savedPendingConfirmation: entry.savedPendingConfirmation || "",
            savedConfirmed: entry.savedConfirmed || "",
            uwResolvedNotConfirmedDetails: entry.uwResolvedNotConfirmedDetails || "",
            uwConfirmedResolvedDetails: entry.uwConfirmedResolvedDetails || "",
            escalationsAgentActionNeeded: entry.escalationsAgentActionNeeded || "",
          }));

          setEodTestEntries((current) => {
            const mergedMap = new Map();

            [...cleanEodTestEntries, ...current].forEach((entry) => {
              const key = [
                entry.id,
                entry.date,
                entry.specialistName,
                entry.totalDials,
                entry.totalTalkTime,
                entry.clientsReached,
                entry.welcomeCallsCompleted,
              ].join("|");

              if (!mergedMap.has(key)) {
                mergedMap.set(key, entry);
              }
            });

            const mergedEntries = Array.from(mergedMap.values()).sort((a, b) => {
              return String(b.date || b.createdAt || "").localeCompare(String(a.date || a.createdAt || ""));
            });

            localStorage.setItem(EOD_TEST_STORAGE_KEY, JSON.stringify(mergedEntries));
            return mergedEntries;
          });
        }

        setLastRefreshed(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
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

  function submitForm(event) {
    event.preventDefault();
    if (!form.clientName.trim()) return;

    const policyNumberInput = form.policyNumber.trim().toLowerCase();
    const duplicatePolicy = policyNumberInput && rows.some((row) => {
      if (editingId && row.id === editingId) return false;
      return String(row.policyNumber || "").trim().toLowerCase() === policyNumberInput;
    });

    if (duplicatePolicy) {
      const shouldContinue = window.confirm("This policy number already exists. Continue anyway?");
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

    if (editingId) {
      setRows((current) => current.map((row) => (row.id === editingId ? { ...row, ...payload } : row)));
    } else {
      const newCase = { id: crypto.randomUUID(), createdAt: new Date().toISOString().slice(0, 10), ...payload };
      setRows((current) => [newCase, ...current]);
      setSheetMessage("Case added successfully. Syncing to Google Sheets...");
      sendToGoogleSheet(newCase);
    }
    setTimeout(() => setSheetMessage(""), 4000);
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

    setRows((current) => current.map((row) => (row.id === editModalRow.id ? { ...row, ...payload } : row)));
    updateGoogleSheetRow(editModalRow.id, payload);
    setSheetMessage("Client details updated. Syncing update to Google Sheets...");
    setTimeout(() => setSheetMessage(""), 2500);
    closeEditModal();
  }

  async function deleteGoogleSheetRow(row) {
    try {
      const formData = new URLSearchParams();

      formData.append("recordType", "delete");
      formData.append("rowId", row.id || "");
      formData.append("clientName", row.clientName || "");
      formData.append("policyNumber", row.policyNumber || "");
      formData.append("specialistName", row.specialistName || "");
      formData.append("agentName", row.agentName || "");

      await fetch(GOOGLE_SHEET_WEB_APP_URL, {
        method: "POST",
        mode: "no-cors",
        body: formData,
      });
    } catch (error) {
      console.error("Google Sheet delete failed:", error);
    }
  }

  function deleteRow(rowOrId) {
    const row = typeof rowOrId === "object" ? rowOrId : rows.find((item) => item.id === rowOrId);
    const rowId = typeof rowOrId === "object" ? rowOrId.id : rowOrId;

    setRows((current) => current.filter((item) => item.id !== rowId));

    if (row) {
      setSheetMessage("Case deleted. Removing it from Google Sheets...");
      deleteGoogleSheetRow(row);
      setTimeout(() => {
        loadFromGoogleSheet();
      }, 1200);
      setTimeout(() => setSheetMessage(""), 4000);
    }
  }

  function quickStatus(id, result) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, result, updatedAt: new Date().toISOString().slice(0, 10) } : row))
    );
  }

  async function copyClientSummary(row) {
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
    ].join(String.fromCharCode(10));

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

  function playReminderSound() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(740, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime + 0.15);

      gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.25, audioContext.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.45);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.45);
    } catch (error) {
      console.error("Reminder sound failed:", error);
    }
  }

  async function toggleReminderSound() {
    const nextValue = !isReminderSoundEnabled;
    setIsReminderSoundEnabled(nextValue);

    if (nextValue) {
      playReminderSound();
      if ("Notification" in window && Notification.permission === "default") {
        try {
          await Notification.requestPermission();
        } catch (error) {
          console.error("Notification permission request failed:", error);
        }
      }
      setSheetMessage("Reminder sound enabled. Upcoming reminders will make a sound.");
      setTimeout(() => setSheetMessage(""), 4000);
    } else {
      setSheetMessage("Reminder sound turned off.");
      setTimeout(() => setSheetMessage(""), 3000);
    }
  }

  function updateReminderForm(field, value) {
    setReminderForm((current) => ({ ...current, [field]: value }));
  }

  function addReminder(event) {
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

  function toggleReminderDone(id) {
    setReminders((current) => current.map((reminder) => (reminder.id === id ? { ...reminder, isDone: !reminder.isDone } : reminder)));
    setAlertedReminderIds((current) => current.filter((reminderId) => reminderId !== id));
  }

  function deleteReminder(id) {
    setReminders((current) => current.filter((reminder) => reminder.id !== id));
    setAlertedReminderIds((current) => current.filter((reminderId) => reminderId !== id));
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
    <div className={isDarkMode ? "dark-tracker relative min-h-screen overflow-x-hidden bg-[#111A16] text-[#F7EFE2]" : "relative min-h-screen overflow-x-hidden bg-[#EDE5D7] text-[#2B1A12]"}>
      {isDarkMode && <DarkModeStyleFix />}
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
                <EternaLogoMark className="h-14 w-14" />
                <div className="text-right">
                  <div className="text-2xl font-semibold tracking-[0.32em] text-[#4D6659]">ETERNA</div>
                  <div className="text-xs text-[#8A7A67]">Retention dashboard</div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-[#D4C3AD] bg-[#EFE6D8] px-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">

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
                  <option value="Fernando">Fernando</option>
                  <option value="Angie">Angie</option>
                </select>

                <Button
                  type="button"
                  onClick={() => setIsDarkMode((current) => !current)}
                  className="h-9 rounded-2xl bg-[#03071A] px-4 text-xs text-white hover:bg-[#10142B]"
                >
                  {isDarkMode ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
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
                <div className="ml-auto flex justify-end gap-2">
                  <Button
                    type="button"
                    onClick={() => setIsSheetOpen(true)}
                    className="h-9 rounded-2xl bg-[#03071A] px-4 text-xs text-white hover:bg-[#10142B]"
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    View Sheet
                  </Button>

                  <Button
                    type="button"
                    onClick={() => setIsReminderOpen(true)}
                    className="relative h-9 rounded-2xl bg-[#5B3320] px-4 text-xs text-white hover:bg-[#432516]"
                  >
                    <Bell className="mr-2 h-4 w-4" />
                    Reminders
                    {dueReminders.length > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#D8913D] px-1 text-[10px] font-bold text-white">
                        {dueReminders.length}
                      </span>
                    )}
                  </Button>
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
          </div>
        </motion.div>

        <div className="mb-3 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <StatCard icon={<Users />} label="Total Cases" value={stats.total} helper={stats.dateLabel} isDarkMode={isDarkMode} />
          <StatCard icon={<Clock3 />} label="Pending Save" value={stats.pendingSaveToday} helper={currency(stats.pendingSaveTodayAp)} tone="amber" isDarkMode={isDarkMode} />
          <StatCard icon={<CheckCircle2 />} label="Save" value={stats.saveToday} helper={currency(stats.saveTodayAp)} tone="emerald" isDarkMode={isDarkMode} />
          <StatCard icon={<CheckCircle2 />} label="UW Action Resolved" value={stats.uwActionResolvedToday} helper={currency(stats.uwActionResolvedTodayAp)} tone="emerald" isDarkMode={isDarkMode} />
          <StatCard icon={<AlertTriangle />} label="UW Action Needed" value={stats.uwActionNeededToday} helper={currency(stats.uwActionNeededTodayAp)} tone="amber" isDarkMode={isDarkMode} />
          <StatCard icon={<DollarSign />} label="Pending Save AP" value={currency(stats.pendingSaveAp)} helper="Action: Pending Save" tone="amber" isDarkMode={isDarkMode} />
          <StatCard icon={<DollarSign />} label="Save AP" value={currency(stats.saveAp)} helper="Action: Save" tone="emerald" isDarkMode={isDarkMode} />
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
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold ${activeEntryTab === "case" ? "bg-[#5B3320] text-white" : "text-[#5B3320]"}`}
                    >
                      Add new case
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveEntryTab("inbound")}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold ${activeEntryTab === "inbound" ? "bg-[#5B3320] text-white" : "text-[#5B3320]"}`}
                    >
                      Inbound cancellation
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveEntryTab("eod")}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold ${activeEntryTab === "eod" ? "bg-[#5B3320] text-white" : "text-[#5B3320]"}`}
                    >
                      EOD
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveEntryTab("eodTest")}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold ${activeEntryTab === "eodTest" ? "bg-[#5B3320] text-white" : "text-[#5B3320]"}`}
                    >
                      EOD Test
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

              {sheetMessage && (
                <div className="mb-3 rounded-2xl border border-[#D4C3AD] bg-[#F6EEE3] px-3 py-2 text-xs font-medium text-[#5B3320]">
                  {sheetMessage}
                </div>
              )}

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
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <Button type="submit" className="h-11 rounded-2xl bg-[#03071A] text-white hover:bg-[#10142B]">
                      {editingId ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                      {editingId ? "Save changes" : "Add case"}
                    </Button>
                    <Button type="button" variant="outline" onClick={resetForm} className="h-11 rounded-2xl border-[#D4C3AD] px-4 text-xs text-[#5B3320]">
                      Clear form
                    </Button>
                  </div>
                </form>
              ) : activeEntryTab === "inbound" ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Input
                      label="Client name"
                      value={inboundCancellationForm.clientName}
                      onChange={(v) => updateInboundCancellationForm("clientName", v)}
                      required
                    />
                    <Input
                      label="Phone number"
                      value={inboundCancellationForm.phoneNumber}
                      onChange={(v) => updateInboundCancellationForm("phoneNumber", v)}
                      placeholder="Client phone number"
                    />
                    <Input
                      label="Agent"
                      value={inboundCancellationForm.agentName}
                      onChange={(v) => updateInboundCancellationForm("agentName", v)}
                      placeholder="Agent name"
                    />
                    <Select
                      label="Specialist"
                      value={inboundCancellationForm.specialistName}
                      onChange={(v) => updateInboundCancellationForm("specialistName", v)}
                      options={specialistOptions}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        label="Resolved"
                        value={inboundCancellationForm.resolved}
                        onChange={(v) => updateInboundCancellationForm("resolved", v)}
                        options={["No", "Yes"]}
                      />
                      <Select
                        label="Agent informed with updates"
                        value={inboundCancellationForm.agentInformed}
                        onChange={(v) => updateInboundCancellationForm("agentInformed", v)}
                        options={["No", "Yes"]}
                      />
                    </div>
                    <Textarea
                      label="Notes"
                      value={inboundCancellationForm.notes}
                      onChange={(v) => updateInboundCancellationForm("notes", v)}
                      placeholder="Add cancellation details, next steps, or agent update notes..."
                    />
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <Button
                        type="button"
                        onClick={submitInboundCancellation}
                        className="h-11 rounded-2xl bg-[#03071A] text-white hover:bg-[#10142B]"
                      >
                        <Plus className="mr-2 h-4 w-4" /> Save inbound cancellation
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setInboundCancellationForm(blankInboundCancellationForm)}
                        className="h-11 rounded-2xl border-[#D4C3AD] px-4 text-xs text-[#5B3320]"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-[1.2rem] border border-[#D4C3AD] bg-[#F6EEE3] p-3 text-xs text-[#8A6A55]">
                    Saved inbound cancellations will appear in their own list on the right side.
                  </div>
                </div>
              ) : activeEntryTab === "eodTest" ? (
                <form onSubmit={submitEodTestForm} className="space-y-3">
                  <Select
                    label="Specialist Name"
                    value={eodTestForm.specialistName}
                    onChange={(v) => updateEodTestForm("specialistName", v)}
                    options={specialistOptions}
                  />

                  <Input
                    label="Date"
                    type="date"
                    value={eodTestForm.date}
                    onChange={(v) => updateEodTestForm("date", v)}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <Input label="Total Dials For The Day" type="number" value={eodTestForm.totalDials} onChange={(v) => updateEodTestForm("totalDials", v)} />
                    <Input label="Total Talk Time for Today (In Minutes)" type="number" value={eodTestForm.totalTalkTime} onChange={(v) => updateEodTestForm("totalTalkTime", v)} />
                  </div>

                  <Input label="Amount of clients reached via call or text?" type="number" value={eodTestForm.clientsReached} onChange={(v) => updateEodTestForm("clientsReached", v)} />

                  <Input label="Total Welcome Calls Completed" type="number" value={eodTestForm.welcomeCallsCompleted} onChange={(v) => updateEodTestForm("welcomeCallsCompleted", v)} />

                  <div className="grid grid-cols-2 gap-2">
                    <Input label="Amount of at risk policies resolved today (pre-confirmation)?" type="number" value={eodTestForm.atRiskResolvedPre} onChange={(v) => updateEodTestForm("atRiskResolvedPre", v)} />
                    <Input label="Amount of at risk policies resolved today (confirmed)?" type="number" value={eodTestForm.atRiskResolvedConfirmed} onChange={(v) => updateEodTestForm("atRiskResolvedConfirmed", v)} />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Input label="Total Amount of AP saved today (pre-confirmation)?" type="number" value={eodTestForm.apSavedPre} onChange={(v) => updateEodTestForm("apSavedPre", v)} />
                    <Input label="Total Amount of AP saved today (confirmed)?" type="number" value={eodTestForm.apSavedConfirmed} onChange={(v) => updateEodTestForm("apSavedConfirmed", v)} />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Input label="Amount of UW Policies Resolved today" type="number" value={eodTestForm.uwPoliciesResolved} onChange={(v) => updateEodTestForm("uwPoliciesResolved", v)} />
                    <Input label="Amount of policies pending resolution from today?" type="number" value={eodTestForm.pendingResolution} onChange={(v) => updateEodTestForm("pendingResolution", v)} />
                  </div>

                  <Textarea
                    label="Client Name & Policy #'s for those that were saved (pending confirmation)"
                    value={eodTestForm.savedPendingConfirmation}
                    onChange={(v) => updateEodTestForm("savedPendingConfirmation", v)}
                    placeholder="Example: John Smith - POLICY123"
                  />

                  <Textarea
                    label="Client name & Policy #'s for those that were saved (confirmed)"
                    value={eodTestForm.savedConfirmed}
                    onChange={(v) => updateEodTestForm("savedConfirmed", v)}
                    placeholder="Example: Jane Doe - POLICY456"
                  />

                  <Textarea
                    label="Please list details of policies in UW that were resolved today but not yet confirmed (AP, Name, Resolution, Carrier & Policy #)?"
                    value={eodTestForm.uwResolvedNotConfirmedDetails}
                    onChange={(v) => updateEodTestForm("uwResolvedNotConfirmedDetails", v)}
                    placeholder="AP, Name, Resolution, Carrier, Policy #"
                  />

                  <Textarea
                    label="Please list details of policies in UW that were confirmed resolved today (AP, Name, Resolution, Carrier & Policy #)?"
                    value={eodTestForm.uwConfirmedResolvedDetails}
                    onChange={(v) => updateEodTestForm("uwConfirmedResolvedDetails", v)}
                    placeholder="AP, Name, Resolution, Carrier, Policy #"
                  />

                  <Textarea
                    label="Escalations where Agent Action is Needed (please share clients info & agents)"
                    value={eodTestForm.escalationsAgentActionNeeded}
                    onChange={(v) => updateEodTestForm("escalationsAgentActionNeeded", v)}
                    placeholder="Client info, policy details, agent name, and action needed"
                  />

                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <Button type="submit" className="h-11 rounded-2xl bg-[#03071A] text-white hover:bg-[#10142B]">
                      <Save className="mr-2 h-4 w-4" /> Save EOD Test
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEodTestForm({ ...blankEodTestForm, date: new Date().toISOString().slice(0, 10) })}
                      className="h-11 rounded-2xl border-[#D4C3AD] px-4 text-xs text-[#5B3320]"
                    >
                      Clear
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
                    <h3 className="text-sm font-bold text-[#2B1A12]">{reportStats.label}</h3>
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
                  <ReportItem label="Total Cases" value={reportStats.totalCases} isDarkMode={isDarkMode} />
                  <ReportItem label="Resolved" value={reportStats.resolved} isDarkMode={isDarkMode} />
                  <ReportItem label="Pending" value={reportStats.pending} isDarkMode={isDarkMode} />
                  <ReportItem label="Lost" value={reportStats.lost} isDarkMode={isDarkMode} />
                  <ReportItem label="Pending Save AP" value={currency(reportStats.pendingSaveAp)} isDarkMode={isDarkMode} />
                  <ReportItem label="Save AP" value={currency(reportStats.saveAp)} isDarkMode={isDarkMode} />
                </div>
              </div>

              <div className="mt-4 rounded-[1.4rem] border border-[#D4C3AD] bg-[#F6EEE3] p-4">
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-[#2B1A12]">
                  <BarChart3 className="h-4 w-4" /> Agent load
                </h3>

                <div className="max-h-[160px] space-y-2 overflow-y-auto pr-1">
                  {topAgents.map(([agent, count]) => {
                    const agentWidth = filteredRows.length ? Math.max(8, Math.round((count / filteredRows.length) * 100)) : 0;

                    return (
                      <div key={agent}>
                        <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                          <span className="truncate font-semibold text-[#5B3320]" title={agent}>
                            {agent}
                          </span>
                          <span className="text-[#8A6A55]">{count}</span>
                        </div>

                        <div className="h-1.5 overflow-hidden rounded-full bg-[#E9DECC]">
                          <div className="h-full rounded-full bg-[#5C7768]" style={{ width: agentWidth + "%" }} />
                        </div>
                      </div>
                    );
                  })}

                  {!topAgents.length && <p className="text-xs text-[#8A6A55]">No agent data yet.</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="h-fit min-w-0 self-start">
            {activeEntryTab === "eodTest" ? (
              <Card className="h-fit min-w-0 self-start rounded-[1.6rem] border border-[#D4C3AD] bg-[#FCF8F2] shadow-md">
                <CardContent className="p-0">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D4C3AD] bg-[#F6EEE3] px-4 py-3">
                    <div>
                      <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#2B1A12]">
                        <FileSpreadsheet className="h-4 w-4" /> EOD Test submissions
                      </h2>
                      <p className="text-[10px] leading-3 text-[#8A6A55]">
                        Saved EOD Test entries from Google Sheets and this tracker.
                      </p>
                    </div>
                    <div className="rounded-full bg-[#5B3320] px-3 py-1 text-xs font-bold text-white">
                      {eodTestEntries.length} total
                    </div>
                  </div>

                  <div className="w-full overflow-x-auto rounded-b-[1.6rem]">
                    <table className="w-full min-w-[1100px] table-fixed text-left text-[11px]">
                      <thead className="bg-[#F7E8D6] text-[11px] uppercase tracking-wide text-[#8A6A55]">
                        <tr>
                          <th className="w-[12%] px-3 py-3">Date</th>
                          <th className="w-[13%] px-2 py-3">Specialist</th>
                          <th className="w-[9%] px-2 py-3">Dials</th>
                          <th className="w-[10%] px-2 py-3">Talk Time</th>
                          <th className="w-[10%] px-2 py-3">Reached</th>
                          <th className="w-[10%] px-2 py-3">Welcome</th>
                          <th className="w-[12%] px-2 py-3">AP Saved Pre</th>
                          <th className="w-[12%] px-2 py-3">AP Saved Confirmed</th>
                          <th className="w-[22%] px-2 py-3">Notes / Details</th>
                          <th className="w-[8%] px-2 py-3 text-right">Tools</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EEDBC6]">
                        {eodTestEntries.map((entry) => (
                          <tr key={entry.id} className="bg-white align-top hover:bg-[#F6EEE3]">
                            <td className="break-words px-3 py-3 font-semibold text-[#2B1A12]">{entry.date || "—"}</td>
                            <td className="break-words px-2 py-3 text-[#5B3320]">{entry.specialistName || "—"}</td>
                            <td className="break-words px-2 py-3 text-[#5B3320]">{entry.totalDials || "0"}</td>
                            <td className="break-words px-2 py-3 text-[#5B3320]">{entry.totalTalkTime || "0"}</td>
                            <td className="break-words px-2 py-3 text-[#5B3320]">{entry.clientsReached || "0"}</td>
                            <td className="break-words px-2 py-3 text-[#5B3320]">{entry.welcomeCallsCompleted || "0"}</td>
                            <td className="break-words px-2 py-3 text-[#5B3320]">{entry.apSavedPre || "0"}</td>
                            <td className="break-words px-2 py-3 text-[#5B3320]">{entry.apSavedConfirmed || "0"}</td>
                            <td className="break-words px-2 py-3">
                              {(entry.savedPendingConfirmation || entry.savedConfirmed || entry.uwResolvedNotConfirmedDetails || entry.uwConfirmedResolvedDetails || entry.escalationsAgentActionNeeded) ? (
                                <NotesHover
                                  text={[
                                    entry.savedPendingConfirmation ? `Saved pending confirmation:\n${entry.savedPendingConfirmation}` : "",
                                    entry.savedConfirmed ? `Saved confirmed:\n${entry.savedConfirmed}` : "",
                                    entry.uwResolvedNotConfirmedDetails ? `UW resolved not confirmed:\n${entry.uwResolvedNotConfirmedDetails}` : "",
                                    entry.uwConfirmedResolvedDetails ? `UW confirmed resolved:\n${entry.uwConfirmedResolvedDetails}` : "",
                                    entry.escalationsAgentActionNeeded ? `Escalations / agent action needed:\n${entry.escalationsAgentActionNeeded}` : "",
                                  ].filter(Boolean).join("\n\n")}
                                />
                              ) : (
                                <span className="text-[#8A6A55]">—</span>
                              )}
                            </td>
                            <td className="px-2 py-3">
                              <div className="flex justify-end">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => deleteEodTestEntry(entry.id)}
                                  className="h-7 w-7 rounded-xl text-[#B44A2B] hover:text-[#8F321D]"
                                  title="Delete local EOD Test entry"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {!eodTestEntries.length && (
                      <div className="flex h-auto flex-col items-center justify-center bg-white px-6 py-10 text-center">
                        <AlertTriangle className="mb-2 h-6 w-6 text-[#F3D9BC]" />
                        <h3 className="text-sm font-bold text-[#2B1A12]">No EOD Test submissions yet</h3>
                        <p className="mt-1 text-xs text-[#8A6A55]">Use the EOD Test form on the left to add one.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : activeEntryTab === "inbound" ? (
              <Card className="h-fit min-w-0 self-start rounded-[1.6rem] border border-[#D4C3AD] bg-[#FCF8F2] shadow-md">
                <CardContent className="p-0">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D4C3AD] bg-[#F6EEE3] px-4 py-3">
                    <div>
                      <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#2B1A12]">
                        <XCircle className="h-4 w-4" /> Inbound cancellation list
                      </h2>
                      <p className="text-[10px] leading-3 text-[#8A6A55]">
                        Separate list for inbound cancellation calls only.
                      </p>
                    </div>
                    <div className="rounded-full bg-[#5B3320] px-3 py-1 text-xs font-bold text-white">
                      {filteredInboundCancellations.length} of {inboundCancellations.length} total
                    </div>
                  </div>

                  <div className="border-b border-[#D4C3AD] bg-[#FCF8F2] px-4 py-3">
                    <div className="grid gap-2 md:grid-cols-[1fr_150px_190px_auto]">
                      <label className="relative block">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A6A55]" />
                        <input
                          type="text"
                          value={inboundSearchQuery}
                          onChange={(e) => setInboundSearchQuery(e.target.value)}
                          placeholder="Search inbound cancellations..."
                          className="h-10 w-full rounded-2xl border border-[#D4C3AD] bg-white pl-9 pr-3 text-xs text-[#2B1A12] outline-none focus:border-[#5C7768]"
                        />
                      </label>

                      <select
                        value={inboundResolvedFilter}
                        onChange={(e) => setInboundResolvedFilter(e.target.value)}
                        className="h-10 rounded-2xl border border-[#D4C3AD] bg-white px-3 text-xs text-[#2B1A12] outline-none focus:border-[#5C7768]"
                      >
                        <option value="All">All Resolved</option>
                        <option value="Yes">Resolved: Yes</option>
                        <option value="No">Resolved: No</option>
                      </select>

                      <select
                        value={inboundAgentInformedFilter}
                        onChange={(e) => setInboundAgentInformedFilter(e.target.value)}
                        className="h-10 rounded-2xl border border-[#D4C3AD] bg-white px-3 text-xs text-[#2B1A12] outline-none focus:border-[#5C7768]"
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
                        className="h-10 rounded-2xl border-[#D4C3AD] px-4 text-xs text-[#5B3320]"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>

                  <div className="w-full overflow-x-auto rounded-b-[1.6rem]">
                    <table className="w-full min-w-[1120px] table-fixed text-left text-[11px]">
                      <thead className="bg-[#F7E8D6] text-[11px] uppercase tracking-wide text-[#8A6A55]">
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

                      <tbody className="divide-y divide-[#EEDBC6]">
                        {filteredInboundCancellations.map((item) => (
                          <tr key={item.id} className="bg-white align-top hover:bg-[#F6EEE3]">
                            <td className="break-words px-3 py-3">
                              <div className="font-semibold text-[#2B1A12]">{item.clientName}</div>
                            </td>
                            <td className="break-words px-2 py-3 text-[#5B3320]">{item.phoneNumber || "—"}</td>
                            <td className="break-words px-2 py-3 text-[#5B3320]">{item.agentName || "—"}</td>
                            <td className="break-words px-2 py-3 text-[#5B3320]">{item.specialistName || "—"}</td>
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
                              {item.notes ? <NotesHover text={item.notes} /> : <span className="text-[#8A6A55]">—</span>}
                            </td>
                            <td className="break-words px-2 py-3 text-[10px] text-[#8A6A55]">
                              {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "—"}
                            </td>
                            <td className="px-2 py-3">
                              <div className="flex justify-end gap-1">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => editInboundCancellation(item)}
                                  className="h-7 w-7 rounded-xl text-[#5C7768] hover:text-[#2E443A]"
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
                      <div className="flex h-auto flex-col items-center justify-center bg-white px-6 py-10 text-center">
                        <AlertTriangle className="mb-2 h-6 w-6 text-[#F3D9BC]" />
                        <h3 className="text-sm font-bold text-[#2B1A12]">No inbound cancellations yet</h3>
                        <p className="mt-1 text-xs text-[#8A6A55]">Use the form on the left to add one, or clear the search filters.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className="h-fit max-h-fit min-w-0 self-start rounded-[1.4rem] border border-[#D4C3AD] bg-[#FCF8F2] shadow-md">
                  <CardContent className="p-2.5">
                    <div className="grid items-center gap-2 lg:grid-cols-[115px_1fr_105px_105px_110px_110px_112px_112px_64px]">
                      <div>
                        <h2 className="flex items-center gap-1.5 text-sm font-bold">
                          <Filter className="h-4 w-4" /> Search
                        </h2>
                        <p className="text-[10px] leading-3 text-[#8A6A55]">
                          {lastRefreshed ? `Last refreshed: ${lastRefreshed}` : "Search & filter."}
                        </p>
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
                      <MiniSelect value={specialistFilter} onChange={setSpecialistFilter} options={["Specialist", "Nisha", "Rick", "Chen", "Fernando", "Angie"]} />
                      <MiniSelect value={sortBy} onChange={setSortBy} options={["updatedAt", "ap", "clientName"]} />
                      <input
                        type="date"
                        value={filterStartDate}
                        onChange={(e) => setFilterStartDate(e.target.value)}
                        className="h-8 rounded-2xl border border-[#D4C3AD] bg-white px-2 text-xs outline-none focus:border-[#5C7768]"
                        title="From date"
                      />
                      <input
                        type="date"
                        value={filterEndDate}
                        onChange={(e) => setFilterEndDate(e.target.value)}
                        className="h-8 rounded-2xl border border-[#D4C3AD] bg-white px-2 text-xs outline-none focus:border-[#5C7768]"
                        title="To date"
                      />
                      <Button variant="outline" size="sm" onClick={clearFilters} className="h-8 rounded-2xl px-2 text-xs">
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
                              <th className="w-[10%] px-2 py-3 text-right">Tools</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#EEDBC6]">
                            {paginatedRows.map((row) => (
                              <tr key={row.id} className="bg-white align-top hover:bg-[#F6EEE3]">
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
                                  {row.notes && <NotesHover text={row.notes} />}
                                </td>
                                <td className="px-2 py-3">
                                  <div className="flex flex-nowrap justify-end gap-0.5">
                                    <Button size="icon" variant="ghost" className="h-7 w-7 rounded-xl" onClick={() => quickStatus(row.id, "RESOLVED")} title="Mark resolved">
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7 rounded-xl" onClick={() => copyClientSummary(row)} title="Copy summary">
                                      <FileSpreadsheet className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7 rounded-xl" onClick={() => editRow(row)} title="Edit">
                                      <Edit3 className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl text-[#B44A2B] hover:text-[#8F321D]" onClick={() => deleteRow(row)} title="Delete">
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
                            <p className="mt-0.5 text-xs text-[#8A6A55]">Try changing your search or filters.</p>
                          </div>
                        )}
                      </div>

                      {filteredRows.length > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#D4C3AD] bg-[#FCF8F2] px-4 py-3 text-xs text-[#5B3320]">
                          <div>
                            Showing {(currentPage - 1) * rowsPerPage + 1} - {Math.min(currentPage * rowsPerPage, filteredRows.length)} of {filteredRows.length}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              disabled={currentPage === 1}
                              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
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
                              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
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
              </>
            )}
          </div>
        </div>
      </div>

      {isWhatsNewOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-2xl overflow-hidden rounded-[1.8rem] border border-[#D4C3AD] bg-[#FCF8F2] shadow-2xl">
            <div className="border-b border-[#D4C3AD] bg-[#F6EEE3] px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="mb-2 inline-flex rounded-full bg-[#5B3320] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                    New updates
                  </div>
                  <h2 className="text-2xl font-bold text-[#2B1A12]">What's new in the tracker</h2>
                  <p className="mt-1 text-xs text-[#8A6A55]">Here are the latest features added to your Eterna Retention Tracker.</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={closeWhatsNew} className="rounded-xl">
                  <X className="mr-1 h-4 w-4" /> Close
                </Button>
              </div>
            </div>

            <div className="space-y-3 px-5 py-5">
              <div className="rounded-2xl border border-[#D4C3AD] bg-white p-4">
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#5B3320] text-white">
                    <Bell className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#2B1A12]">Personal Reminders</h3>
                    <p className="mt-1 text-xs leading-5 text-[#8A6A55]">A Reminders button was added beside Refresh Data. You can add personal follow-ups, appointments, and self notes without tying them to a client.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#D4C3AD] bg-white p-4">
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#6F8A3A] text-white">
                    <Clock3 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#2B1A12]">Reminder Calendar</h3>
                    <p className="mt-1 text-xs leading-5 text-[#8A6A55]">The reminder popup now includes a calendar view so you can quickly see which dates have reminders and which reminders are due soon.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#D4C3AD] bg-white p-4">
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#D8913D] text-white">
                    <Volume2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#2B1A12]">Reminder Sound Alerts</h3>
                    <p className="mt-1 text-xs leading-5 text-[#8A6A55]">You can turn reminder sounds on. The tracker will alert you when a reminder is due or coming up soon while the tab is open.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#D4C3AD] bg-white p-4">
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#5C7768] text-white">
                    <FileSpreadsheet className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#2B1A12]">View Sheet Button</h3>
                    <p className="mt-1 text-xs leading-5 text-[#8A6A55]">A View Sheet button was added near Refresh Data so you can open the Google Sheet inside the tracker once your sheet link is added.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#D4C3AD] bg-white p-4">
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#03071A] text-white">
                    <Moon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#2B1A12]">Full Dark Mode</h3>
                    <p className="mt-1 text-xs leading-5 text-[#8A6A55]">Dark mode now applies to the full tracker, including cards, forms, search filters, tables, popups, inputs, and helper text so everything stays readable.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#D4C3AD] bg-white p-4">
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#5B3320] text-white">
                    <XCircle className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#2B1A12]">Inbound Cancellation Updates</h3>
                    <p className="mt-1 text-xs leading-5 text-[#8A6A55]">The Inbound Cancellation tab now uses its own workflow and is set up to send specialist details to the dedicated Inbound Cancellations sheet.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#D4C3AD] bg-white p-4">
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#5C7768] text-white">
                    <Edit3 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#2B1A12]">Edit Inbound Cancellations</h3>
                    <p className="mt-1 text-xs leading-5 text-[#8A6A55]">The Inbound Cancellation list now has an edit button so you can correct the client name, phone, agent, specialist, resolved status, and agent update status.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-[#D4C3AD] bg-[#F6EEE3] px-5 py-4">
              <Button type="button" onClick={closeWhatsNew} className="rounded-2xl bg-[#03071A] px-5 text-xs text-white hover:bg-[#10142B]">
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}

      {isSheetOpen && (
        <div className="fixed inset-0 z-[105] flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-[1.8rem] border border-[#D4C3AD] bg-[#FCF8F2] shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-[#D4C3AD] bg-[#F6EEE3] px-5 py-4">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-bold text-[#2B1A12]">
                  <FileSpreadsheet className="h-5 w-5" /> Google Sheet
                </h2>
                <p className="text-xs text-[#8A6A55]">View your live Google Sheet without leaving the tracker.</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsSheetOpen(false)} className="rounded-xl">
                <X className="mr-1 h-4 w-4" /> Close
              </Button>
            </div>

            {GOOGLE_SHEET_VIEW_URL ? (
              <iframe
                title="Google Sheet Viewer"
                src={GOOGLE_SHEET_VIEW_URL}
                className="h-[76vh] w-full bg-white"
                frameBorder="0"
                allowFullScreen
              />
            ) : (
              <div className="flex h-[420px] flex-col items-center justify-center bg-white px-6 text-center">
                <FileSpreadsheet className="mb-3 h-10 w-10 text-[#6E8578]" />
                <h3 className="text-lg font-bold text-[#2B1A12]">Google Sheet link needed</h3>
                <p className="mt-2 max-w-lg text-sm text-[#8A6A55]">
                  Add your Google Sheet share link to <span className="font-semibold text-[#5B3320]">GOOGLE_SHEET_VIEW_URL</span> near the top of the code, then this window will show the live sheet.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {isReminderOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[1.8rem] border border-[#D4C3AD] bg-[#FCF8F2] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-bold text-[#2B1A12]">
                  <Bell className="h-5 w-5" /> Personal Reminders
                </h2>
                <p className="text-xs text-[#8A6A55]">Set appointments, follow-ups, or important self notes. Turn sound on once so your browser allows reminder audio.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={toggleReminderSound}
                  className={isReminderSoundEnabled ? "h-8 rounded-2xl bg-[#5C7768] px-3 text-xs text-white hover:bg-[#466153]" : "h-8 rounded-2xl bg-[#03071A] px-3 text-xs text-white hover:bg-[#10142B]"}
                  title={isReminderSoundEnabled ? "Turn reminder sound off" : "Turn reminder sound on"}
                >
                  {isReminderSoundEnabled ? <Volume2 className="mr-1.5 h-3.5 w-3.5" /> : <VolumeX className="mr-1.5 h-3.5 w-3.5" />}
                  {isReminderSoundEnabled ? "Sound On" : "Sound Off"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsReminderOpen(false)} className="rounded-xl">
                  <X className="mr-1 h-4 w-4" /> Close
                </Button>
              </div>
            </div>

            {dueReminders.length > 0 && (
              <div className="mb-4 rounded-2xl border border-[#D8913D] bg-[#FFF1D8] px-3 py-2 text-xs font-semibold text-[#7A4B12]">
                You have {dueReminders.length} reminder{dueReminders.length > 1 ? "s" : ""} due now.
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-[300px_320px_1fr]">
              <form onSubmit={addReminder} className="rounded-[1.4rem] border border-[#D4C3AD] bg-[#F6EEE3] p-4">
                <h3 className="mb-3 text-sm font-bold text-[#2B1A12]">Add reminder</h3>
                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#8A6A55]">Reminder title</span>
                    <input
                      type="text"
                      value={reminderForm.title}
                      onChange={(e) => updateReminderForm("title", e.target.value)}
                      placeholder="Example: Call lead back"
                      className="h-9 w-full rounded-2xl border border-[#D4C3AD] bg-white px-3 text-xs text-[#2B1A12] outline-none focus:border-[#5C7768]"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#8A6A55]">Date and time</span>
                    <input
                      type="datetime-local"
                      value={reminderForm.reminderAt}
                      onChange={(e) => updateReminderForm("reminderAt", e.target.value)}
                      className="h-9 w-full rounded-2xl border border-[#D4C3AD] bg-white px-3 text-xs text-[#2B1A12] outline-none focus:border-[#5C7768]"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#8A6A55]">Notes</span>
                    <textarea
                      value={reminderForm.note}
                      onChange={(e) => updateReminderForm("note", e.target.value)}
                      placeholder="Important details..."
                      rows={6}
                      className="w-full resize-none rounded-2xl border border-[#D4C3AD] bg-white px-3 py-2 text-xs text-[#2B1A12] outline-none focus:border-[#5C7768]"
                    />
                  </label>

                  <Button type="submit" className="h-10 w-full rounded-2xl bg-[#03071A] text-xs text-white hover:bg-[#10142B]">
                    <Plus className="mr-2 h-4 w-4" /> Add reminder
                  </Button>
                </div>
              </form>

              <div className="rounded-[1.4rem] border border-[#D4C3AD] bg-[#F6EEE3] p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[#2B1A12]">Calendar</h3>
                    <p className="text-[11px] text-[#8A6A55]">{reminderCalendarTitle}</p>
                  </div>

                  <input
                    type="month"
                    value={reminderCalendarMonth}
                    onChange={(e) => setReminderCalendarMonth(e.target.value)}
                    className="h-8 rounded-2xl border border-[#D4C3AD] bg-white px-2 text-[11px] text-[#2B1A12] outline-none focus:border-[#5C7768]"
                  />
                </div>

                <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-[#8A6A55]">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day}>{day}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {reminderCalendarDays.map((day) =>
                    day.blank ? (
                      <div key={day.key} className="h-10 rounded-xl" />
                    ) : (
                      <div
                        key={day.key}
                        title={
                          day.reminders.length
                            ? day.reminders.map((reminder) => reminder.title).join(", ")
                            : ""
                        }
                        className={`relative flex h-10 items-start justify-start rounded-xl border px-1.5 py-1 text-[11px] font-semibold ${
                          day.reminders.length
                            ? day.hasDueReminder
                              ? "border-[#D8913D] bg-[#FFF1D8] text-[#5B3320]"
                              : "border-[#6E8578] bg-[#EEF7E8] text-[#2E443A]"
                            : "border-[#E7D5BF] bg-white text-[#8A6A55]"
                        }`}
                      >
                        <span>{day.day}</span>
                        {day.reminders.length > 0 && (
                          <span className={`absolute bottom-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white ${
                            day.hasDueReminder ? "bg-[#D8913D]" : "bg-[#5C7768]"
                          }`}>
                            {day.reminders.length}
                          </span>
                        )}
                      </div>
                    )
                  )}
                </div>

                <div className="mt-3 rounded-2xl bg-white/70 p-3 text-[11px] text-[#5B3320]">
                  Dates with reminders show a number. Orange means at least one reminder is due.
                </div>
              </div>

              <div className="rounded-[1.4rem] border border-[#D4C3AD] bg-[#F6EEE3] p-4">
                <h3 className="mb-3 text-sm font-bold text-[#2B1A12]">Reminder list</h3>
                <div className="max-h-[430px] space-y-2 overflow-y-auto pr-1">
                  {sortedReminders.map((reminder) => {
                    const reminderTime = reminder.reminderAt ? new Date(reminder.reminderAt).getTime() : 0;
                    const isDue = !reminder.isDone && reminderTime && reminderTime <= Date.now();
                    const isUpcoming = !reminder.isDone && reminderTime && reminderTime > Date.now() && reminderTime <= Date.now() + 5 * 60 * 1000;

                    return (
                      <div
                        key={reminder.id}
                        className={`rounded-2xl border p-3 text-xs ${isDue ? "border-[#D8913D] bg-[#FFF1D8]" : "border-[#D4C3AD] bg-[#FCF8F2]"} ${reminder.isDone ? "opacity-60" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-[#2B1A12]">{reminder.title}</div>
                            <div className="mt-0.5 text-[11px] text-[#8A6A55]">{new Date(reminder.reminderAt).toLocaleString()}</div>
                            {isDue && <div className="mt-1 inline-flex rounded-full bg-[#D8913D] px-2 py-0.5 text-[10px] font-bold text-white">Due now</div>}
                            {isUpcoming && <div className="mt-1 inline-flex rounded-full bg-[#5C7768] px-2 py-0.5 text-[10px] font-bold text-white">Upcoming soon</div>}
                          </div>

                          <div className="flex gap-1">
                            <Button type="button" size="icon" variant="ghost" onClick={() => toggleReminderDone(reminder.id)} className="h-7 w-7 rounded-xl" title="Mark done">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button type="button" size="icon" variant="ghost" onClick={() => deleteReminder(reminder.id)} className="h-7 w-7 rounded-xl text-[#B44A2B]" title="Delete reminder">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {reminder.note && <div className="mt-2 rounded-xl bg-white/70 p-2 text-[11px] text-[#5B3320]">{reminder.note}</div>}
                      </div>
                    );
                  })}

                  {!sortedReminders.length && <p className="text-xs text-[#8A6A55]">No reminders yet.</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {editInboundCancellationRow && (
        <div className="fixed inset-0 z-[102] flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[1.8rem] border border-[#D4C3AD] bg-[#FCF8F2] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-[#2B1A12]">Edit inbound cancellation</h2>
                <p className="text-xs text-[#8A6A55]">Update the inbound cancellation details below.</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={closeInboundCancellationEditModal} className="rounded-xl">
                <X className="mr-1 h-4 w-4" /> Close
              </Button>
            </div>

            <form onSubmit={saveInboundCancellationEditModal} className="space-y-3">
              <Input
                label="Client name"
                value={editInboundCancellationForm.clientName}
                onChange={(v) => updateEditInboundCancellationForm("clientName", v)}
                required
              />

              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  label="Phone number"
                  value={editInboundCancellationForm.phoneNumber}
                  onChange={(v) => updateEditInboundCancellationForm("phoneNumber", v)}
                />
                <Input
                  label="Agent"
                  value={editInboundCancellationForm.agentName}
                  onChange={(v) => updateEditInboundCancellationForm("agentName", v)}
                />
              </div>

              <Select
                label="Specialist"
                value={editInboundCancellationForm.specialistName}
                onChange={(v) => updateEditInboundCancellationForm("specialistName", v)}
                options={["", "Nisha", "Rick", "Chen", "Fernando", "Angie"]}
              />

              <div className="grid gap-3 md:grid-cols-2">
                <Select
                  label="Resolved"
                  value={editInboundCancellationForm.resolved}
                  onChange={(v) => updateEditInboundCancellationForm("resolved", v)}
                  options={["No", "Yes"]}
                />
                <Select
                  label="Agent informed with updates"
                  value={editInboundCancellationForm.agentInformed}
                  onChange={(v) => updateEditInboundCancellationForm("agentInformed", v)}
                  options={["No", "Yes"]}
                />
              </div>
              <Textarea
                label="Notes"
                value={editInboundCancellationForm.notes}
                onChange={(v) => updateEditInboundCancellationForm("notes", v)}
                placeholder="Add cancellation details, next steps, or agent update notes..."
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeInboundCancellationEditModal}
                  className="rounded-2xl border-[#D4C3AD] text-[#5B3320]"
                >
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
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[1.8rem] border border-[#D4C3AD] bg-[#FCF8F2] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-[#2B1A12]">Edit client details</h2>
                <p className="text-xs text-[#8A6A55]">Update the client information below.</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={closeEditModal} className="rounded-xl">
                <X className="mr-1 h-4 w-4" /> Close
              </Button>
            </div>

            <form onSubmit={saveEditModal} className="space-y-3">
              <Input label="Client name" value={editForm.clientName} onChange={(v) => updateEditForm("clientName", v)} required />
              <div className="grid gap-3 md:grid-cols-2">
                <Input label="Policy number" value={editForm.policyNumber} onChange={(v) => updateEditForm("policyNumber", v)} />
                <Input label="AP" type="number" value={editForm.ap} onChange={(v) => updateEditForm("ap", v)} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Select label="Lead status" value={editForm.leadStatus} onChange={(v) => updateEditForm("leadStatus", v)} options={leadStatusOptions} />
                <Input label="Agent name" value={editForm.agentName} onChange={(v) => updateEditForm("agentName", v)} />
              </div>
              <Select label="Specialist name" value={editForm.specialistName} onChange={(v) => updateEditForm("specialistName", v)} options={specialistOptions} />
              <div className="grid gap-3 md:grid-cols-3">
                <Select label="Status" value={editForm.result} onChange={(v) => updateEditForm("result", v)} options={resultOptions} />
                <Select label="Priority" value={editForm.priority} onChange={(v) => updateEditForm("priority", v)} options={priorityOptions} />
                <Input label="Updated" type="date" value={editForm.updatedAt} onChange={(v) => updateEditForm("updatedAt", v)} />
              </div>
              <Select label="Action" value={editForm.action} onChange={(v) => updateEditForm("action", v)} options={actionOptions} />
              <Textarea label="Notes" value={editForm.notes} onChange={(v) => updateEditForm("notes", v)} placeholder="Callback time, issue, next step..." />

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={closeEditModal} className="rounded-2xl border-[#D4C3AD] text-[#5B3320]">
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


function DarkModeStyleFix() {
  return (
    <style>{`
      .dark-tracker {
        color-scheme: dark;
      }

      .dark-tracker [class*="bg-[#FCF8F2]"],
      .dark-tracker [class*="bg-[#F6EEE3]"],
      .dark-tracker [class*="bg-[#EFE6D8]"],
      .dark-tracker [class*="bg-[#E9DECC]"],
      .dark-tracker [class*="bg-[#F7E8D6]"],
      .dark-tracker [class*="bg-[#F4EEE3]"],
      .dark-tracker [class*="bg-[#E8D8C3]"],
      .dark-tracker [class*="bg-[#F7F1E8]"],
      .dark-tracker [class*="bg-white"] {
        background-color: #111F1A !important;
        background-image: none !important;
      }

      .dark-tracker [class*="hover:bg-[#F6EEE3]"]:hover,
      .dark-tracker [class*="hover:bg-[#E9DECC]"]:hover,
      .dark-tracker tr:hover {
        background-color: #182B23 !important;
      }

      .dark-tracker [class*="border-[#D4C3AD]"],
      .dark-tracker [class*="border-[#CDBAA3]"],
      .dark-tracker [class*="border-[#BFAE98]"],
      .dark-tracker [class*="border-[#EEDBC6]"] {
        border-color: #52685B !important;
      }

      .dark-tracker [class*="divide-[#EEDBC6]"] > :not([hidden]) ~ :not([hidden]) {
        border-color: #344A40 !important;
      }

      .dark-tracker [class*="text-[#2B1A12]"],
      .dark-tracker [class*="text-[#3A2417]"],
      .dark-tracker [class*="text-[#5B3320]"],
      .dark-tracker [class*="text-[#4D6659]"],
      .dark-tracker [class*="text-[#2E443A]"] {
        color: #F7EFE2 !important;
      }

      .dark-tracker [class*="text-[#8A6A55]"],
      .dark-tracker [class*="text-[#6D6256]"],
      .dark-tracker [class*="text-[#8A7A67]"],
      .dark-tracker [class*="text-[#7C5A45]"] {
        color: #CDBFAE !important;
      }

      .dark-tracker label span,
      .dark-tracker th,
      .dark-tracker p,
      .dark-tracker h1,
      .dark-tracker h2,
      .dark-tracker h3,
      .dark-tracker td,
      .dark-tracker div,
      .dark-tracker span {
        text-shadow: none;
      }

      .dark-tracker input,
      .dark-tracker select,
      .dark-tracker textarea {
        background-color: #0C1713 !important;
        color: #F7EFE2 !important;
        border-color: #52685B !important;
      }

      .dark-tracker input::placeholder,
      .dark-tracker textarea::placeholder {
        color: #A89B8A !important;
      }

      .dark-tracker option {
        background-color: #0C1713;
        color: #F7EFE2;
      }

      .dark-tracker table thead,
      .dark-tracker thead tr,
      .dark-tracker th {
        background-color: #17271F !important;
        color: #EADAC6 !important;
      }

      .dark-tracker tbody tr,
      .dark-tracker td {
        background-color: #0F1D18 !important;
        color: #F7EFE2 !important;
      }

      .dark-tracker [class*="shadow"] {
        box-shadow: 0 16px 38px rgba(0, 0, 0, 0.38) !important;
      }

      .dark-tracker [class*="bg-[#03071A]"] {
        background-color: #050914 !important;
      }

      .dark-tracker [class*="bg-[#5B3320]"] {
        background-color: #6A3B25 !important;
      }

      .dark-tracker [class*="bg-[#5C7768]"] {
        background-color: #355F50 !important;
      }

      .dark-tracker [class*="bg-[#D8913D]"] {
        background-color: #D8913D !important;
      }

      .dark-tracker [class*="bg-[#6F8A3A]"] {
        background-color: #6F8A3A !important;
      }

      .dark-tracker .rounded-full[class*="bg-[#F7E8D6]"],
      .dark-tracker .rounded-full[class*="bg-[#FFF1D8]"],
      .dark-tracker .rounded-full[class*="bg-[#EEF7E8]"],
      .dark-tracker .rounded-full[class*="bg-[#FCE8DF]"] {
        background-color: #24352C !important;
        color: #F7EFE2 !important;
        border-color: #52685B !important;
      }

      /* FORCE STAT CARDS DARK - this targets the top metric cards specifically */
      .dark-tracker .stat-card-strip > * {
        background-color: #102019 !important;
        background-image: none !important;
        border-color: #425549 !important;
        color: #ffffff !important;
      }

      .dark-tracker .stat-card-strip .stat-card-force {
        background-color: #102019 !important;
        background-image: none !important;
        border-color: #425549 !important;
        color: #ffffff !important;
      }

      .dark-tracker .stat-card-strip .stat-card-label,
      .dark-tracker .stat-card-strip .stat-card-helper {
        color: #D9C9B4 !important;
      }

      .dark-tracker .stat-card-strip .stat-card-value {
        color: #FFFFFF !important;
        font-size: 1rem !important;
        line-height: 1.2 !important;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      @media (min-width: 768px) {
        .dark-tracker .stat-card-strip .stat-card-value {
          font-size: 1.125rem !important;
        }
      }

      .dark-tracker .stat-card-strip .stat-card-icon,
      .dark-tracker .stat-card-strip .stat-card-icon * {
        color: #ffffff !important;
      }

      .dark-tracker .stat-card-strip svg {
        color: #ffffff !important;
        stroke: currentColor !important;
      }
    `}</style>
  );
}

function StatCard({ icon, label, value, helper, tone = "slate", isDarkMode = false }) {
  const iconBg = {
    slate: isDarkMode ? "#7A4328" : "#5B3320",
    amber: "#D8913D",
    emerald: "#6F8A3A",
  };

  return (
    <div
      className="stat-card-force rounded-[1.4rem] border shadow-md transition-colors"
      style={{
        backgroundColor: isDarkMode ? "#102019" : "#FCF8F2",
        borderColor: isDarkMode ? "#425549" : "#D4C3AD",
        color: isDarkMode ? "#FFFFFF" : "#2B1A12",
      }}
    >
      <div className="flex items-start justify-between gap-3 p-3.5">
        <div className="min-w-0 flex-1">
          <p
            className="stat-card-label text-xs font-medium"
            style={{ color: isDarkMode ? "#D9C9B4" : "#8A6A55" }}
          >
            {label}
          </p>

          <div
            className="stat-card-value mt-1 truncate text-base font-bold leading-tight md:text-lg"
            style={{ color: isDarkMode ? "#FFFFFF" : "#2B1A12" }}
            title={String(value)}
          >
            {value}
          </div>

          <p
            className="stat-card-helper mt-0.5 text-[11px] leading-snug"
            style={{ color: isDarkMode ? "#D9C9B4" : "#8A6A55" }}
          >
            {helper}
          </p>
        </div>

        <div
          className="stat-card-icon grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-white"
          style={{ backgroundColor: iconBg[tone] || iconBg.slate }}
        >
          {React.cloneElement(icon, { className: "h-4 w-4" })}
        </div>
      </div>
    </div>
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

function ReportItem({ label, value, isDarkMode = false }) {
  const cardBg = isDarkMode ? "#102019" : "#FCF8F2";
  const border = isDarkMode ? "#425549" : "#D4C3AD";
  const mainText = isDarkMode ? "#FFFFFF" : "#2B1A12";
  const mutedText = isDarkMode ? "#D9C9B4" : "#8A6A55";

  return (
    <div
      className="rounded-2xl p-3"
      style={{
        backgroundColor: cardBg,
        border: `1px solid ${border}`,
      }}
    >
      <div
        className="text-[10px] font-semibold uppercase tracking-wide"
        style={{ color: mutedText }}
      >
        {label}
      </div>

      <div
        className="mt-1 truncate text-sm font-bold leading-tight"
        style={{ color: mainText }}
        title={String(value)}
      >
        {value}
      </div>
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
        className="h-9 w-full rounded-2xl border border-[#D4C3AD] bg-white px-3 text-xs text-[#2B1A12] outline-none focus:border-[#5C7768]"
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
        className="w-full resize-none rounded-2xl border border-[#D4C3AD] bg-white px-3 py-2 text-xs text-[#2B1A12] outline-none focus:border-[#5C7768]"
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
        className="h-9 w-full rounded-2xl border border-[#D4C3AD] bg-white px-2 text-xs text-[#2B1A12] outline-none focus:border-[#5C7768]"
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

function MiniSelect({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-2xl border border-[#D4C3AD] bg-white px-2 text-xs text-[#2B1A12] outline-none focus:border-[#5C7768]"
    >
      {options.map((option) => {
        const optionLabel = option === "updatedAt" ? "Latest update" : option === "clientName" ? "Client A-Z" : option === "ap" ? "Highest AP" : option;
        return (
          <option key={option} value={option}>
            {optionLabel}
          </option>
        );
      })}
    </select>
  );
}
