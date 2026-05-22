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
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const STORAGE_KEY = "chen-policy-tracker-v1";
const GOOGLE_SHEET_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxQbzGV243t3Tyfyzc7kcZuvNEmscoGf0lpdSRft5VhUIL1Y_ALEc3mA7HIO4WgF_x4/exec";

const starterRows = [];

const blankForm = {
  clientName: "",
  policyNumber: "",
  ap: "",
  leadStatus: "",
  agentName: "",
  result: "PENDING",
  action: "",
  notes: "",
  priority: "Normal",
  updatedAt: new Date().toISOString().slice(0, 10),
};

const resultOptions = ["PENDING", "RESOLVED", "LOST"];
const priorityOptions = ["Normal", "High", "Urgent"];

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
  if (upper === "RESOLVED") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (upper === "LOST") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function priorityClasses(priority) {
  if (priority === "Urgent") return "bg-rose-100 text-rose-700";
  if (priority === "High") return "bg-orange-100 text-orange-700";
  return "bg-slate-100 text-slate-600";
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
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
    "PENDING OR RESOLVED?",
    "ACTION",
    "NOTES",
    "PRIORITY",
    "UPDATED AT",
  ];

  const escape = (value) => {
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

export default function ChenTrackerApp() {
  const [rows, setRows] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : starterRows;
    } catch {
      return starterRows;
    }
  });
  const [form, setForm] = useState(blankForm);
  const [editingId, setEditingId] = useState(null);
  const [query, setQuery] = useState("");
  const [resultFilter, setResultFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("updatedAt");

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
          row.leadStatus,
          row.result,
          row.action,
          row.notes,
        ]
          .join(" ")
          .toLowerCase();
        const matchesQuery = !q || searchable.includes(q);
        const matchesResult = resultFilter === "ALL" || row.result === resultFilter;
        const matchesPriority = priorityFilter === "ALL" || row.priority === priorityFilter;
        return matchesQuery && matchesResult && matchesPriority;
      })
      .sort((a, b) => {
        if (sortBy === "ap") return Number(b.ap || 0) - Number(a.ap || 0);
        if (sortBy === "clientName") return a.clientName.localeCompare(b.clientName);
        return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
      });
  }, [rows, query, resultFilter, priorityFilter, sortBy]);

  const topAgents = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      const key = row.agentName || "Unassigned";
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [rows]);

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
    setEditingId(row.id);
    setForm({
      clientName: row.clientName || "",
      policyNumber: row.policyNumber || "",
      ap: row.ap || "",
      leadStatus: row.leadStatus || "",
      agentName: row.agentName || "",
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
      current.map((row) =>
        row.id === id ? { ...row, result, updatedAt: new Date().toISOString().slice(0, 10) } : row
      )
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

  function resetDemoData() {
    setRows([]);
    localStorage.removeItem(STORAGE_KEY);
    resetForm();
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#6590BD] text-slate-950">
      <div className="mx-auto max-w-[1440px] px-4 py-5">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-3 rounded-[1.6rem] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-5 py-4 text-white shadow-lg"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-slate-200 ring-1 ring-white/15">
                <FileSpreadsheet className="h-3.5 w-3.5" /> Policy tracker app
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Eterna Retention Tracker</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-300">
                Track clients, policies, AP, agent assignments, pending saves, welcome calls, onboarding, rewrites, and lost cases.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button onClick={exportTodayCsv} className="rounded-2xl bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/15">
                <Download className="mr-2 h-4 w-4" /> Export Today
              </Button>
              <Button onClick={exportCsv} className="rounded-2xl bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/15">
                <Download className="mr-2 h-4 w-4" /> Export All
              </Button>
              <label className="inline-flex h-10 cursor-pointer items-center rounded-2xl bg-white/10 px-4 text-sm font-medium text-white ring-1 ring-white/15 hover:bg-white/15">
                <Upload className="mr-2 h-4 w-4" /> Import CSV
                <input type="file" accept=".csv" className="hidden" onChange={importCsv} />
              </label>
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
          <Card className="rounded-[1.6rem] border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">{editingId ? "Edit case" : "Add new case"}</h2>
                  <p className="text-xs text-slate-500">Fast entry for daily tracking.</p>
                </div>
                {editingId && (
                  <Button variant="ghost" size="sm" onClick={resetForm} className="rounded-xl">
                    <X className="mr-1 h-4 w-4" /> Cancel
                  </Button>
                )}
              </div>

              <form onSubmit={submitForm} className="space-y-2">
                <Input label="Client name" value={form.clientName} onChange={(v) => updateForm("clientName", v)} required />
                <div className="grid grid-cols-2 gap-2">
                  <Input label="Policy number" value={form.policyNumber} onChange={(v) => updateForm("policyNumber", v)} />
                  <Input label="AP" type="number" value={form.ap} onChange={(v) => updateForm("ap", v)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input label="Lead status" value={form.leadStatus} onChange={(v) => updateForm("leadStatus", v)} placeholder="CWCN" />
                  <Input label="Agent name" value={form.agentName} onChange={(v) => updateForm("agentName", v)} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Select label="Result" value={form.result} onChange={(v) => updateForm("result", v)} options={resultOptions} />
                  <Select label="Priority" value={form.priority} onChange={(v) => updateForm("priority", v)} options={priorityOptions} />
                  <Input label="Updated" type="date" value={form.updatedAt} onChange={(v) => updateForm("updatedAt", v)} />
                </div>
                <Textarea label="Action" value={form.action} onChange={(v) => updateForm("action", v)} placeholder="Pending save / Welcome call / Payment confirmation" />
                <Textarea label="Notes" value={form.notes} onChange={(v) => updateForm("notes", v)} placeholder="Callback time, issue, next step..." />
                <Button type="submit" className="h-11 w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-800">
                  {editingId ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                  {editingId ? "Save changes" : "Add case"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="grid gap-3">
            <Card className="rounded-[1.4rem] border-0 shadow-sm lg:mr-[192px]">
              <CardContent className="p-2.5">
                <div className="grid items-center gap-2 lg:grid-cols-[115px_1fr_105px_105px_110px_64px]">
                  <div>
                    <h2 className="flex items-center gap-1.5 text-sm font-bold">
                      <Filter className="h-4 w-4" /> Work queue
                    </h2>
                    <p className="text-[10px] leading-3 text-slate-500">Search & filter.</p>
                  </div>
                                    <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search client, policy, agent, notes..."
                      className="h-8 w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-slate-400"
                    />
                  </div>
                  <MiniSelect value={resultFilter} onChange={setResultFilter} options={["ALL", ...resultOptions]} />
                  <MiniSelect value={priorityFilter} onChange={setPriorityFilter} options={["ALL", ...priorityOptions]} />
                  <MiniSelect value={sortBy} onChange={setSortBy} options={["updatedAt", "ap", "clientName"]} />
                  <Button variant="outline" size="sm" onClick={resetDemoData} className="h-8 rounded-2xl px-2 text-xs">
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
              <Card className="rounded-[1.6rem] border-0 shadow-sm">
                <CardContent className="p-0">
                  <div className="overflow-hidden rounded-[1.6rem]">
                    <table className="w-full table-fixed text-left text-[11px]">
                      <thead className="sticky top-0 z-10 bg-slate-100 text-[11px] uppercase tracking-wide text-slate-500">
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
                      <tbody className="divide-y divide-slate-100">
                        {filteredRows.map((row) => (
                          <tr key={row.id} className="bg-white align-top hover:bg-slate-50/80">
                            <td className="break-words px-3 py-3">
                              <div className="font-semibold text-slate-950">{row.clientName}</div>
                              <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                                {row.updatedAt}
                                <span className={`rounded-full px-2 py-0.5 ${priorityClasses(row.priority)}`}>{row.priority}</span>
                              </div>
                            </td>
                            <td className="break-words px-2 py-3 font-mono text-[10px] text-slate-600">{row.policyNumber}</td>
                            <td className="break-words px-2 py-3 font-semibold">{currency(row.ap)}</td>
                            <td className="px-2 py-3">
                              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">{row.leadStatus || "—"}</span>
                            </td>
                            <td className="break-words px-2 py-3 text-slate-700">{row.agentName || "—"}</td>
                            <td className="px-2 py-3">
                              <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${statusClasses(row.result)}`}>
                                {row.result === "RESOLVED" && <CheckCircle2 className="mr-1 h-3 w-3" />}
                                {row.result === "PENDING" && <Clock3 className="mr-1 h-3 w-3" />}
                                {row.result === "LOST" && <XCircle className="mr-1 h-3 w-3" />}
                                {row.result}
                              </span>
                            </td>
                            <td className="break-words px-2 py-3">
                              <div className="font-medium text-slate-800">{row.action || "—"}</div>
                              {row.notes && <div className="mt-0.5 text-[10px] leading-4 text-slate-500">{row.notes}</div>}
                            </td>
                            <td className="px-2 py-3">
                              <div className="flex justify-end gap-0.5">
                                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-xl" onClick={() => quickStatus(row.id, "RESOLVED")} title="Mark resolved">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-xl" onClick={() => editRow(row)} title="Edit">
                                  <Edit3 className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl text-rose-600 hover:text-rose-700" onClick={() => deleteRow(row.id)} title="Delete">
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
                        <AlertTriangle className="mb-3 h-10 w-10 text-slate-300" />
                        <h3 className="text-lg font-bold">No cases found</h3>
                        <p className="mt-1 text-sm text-slate-500">Try changing your search or filters.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[1.4rem] border-0 shadow-sm">
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
                            <span className="max-w-[125px] truncate font-medium text-slate-700" title={agent}>{agent}</span>
                            <span className="text-slate-500">{count}</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-slate-900" style={{ width: `${width}%` }} />
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
    slate: "bg-slate-950 text-white",
    amber: "bg-amber-500 text-white",
    emerald: "bg-emerald-600 text-white",
  };
  return (
    <Card className="rounded-[1.4rem] border-0 shadow-sm">
      <CardContent className="p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <div className="mt-1 text-xl font-bold tracking-tight">{value}</div>
            <p className="mt-0.5 text-xs text-slate-500">{helper}</p>
          </div>
          <div className={`rounded-2xl p-2.5 ${tones[tone]}`}>{React.cloneElement(icon, { className: "h-4 w-4" })}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Input({ label, value, onChange, type = "text", required = false, placeholder = "" }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="h-9 w-full rounded-2xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-slate-400"
      />
    </label>
  );
}

function Textarea({ label, value, onChange, placeholder = "" }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-slate-400"
      />
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-2xl border border-slate-200 bg-white px-2 text-xs outline-none focus:border-slate-400"
      >
        {options.map((option) => (
          <option key={option} value={option}>
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
      className="h-8 rounded-2xl border border-slate-200 bg-white px-2 text-xs outline-none focus:border-slate-400"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option === "updatedAt" ? "Latest update" : option === "clientName" ? "Client A-Z" : option === "ap" ? "Highest AP" : option}
        </option>
      ))}
    </select>
  );
}
