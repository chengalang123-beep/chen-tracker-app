import React, { useState, useMemo, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────
// GOOGLE SHEETS URLS
// ─────────────────────────────────────────────
const GOOGLE_SHEET_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbxbNbAYvCGjA2oNLjEa_qVi_p4RWxMo9vHm9hXicdHcuIzZIYb_nGzXo9xzVHE_Bfc9/exec";

const GOOGLE_SHEET_VIEW_URL =
  "https://docs.google.com/spreadsheets/d/1ZTk5rV-4qFQWTxC0VYovD45Y8bHtHDI8dA1tfREge0A/edit?usp=sharing";

// ─────────────────────────────────────────────
// STORAGE KEYS
// ─────────────────────────────────────────────
const STORAGE_KEY          = "eterna-tracker-rows-v1";
const INBOUND_STORAGE_KEY  = "eterna-inbound-v1";
const EOD_STORAGE_KEY      = "eterna-eod-v1";
const DARK_MODE_KEY        = "eterna-dark-mode-v1";

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const TODAY = new Date().toISOString().slice(0, 10);

const ACTION_OPTS   = ["", "Pending Save", "Welcome Call", "Onboarding Call", "Pending Agent Assist", "Save", "UW Action Needed", "UW Action Resolved", "Lost", "Hang up"];
const LEAD_OPTS     = ["", "NA", "NAA", "SRWT", "AS", "RTR", "CEP", "AYAR", "CWCC", "IUW", "UWAN", "UWAR", "UWSRWT"];
const SPEC_OPTS     = ["", "Nisha", "Rick", "Chen", "Fernando", "Angie"];
const PRIORITY_OPTS = ["Normal", "High", "Urgent"];
const RESULT_OPTS   = ["PENDING", "RESOLVED", "LOST"];

const BLANK_FORM = {
  clientName: "", policyNumber: "", ap: "", leadStatus: "",
  agentName: "", specialistName: "", result: "PENDING",
  action: "", notes: "", priority: "Normal", updatedAt: TODAY,
};

const BLANK_EOD = {
  specialistName: "", date: TODAY, totalDials: "", totalTalkTime: "",
  clientsReached: "", welcomeCallsCompleted: "",
  atRiskResolvedPre: "", atRiskResolvedConfirmed: "",
  apSavedPre: "", apSavedConfirmed: "",
  uwPoliciesResolved: "", pendingResolution: "",
  savedPendingConfirmation: "", savedConfirmed: "",
  uwResolvedNotConfirmedDetails: "", uwConfirmedResolvedDetails: "",
  escalationsAgentActionNeeded: "",
};

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const cur = (v) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(v || 0));

const getWTD = () => {
  const n = new Date(), d = n.getDay(), diff = d === 0 ? 6 : d - 1, m = new Date(n);
  m.setDate(n.getDate() - diff);
  return m.toISOString().slice(0, 10);
};
const getMTD = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0, 10);
};

function safeLoad(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch { return fallback; }
}
function safeSave(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

// Deduplication for tracker rows
function dedupeRows(sourceRows) {
  const map = new Map();
  sourceRows.forEach((row) => {
    const pn = String(row.policyNumber || "").trim().toLowerCase();
    const cn = String(row.clientName  || "").trim().toLowerCase();
    const sn = String(row.specialistName || "").trim().toLowerCase();
    const ap = String(row.ap || "").trim();
    const key = pn ? `policy:${pn}` : `client:${cn}|spec:${sn}|ap:${ap}`;
    const existing = map.get(key);
    if (!existing) { map.set(key, row); return; }
    const ed = String(existing.updatedAt || existing.createdAt || "");
    const rd = String(row.updatedAt      || row.createdAt      || "");
    if (rd >= ed) map.set(key, row);
  });
  return Array.from(map.values());
}

// Validate a row is a real tracker row (not a header/junk row)
function isRealRow(row) {
  const bad = ["save","pending save","welcome call","onboarding call","uw action needed","uw action resolved","lost","client name","policy number","ap","lead status","agent name","result","status","action","notes","priority","updated at","specialist name","created at"];
  const cn = String(row?.clientName || "").trim();
  const sn = String(row?.specialistName || "").trim();
  if (!cn || bad.includes(cn.toLowerCase())) return false;
  if (!["Nisha","Rick","Chen","Fernando","Angie","Unassigned"].includes(sn)) return false;
  const ud = String(row?.updatedAt || "");
  const cd = String(row?.createdAt || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(ud) || /^\d{4}-\d{2}-\d{2}$/.test(cd);
}

// ─────────────────────────────────────────────
// COLOR SYSTEM
// ─────────────────────────────────────────────
const STATUS_META = {
  PENDING:  { dot: "#E09B3D", label: "Pending",  bg: "#FFF1D8", text: "#9A5B12", border: "#F1C27D" },
  RESOLVED: { dot: "#5A9040", label: "Resolved", bg: "#EEF7E8", text: "#4C6B2F", border: "#BDD6A6" },
  LOST:     { dot: "#C04030", label: "Lost",     bg: "#FCE8DF", text: "#9D3F23", border: "#F0B49C" },
};

function kpiColor(key, isDark) {
  const L = { total:"#5B3320", ps:"#C07820", sv:"#4C6B2F", uwr:"#2E6680", lost:"#9D3F23", psAp:"#C07820", svAp:"#4C6B2F" };
  const D = { total:"#D4A870", ps:"#F0B84A", sv:"#7DC860",  uwr:"#60C0E0", lost:"#F07850", psAp:"#F0B84A", svAp:"#7DC860" };
  return isDark ? D[key] : L[key];
}
function rptColor(key, isDark) {
  const L = { total:"#5B3320", sv:"#4C6B2F", ps:"#C07820", lost:"#9D3F23" };
  const D = { total:"#D4A870", sv:"#7DC860",  ps:"#F0B84A", lost:"#F07850" };
  return isDark ? D[key] : L[key];
}

// ─────────────────────────────────────────────
// THEME TOKENS
// ─────────────────────────────────────────────
function useTheme(isDark) {
  return useMemo(() => {
    if (isDark) return {
      pageBg:         "linear-gradient(135deg,#0E1A15 0%,#162219 48%,#1A1A12 100%)",
      color:          "#EAE0D0",
      topbarBg:       "#162219",   topbarBorder:    "#2D4035",
      cardBg:         "#162219",   cardBorder:      "#2D4035",
      cardHover:      "#1C2E24",   cardHoverBorder: "#3A5045",
      inputBg:        "#0E1A15",   inputBorder:     "#2D4035",
      inputColor:     "#EAE0D0",   inputPh:         "#4A6A58",  inputFocus: "#4A8A65",
      sideHeadBg:     "#1A2E22",   labelColor:      "#7A9E8A",
      mutedColor:     "#7A9E8A",   dimColor:        "#5A7A68",
      rptCellBg:      "#1A2E22",   inboundCardBg:   "#1A2E22",
      agentTrackBg:   "#0E1A15",   agentFillBg:     "#3A6E50",
      emptyBg:        "#162219",
      pillOnBg:       "#7A4A28",   pillOnColor:     "#FFE0BC",  pillOnBorder: "#7A4A28",
      sideTitle:      "#E8B87A",
      saveBtnBg:      "#7A4A28",   saveBtnColor:    "#FFE0BC",
      modalBg:        "#162219",
      stageTagBg:     "#1A2E22",   stageTagColor:   "#C8B89A",  stageTagBorder: "#2D4035",
      toolResBg:      "rgba(76,107,47,0.25)",  toolResBorder:  "#4A8050",  toolResColor:  "#7DC860",
      toolEditBg:     "rgba(46,100,128,0.25)", toolEditBorder: "#2E6680",  toolEditColor: "#60B4DC",
      toolDelBg:      "rgba(157,63,35,0.25)",  toolDelBorder:  "#8A3520",  toolDelColor:  "#F08060",
      toastSuccess:   "#3A6E50",   toastError:      "#9D3F23",  toastInfo:    "#5C7768",
    };
    return {
      pageBg:         "linear-gradient(135deg,#F6EFE4 0%,#E7DCCB 45%,#D6C8B5 100%)",
      color:          "#2B1A12",
      topbarBg:       "#E9DECC",   topbarBorder:    "#D4C3AD",
      cardBg:         "#FCF8F2",   cardBorder:      "#DDD0BB",
      cardHover:      "#F6EEE3",   cardHoverBorder: "#C4A882",
      inputBg:        "#FFFFFF",   inputBorder:     "#D4C3AD",
      inputColor:     "#2B1A12",   inputPh:         "#B28A6B",  inputFocus: "#5C7768",
      sideHeadBg:     "#F6EEE3",   labelColor:      "#8A6A55",
      mutedColor:     "#8A6A55",   dimColor:        "#B28A6B",
      rptCellBg:      "#F6EEE3",   inboundCardBg:   "#F6EEE3",
      agentTrackBg:   "#EDE5D7",   agentFillBg:     "#5C7768",
      emptyBg:        "#FCF8F2",
      pillOnBg:       "#5B3320",   pillOnColor:     "#FFFFFF",  pillOnBorder: "#5B3320",
      sideTitle:      "#5B3320",
      saveBtnBg:      "#5B3320",   saveBtnColor:    "#FFFFFF",
      modalBg:        "#FCF8F2",
      stageTagBg:     "#EFE6D8",   stageTagColor:   "#6D6256",  stageTagBorder: "#D4C3AD",
      toolResBg:      "#EEF7E8",   toolResBorder:   "#BDD6A6",  toolResColor:   "#4C6B2F",
      toolEditBg:     "#E8EEF0",   toolEditBorder:  "#AABFC8",  toolEditColor:  "#2E5566",
      toolDelBg:      "#FCE8DF",   toolDelBorder:   "#F0B49C",  toolDelColor:   "#9D3F23",
      toastSuccess:   "#4C6B2F",   toastError:      "#9D3F23",  toastInfo:      "#5C7768",
    };
  }, [isDark]);
}

// ─────────────────────────────────────────────
// SMALL COMPONENTS
// ─────────────────────────────────────────────
function StatusChip({ status }) {
  const m = STATUS_META[status] || STATUS_META.PENDING;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, background:m.bg, color:m.text, border:`1px solid ${m.border}`, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700 }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:m.dot, flexShrink:0 }} />
      {m.label}
    </span>
  );
}

