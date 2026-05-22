import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "eterna-retention-tracker-v1";
const EOD_STORAGE_KEY = "eterna-retention-eod-v1";
const GOOGLE_SHEET_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxQbzGV243t3Tyfyzc7kcZuvNEmscoGf0lpdSRft5VhUIL1Y_ALEc3mA7HIO4WgF_x4/exec";

const resultOptions = ["PENDING", "RESOLVED", "LOST"];
const priorityOptions = ["Normal", "High", "Urgent"];
const specialistOptions = ["", "Nisha", "Chen", "Rick"];
const actionOptions = ["", "Save", "Pending save", "Welcome call", "Onboarding", "UW Action Needed", "UW Resolved", "LOST", "Hang up", "Pending"];
const leadStatusOptions = ["", "NA", "NAA", "SRWT", "AS", "RTR", "CEP", "CWCC", "IUW", "UWAN", "UWAR", "UWSRWT"];

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

const blankEodForm = {
  date: new Date().toISOString().slice(0, 10),
  specialistName: "",
  totalDials: "",
  totalTalkTime: "",
  totalClientsTouched: "",
  totalPoliciesSaved: "",
  apSavedToday: "",
  cancelledClientsReinstated: "",
  welcomeOnboardingCompleted: "",
  apUwResolvedToday: "",
  uwPoliciesResolvedPending: "",
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function currency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function statusClass(status) {
  if (status === "RESOLVED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "LOST") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function priorityClass(priority) {
  if (priority === "Urgent") return "bg-rose-100 text-rose-700";
  if (priority === "High") return "bg-orange-100 text-orange-700";
  return "bg-[#EFE4D6] text-[#6B5C52]";
}

function escapeCsvCell(value) {
  const str = String(value || "");
  const quote = String.fromCharCode(34);
  const lineBreak = String.fromCharCode(10);
  const carriageReturn = String.fromCharCode(13);
  const needsQuotes = str.includes(",") || str.includes(quote) || str.includes(lineBreak) || str.includes(carriageReturn);
  if (!needsQuotes) return str;
  return quote + str.split(quote).join(quote + quote) + quote;
}

function toCsv(rows) {
  const headers = [
    "CLIENT NAME",
    "POLICY NUMBER",
    "AP",
    "LEAD STATUS",
    "AGENT NAME",
    "RESULT",
    "ACTION",
    "NOTES",
    "PRIORITY",
    "UPDATED AT",
    "SPECIALIST NAME",
  ];

  const body = rows.map((row) => [
    row.clientName,
    row.policyNumber,
    row.ap,
    row.leadStatus,
    row.agentName,
    row.result,
    row.action,
    row.notes,
    row.priority,
    row.updatedAt,
    row.specialistName,
  ].map(escapeCsvCell).join(","));

  return [headers.join(","), ...body].join(String.fromCharCode(10));
}

function toEodCsv(rows) {
  const headers = [
    "DATE",
    "SPECIALIST NAME",
    "TOTAL DIALS",
    "TOTAL TALK TIME FOR TODAY (MINUTES)",
    "TOTAL CLIENTS TOUCHED / REACHED / TEXTS",
    "TOTAL POLICIES SAVED",
    "AMOUNT OF AP SAVED TODAY ($)",
    "CANCELLED CLIENTS REINSTATED (AMOUNT) (AP)",
    "TOTAL WELCOME / ONBOARDING CALLS COMPLETED",
    "AMOUNT OF AP UW RESOLVED TODAY (PRE)",
    "UW POLICIES RESOLVED PENDING",
  ];

  const body = rows.map((row) => [
    row.date,
    row.specialistName,
    row.totalDials,
    row.totalTalkTime,
    row.totalClientsTouched,
    row.totalPoliciesSaved,
    row.apSavedToday,
    row.cancelledClientsReinstated,
    row.welcomeOnboardingCompleted,
    row.apUwResolvedToday,
    row.uwPoliciesResolvedPending,
  ].map(escapeCsvCell).join(","));

  return [headers.join(","), ...body].join(String.fromCharCode(10));
}

function downloadCsv(filename, csvText) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [rows, setRows] = useState([]);
  const [eodRows, setEodRows] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [eodForm, setEodForm] = useState(blankEodForm);
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState("case");
  const [query, setQuery] = useState("");
  const [resultFilter, setResultFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [specialistFilter, setSpecialistFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("updatedAt");
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setRows(JSON.parse(saved));
      const savedEod = window.localStorage.getItem(EOD_STORAGE_KEY);
      if (savedEod) setEodRows(JSON.parse(savedEod));
    } catch (error) {
      console.error("Could not load saved tracker data:", error);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch (error) {
      console.error("Could not save tracker data:", error);
    }
  }, [rows]);

  useEffect(() => {
    try {
      window.localStorage.setItem(EOD_STORAGE_KEY, JSON.stringify(eodRows));
    } catch (error) {
      console.error("Could not save EOD data:", error);
    }
  }, [eodRows]);

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
        const searchable = [row.clientName, row.policyNumber, row.agentName, row.specialistName, row.leadStatus, row.result, row.action, row.notes].join(" ").toLowerCase();
        return (
          (!q || searchable.includes(q)) &&
          (resultFilter === "ALL" || row.result === resultFilter) &&
          (priorityFilter === "ALL" || row.priority === priorityFilter) &&
          (specialistFilter === "ALL" || row.specialistName === specialistFilter)
        );
      })
      .sort((a, b) => {
        if (sortBy === "ap") return Number(b.ap || 0) - Number(a.ap || 0);
        if (sortBy === "clientName") return String(a.clientName || "").localeCompare(String(b.clientName || ""));
        return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
      });
  }, [rows, query, resultFilter, priorityFilter, specialistFilter, sortBy]);

  const topAgents = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      const key = row.agentName || "Unassigned";
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [rows]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateEodForm(field, value) {
    setEodForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setForm({ ...blankForm, updatedAt: new Date().toISOString().slice(0, 10) });
    setEditingId(null);
  }

  function resetEodForm() {
    setEodForm({ ...blankEodForm, date: new Date().toISOString().slice(0, 10) });
  }

  async function sendToGoogleSheet(data) {
    try {
      const formData = new URLSearchParams();
      formData.append("recordType", "case");
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
      await fetch(GOOGLE_SHEET_WEB_APP_URL, { method: "POST", mode: "no-cors", body: formData });
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
      const newCase = { id: makeId(), createdAt: new Date().toISOString().slice(0, 10), ...payload };
      setRows((current) => [newCase, ...current]);
      sendToGoogleSheet(newCase);
    }
    resetForm();
  }

  function submitEod(event) {
    event.preventDefault();
    if (!eodForm.specialistName) {
      alert("Please select a specialist name before saving EOD.");
      return;
    }
    const newEod = { id: makeId(), ...eodForm };
    setEodRows((current) => [newEod, ...current]);
    resetEodForm();
  }

  function editRow(row) {
    setActiveTab("case");
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteRow(id) {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  function quickResolve(id) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, result: "RESOLVED", updatedAt: new Date().toISOString().slice(0, 10) } : row));
  }

  function clearFilters() {
    setQuery("");
    setResultFilter("ALL");
    setPriorityFilter("ALL");
    setSpecialistFilter("ALL");
    setSortBy("updatedAt");
  }

  function exportAll() {
    downloadCsv(`eterna-retention-tracker-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
  }

  function exportToday() {
    const today = new Date().toISOString().slice(0, 10);
    const todayRows = rows.filter((row) => (row.createdAt || row.updatedAt) === today);
    downloadCsv(`eterna-retention-tracker-added-today-${today}.csv`, toCsv(todayRows));
  }

  function exportDateRange() {
    if (!exportStartDate || !exportEndDate) {
      alert("Please select both a start date and an end date.");
      return;
    }
    const rangeRows = rows.filter((row) => {
      const rowDate = row.createdAt || row.updatedAt || "";
      return rowDate >= exportStartDate && rowDate <= exportEndDate;
    });
    downloadCsv(`eterna-retention-tracker-${exportStartDate}-to-${exportEndDate}.csv`, toCsv(rangeRows));
  }

  function exportEod() {
    downloadCsv(`eterna-retention-eod-summary-${new Date().toISOString().slice(0, 10)}.csv`, toEodCsv(eodRows));
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#D8CBBE] text-[#5F5147]">
      <div className="mx-auto max-w-[1440px] px-4 py-5">
        <header className="mb-3 rounded-[1.6rem] bg-[#E8D8C3] px-5 py-4 text-[#5F5147] shadow-lg">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-1 inline-flex rounded-full bg-[#B8896A]/15 px-2.5 py-0.5 text-xs text-[#5F5147] ring-1 ring-[#B8896A]/20">Policy tracker app</div>
              <h1 className="text-3xl font-bold tracking-tight">Eterna Retention Tracker</h1>
              <p className="mt-1 max-w-3xl text-sm text-[#6B5C52]">Track clients, policies, AP, agent assignments, specialists, pending saves, welcome calls, onboarding, rewrites, and lost cases.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={exportToday} className="h-10 rounded-2xl bg-[#B8896A] px-4 text-sm font-medium text-white hover:bg-[#A8795C]">Export Today</button>
              <button type="button" onClick={exportAll} className="h-10 rounded-2xl bg-[#B8896A] px-4 text-sm font-medium text-white hover:bg-[#A8795C]">Export All</button>
            </div>
          </div>
        </header>

        <section className="mb-3 rounded-[1.4rem] bg-[#F7F1E8] p-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-sm font-bold">Export by Date Range</h2>
              <p className="text-xs text-[#6B5C52]">Select dates, then export only cases added or updated within that range.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[160px_160px_130px]">
              <label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#6B5C52]">Start date</span><input type="date" value={exportStartDate} onChange={(e) => setExportStartDate(e.target.value)} className="h-9 w-full rounded-2xl border border-[#D8C7B8] bg-[#FCF8F3] px-3 text-xs text-[#5F5147] outline-none focus:border-[#B8896A]" /></label>
              <label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#6B5C52]">End date</span><input type="date" value={exportEndDate} onChange={(e) => setExportEndDate(e.target.value)} className="h-9 w-full rounded-2xl border border-[#D8C7B8] bg-[#FCF8F3] px-3 text-xs text-[#5F5147] outline-none focus:border-[#B8896A]" /></label>
              <button type="button" onClick={exportDateRange} className="h-9 self-end rounded-2xl bg-[#B8896A] px-4 text-xs font-semibold text-white hover:bg-[#A8795C]">Export Range</button>
            </div>
          </div>
        </section>

        <section className="mb-3 grid gap-3 md:grid-cols-4">
          <StatCard label="Total Cases" value={stats.total} helper={`${stats.completionRate}% resolved`} />
          <StatCard label="Pending" value={stats.pending} helper={currency(stats.pendingAp)} tone="amber" />
          <StatCard label="Resolved" value={stats.resolved} helper="Completed cases" tone="emerald" />
          <StatCard label="Total AP" value={currency(stats.totalAp)} helper={`${stats.lost} lost cases`} />
        </section>

        <main className="grid gap-4 xl:grid-cols-[390px_1fr]">
          <section className="rounded-[1.6rem] bg-[#F7F1E8] p-4 shadow-sm">
            <div className="mb-4 grid grid-cols-2 rounded-2xl bg-[#EFE4D6] p-1">
              <button type="button" onClick={() => setActiveTab("case")} className={`rounded-xl px-3 py-2 text-sm font-semibold ${activeTab === "case" ? "bg-[#B8896A] text-white" : "text-[#5F5147]"}`}>New Case</button>
              <button type="button" onClick={() => setActiveTab("eod")} className={`rounded-xl px-3 py-2 text-sm font-semibold ${activeTab === "eod" ? "bg-[#B8896A] text-white" : "text-[#5F5147]"}`}>EOD</button>
            </div>

            {activeTab === "case" ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <div><h2 className="text-lg font-bold">{editingId ? "Edit case" : "Add new case"}</h2><p className="text-xs text-[#6B5C52]">Fast entry for daily tracking.</p></div>
                  {editingId && <button type="button" onClick={resetForm} className="rounded-xl px-3 py-2 text-xs font-medium hover:bg-[#EFE4D6]">Cancel</button>}
                </div>
                <form onSubmit={submitForm} className="space-y-2">
                  <Input label="Client name" value={form.clientName} onChange={(v) => updateForm("clientName", v)} required />
                  <div className="grid grid-cols-2 gap-2"><Input label="Policy number" value={form.policyNumber} onChange={(v) => updateForm("policyNumber", v)} /><Input label="AP" type="number" value={form.ap} onChange={(v) => updateForm("ap", v)} /></div>
                  <div className="grid grid-cols-2 gap-2"><Select label="Lead status" value={form.leadStatus} onChange={(v) => updateForm("leadStatus", v)} options={leadStatusOptions} /><Input label="Agent name" value={form.agentName} onChange={(v) => updateForm("agentName", v)} /></div>
                  <Select label="Specialist name" value={form.specialistName} onChange={(v) => updateForm("specialistName", v)} options={specialistOptions} />
                  <div className="grid grid-cols-3 gap-2"><Select label="Result" value={form.result} onChange={(v) => updateForm("result", v)} options={resultOptions} /><Select label="Priority" value={form.priority} onChange={(v) => updateForm("priority", v)} options={priorityOptions} /><Input label="Updated" type="date" value={form.updatedAt} onChange={(v) => updateForm("updatedAt", v)} /></div>
                  <Select label="Action" value={form.action} onChange={(v) => updateForm("action", v)} options={actionOptions} />
                  <Textarea label="Notes" value={form.notes} onChange={(v) => updateForm("notes", v)} placeholder="Callback time, issue, next step..." />
                  <button type="submit" className="h-11 w-full rounded-2xl bg-[#B8896A] text-sm font-semibold text-white hover:bg-[#A8795C]">{editingId ? "Save changes" : "Add case"}</button>
                </form>
              </>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <div><h2 className="text-lg font-bold">EOD Summary</h2><p className="text-xs text-[#6B5C52]">End-of-day numbers. This stays in the tracker app and exports as CSV only.</p></div>
                  <button type="button" onClick={exportEod} className="rounded-xl bg-[#B8896A] px-3 py-2 text-xs font-semibold text-white hover:bg-[#A8795C]">Export</button>
                </div>
                <form onSubmit={submitEod} className="space-y-2">
                  <Input label="Date" type="date" value={eodForm.date} onChange={(v) => updateEodForm("date", v)} />
                  <Select label="Specialist name" value={eodForm.specialistName} onChange={(v) => updateEodForm("specialistName", v)} options={specialistOptions} />
                  <div className="grid grid-cols-2 gap-2"><Input label="Total dials" type="number" value={eodForm.totalDials} onChange={(v) => updateEodForm("totalDials", v)} /><Input label="Total talk time today (minutes)" type="number" value={eodForm.totalTalkTime} onChange={(v) => updateEodForm("totalTalkTime", v)} /></div>
                  <Input label="Total clients touched / reached / texts" type="number" value={eodForm.totalClientsTouched} onChange={(v) => updateEodForm("totalClientsTouched", v)} />
                  <div className="grid grid-cols-2 gap-2"><Input label="Total policies saved" type="number" value={eodForm.totalPoliciesSaved} onChange={(v) => updateEodForm("totalPoliciesSaved", v)} /><Input label="Amount of AP saved today ($)" type="number" value={eodForm.apSavedToday} onChange={(v) => updateEodForm("apSavedToday", v)} /></div>
                  <Input label="Cancelled clients reinstated (amount) (AP)" type="number" value={eodForm.cancelledClientsReinstated} onChange={(v) => updateEodForm("cancelledClientsReinstated", v)} />
                  <Input label="Total welcome / onboarding calls completed" type="number" value={eodForm.welcomeOnboardingCompleted} onChange={(v) => updateEodForm("welcomeOnboardingCompleted", v)} />
                  <Input label="Amount of AP UW resolved today (pre)" type="number" value={eodForm.apUwResolvedToday} onChange={(v) => updateEodForm("apUwResolvedToday", v)} />
                  <Input label="UW policies resolved pending" type="number" value={eodForm.uwPoliciesResolvedPending} onChange={(v) => updateEodForm("uwPoliciesResolvedPending", v)} />
                  <button type="submit" className="h-11 w-full rounded-2xl bg-[#B8896A] text-sm font-semibold text-white hover:bg-[#A8795C]">Save EOD</button>
                </form>
                {eodRows.length > 0 && <div className="mt-4 rounded-2xl bg-[#EFE4D6] p-3"><h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#6B5C52]">Latest EOD</h3><div className="text-sm font-semibold">{eodRows[0].date}</div><div className="mt-1 text-xs text-[#6B5C52]">Specialist: {eodRows[0].specialistName || "—"}</div><div className="mt-1 text-xs text-[#6B5C52]">Dials: {eodRows[0].totalDials || 0} • Saved: {eodRows[0].totalPoliciesSaved || 0} • AP Saved: {currency(eodRows[0].apSavedToday || 0)}</div></div>}
              </>
            )}
          </section>

          <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-start">
            <div className="rounded-[1.4rem] bg-[#F7F1E8] p-2.5 shadow-sm">
              <div className="grid items-center gap-2 lg:grid-cols-[115px_1fr_105px_105px_105px_110px_64px]">
                <div><h2 className="text-sm font-bold">Work queue</h2><p className="text-[10px] leading-3 text-[#6B5C52]">Search & filter.</p></div>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search client, policy, agent, specialist, notes..." className="h-8 w-full rounded-2xl border border-[#D8C7B8] bg-[#FCF8F3] px-3 text-xs text-[#5F5147] outline-none focus:border-[#B8896A]" />
                <MiniSelect value={resultFilter} onChange={setResultFilter} options={["ALL", ...resultOptions]} placeholder="Status" />
                <MiniSelect value={priorityFilter} onChange={setPriorityFilter} options={["ALL", ...priorityOptions]} placeholder="Priority" />
                <MiniSelect value={specialistFilter} onChange={setSpecialistFilter} options={["ALL", "Nisha", "Chen", "Rick"]} placeholder="Specialist" />
                <MiniSelect value={sortBy} onChange={setSortBy} options={["updatedAt", "ap", "clientName"]} />
                <button type="button" onClick={clearFilters} className="h-8 rounded-2xl border border-[#D8C7B8] px-2 text-xs hover:bg-[#EFE4D6]">Clear</button>
              </div>
            </div>

            <aside className="rounded-[1.4rem] bg-[#F7F1E8] p-2.5 shadow-sm">
              <h3 className="mb-2 text-xs font-bold">Agent load</h3>
              <div className="space-y-1.5">
                {topAgents.map(([agent, count]) => {
                  const width = stats.total ? Math.max(8, Math.round((count / stats.total) * 100)) : 0;
                  return <div key={agent}><div className="mb-1 flex items-center justify-between gap-1 text-[10px]"><span className="max-w-[125px] truncate font-medium text-[#5F5147]" title={agent}>{agent}</span><span className="text-[#6B5C52]">{count}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#EFE4D6]"><div className="h-full rounded-full bg-[#B8896A]" style={{ width: `${width}%` }} /></div></div>;
                })}
                {!topAgents.length && <p className="text-[11px] text-[#6B5C52]">No agent data yet.</p>}
              </div>
            </aside>

            <section className="overflow-hidden rounded-[1.6rem] bg-[#F7F1E8] shadow-sm lg:col-start-1 lg:-mt-88">
              <table className="w-full table-fixed text-left text-[11px]">
                <thead className="bg-[#EFE4D6] text-[10px] uppercase tracking-wide text-[#6B5C52]"><tr><th className="w-[17%] px-3 py-3">Client</th><th className="w-[13%] px-2 py-3">Policy</th><th className="w-[10%] px-2 py-3">AP</th><th className="w-[9%] px-2 py-3">Stage</th><th className="w-[14%] px-2 py-3">Agent</th><th className="w-[12%] px-2 py-3">Status</th><th className="w-[17%] px-2 py-3">Action</th><th className="w-[8%] px-2 py-3 text-right">Tools</th></tr></thead>
                <tbody className="divide-y divide-[#E7D8C8]">
                  {filteredRows.map((row) => <tr key={row.id} className="align-top hover:bg-[#EFE4D6]">
                    <td className="break-words px-3 py-3"><div className="group relative inline-block"><div className="font-semibold text-[#4F4038]">{row.clientName}</div>{row.notes && <div className="pointer-events-none absolute left-0 top-full z-50 mt-2 hidden w-64 rounded-2xl bg-[#4F4038] px-3 py-2 text-xs leading-5 text-white shadow-xl group-hover:block">{row.notes}</div>}</div><div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-[#6B5C52]">{row.updatedAt}<span className={`rounded-full px-1.5 py-0.5 ${priorityClass(row.priority)}`}>{row.priority}</span></div></td>
                    <td className="break-words px-2 py-3 font-mono text-[10px] text-[#6B5C52]">{row.policyNumber}</td><td className="break-words px-2 py-3 font-semibold">{currency(row.ap)}</td><td className="px-2 py-3"><span className="rounded-full bg-[#EFE4D6] px-1.5 py-0.5 text-[10px] font-semibold text-[#6B5C52]">{row.leadStatus || "—"}</span></td><td className="break-words px-2 py-3 text-[#5F5147]">{row.agentName || "—"}</td><td className="px-2 py-3"><span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${statusClass(row.result)}`}>{row.result}</span></td><td className="break-words px-2 py-3"><div className="font-medium text-[#4F4038]">{row.action || "—"}</div></td><td className="px-2 py-3"><div className="flex justify-end gap-1"><button type="button" onClick={() => quickResolve(row.id)} title="Mark resolved" className="rounded-lg px-1.5 py-1 hover:bg-[#EFE4D6]">✓</button><button type="button" onClick={() => editRow(row)} title="Edit" className="rounded-lg px-1.5 py-1 hover:bg-[#EFE4D6]">✎</button><button type="button" onClick={() => deleteRow(row.id)} title="Delete" className="rounded-lg px-1.5 py-1 text-rose-600 hover:bg-rose-50">x</button></div></td>
                  </tr>)}
                </tbody>
              </table>
              {!filteredRows.length && <div className="flex min-h-[320px] flex-col items-center justify-center bg-[#F7F1E8] px-6 text-center"><h3 className="text-lg font-bold">No cases found</h3><p className="mt-1 text-sm text-[#6B5C52]">Try changing your search or filters.</p></div>}
            </section>
          </section>
        </main>
      </div>
    </div>
  );
}

function StatCard({ label, value, helper, tone = "slate" }) {
  const color = tone === "amber" ? "bg-[#D9A866]" : tone === "emerald" ? "bg-[#8AA382]" : "bg-[#B8896A]";
  return <div className="rounded-[1.4rem] bg-[#F7F1E8] p-3.5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-[#6B5C52]">{label}</p><div className="mt-1 text-xl font-bold tracking-tight text-[#5F5147]">{value}</div><p className="mt-0.5 text-xs text-[#6B5C52]">{helper}</p></div><div className={`h-9 w-9 rounded-2xl ${color}`} /></div></div>;
}

function Input({ label, value, onChange, type = "text", required = false, placeholder = "" }) {
  return <label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#6B5C52]">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} placeholder={placeholder} className="h-9 w-full rounded-2xl border border-[#D8C7B8] bg-[#FCF8F3] px-3 text-xs text-[#5F5147] outline-none focus:border-[#B8896A]" /></label>;
}

function Textarea({ label, value, onChange, placeholder = "" }) {
  return <label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#6B5C52]">{label}</span><textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={2} className="w-full resize-none rounded-2xl border border-[#D8C7B8] bg-[#FCF8F3] px-3 py-2 text-xs text-[#5F5147] outline-none focus:border-[#B8896A]" /></label>;
}

function Select({ label, value, onChange, options }) {
  return <label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#6B5C52]">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-2xl border border-[#D8C7B8] bg-[#FCF8F3] px-2 text-xs text-[#5F5147] outline-none focus:border-[#B8896A]">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function MiniSelect({ value, onChange, options, placeholder = "ALL" }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} className="h-8 rounded-2xl border border-[#D8C7B8] bg-[#FCF8F3] px-2 text-xs text-[#5F5147] outline-none focus:border-[#B8896A]">{options.map((option) => <option key={option} value={option}>{option === "ALL" ? placeholder : option === "updatedAt" ? "Latest" : option === "clientName" ? "A-Z" : option === "ap" ? "High AP" : option}</option>)}</select>;
}