function PriorityChip({ priority }) {
  if (priority === "Normal") return null;
  const s = priority === "Urgent"
    ? { background:"#FCE8DF", color:"#9D3F23", border:"1px solid #F0B49C" }
    : { background:"#FFE6C7", color:"#A65B17", border:"1px solid #F1C27D" };
  return <span style={{ display:"inline-flex", alignItems:"center", borderRadius:5, padding:"2px 6px", fontSize:10, fontWeight:700, ...s }}>{priority}</span>;
}

function StageTag({ s, t }) {
  return (
    <span style={{ background:t.stageTagBg, color:t.stageTagColor, border:`1px solid ${t.stageTagBorder}`, borderRadius:5, padding:"2px 6px", fontSize:10, fontWeight:700, fontFamily:"monospace" }}>
      {s || "—"}
    </span>
  );
}

function FL({ children, t }) {
  return <span style={{ display:"block", fontSize:10, fontWeight:700, color:t.labelColor, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>{children}</span>;
}

function FI({ value, onChange, type="text", placeholder="", t, style={} }) {
  const base = { width:"100%", height:31, background:t.inputBg, border:`1px solid ${t.inputBorder}`, borderRadius:7, padding:"0 9px", fontSize:12, color:t.inputColor, outline:"none", boxSizing:"border-box", fontFamily:"inherit", ...style };
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={base}
      onFocus={(e) => (e.target.style.borderColor = t.inputFocus)}
      onBlur={(e)  => (e.target.style.borderColor = t.inputBorder)} />
  );
}

function FS({ value, onChange, options, t }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      style={{ width:"100%", height:31, background:t.inputBg, border:`1px solid ${t.inputBorder}`, borderRadius:7, padding:"0 9px", fontSize:12, color:t.inputColor, outline:"none", boxSizing:"border-box", fontFamily:"inherit" }}>
      {options.map((o) => <option key={o} value={o}>{o || "—"}</option>)}
    </select>
  );
}

function FTA({ value, onChange, placeholder="", rows=2, t }) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      style={{ width:"100%", background:t.inputBg, border:`1px solid ${t.inputBorder}`, borderRadius:7, padding:"7px 9px", fontSize:12, color:t.inputColor, outline:"none", boxSizing:"border-box", resize:"none", lineHeight:1.4, fontFamily:"inherit" }}
      onFocus={(e) => (e.target.style.borderColor = t.inputFocus)}
      onBlur={(e)  => (e.target.style.borderColor = t.inputBorder)} />
  );
}

function FRow({ label, children, t }) {
  return <div><FL t={t}>{label}</FL>{children}</div>;
}

function G2({ children }) { return <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>{children}</div>; }
function G3({ children }) { return <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:5 }}>{children}</div>; }

function GhostBtn({ children, onClick, active, disabled, isDark, style }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: active ? (isDark ? "rgba(90,160,120,0.2)" : "rgba(92,119,104,0.18)") : "transparent",
      color: active ? (isDark ? "#7DCFA0" : "#355F50") : (isDark ? "#C8B89A" : "#6D6256"),
      border: `1px solid ${active ? (isDark ? "#4A8A65" : "rgba(92,119,104,0.5)") : (isDark ? "#2D4035" : "#CDBAA3")}`,
      borderRadius:8, padding:"0 13px", height:31, fontSize:12, fontWeight:600,
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1,
      display:"inline-flex", alignItems:"center", gap:5, whiteSpace:"nowrap", fontFamily:"inherit", ...style,
    }}>{children}</button>
  );
}

function PrimaryBtn({ children, onClick, color="#03071A" }) {
  return (
    <button onClick={onClick} style={{ width:"100%", height:33, background:color, color:"#fff", border:"none", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:5, fontFamily:"inherit", marginTop:3 }}>
      {children}
    </button>
  );
}

function ClearBtn({ children, onClick, t }) {
  return (
    <button onClick={onClick} style={{ width:"100%", height:29, background:"transparent", color:t.mutedColor, border:`1px solid ${t.inputBorder}`, borderRadius:8, fontSize:12, cursor:"pointer", fontFamily:"inherit", marginTop:3 }}>
      {children}
    </button>
  );
}

function KpiCard({ label, value, sub, colorKey, isDark, t }) {
  const c = kpiColor(colorKey, isDark);
  const isLong = String(value).length > 5;
  return (
    <div style={{ background:t.cardBg, border:`1px solid ${t.cardBorder}`, borderRadius:12, padding:"12px 14px", borderLeft:`3px solid ${c}` }}>
      <div style={{ fontSize:10, fontWeight:600, color:t.mutedColor, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>{label}</div>
      <div style={{ fontSize: isLong ? 13 : 20, fontWeight:800, lineHeight:1, letterSpacing:"-0.03em", color:c, paddingTop: isLong ? 3 : 0 }}>{value}</div>
      <div style={{ fontSize:10, color:t.mutedColor, marginTop:4 }}>{sub}</div>
    </div>
  );
}

function SideSection({ title, children, t }) {
  return (
    <div style={{ background:t.cardBg, border:`1px solid ${t.cardBorder}`, borderRadius:12, overflow:"hidden" }}>
      <div style={{ padding:"11px 15px", borderBottom:`1px solid ${t.cardBorder}`, background:t.sideHeadBg }}>
        <span style={{ fontSize:11, fontWeight:700, color:t.sideTitle, textTransform:"uppercase", letterSpacing:"0.09em" }}>{title}</span>
      </div>
      <div style={{ padding:14 }}>{children}</div>
    </div>
  );
}

function TabPill({ label, active, onClick, t }) {
  return (
    <button onClick={onClick} style={{
      flex:1, height:27,
      background: active ? t.pillOnBg : "transparent",
      color:      active ? t.pillOnColor : t.mutedColor,
      border: `1px solid ${active ? t.pillOnBorder : t.cardBorder}`,
      borderRadius:7, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
    }}>{label}</button>
  );
}

function EternaLogo() {
  return (
    <div style={{ width:36, height:36, background:"#5C7768", borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
      <svg width="19" height="19" viewBox="0 0 100 100" fill="none">
        <g stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="50" cy="28" rx="18" ry="23" />
          <ellipse cx="33" cy="60" rx="18" ry="23" transform="rotate(60 33 60)" />
          <ellipse cx="67" cy="60" rx="18" ry="23" transform="rotate(-60 67 60)" />
        </g>
      </svg>
    </div>
  );
}

function Toast({ message, color }) {
  if (!message) return null;
  return (
    <div style={{ position:"fixed", bottom:22, left:"50%", transform:"translateX(-50%)", background:color||"#5B3320", color:"#fff", borderRadius:10, padding:"9px 20px", fontSize:13, fontWeight:700, zIndex:9999, pointerEvents:"none", whiteSpace:"nowrap", boxShadow:"0 4px 20px rgba(0,0,0,0.25)" }}>
      {message}
    </div>
  );
}

// ─────────────────────────────────────────────
// VIEW SHEET MODAL
// ─────────────────────────────────────────────
function SheetModal({ onClose, t }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:t.modalBg, border:`1px solid ${t.cardBorder}`, borderRadius:14, width:"100%", maxWidth:1100, height:"88vh", display:"flex", flexDirection:"column", boxShadow:"0 24px 64px rgba(0,0,0,0.35)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 18px", borderBottom:`1px solid ${t.cardBorder}`, background:t.sideHeadBg, flexShrink:0 }}>
          <span style={{ fontSize:14, fontWeight:700, color:t.color }}>📊 Google Sheet — Live View</span>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, color:t.mutedColor, lineHeight:1, fontFamily:"inherit" }}>✕ Close</button>
        </div>
        <iframe
          src={GOOGLE_SHEET_VIEW_URL}
          title="Google Sheet"
          style={{ flex:1, width:"100%", border:"none", borderRadius:"0 0 14px 14px" }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// EDIT MODAL
// ─────────────────────────────────────────────
function EditModal({ row, onClose, onSave, t }) {
  const [f, setF] = useState({ ...row });
  const u = (k, v) => setF((x) => ({ ...x, [k]: v }));
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:t.modalBg, border:`1px solid ${t.cardBorder}`, borderRadius:14, width:"100%", maxWidth:500, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 24px 64px rgba(0,0,0,0.3)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"13px 17px", borderBottom:`1px solid ${t.cardBorder}`, background:t.sideHeadBg }}>
          <span style={{ fontSize:14, fontWeight:700, color:t.color }}>Edit case</span>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, color:t.mutedColor, lineHeight:1, fontFamily:"inherit" }}>✕</button>
        </div>
        <div style={{ padding:"15px 17px", display:"flex", flexDirection:"column", gap:9 }}>
          <FRow label="Client name" t={t}><FI value={f.clientName}    onChange={(v)=>u("clientName",v)}    placeholder="Full name" t={t} /></FRow>
          <G2>
            <FRow label="Policy #" t={t}><FI value={f.policyNumber}   onChange={(v)=>u("policyNumber",v)}  t={t} /></FRow>
            <FRow label="AP" t={t}><FI type="number" value={f.ap}     onChange={(v)=>u("ap",v)}            t={t} /></FRow>
          </G2>
          <G2>
            <FRow label="Lead status" t={t}><FS value={f.leadStatus}  onChange={(v)=>u("leadStatus",v)}    options={LEAD_OPTS}    t={t} /></FRow>
            <FRow label="Agent" t={t}><FI value={f.agentName}         onChange={(v)=>u("agentName",v)}     t={t} /></FRow>
          </G2>
          <FRow label="Specialist" t={t}><FS value={f.specialistName} onChange={(v)=>u("specialistName",v)} options={SPEC_OPTS}   t={t} /></FRow>
          <G3>
            <FRow label="Status" t={t}><FS value={f.result}           onChange={(v)=>u("result",v)}        options={RESULT_OPTS}  t={t} /></FRow>
            <FRow label="Priority" t={t}><FS value={f.priority}       onChange={(v)=>u("priority",v)}      options={PRIORITY_OPTS} t={t} /></FRow>
            <FRow label="Date" t={t}><FI type="date" value={f.updatedAt} onChange={(v)=>u("updatedAt",v)} t={t} /></FRow>
          </G3>
          <FRow label="Action" t={t}><FS value={f.action}             onChange={(v)=>u("action",v)}        options={ACTION_OPTS}  t={t} /></FRow>
          <FRow label="Notes" t={t}><FTA value={f.notes}              onChange={(v)=>u("notes",v)}         placeholder="Callback time, issue, next step…" rows={3} t={t} /></FRow>
        </div>
        <div style={{ padding:"11px 17px", borderTop:`1px solid ${t.cardBorder}`, background:t.sideHeadBg, display:"flex", justifyContent:"flex-end", gap:7 }}>
          <GhostBtn onClick={onClose} isDark={false}>Cancel</GhostBtn>
          <button onClick={() => onSave({ ...f, ap:Number(f.ap||0) })} style={{ background:t.saveBtnBg, color:t.saveBtnColor, border:"none", borderRadius:8, padding:"0 17px", height:31, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// FORM PANELS
// ─────────────────────────────────────────────
function CaseForm({ form, setForm, onAdd, onClear, t }) {
  const u = (f, v) => setForm((x) => ({ ...x, [f]: v }));
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      <FRow label="Client name" t={t}><FI value={form.clientName}    onChange={(v)=>u("clientName",v)}    placeholder="Full name"    t={t} /></FRow>
      <G2>
        <FRow label="Policy #" t={t}><FI value={form.policyNumber}   onChange={(v)=>u("policyNumber",v)}  placeholder="POL-00000"    t={t} /></FRow>
        <FRow label="AP" t={t}><FI type="number" value={form.ap}     onChange={(v)=>u("ap",v)}            placeholder="0"            t={t} /></FRow>
      </G2>
      <G2>
        <FRow label="Lead status" t={t}><FS value={form.leadStatus}  onChange={(v)=>u("leadStatus",v)}    options={LEAD_OPTS}        t={t} /></FRow>
        <FRow label="Agent" t={t}><FI value={form.agentName}         onChange={(v)=>u("agentName",v)}     placeholder="Name"         t={t} /></FRow>
      </G2>
      <FRow label="Specialist" t={t}><FS value={form.specialistName} onChange={(v)=>u("specialistName",v)} options={SPEC_OPTS}       t={t} /></FRow>
      <G3>
        <FRow label="Status" t={t}><FS value={form.result}           onChange={(v)=>u("result",v)}        options={RESULT_OPTS}      t={t} /></FRow>
        <FRow label="Priority" t={t}><FS value={form.priority}       onChange={(v)=>u("priority",v)}      options={PRIORITY_OPTS}    t={t} /></FRow>
        <FRow label="Date" t={t}><FI type="date" value={form.updatedAt} onChange={(v)=>u("updatedAt",v)} t={t} /></FRow>
      </G3>
      <FRow label="Action" t={t}><FS value={form.action}             onChange={(v)=>u("action",v)}        options={ACTION_OPTS}      t={t} /></FRow>
      <FRow label="Notes" t={t}><FTA value={form.notes}              onChange={(v)=>u("notes",v)}         placeholder="Callback time, issue, next step…" t={t} /></FRow>
      <PrimaryBtn onClick={onAdd}>+ Add case</PrimaryBtn>
      <ClearBtn onClick={onClear} t={t}>Clear form</ClearBtn>
    </div>
  );
}

function InboundForm({ ibDate, setIbDate, inboundRows, onSave, t, isDark }) {
  const [f, setF] = useState({ clientName:"", phoneNumber:"", agentName:"", specialistName:"", resolved:"No", agentInformed:"No", notes:"" });
  const u = (k, v) => setF((x) => ({ ...x, [k]: v }));
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      <FRow label="Client name" t={t}><FI value={f.clientName}     onChange={(v)=>u("clientName",v)}     placeholder="Full name"      t={t} /></FRow>
      <FRow label="Phone number" t={t}><FI type="tel" value={f.phoneNumber} onChange={(v)=>u("phoneNumber",v)} placeholder="305-555-0000" t={t} /></FRow>
      <G2>
        <FRow label="Agent" t={t}><FI value={f.agentName}          onChange={(v)=>u("agentName",v)}      placeholder="Agent name"     t={t} /></FRow>
        <FRow label="Specialist" t={t}><FS value={f.specialistName} onChange={(v)=>u("specialistName",v)} options={SPEC_OPTS}          t={t} /></FRow>
      </G2>
      <FRow label="Date of call" t={t}><FI type="date" value={ibDate} onChange={setIbDate} t={t} /></FRow>
      <G2>
        <FRow label="Resolved" t={t}><FS value={f.resolved}         onChange={(v)=>u("resolved",v)}       options={["No","Yes"]}       t={t} /></FRow>
        <FRow label="Agent informed" t={t}><FS value={f.agentInformed} onChange={(v)=>u("agentInformed",v)} options={["No","Yes"]}    t={t} /></FRow>
      </G2>
      <FRow label="Notes" t={t}><FTA value={f.notes}                onChange={(v)=>u("notes",v)}          placeholder="Cancellation details, next steps…" t={t} /></FRow>
      <PrimaryBtn onClick={() => { onSave({ ...f, dateOfCall: ibDate }); setF({ clientName:"", phoneNumber:"", agentName:"", specialistName:"", resolved:"No", agentInformed:"No", notes:"" }); }}>
        + Save inbound cancellation
      </PrimaryBtn>
      {inboundRows.length > 0 && (
        <div style={{ borderTop:`1px solid ${t.cardBorder}`, paddingTop:11, marginTop:11 }}>
          <div style={{ fontSize:10, fontWeight:700, color:t.dimColor, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:7 }}>Recent inbound</div>
          {inboundRows.slice(0, 5).map((item) => (
            <div key={item.id} style={{ background:t.inboundCardBg, border:`1px solid ${t.cardBorder}`, borderRadius:8, padding:"9px 11px", marginBottom:6 }}>
              <div style={{ fontWeight:700, fontSize:12, color:t.color }}>{item.clientName}</div>
              <div style={{ fontSize:11, color:t.mutedColor, marginTop:2 }}>{item.agentName} · {item.phoneNumber}</div>
              {item.createdAt && <div style={{ fontSize:10, color:t.dimColor, marginTop:1 }}>{new Date(item.createdAt).toLocaleDateString()}</div>}
              <div style={{ marginTop:6 }}><StatusChip status={item.resolved === "Yes" ? "RESOLVED" : "PENDING"} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EodForm({ onSave, t }) {
  const [f, setF] = useState({ ...BLANK_EOD });
  const u = (k, v) => setF((x) => ({ ...x, [k]: v }));
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      <FRow label="Specialist name" t={t}><FS value={f.specialistName} onChange={(v)=>u("specialistName",v)} options={SPEC_OPTS} t={t} /></FRow>
      <FRow label="Date" t={t}><FI type="date" value={f.date} onChange={(v)=>u("date",v)} t={t} /></FRow>
      <G2>
        <FRow label="Total dials for the day" t={t}><FI type="number" value={f.totalDials}    onChange={(v)=>u("totalDials",v)}    placeholder="0" t={t} /></FRow>
        <FRow label="Total talk time (minutes)" t={t}><FI type="number" value={f.totalTalkTime} onChange={(v)=>u("totalTalkTime",v)} placeholder="0" t={t} /></FRow>
      </G2>
      <FRow label="Clients reached via call or text" t={t}><FI type="number" value={f.clientsReached}        onChange={(v)=>u("clientsReached",v)}        placeholder="0" t={t} /></FRow>
      <FRow label="Total welcome calls completed" t={t}><FI type="number"    value={f.welcomeCallsCompleted}  onChange={(v)=>u("welcomeCallsCompleted",v)}  placeholder="0" t={t} /></FRow>
      <G2>
        <FRow label="At risk resolved (pre-confirmation)" t={t}><FI type="number" value={f.atRiskResolvedPre}        onChange={(v)=>u("atRiskResolvedPre",v)}        placeholder="0" t={t} /></FRow>
        <FRow label="At risk resolved (confirmed)" t={t}><FI type="number"        value={f.atRiskResolvedConfirmed}   onChange={(v)=>u("atRiskResolvedConfirmed",v)}   placeholder="0" t={t} /></FRow>
      </G2>
      <G2>
        <FRow label="AP saved (pre-confirmation)" t={t}><FI type="number" value={f.apSavedPre}        onChange={(v)=>u("apSavedPre",v)}        placeholder="0" t={t} /></FRow>
        <FRow label="AP saved (confirmed)" t={t}><FI type="number"        value={f.apSavedConfirmed}   onChange={(v)=>u("apSavedConfirmed",v)}   placeholder="0" t={t} /></FRow>
      </G2>
      <G2>
        <FRow label="UW policies resolved today" t={t}><FI type="number" value={f.uwPoliciesResolved} onChange={(v)=>u("uwPoliciesResolved",v)} placeholder="0" t={t} /></FRow>
        <FRow label="Policies pending resolution" t={t}><FI type="number" value={f.pendingResolution}  onChange={(v)=>u("pendingResolution",v)}  placeholder="0" t={t} /></FRow>
      </G2>
      <FRow label="Saved — pending confirmation (Client Name & Policy #)" t={t}><FTA value={f.savedPendingConfirmation}       onChange={(v)=>u("savedPendingConfirmation",v)}       placeholder="John Smith - POLICY123"                 t={t} /></FRow>
      <FRow label="Saved — confirmed (Client Name & Policy #)" t={t}><FTA            value={f.savedConfirmed}                onChange={(v)=>u("savedConfirmed",v)}                placeholder="Jane Doe - POLICY456"                   t={t} /></FRow>
      <FRow label="UW resolved not yet confirmed (AP, Name, Resolution, Carrier & Policy #)" t={t}><FTA value={f.uwResolvedNotConfirmedDetails} onChange={(v)=>u("uwResolvedNotConfirmedDetails",v)} placeholder="AP, Name, Resolution, Carrier, Policy #" t={t} /></FRow>
      <FRow label="UW confirmed resolved (AP, Name, Resolution, Carrier & Policy #)" t={t}><FTA       value={f.uwConfirmedResolvedDetails}       onChange={(v)=>u("uwConfirmedResolvedDetails",v)}   placeholder="AP, Name, Resolution, Carrier, Policy #" t={t} /></FRow>
      <FRow label="Escalations / agent action needed" t={t}><FTA value={f.escalationsAgentActionNeeded} onChange={(v)=>u("escalationsAgentActionNeeded",v)} placeholder="Client info, policy details, agent name, action needed" t={t} /></FRow>
      <PrimaryBtn onClick={() => onSave(f)}>💾 Save EOD</PrimaryBtn>
      <ClearBtn onClick={() => setF({ ...BLANK_EOD })} t={t}>Clear</ClearBtn>
    </div>
  );
}

// ─────────────────────────────────────────────
// GOOGLE SHEETS API FUNCTIONS
// ─────────────────────────────────────────────
async function sendCaseToSheet(data) {
  try {
    const fd = new URLSearchParams();
    Object.entries({ ...data, recordType: "case" }).forEach(([k, v]) => fd.append(k, v ?? ""));
    await fetch(GOOGLE_SHEET_WEB_APP_URL, { method:"POST", mode:"no-cors", body:fd });
  } catch (e) { console.error("Sheet sync failed:", e); }
}

async function updateCaseOnSheet(data) {
  try {
    const fd = new URLSearchParams();
    Object.entries({ ...data, recordType:"update" }).forEach(([k, v]) => fd.append(k, v ?? ""));
    await fetch(GOOGLE_SHEET_WEB_APP_URL, { method:"POST", mode:"no-cors", body:fd });
  } catch (e) { console.error("Sheet update failed:", e); }
}

async function deleteCaseOnSheet(row) {
  try {
    const fd = new URLSearchParams();
    ["id","clientName","policyNumber","specialistName","agentName"].forEach((k) => fd.append(k, row[k] ?? ""));
    fd.append("recordType", "delete");
    await fetch(GOOGLE_SHEET_WEB_APP_URL, { method:"POST", mode:"no-cors", body:fd });
  } catch (e) { console.error("Sheet delete failed:", e); }
}

async function sendInboundToSheet(data) {
  try {
    const fd = new URLSearchParams();
    fd.append("recordType",  "inboundCancellation");
    fd.append("forceSheet",  "Inbound Cancellations");
    fd.append("inboundOnly", "true");
    Object.entries(data).forEach(([k, v]) => fd.append(k, v ?? ""));
    await fetch(GOOGLE_SHEET_WEB_APP_URL, { method:"POST", mode:"no-cors", body:fd });
  } catch (e) { console.error("Inbound sync failed:", e); }
}

async function sendEodToSheet(data) {
  try {
    const fd = new URLSearchParams();
    fd.append("recordType", "eodTest");
    fd.append("forceSheet", "EOD Test");
    Object.entries(data).forEach(([k, v]) => fd.append(k, v ?? ""));
    await fetch(GOOGLE_SHEET_WEB_APP_URL, { method:"POST", mode:"no-cors", body:fd });
  } catch (e) { console.error("EOD sync failed:", e); }
}

async function loadFromSheet() {
  const res  = await fetch(GOOGLE_SHEET_WEB_APP_URL);
  const data = await res.json();
  return data;
}

// ─────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────
export default function ChenTrackerApp() {
  // ── state ──
  const [rows,         setRows]         = useState(() => safeLoad(STORAGE_KEY,         []));
  const [inboundRows,  setInboundRows]  = useState(() => safeLoad(INBOUND_STORAGE_KEY, []));
  const [eodEntries,   setEodEntries]   = useState(() => safeLoad(EOD_STORAGE_KEY,      []));
  const [isDark,       setIsDark]       = useState(() => safeLoad(DARK_MODE_KEY,        false));
  const [activeTab,    setActiveTab]    = useState("case");
  const [specFilter,   setSpecFilter]   = useState("All");
  const [resultFilter, setResultFilter] = useState("All");
  const [query,        setQuery]        = useState("");
  const [filterStart,  setFilterStart]  = useState("");
  const [filterEnd,    setFilterEnd]    = useState("");
  const [form,         setForm]         = useState(BLANK_FORM);
  const [editRow,      setEditRow]      = useState(null);
  const [toast,        setToast]        = useState({ msg:"", color:"" });
  const [page,         setPage]         = useState(1);
  const [rptMode,      setRptMode]      = useState("wtd");
  const [rptStart,     setRptStart]     = useState("");
  const [rptEnd,       setRptEnd]       = useState("");
  const [ibDate,       setIbDate]       = useState(TODAY);
  const [isLoading,    setIsLoading]    = useState(false);
  const [showSheet,    setShowSheet]    = useState(false);
  const PER = 10;

  const t = useTheme(isDark);

  // ── persist to localStorage ──
  useEffect(() => { safeSave(STORAGE_KEY,         rows);        }, [rows]);
  useEffect(() => { safeSave(INBOUND_STORAGE_KEY, inboundRows); }, [inboundRows]);
  useEffect(() => { safeSave(EOD_STORAGE_KEY,      eodEntries);  }, [eodEntries]);
  useEffect(() => { safeSave(DARK_MODE_KEY,        isDark);       }, [isDark]);

  // ── load from Google Sheets on mount ──
  useEffect(() => { refreshData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── toast helper ──
  const toastTimer = React.useRef(null);
  function showToast(msg, color) {
    setToast({ msg, color: color || t.toastInfo });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast({ msg:"", color:"" }), 2800);
  }

  // ── Google Sheets refresh ──
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    showToast("Refreshing data…", t.toastInfo);
    try {
      const data = await loadFromSheet();
      if (data.success && Array.isArray(data.rows)) {
        const clean = dedupeRows(data.rows.filter(isRealRow));
        setRows(clean);
        safeSave(STORAGE_KEY, clean);
      }
      if (Array.isArray(data.inboundCancellations)) {
        const ib = data.inboundCancellations.map((item) => ({
          id:            item.id || crypto.randomUUID(),
          createdAt:     item.createdAt     || "",
          clientName:    item.clientName    || "",
          phoneNumber:   item.phoneNumber   || "",
          agentName:     item.agentName     || "",
          specialistName:item.specialistName|| "",
          resolved:      item.resolved      || "No",
          agentInformed: item.agentInformed || "No",
          notes:         item.notes         || "",
        }));
        setInboundRows(ib);
        safeSave(INBOUND_STORAGE_KEY, ib);
      }
      if (Array.isArray(data.eodTestEntries)) {
        setEodEntries((current) => {
          const merged = [...data.eodTestEntries, ...current].filter((e, i, arr) =>
            arr.findIndex((x) => x.id === e.id) === i
          );
          safeSave(EOD_STORAGE_KEY, merged);
          return merged;
        });
      }
      showToast("Data refreshed.", t.toastSuccess);
    } catch (e) {
      console.error("Refresh failed:", e);
      showToast("Refresh failed — check connection.", t.toastError);
    } finally {
      setIsLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── filtered rows ──
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) =>
        (specFilter   === "All" || r.specialistName === specFilter) &&
        (resultFilter === "All" || r.result         === resultFilter) &&
        (!q           || [r.clientName, r.policyNumber, r.agentName, r.notes, r.action].join(" ").toLowerCase().includes(q)) &&
        (!filterStart || r.updatedAt >= filterStart) &&
        (!filterEnd   || r.updatedAt <= filterEnd)
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [rows, specFilter, resultFilter, query, filterStart, filterEnd]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER));
  const safePage   = Math.min(page, totalPages);
  const paged      = filtered.slice((safePage - 1) * PER, safePage * PER);

  // ── KPI stats (today only, filtered by specialist) ──
  const kpi = useMemo(() => {
    const src = specFilter === "All" ? rows : rows.filter((r) => r.specialistName === specFilter);
    const td  = src.filter((r) => r.updatedAt === TODAY);
    const ps  = td.filter((r) => (r.action || "").toLowerCase() === "pending save");
    const sv  = td.filter((r) => (r.action || "").toLowerCase() === "save");
    const uwr = td.filter((r) => (r.action || "").toLowerCase() === "uw action resolved");
    return {
      total:    src.length,
      resolved: src.filter((r) => r.result === "RESOLVED").length,
      pending:  src.filter((r) => r.result === "PENDING").length,
      lost:     src.filter((r) => r.result === "LOST").length,
      psCount:  ps.length,  psAp:  ps.reduce((s, r) => s + Number(r.ap || 0), 0),
      svCount:  sv.length,  svAp:  sv.reduce((s, r) => s + Number(r.ap || 0), 0),
      uwrCount: uwr.length,
    };
  }, [rows, specFilter]);

  // ── report stats ──
  const rpt = useMemo(() => {
    const src   = specFilter === "All" ? rows : rows.filter((r) => r.specialistName === specFilter);
    const start = rptStart || (rptMode === "mtd" ? getMTD() : getWTD());
    const end   = rptEnd   || TODAY;
    const rr    = src.filter((r) => r.updatedAt >= start && r.updatedAt <= end);
    const ps    = rr.filter((r) => (r.action || "").toLowerCase() === "pending save");
    const sv    = rr.filter((r) => (r.action || "").toLowerCase() === "save");
    return {
      total:    rr.length,
      resolved: rr.filter((r) => r.result === "RESOLVED").length,
      pending:  rr.filter((r) => r.result === "PENDING").length,
      lost:     rr.filter((r) => r.result === "LOST").length,
      psCount:  ps.length,  psAp:  ps.reduce((s, r) => s + Number(r.ap || 0), 0),
      svCount:  sv.length,  svAp:  sv.reduce((s, r) => s + Number(r.ap || 0), 0),
      start, end,
    };
  }, [rows, specFilter, rptMode, rptStart, rptEnd]);

  // ── agent load ──
  const agentMap = useMemo(() => {
    const m = {};
    rows.forEach((r) => { const k = r.agentName || "Unassigned"; m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const agentMax = agentMap[0]?.[1] || 1;

  // ── case actions ──
  function addCase() {
    if (!form.clientName.trim()) { showToast("Enter a client name first.", t.toastError); return; }
    const dup = form.policyNumber.trim() && rows.some((r) => String(r.policyNumber || "").trim().toLowerCase() === form.policyNumber.trim().toLowerCase());
    if (dup && !window.confirm("This policy number already exists. Continue anyway?")) return;
    const newCase = { ...form, id: crypto.randomUUID(), ap: Number(form.ap || 0), createdAt: TODAY };
    setRows((r) => [newCase, ...r]);
    setForm(BLANK_FORM);
    setPage(1);
    showToast("Case added. Syncing to Google Sheets…", t.toastSuccess);
    sendCaseToSheet(newCase).then(() => setTimeout(refreshData, 1500));
  }

  function quickResolve(id) {
    const updated = rows.map((r) => r.id === id ? { ...r, result:"RESOLVED", updatedAt:TODAY } : r);
    setRows(updated);
    showToast("Marked as resolved.", t.toastSuccess);
    const row = updated.find((r) => r.id === id);
    if (row) updateCaseOnSheet(row);
  }

  function deleteRow(id) {
    const row = rows.find((r) => r.id === id);
    setRows((r) => r.filter((x) => x.id !== id));
    showToast("Case deleted. Removing from Google Sheets…", t.toastError);
    if (row) deleteCaseOnSheet(row).then(() => setTimeout(refreshData, 1500));
  }

  function saveEdit(updated) {
    setRows((r) => r.map((x) => x.id === updated.id ? updated : x));
    setEditRow(null);
    showToast("Case updated. Syncing to Google Sheets…", t.toastSuccess);
    updateCaseOnSheet(updated);
  }

  function saveInbound(f) {
    if (!f.clientName.trim()) { showToast("Enter a client name.", t.toastError); return; }
    if (!f.specialistName)    { showToast("Select a specialist.", t.toastError); return; }
    const entry = { ...f, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    setInboundRows((r) => [entry, ...r]);
    showToast("Inbound cancellation saved. Syncing…", t.toastSuccess);
    sendInboundToSheet(entry).then(() => setTimeout(refreshData, 1500));
  }

  function saveEod(f) {
    if (!f.specialistName) { showToast("Please select a specialist.", t.toastError); return; }
    if (!f.date)           { showToast("Please select a date.", t.toastError); return; }
    const entry = { ...f, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    setEodEntries((e) => [entry, ...e]);
    showToast("EOD saved. Syncing to Google Sheets…", t.toastSuccess);
    sendEodToSheet(entry).then(() => setTimeout(refreshData, 2500));
  }

  // ── shared input style for toolbar ──
  const toolInp = {
    height:33, background:t.inputBg, border:`1px solid ${t.inputBorder}`,
    borderRadius:9, padding:"0 8px", fontSize:12, color:t.inputColor,
    outline:"none", fontFamily:"inherit",
  };

  // ── report date input style ──
  const rptInp = {
    height:26, background:t.inputBg, border:`1px solid ${t.inputBorder}`,
    borderRadius:6, padding:"0 6px", fontSize:11, color:t.inputColor,
    outline:"none", fontFamily:"inherit", flex:1, minWidth:88,
  };

  // ── report mode button ──
  function RptModeBtn({ mode, label }) {
    const on = rptMode === mode;
    return (
      <button onClick={() => { setRptMode(mode); setRptStart(""); setRptEnd(""); }}
        style={{ flex:1, height:26, background: on ? t.pillOnBg : "transparent", color: on ? t.pillOnColor : t.mutedColor, border:`1px solid ${on ? t.pillOnBorder : t.cardBorder}`, borderRadius:6, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
        {label}
      </button>
    );
  }

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:t.pageBg, color:t.color, fontFamily:"system-ui,-apple-system,sans-serif", padding:20, display:"flex", flexDirection:"column", gap:14 }}>

      <Toast message={toast.msg} color={toast.color} />

      {showSheet  && <SheetModal onClose={() => setShowSheet(false)} t={t} />}
      {editRow    && <EditModal  row={editRow} onClose={() => setEditRow(null)} onSave={saveEdit} t={t} />}

      {/* ── TOPBAR ── */}
      <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", background:t.topbarBg, border:`1px solid ${t.topbarBorder}`, borderRadius:14, padding:"11px 18px" }}>
        <EternaLogo />
        <div>
          <div style={{ fontSize:19, fontWeight:800, color: isDark ? "#A8C5B0" : "#2E443A", letterSpacing:"-0.03em", lineHeight:1 }}>Eterna</div>
          <div style={{ fontSize:10, color:t.mutedColor, marginTop:2, letterSpacing:"0.05em" }}>RETENTION TRACKER</div>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
          <select value={specFilter} onChange={(e) => { setSpecFilter(e.target.value); setPage(1); }}
            style={{ height:31, background:t.inputBg, border:`1px solid ${t.inputBorder}`, borderRadius:8, padding:"0 11px", fontSize:12, color:t.inputColor, outline:"none", cursor:"pointer", fontFamily:"inherit" }}>
            <option value="All">All specialists</option>
            {["Nisha","Rick","Chen","Fernando","Angie"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <GhostBtn onClick={() => showToast("Reminders — coming soon.", t.toastInfo)} isDark={isDark}>🔔 Reminders</GhostBtn>
          <GhostBtn onClick={() => setShowSheet(true)} isDark={isDark}>⊞ View sheet</GhostBtn>
          <button onClick={() => setIsDark((d) => !d)}
            style={{ background: isDark ? "#D4C8B4" : "#03071A", color: isDark ? "#1A1008" : "#fff", border:"none", borderRadius:8, padding:"0 13px", height:31, fontSize:12, fontWeight:600, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:5, fontFamily:"inherit" }}>
            {isDark ? "☀️ Light mode" : "🌙 Dark mode"}
          </button>
          <button onClick={refreshData} disabled={isLoading}
            style={{ background: isDark ? "#3A6E50" : "#5C7768", color:"#fff", border:"none", borderRadius:8, padding:"0 13px", height:31, fontSize:12, fontWeight:600, cursor: isLoading ? "not-allowed" : "pointer", display:"inline-flex", alignItems:"center", gap:5, fontFamily:"inherit", opacity: isLoading ? 0.7 : 1 }}>
            {isLoading ? "⟳ Refreshing…" : "↻ Refresh"}
          </button>
        </div>
      </div>

      {/* ── 7 KPI CARDS ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:8 }}>
        <KpiCard label="Total cases"        value={kpi.total}    sub={`${kpi.resolved} resolved · ${kpi.pending} pending`} colorKey="total" isDark={isDark} t={t} />
        <KpiCard label="Pending save"       value={kpi.psCount}  sub={`${cur(kpi.psAp)} at stake`}   colorKey="ps"   isDark={isDark} t={t} />
        <KpiCard label="Saved today"        value={kpi.svCount}  sub={`${cur(kpi.svAp)} locked in`}  colorKey="sv"   isDark={isDark} t={t} />
        <KpiCard label="UW Action Resolved" value={kpi.uwrCount} sub="Today"                         colorKey="uwr"  isDark={isDark} t={t} />
        <KpiCard label="Lost cases"         value={kpi.lost}     sub="All time"                      colorKey="lost" isDark={isDark} t={t} />
        <KpiCard label="Pending Save AP"    value={cur(kpi.psAp)} sub="Action: Pending Save"         colorKey="psAp" isDark={isDark} t={t} />
        <KpiCard label="Save AP"            value={cur(kpi.svAp)} sub="Action: Save"                 colorKey="svAp" isDark={isDark} t={t} />
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:14, alignItems:"start" }}>

        {/* LEFT: case list */}
        <div style={{ display:"flex", flexDirection:"column", gap:9 }}>

          {/* Search + date + status filters */}
          <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
            <div style={{ position:"relative", flex:1, minWidth:180 }}>
              <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", fontSize:15, color:t.mutedColor, pointerEvents:"none" }}>⌕</span>
              <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search client, policy, agent, notes…"
                style={{ ...toolInp, width:"100%", paddingLeft:29 }} />
            </div>
            <input type="date" value={filterStart} onChange={(e) => { setFilterStart(e.target.value); setPage(1); }} title="From date" style={toolInp} />
            <input type="date" value={filterEnd}   onChange={(e) => { setFilterEnd(e.target.value);   setPage(1); }} title="To date"   style={toolInp} />
            {["All","PENDING","RESOLVED","LOST"].map((v) => {
              const m = STATUS_META[v];
              return (
                <GhostBtn key={v} active={resultFilter === v} onClick={() => { setResultFilter(v); setPage(1); }} isDark={isDark} style={{ fontSize:11 }}>
                  {v === "All" ? "All" : <><span style={{ width:6, height:6, borderRadius:"50%", background:m?.dot, display:"inline-block", marginRight:3 }} />{m?.label}</>}
                </GhostBtn>
              );
            })}
            {(filterStart || filterEnd) && (
              <GhostBtn onClick={() => { setFilterStart(""); setFilterEnd(""); }} isDark={isDark} style={{ fontSize:11 }}>✕ Clear dates</GhostBtn>
            )}
            <span style={{ fontSize:11, color:t.mutedColor, marginLeft:"auto" }}>{filtered.length} case{filtered.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Column headers */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:10, padding:"0 14px" }}>
            <div style={{ display:"grid", gridTemplateColumns:"170px 100px 78px 88px 1fr", gap:10 }}>
              {["Client","AP","Stage","Status","Action / notes"].map((h) => (
                <div key={h} style={{ fontSize:10, fontWeight:700, color:t.dimColor, textTransform:"uppercase", letterSpacing:"0.08em" }}>{h}</div>
              ))}
            </div>
            <div style={{ width:95 }} />
          </div>

          {/* Case cards */}
          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
            {paged.length ? paged.map((row) => (
              <div key={row.id}
                style={{ background:t.cardBg, border:`1px solid ${t.cardBorder}`, borderRadius:10, padding:"11px 14px", display:"grid", gridTemplateColumns:"1fr auto", gap:10, alignItems:"center", cursor:"default", transition:"border-color .14s,background .14s" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = t.cardHover; e.currentTarget.style.borderColor = t.cardHoverBorder; e.currentTarget.querySelector(".rt").style.opacity = "1"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = t.cardBg;    e.currentTarget.style.borderColor = t.cardBorder;      e.currentTarget.querySelector(".rt").style.opacity = "0"; }}
              >
                <div style={{ display:"grid", gridTemplateColumns:"170px 100px 78px 88px 1fr", gap:10, alignItems:"center", minWidth:0 }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:13, color:t.color, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{row.clientName}</div>
                    <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:3 }}>
                      <span style={{ fontSize:10, color:t.mutedColor, fontFamily:"monospace" }}>{row.policyNumber || "—"}</span>
                      <PriorityChip priority={row.priority} />
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize:15, fontWeight:800, color: isDark ? "#E8B87A" : "#5B3320", letterSpacing:"-0.02em" }}>{cur(row.ap)}</div>
                    <div style={{ fontSize:10, color:t.mutedColor, marginTop:2 }}>annual premium</div>
                  </div>
                  <div><StageTag s={row.leadStatus} t={t} /></div>
                  <div><StatusChip status={row.result} /></div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:600, color: isDark ? "#C8B89A" : "#6D6256", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{row.action || "—"}</div>
                    {row.notes && <div style={{ fontSize:11, color:t.mutedColor, marginTop:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{row.notes}</div>}
                  </div>
                </div>
                <div className="rt" style={{ display:"flex", gap:4, opacity:0, transition:"opacity .14s" }}>
                  {row.result !== "RESOLVED" && (
                    <button onClick={() => quickResolve(row.id)} title="Mark resolved" style={{ width:29, height:29, background:t.toolResBg, border:`1px solid ${t.toolResBorder}`, borderRadius:7, cursor:"pointer", color:t.toolResColor, fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}>✓</button>
                  )}
                  <button onClick={() => setEditRow({ ...row })} title="Edit" style={{ width:29, height:29, background:t.toolEditBg, border:`1px solid ${t.toolEditBorder}`, borderRadius:7, cursor:"pointer", color:t.toolEditColor, fontSize:13, display:"flex", alignItems:"center", justifyContent:"center" }}>✎</button>
                  <button onClick={() => deleteRow(row.id)} title="Delete" style={{ width:29, height:29, background:t.toolDelBg, border:`1px solid ${t.toolDelBorder}`, borderRadius:7, cursor:"pointer", color:t.toolDelColor, fontSize:13, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
                </div>
              </div>
            )) : (
              <div style={{ textAlign:"center", padding:"52px 20px", background:t.emptyBg, borderRadius:10 }}>
                <div style={{ fontSize:28, marginBottom:8, opacity:0.35 }}>◈</div>
                <div style={{ fontSize:14, fontWeight:700, color:t.mutedColor }}>No cases match your filters</div>
                <div style={{ fontSize:12, marginTop:4, color:t.dimColor }}>Try clearing your search or filters</div>
              </div>
            )}
          </div>

          {/* Pagination */}
          {filtered.length > PER && (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", fontSize:11, color:t.mutedColor }}>
              <span>{(safePage - 1) * PER + 1}–{Math.min(safePage * PER, filtered.length)} of {filtered.length}</span>
              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                <GhostBtn onClick={() => setPage((p) => Math.max(1, p - 1))} isDark={isDark} style={{ fontSize:11, opacity: safePage === 1 ? 0.3 : 1 }} disabled={safePage === 1}>← Prev</GhostBtn>
                <span>{safePage} / {totalPages}</span>
                <GhostBtn onClick={() => setPage((p) => Math.min(totalPages, p + 1))} isDark={isDark} style={{ fontSize:11, opacity: safePage >= totalPages ? 0.3 : 1 }} disabled={safePage >= totalPages}>Next →</GhostBtn>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR */}
        <div style={{ display:"flex", flexDirection:"column", gap:11 }}>

          {/* Entry form */}
          <SideSection title={activeTab === "case" ? "Add new case" : activeTab === "inbound" ? "Inbound cancellation" : "EOD"} t={t}>
            <div style={{ display:"flex", gap:4, marginBottom:13 }}>
              {[["case","Add new case"],["inbound","Inbound"],["eod","EOD"]].map(([id, lbl]) => (
                <TabPill key={id} label={lbl} active={activeTab === id} onClick={() => setActiveTab(id)} t={t} />
              ))}
            </div>
            {activeTab === "case"    && <CaseForm    form={form} setForm={setForm} onAdd={addCase} onClear={() => setForm(BLANK_FORM)} t={t} />}
            {activeTab === "inbound" && <InboundForm ibDate={ibDate} setIbDate={setIbDate} inboundRows={inboundRows} onSave={saveInbound} t={t} isDark={isDark} />}
            {activeTab === "eod"     && <EodForm     onSave={saveEod} t={t} />}
          </SideSection>

          {/* Report panel */}
          <SideSection title={rptMode === "mtd" ? "Month to date" : "Week to date"} t={t}>
            <div style={{ display:"flex", gap:4, marginBottom:9 }}>
              <RptModeBtn mode="wtd" label="Week to date" />
              <RptModeBtn mode="mtd" label="Month to date" />
            </div>
            <div style={{ display:"flex", gap:5, alignItems:"center", marginBottom:10, flexWrap:"wrap" }}>
              <input type="date" value={rpt.start} onChange={(e) => setRptStart(e.target.value)} style={rptInp} />
              <span style={{ fontSize:11, opacity:0.4, color:t.color }}>→</span>
              <input type="date" value={rpt.end}   onChange={(e) => setRptEnd(e.target.value)}   style={rptInp} />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
              {[
                { label:"Total cases",    val:rpt.total,    key:"total" },
                { label:"Resolved",       val:rpt.resolved, key:"sv"    },
                { label:"Pending saves",  val:rpt.psCount,  key:"ps"    },
                { label:"Lost",           val:rpt.lost,     key:"lost"  },
                { label:"Pending Save AP",val:cur(rpt.psAp),key:"ps",   span:2 },
                { label:"Save AP",        val:cur(rpt.svAp),key:"sv",   span:2 },
              ].map(({ label, val, key, span }) => {
                const c = rptColor(key, isDark);
                return (
                  <div key={label} style={{ background:t.rptCellBg, borderRadius:8, padding:"9px 11px", borderLeft:`2px solid ${c}`, gridColumn: span ? `span ${span}` : undefined }}>
                    <div style={{ fontSize:10, fontWeight:600, color:t.mutedColor, textTransform:"uppercase", letterSpacing:"0.05em" }}>{label}</div>
                    <div style={{ fontSize: span ? 13 : 18, fontWeight:800, color:c, marginTop:3, lineHeight:1, letterSpacing:"-0.02em" }}>{val}</div>
                  </div>
                );
              })}
            </div>
          </SideSection>

          {/* Agent load */}
          <SideSection title="Agent load" t={t}>
            {agentMap.length ? agentMap.map(([agent, count]) => (
              <div key={agent} style={{ marginBottom:9 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, fontWeight:500, color: isDark ? "#C8B89A" : "#6D6256", marginBottom:3 }}>
                  <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{agent}</span>
                  <span>{count}</span>
                </div>
                <div style={{ height:3, background:t.agentTrackBg, borderRadius:99, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${Math.round((count / agentMax) * 100)}%`, background:t.agentFillBg, borderRadius:99 }} />
                </div>
              </div>
            )) : <div style={{ fontSize:12, color:t.dimColor }}>No data yet — refresh to load.</div>}
          </SideSection>
        </div>
      </div>
    </div>
  );
}
