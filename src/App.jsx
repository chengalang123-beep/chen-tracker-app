import { BrowserRouter, Routes, Route } from "react-router-dom";
import AdminEodRecap from "./components/AdminEodRecap";
import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";

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
const STORAGE_KEY         = "eterna-tracker-rows-v1";
const INBOUND_STORAGE_KEY = "eterna-inbound-v1";
const EOD_STORAGE_KEY     = "eterna-eod-v1";
const DARK_MODE_KEY       = "eterna-dark-mode-v1";
const REMINDER_KEY        = "eterna-reminders-v1";

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const TODAY = new Date().toISOString().slice(0, 10);

const ACTION_OPTS   = ["", "Pending", "Pending Save", "Welcome Call", "Onboarding Call", "Pending Agent Assist", "Save", "UW Action Needed", "UW Action Resolved", "Lost", "Hang up"];
const LEAD_OPTS     = ["", "NA", "NAA", "SRWT", "AS", "RTR", "CEP", "AYAR", "CWCC", "IUW", "UWAN", "UWAR", "UWSRWT"];
const SPEC_OPTS     = ["", "Nisha", "Rick", "Chen", "Fernando", "Claire"];
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
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback; }
  catch { return fallback; }
}
function safeSave(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// Normalize any date format to YYYY-MM-DD for clean display
function normalizeEodDate(val) {
  if (!val) return "";
  const s = String(val).trim();
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // ISO timestamp — take just the date part
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  // M/D/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) {
    const [mo, dy, yr] = s.split("/");
    return `${yr}-${mo.padStart(2,"0")}-${dy.padStart(2,"0")}`;
  }
  // Try JS Date parse as fallback
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch {}
  return s;
}

function dedupeRows(sourceRows) {
  const map = new Map();
  sourceRows.forEach((row) => {
    const pn  = String(row.policyNumber   || "").trim().toLowerCase();
    const cn  = String(row.clientName     || "").trim().toLowerCase();
    const sn  = String(row.specialistName || "").trim().toLowerCase();
    const ap  = String(row.ap             || "").trim();
    const key = pn ? `policy:${pn}` : `client:${cn}|spec:${sn}|ap:${ap}`;
    const ex  = map.get(key);
    if (!ex) { map.set(key, row); return; }
    const ed = String(ex.updatedAt  || ex.createdAt  || "");
    const rd = String(row.updatedAt || row.createdAt || "");
    if (rd >= ed) map.set(key, row);
  });
  return Array.from(map.values());
}

function isRealRow(row) {
  const bad = ["save","pending save","welcome call","onboarding call","uw action needed","uw action resolved","lost","client name","policy number","ap","lead status","agent name","result","status","action","notes","priority","updated at","specialist name","created at"];
  const cn = String(row?.clientName     || "").trim();
  const sn = String(row?.specialistName || "").trim();
  if (!cn || bad.includes(cn.toLowerCase())) return false;
  if (!["Nisha","Rick","Chen","Fernando","Claire","Unassigned"].includes(sn)) return false;
  const ud = String(row?.updatedAt || ""), cd = String(row?.createdAt || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(ud) || /^\d{4}-\d{2}-\d{2}$/.test(cd);
}

function playAlertSound() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(740, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.5);
  } catch {}
}

// ─────────────────────────────────────────────
// DATE RANGE PICKER — single button, click opens dropdown with from/to
// ─────────────────────────────────────────────
function DateRangePicker({ filterStart, filterEnd, setFilterStart, setFilterEnd, t, isDark }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const hasFilter = filterStart || filterEnd;

  // Button label
  let label = "📅 Date range";
  if (filterStart && filterEnd)   label = `${filterStart} → ${filterEnd}`;
  else if (filterStart)           label = `From ${filterStart}`;
  else if (filterEnd)             label = `Until ${filterEnd}`;

  const btnStyle = {
    height:33, display:"inline-flex", alignItems:"center", gap:6,
    padding:"0 12px", borderRadius:9, fontFamily:"inherit",
    fontSize:12, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap",
    background: hasFilter ? (isDark ? "rgba(90,160,120,0.2)" : "rgba(92,119,104,0.18)") : "transparent",
    color:      hasFilter ? (isDark ? "#7DCFA0" : "#355F50")  : (isDark ? "#C8B89A" : "#6D6256"),
    border: `1px solid ${hasFilter ? (isDark ? "#4A8A65" : "rgba(92,119,104,0.5)") : (isDark ? "#2D4035" : "#CDBAA3")}`,
  };

  const inpStyle = {
    width:"100%", height:30, background:t.inputBg, border:`1px solid ${t.inputBorder}`,
    borderRadius:7, padding:"0 9px", fontSize:12, color:t.inputColor,
    outline:"none", fontFamily:"inherit", boxSizing:"border-box",
  };

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button style={btnStyle} onClick={() => setOpen((o) => !o)}>
        {label}
        <span style={{ fontSize:10, opacity:0.6 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{
          position:"absolute", top:"calc(100% + 6px)", left:0, zIndex:500,
          background: isDark ? "#1A2E22" : "#FCF8F2",
          border:`1px solid ${isDark ? "#2D4035" : "#D4C3AD"}`,
          borderRadius:10, padding:14, boxShadow:"0 8px 32px rgba(0,0,0,0.25)",
          minWidth:240,
        }}>
          <div style={{ fontSize:10, fontWeight:700, color: isDark ? "#7A9E8A" : "#8A6A55", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}>
            Filter by date
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <div>
              <div style={{ fontSize:10, fontWeight:600, color: isDark ? "#7A9E8A" : "#8A6A55", marginBottom:3 }}>From</div>
              <input type="date" value={filterStart} onChange={(e) => setFilterStart(e.target.value)} style={inpStyle}
                onFocus={(e) => (e.target.style.borderColor = isDark ? "#4A8A65" : "#5C7768")}
                onBlur={(e)  => (e.target.style.borderColor = t.inputBorder)} />
            </div>
            <div>
              <div style={{ fontSize:10, fontWeight:600, color: isDark ? "#7A9E8A" : "#8A6A55", marginBottom:3 }}>To</div>
              <input type="date" value={filterEnd} onChange={(e) => setFilterEnd(e.target.value)} style={inpStyle}
                onFocus={(e) => (e.target.style.borderColor = isDark ? "#4A8A65" : "#5C7768")}
                onBlur={(e)  => (e.target.style.borderColor = t.inputBorder)} />
            </div>
            <div style={{ fontSize:10, color: isDark ? "#5A7A68" : "#B28A6B", lineHeight:1.5, marginTop:2 }}>
              Set only "From" to filter a single day.<br/>Set both for a date range.
            </div>
            {(filterStart || filterEnd) && (
              <button onClick={() => { setFilterStart(""); setFilterEnd(""); setOpen(false); }}
                style={{ height:28, background:"transparent", border:`1px solid ${isDark ? "#8A3520" : "#F0B49C"}`, borderRadius:7, cursor:"pointer", color: isDark ? "#F08060" : "#9D3F23", fontSize:11, fontWeight:600, fontFamily:"inherit" }}>
                ✕ Clear dates
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// NOTES BADGE — styled like a status chip, hover shows popup, click copies
// ─────────────────────────────────────────────
function NotesBubble({ notes, isDark }) {
  const [hovered, setHovered] = useState(false);
  const [copied,  setCopied]  = useState(false);
  const [pos,     setPos]     = useState({ top:0, left:0 });
  if (!notes) return null;

  function handleMouseEnter(e) {
    setHovered(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const popW = 280;
    let left = rect.left + rect.width / 2 - popW / 2;
    if (left < 8) left = 8;
    if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
    // prefer above; if too close to top, go below
    const top = rect.top > 160 ? rect.top - 8 : rect.bottom + 8;
    const above = rect.top > 160;
    setPos({ top, left, above });
  }

  async function handleClick(e) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(notes);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  // Badge colours — match pending chip palette but in a neutral slate
  const bg     = isDark ? (copied ? "rgba(76,107,47,0.25)"  : "rgba(122,158,138,0.15)") : (copied ? "#EEF7E8"  : "#F0EBE3");
  const border = isDark ? (copied ? "#4A8050"               : "#2D4035")                  : (copied ? "#BDD6A6"  : "#C8B89A");
  const color  = isDark ? (copied ? "#7DC860"               : "#C8B89A")                  : (copied ? "#4C6B2F"  : "#6D6256");
  const dot    = copied
    ? (isDark ? "#7DC860" : "#4C6B2F")
    : (isDark ? "#7A9E8A" : "#8A6A55");

  return (
    <span style={{ position:"relative", display:"inline-flex" }}>
      <button
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setHovered(false)}
        title="Hover to read · Click to copy"
        style={{
          display:"inline-flex", alignItems:"center", gap:5,
          background:bg, color, border:`1px solid ${border}`,
          borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700,
          cursor:"pointer", whiteSpace:"nowrap", fontFamily:"inherit",
          transition:"all .15s",
        }}
      >
        <span style={{ width:6, height:6, borderRadius:"50%", background:dot, flexShrink:0 }} />
        {copied ? "Copied!" : "Notes"}
      </button>

      {hovered && !copied && (
        <div style={{
          position:"fixed",
          top:  pos.above ? pos.top : pos.top,
          left: pos.left,
          zIndex:9999,
          width:280,
          background: isDark ? "#1A2E22" : "#FDFAF6",
          border:`1px solid ${isDark ? "#2D4035" : "#D4C3AD"}`,
          borderRadius:10,
          padding:"11px 13px",
          boxShadow:"0 10px 36px rgba(0,0,0,0.35)",
          transform: pos.above ? "translateY(-100%)" : "translateY(0)",
          pointerEvents:"none",
        }}>
          <div style={{ fontSize:10, fontWeight:700, color: isDark ? "#7A9E8A" : "#8A6A55", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>
            Notes
          </div>
          <div style={{ fontSize:12, color: isDark ? "#EAE0D0" : "#2B1A12", lineHeight:1.55, whiteSpace:"pre-wrap", wordBreak:"break-word", maxHeight:160, overflowY:"auto" }}>
            {notes}
          </div>
          <div style={{ fontSize:10, color: isDark ? "#5A7A68" : "#B28A6B", marginTop:7, borderTop:`1px solid ${isDark ? "#2D4035" : "#E8DDD0"}`, paddingTop:5 }}>
            Click to copy to clipboard
          </div>
        </div>
      )}
    </span>
  );
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
  const D = { total:"#D4A870", ps:"#F0B84A", sv:"#7DC860", uwr:"#60C0E0", lost:"#F07850", psAp:"#F0B84A", svAp:"#7DC860" };
  return isDark ? D[key] : L[key];
}
function rptColor(key, isDark) {
  const L = { total:"#5B3320", sv:"#4C6B2F", ps:"#C07820", lost:"#9D3F23" };
  const D = { total:"#D4A870", sv:"#7DC860", ps:"#F0B84A", lost:"#F07850" };
  return isDark ? D[key] : L[key];
}

// ─────────────────────────────────────────────
// THEME TOKENS
// ─────────────────────────────────────────────
function useTheme(isDark) {
  return useMemo(() => {
    if (isDark) return {
      pageBg: "linear-gradient(135deg,#0E1A15 0%,#162219 48%,#1A1A12 100%)",
      color: "#EAE0D0", topbarBg: "#162219", topbarBorder: "#2D4035",
      cardBg: "#162219", cardBorder: "#2D4035", cardHover: "#1C2E24", cardHoverBorder: "#3A5045",
      inputBg: "#0E1A15", inputBorder: "#2D4035", inputColor: "#EAE0D0", inputPh: "#4A6A58", inputFocus: "#4A8A65",
      sideHeadBg: "#1A2E22", labelColor: "#7A9E8A", mutedColor: "#7A9E8A", dimColor: "#5A7A68",
      rptCellBg: "#1A2E22", inboundCardBg: "#1A2E22", agentTrackBg: "#0E1A15", agentFillBg: "#3A6E50",
      emptyBg: "#162219", pillOnBg: "#7A4A28", pillOnColor: "#FFE0BC", pillOnBorder: "#7A4A28",
      sideTitle: "#E8B87A", saveBtnBg: "#7A4A28", saveBtnColor: "#FFE0BC", modalBg: "#162219",
      stageTagBg: "#1A2E22", stageTagColor: "#C8B89A", stageTagBorder: "#2D4035",
      toolResBg: "rgba(76,107,47,0.25)", toolResBorder: "#4A8050", toolResColor: "#7DC860",
      toolEditBg: "rgba(46,100,128,0.25)", toolEditBorder: "#2E6680", toolEditColor: "#60B4DC",
      toolDelBg: "rgba(157,63,35,0.25)", toolDelBorder: "#8A3520", toolDelColor: "#F08060",
      toastSuccess: "#3A6E50", toastError: "#9D3F23", toastInfo: "#5C7768",
    };
    return {
      pageBg: "linear-gradient(135deg,#F6EFE4 0%,#E7DCCB 45%,#D6C8B5 100%)",
      color: "#2B1A12", topbarBg: "#E9DECC", topbarBorder: "#D4C3AD",
      cardBg: "#FCF8F2", cardBorder: "#DDD0BB", cardHover: "#F6EEE3", cardHoverBorder: "#C4A882",
      inputBg: "#FFFFFF", inputBorder: "#D4C3AD", inputColor: "#2B1A12", inputPh: "#B28A6B", inputFocus: "#5C7768",
      sideHeadBg: "#F6EEE3", labelColor: "#8A6A55", mutedColor: "#8A6A55", dimColor: "#B28A6B",
      rptCellBg: "#F6EEE3", inboundCardBg: "#F6EEE3", agentTrackBg: "#EDE5D7", agentFillBg: "#5C7768",
      emptyBg: "#FCF8F2", pillOnBg: "#5B3320", pillOnColor: "#FFFFFF", pillOnBorder: "#5B3320",
      sideTitle: "#5B3320", saveBtnBg: "#5B3320", saveBtnColor: "#FFFFFF", modalBg: "#FCF8F2",
      stageTagBg: "#EFE6D8", stageTagColor: "#6D6256", stageTagBorder: "#D4C3AD",
      toolResBg: "#EEF7E8", toolResBorder: "#BDD6A6", toolResColor: "#4C6B2F",
      toolEditBg: "#E8EEF0", toolEditBorder: "#AABFC8", toolEditColor: "#2E5566",
      toolDelBg: "#FCE8DF", toolDelBorder: "#F0B49C", toolDelColor: "#9D3F23",
      toastSuccess: "#4C6B2F", toastError: "#9D3F23", toastInfo: "#5C7768",
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
      <span style={{ width:6, height:6, borderRadius:"50%", background:m.dot, flexShrink:0 }} />{m.label}
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
  return <span style={{ background:t.stageTagBg, color:t.stageTagColor, border:`1px solid ${t.stageTagBorder}`, borderRadius:5, padding:"2px 6px", fontSize:10, fontWeight:700, fontFamily:"monospace" }}>{s || "—"}</span>;
}

function FL({ children, t }) {
  return <span style={{ display:"block", fontSize:10, fontWeight:700, color:t.labelColor, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>{children}</span>;
}

function FI({ value, onChange, type = "text", placeholder = "", t, style = {} }) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      style={{ width:"100%", height:31, background:t.inputBg, border:`1px solid ${t.inputBorder}`, borderRadius:7, padding:"0 9px", fontSize:12, color:t.inputColor, outline:"none", boxSizing:"border-box", fontFamily:"inherit", ...style }}
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

function FTA({ value, onChange, placeholder = "", rows = 2, t }) {
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

function G2({ children }) {
  return <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>{children}</div>;
}

function G3({ children }) {
  return <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:5 }}>{children}</div>;
}

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

function PrimaryBtn({ children, onClick, color = "#03071A" }) {
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
      color: active ? t.pillOnColor : t.mutedColor,
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
// FIX 1: AGENT LOAD — paginated 5 per page
// ─────────────────────────────────────────────
function AgentLoad({ agentMap, isDark, t }) {
  const PER_PAGE = 5;
  const [pg, setPg] = useState(1);
  const totalPg = Math.max(1, Math.ceil(agentMap.length / PER_PAGE));
  const safePg  = Math.min(pg, totalPg);
  const slice   = agentMap.slice((safePg - 1) * PER_PAGE, safePg * PER_PAGE);
  const agMax   = agentMap[0]?.[1] || 1;

  const navBtn = (label, onClick, disabled) => (
    <button onClick={onClick} disabled={disabled}
      style={{ width:26, height:26, background:"transparent", border:`1px solid ${t.cardBorder}`, borderRadius:7, cursor: disabled ? "not-allowed" : "pointer", color: disabled ? t.dimColor : t.mutedColor, fontSize:13, display:"flex", alignItems:"center", justifyContent:"center", opacity: disabled ? 0.3 : 1, fontFamily:"inherit" }}>
      {label}
    </button>
  );

  return (
    <div>
      {agentMap.length > PER_PAGE && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <span style={{ fontSize:10, color:t.dimColor }}>{agentMap.length} total agents</span>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            {navBtn("‹", () => setPg((p) => Math.max(1, p - 1)), safePg === 1)}
            <span style={{ fontSize:10, color:t.mutedColor }}>{safePg} / {totalPg}</span>
            {navBtn("›", () => setPg((p) => Math.min(totalPg, p + 1)), safePg >= totalPg)}
          </div>
        </div>
      )}
      {slice.length ? slice.map(([agent, count]) => (
        <div key={agent} style={{ marginBottom:9 }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, fontWeight:500, color: isDark ? "#C8B89A" : "#6D6256", marginBottom:3 }}>
            <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{agent}</span>
            <span>{count}</span>
          </div>
          <div style={{ height:3, background:t.agentTrackBg, borderRadius:99, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${Math.round((count / agMax) * 100)}%`, background:t.agentFillBg, borderRadius:99 }} />
          </div>
        </div>
      )) : <div style={{ fontSize:12, color:t.dimColor }}>No data yet — refresh to load.</div>}
    </div>
  );
}

// ─────────────────────────────────────────────
// FIX 2: REMINDERS MODAL — calendar + alarm
// ─────────────────────────────────────────────
function RemindersModal({ reminders, setReminders, onClose, t, isDark }) {
  const [title, setTitle]     = useState("");
  const [date,  setDate]      = useState(TODAY);
  const [time,  setTime]      = useState("09:00");
  const [note,  setNote]      = useState("");
  const [calMonth, setCalMonth] = useState(TODAY.slice(0, 7));

  const calDays = useMemo(() => {
    const [yr, mo] = calMonth.split("-").map(Number);
    const first = new Date(yr, mo - 1, 1);
    const daysInMonth = new Date(yr, mo, 0).getDate();
    const lead = first.getDay();
    const days = [];
    for (let i = 0; i < lead; i++) days.push({ blank:true, key:`b${i}` });
    for (let d = 1; d <= daysInMonth; d++) {
      const dk = `${yr}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      days.push({ blank:false, key:dk, day:d, dateKey:dk });
    }
    return days;
  }, [calMonth]);

  const byDate = useMemo(() => {
    const m = {};
    reminders.forEach((r) => {
      const dk = r.datetime?.slice(0, 10);
      if (!dk) return;
      if (!m[dk]) m[dk] = [];
      m[dk].push(r);
    });
    return m;
  }, [reminders]);

  function addReminder() {
    if (!title.trim() || !date || !time) return;
    const datetime = `${date}T${time}:00`;
    const newR = { id:crypto.randomUUID(), title:title.trim(), datetime, note:note.trim(), done:false };
    const updated = [...reminders, newR].sort((a, b) => a.datetime.localeCompare(b.datetime));
    setReminders(updated); safeSave(REMINDER_KEY, updated);
    setTitle(""); setNote(""); setDate(TODAY); setTime("09:00");
  }

  function toggleDone(id) {
    const updated = reminders.map((r) => r.id === id ? { ...r, done:!r.done } : r);
    setReminders(updated); safeSave(REMINDER_KEY, updated);
  }

  function deleteR(id) {
    const updated = reminders.filter((r) => r.id !== id);
    setReminders(updated); safeSave(REMINDER_KEY, updated);
  }

  const [yr, mo] = calMonth.split("-").map(Number);
  const monthLabel = new Date(yr, mo - 1, 1).toLocaleString("en-US", { month:"long", year:"numeric" });

  const inputS = { width:"100%", height:31, background:t.inputBg, border:`1px solid ${t.inputBorder}`, borderRadius:7, padding:"0 9px", fontSize:12, color:t.inputColor, outline:"none", boxSizing:"border-box", fontFamily:"inherit" };

  function prevMonth() {
    const d = new Date(yr, mo - 2, 1);
    setCalMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  }
  function nextMonth() {
    const d = new Date(yr, mo, 1);
    setCalMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:t.modalBg, border:`1px solid ${t.cardBorder}`, borderRadius:16, width:"100%", maxWidth:940, maxHeight:"92vh", overflowY:"auto", boxShadow:"0 24px 64px rgba(0,0,0,0.4)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 20px", borderBottom:`1px solid ${t.cardBorder}`, background:t.sideHeadBg }}>
          <span style={{ fontSize:15, fontWeight:700, color:t.color }}>🔔 Personal Reminders</span>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, color:t.mutedColor, fontFamily:"inherit" }}>✕ Close</button>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:0 }}>
          {/* Add reminder panel */}
          <div style={{ padding:18, borderRight:`1px solid ${t.cardBorder}` }}>
            <div style={{ fontSize:11, fontWeight:700, color:t.sideTitle, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>Add reminder</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <div><FL t={t}>Title</FL><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Call back client" style={inputS} /></div>
              <G2>
                <div><FL t={t}>Date</FL><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputS} /></div>
                <div><FL t={t}>Time</FL><input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={inputS} /></div>
              </G2>
              <div><FL t={t}>Note (optional)</FL>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Details…" rows={3}
                  style={{ ...inputS, height:"auto", padding:"7px 9px", resize:"none", lineHeight:1.4 }} />
              </div>
              <button onClick={addReminder} style={{ height:33, background:t.pillOnBg, color:t.pillOnColor, border:"none", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", marginTop:4 }}>
                + Set reminder
              </button>
              <div style={{ fontSize:10, color:t.dimColor, marginTop:4, lineHeight:1.5 }}>
                🔔 An alarm sound will play 10 minutes before your reminder while the app is open.
              </div>
            </div>
          </div>

          {/* Calendar */}
          <div style={{ padding:18, borderRight:`1px solid ${t.cardBorder}` }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <button onClick={prevMonth} style={{ background:"none", border:`1px solid ${t.cardBorder}`, borderRadius:6, width:28, height:28, cursor:"pointer", color:t.mutedColor, fontSize:15, display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button>
              <span style={{ fontSize:12, fontWeight:700, color:t.color }}>{monthLabel}</span>
              <button onClick={nextMonth} style={{ background:"none", border:`1px solid ${t.cardBorder}`, borderRadius:6, width:28, height:28, cursor:"pointer", color:t.mutedColor, fontSize:15, display:"flex", alignItems:"center", justifyContent:"center" }}>›</button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:6 }}>
              {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => (
                <div key={d} style={{ textAlign:"center", fontSize:9, fontWeight:700, color:t.dimColor }}>{d}</div>
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
              {calDays.map((day) => {
                if (day.blank) return <div key={day.key} />;
                const hasR   = !!byDate[day.dateKey]?.length;
                const isDue  = byDate[day.dateKey]?.some((r) => !r.done && new Date(r.datetime).getTime() <= Date.now());
                const isToday = day.dateKey === TODAY;
                const isSelected = day.dateKey === date;
                return (
                  <div key={day.key} onClick={() => setDate(day.dateKey)} style={{
                    textAlign:"center", fontSize:11,
                    fontWeight: isToday || isSelected ? 800 : 500,
                    padding:"5px 2px", borderRadius:6, cursor:"pointer", position:"relative",
                    background: isSelected ? t.pillOnBg : isToday ? (isDark ? "#1A2E22" : "#EEF7E8") : hasR ? (isDark ? "#1A2E22" : "#EEF7E8") : "transparent",
                    color: isSelected ? t.pillOnColor : isToday ? (isDark ? "#7DC860" : "#4C6B2F") : hasR ? (isDark ? "#7DC860" : "#4C6B2F") : t.color,
                    border: `1px solid ${isSelected ? t.pillOnBorder : isToday ? (isDark ? "#4A8050" : "#BDD6A6") : hasR ? (isDark ? "#4A8050" : "#BDD6A6") : "transparent"}`,
                  }}>
                    {day.day}
                    {isDue && <span style={{ position:"absolute", top:1, right:2, width:5, height:5, borderRadius:"50%", background:"#F07850", display:"block" }} />}
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop:10, fontSize:10, color:t.dimColor, lineHeight:1.5 }}>
              Click a date to select it. Green = has reminders. Orange dot = overdue.
            </div>
          </div>

          {/* Reminder list */}
          <div style={{ padding:18 }}>
            <div style={{ fontSize:11, fontWeight:700, color:t.sideTitle, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>
              All reminders ({reminders.filter((r) => !r.done).length} active)
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:7, maxHeight:420, overflowY:"auto" }}>
              {reminders.length === 0 && <div style={{ fontSize:12, color:t.dimColor }}>No reminders yet.</div>}
              {reminders.map((r) => {
                const dt   = new Date(r.datetime);
                const isDue = !r.done && dt.getTime() <= Date.now();
                const soon  = !r.done && !isDue && dt.getTime() - Date.now() <= 10 * 60 * 1000;
                return (
                  <div key={r.id} style={{ background: isDue ? (isDark ? "#2A1A10" : "#FFF1D8") : t.cardBg, border:`1px solid ${isDue ? (isDark ? "#7A4A28" : "#F1C27D") : t.cardBorder}`, borderRadius:9, padding:"10px 12px", opacity:r.done ? 0.5 : 1 }}>
                    <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:6 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:12, color:t.color, textDecoration:r.done ? "line-through" : "none" }}>{r.title}</div>
                        <div style={{ fontSize:10, color:t.mutedColor, marginTop:2 }}>{dt.toLocaleString()}</div>
                        {r.note && <div style={{ fontSize:11, color:t.mutedColor, marginTop:3 }}>{r.note}</div>}
                        {isDue && <span style={{ display:"inline-block", marginTop:4, fontSize:10, fontWeight:700, background:"#F07850", color:"#fff", borderRadius:4, padding:"1px 6px" }}>Overdue</span>}
                        {soon && <span style={{ display:"inline-block", marginTop:4, fontSize:10, fontWeight:700, background: isDark ? "#7A4A28" : "#D8913D", color:"#fff", borderRadius:4, padding:"1px 6px" }}>Due in 10 min</span>}
                      </div>
                      <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                        <button onClick={() => toggleDone(r.id)} title="Toggle done"
                          style={{ width:24, height:24, background: r.done ? (isDark ? "#3A6E50" : "#EEF7E8") : "transparent", border:`1px solid ${isDark ? "#3A6E50" : "#BDD6A6"}`, borderRadius:6, cursor:"pointer", color: isDark ? "#7DC860" : "#4C6B2F", fontSize:12, display:"flex", alignItems:"center", justifyContent:"center" }}>✓</button>
                        <button onClick={() => deleteR(r.id)} title="Delete"
                          style={{ width:24, height:24, background:"transparent", border:`1px solid ${isDark ? "#8A3520" : "#F0B49C"}`, borderRadius:6, cursor:"pointer", color: isDark ? "#F08060" : "#9D3F23", fontSize:12, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SHEET MODAL
// ─────────────────────────────────────────────
function SheetModal({ onClose, t }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:t.modalBg, border:`1px solid ${t.cardBorder}`, borderRadius:14, width:"100%", maxWidth:1100, height:"88vh", display:"flex", flexDirection:"column", boxShadow:"0 24px 64px rgba(0,0,0,0.35)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 18px", borderBottom:`1px solid ${t.cardBorder}`, background:t.sideHeadBg, flexShrink:0 }}>
          <span style={{ fontSize:14, fontWeight:700, color:t.color }}>📊 Google Sheet — Live View</span>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, color:t.mutedColor, fontFamily:"inherit" }}>✕ Close</button>
        </div>
        <iframe src={GOOGLE_SHEET_VIEW_URL} title="Google Sheet" style={{ flex:1, width:"100%", border:"none", borderRadius:"0 0 14px 14px" }} />
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
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, color:t.mutedColor, fontFamily:"inherit" }}>✕</button>
        </div>
        <div style={{ padding:"15px 17px", display:"flex", flexDirection:"column", gap:9 }}>
          <FRow label="Client name" t={t}><FI value={f.clientName} onChange={(v) => u("clientName", v)} placeholder="Full name" t={t} /></FRow>
          <G2>
            <FRow label="Policy #" t={t}><FI value={f.policyNumber} onChange={(v) => u("policyNumber", v)} t={t} /></FRow>
            <FRow label="AP" t={t}><FI type="number" value={f.ap} onChange={(v) => u("ap", v)} t={t} /></FRow>
          </G2>
          <G2>
            <FRow label="Lead status" t={t}><FS value={f.leadStatus} onChange={(v) => u("leadStatus", v)} options={LEAD_OPTS} t={t} /></FRow>
            <FRow label="Agent" t={t}><FI value={f.agentName} onChange={(v) => u("agentName", v)} t={t} /></FRow>
          </G2>
          <FRow label="Specialist" t={t}><FS value={f.specialistName} onChange={(v) => u("specialistName", v)} options={SPEC_OPTS} t={t} /></FRow>
          <G3>
            <FRow label="Status" t={t}><FS value={f.result} onChange={(v) => u("result", v)} options={RESULT_OPTS} t={t} /></FRow>
            <FRow label="Priority" t={t}><FS value={f.priority} onChange={(v) => u("priority", v)} options={PRIORITY_OPTS} t={t} /></FRow>
            <FRow label="Date" t={t}><FI type="date" value={f.updatedAt} onChange={(v) => u("updatedAt", v)} t={t} /></FRow>
          </G3>
          <FRow label="Action" t={t}><FS value={f.action} onChange={(v) => u("action", v)} options={ACTION_OPTS} t={t} /></FRow>
          <FRow label="Notes" t={t}><FTA value={f.notes} onChange={(v) => u("notes", v)} placeholder="Callback time, issue, next step…" rows={3} t={t} /></FRow>
        </div>
        <div style={{ padding:"11px 17px", borderTop:`1px solid ${t.cardBorder}`, background:t.sideHeadBg, display:"flex", justifyContent:"flex-end", gap:7 }}>
          <GhostBtn onClick={onClose} isDark={false}>Cancel</GhostBtn>
          <button onClick={() => onSave({ ...f, ap:Number(f.ap||0) })} style={{ background:t.saveBtnBg, color:t.saveBtnColor, border:"none", borderRadius:8, padding:"0 17px", height:31, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Save changes</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CASE FORM
// ─────────────────────────────────────────────
function CaseForm({ form, setForm, onAdd, onClear, t }) {
  const u = (f, v) => setForm((x) => ({ ...x, [f]: v }));
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      <FRow label="Client name" t={t}><FI value={form.clientName} onChange={(v) => u("clientName", v)} placeholder="Full name" t={t} /></FRow>
      <G2>
        <FRow label="Policy #" t={t}><FI value={form.policyNumber} onChange={(v) => u("policyNumber", v)} placeholder="POL-00000" t={t} /></FRow>
        <FRow label="AP" t={t}><FI type="number" value={form.ap} onChange={(v) => u("ap", v)} placeholder="0" t={t} /></FRow>
      </G2>
      <G2>
        <FRow label="Lead status" t={t}><FS value={form.leadStatus} onChange={(v) => u("leadStatus", v)} options={LEAD_OPTS} t={t} /></FRow>
        <FRow label="Agent" t={t}><FI value={form.agentName} onChange={(v) => u("agentName", v)} placeholder="Name" t={t} /></FRow>
      </G2>
      <FRow label="Specialist" t={t}><FS value={form.specialistName} onChange={(v) => u("specialistName", v)} options={SPEC_OPTS} t={t} /></FRow>
      <G3>
        <FRow label="Status" t={t}><FS value={form.result} onChange={(v) => u("result", v)} options={RESULT_OPTS} t={t} /></FRow>
        <FRow label="Priority" t={t}><FS value={form.priority} onChange={(v) => u("priority", v)} options={PRIORITY_OPTS} t={t} /></FRow>
        <FRow label="Date" t={t}><FI type="date" value={form.updatedAt} onChange={(v) => u("updatedAt", v)} t={t} /></FRow>
      </G3>
      <FRow label="Action" t={t}><FS value={form.action} onChange={(v) => u("action", v)} options={ACTION_OPTS} t={t} /></FRow>
      <FRow label="Notes" t={t}><FTA value={form.notes} onChange={(v) => u("notes", v)} placeholder="Callback time, issue, next step…" t={t} /></FRow>
      <PrimaryBtn onClick={onAdd}>+ Add case</PrimaryBtn>
      <ClearBtn onClick={onClear} t={t}>Clear form</ClearBtn>
    </div>
  );
}

// ─────────────────────────────────────────────
// FIX 3 & 4: INBOUND TAB — its own data only, never mixed with cases
// ─────────────────────────────────────────────
function InboundTab({ ibDate, setIbDate, inboundRows, onSave, onDelete, t, isDark }) {
  const [f, setF] = useState({ clientName:"", phoneNumber:"", agentName:"", specialistName:"", resolved:"No", agentInformed:"No", notes:"" });
  const u = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const [ibQ,  setIbQ]  = useState("");
  const [ibRes, setIbRes] = useState("All");

  const filtered = useMemo(() => {
    const q = ibQ.trim().toLowerCase();
    return inboundRows.filter((r) =>
      (ibRes === "All" || r.resolved === ibRes) &&
      (!q || [r.clientName, r.agentName, r.phoneNumber, r.notes, r.specialistName].join(" ").toLowerCase().includes(q))
    );
  }, [inboundRows, ibQ, ibRes]);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {/* Form */}
      <FRow label="Client name" t={t}><FI value={f.clientName} onChange={(v) => u("clientName", v)} placeholder="Full name" t={t} /></FRow>
      <FRow label="Phone number" t={t}><FI type="tel" value={f.phoneNumber} onChange={(v) => u("phoneNumber", v)} placeholder="305-555-0000" t={t} /></FRow>
      <G2>
        <FRow label="Agent" t={t}><FI value={f.agentName} onChange={(v) => u("agentName", v)} placeholder="Agent name" t={t} /></FRow>
        <FRow label="Specialist" t={t}><FS value={f.specialistName} onChange={(v) => u("specialistName", v)} options={SPEC_OPTS} t={t} /></FRow>
      </G2>
      <FRow label="Date of call" t={t}><FI type="date" value={ibDate} onChange={setIbDate} t={t} /></FRow>
      <G2>
        <FRow label="Resolved" t={t}><FS value={f.resolved} onChange={(v) => u("resolved", v)} options={["No","Yes"]} t={t} /></FRow>
        <FRow label="Agent informed" t={t}><FS value={f.agentInformed} onChange={(v) => u("agentInformed", v)} options={["No","Yes"]} t={t} /></FRow>
      </G2>
      <FRow label="Notes" t={t}><FTA value={f.notes} onChange={(v) => u("notes", v)} placeholder="Cancellation details, next steps…" t={t} /></FRow>
      <PrimaryBtn onClick={() => {
        onSave({ ...f, dateOfCall:ibDate });
        setF({ clientName:"", phoneNumber:"", agentName:"", specialistName:"", resolved:"No", agentInformed:"No", notes:"" });
      }}>+ Save inbound cancellation</PrimaryBtn>

      {/* Separator */}
      <div style={{ borderTop:`1px solid ${t.cardBorder}`, margin:"4px 0" }} />

      {/* Inbound-only list */}
      <div style={{ fontSize:11, fontWeight:700, color:t.sideTitle, textTransform:"uppercase", letterSpacing:"0.08em" }}>
        Inbound list ({inboundRows.length})
      </div>
      <div style={{ display:"flex", gap:5 }}>
        <input value={ibQ} onChange={(e) => setIbQ(e.target.value)} placeholder="Search inbound…"
          style={{ flex:1, height:26, background:t.inputBg, border:`1px solid ${t.inputBorder}`, borderRadius:7, padding:"0 8px", fontSize:11, color:t.inputColor, outline:"none", fontFamily:"inherit" }} />
        <select value={ibRes} onChange={(e) => setIbRes(e.target.value)}
          style={{ height:26, background:t.inputBg, border:`1px solid ${t.inputBorder}`, borderRadius:7, padding:"0 6px", fontSize:11, color:t.inputColor, outline:"none", fontFamily:"inherit" }}>
          <option value="All">All</option>
          <option value="Yes">Resolved</option>
          <option value="No">Unresolved</option>
        </select>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:5, maxHeight:300, overflowY:"auto" }}>
        {filtered.length === 0 && <div style={{ fontSize:11, color:t.dimColor, textAlign:"center", padding:"12px 0" }}>No inbound entries yet.</div>}
        {filtered.map((item) => (
          <div key={item.id} style={{ background:t.inboundCardBg, border:`1px solid ${t.cardBorder}`, borderRadius:8, padding:"9px 11px" }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:4 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:12, color:t.color }}>{item.clientName}</div>
                <div style={{ fontSize:10, color:t.mutedColor, marginTop:1 }}>
                  {item.agentName}{item.phoneNumber ? ` · ${item.phoneNumber}` : ""}
                  {item.dateOfCall ? ` · ${item.dateOfCall}` : ""}
                </div>
                <div style={{ display:"flex", gap:4, marginTop:4, flexWrap:"wrap" }}>
                  <StatusChip status={item.resolved === "Yes" ? "RESOLVED" : "PENDING"} />
                  {item.agentInformed === "Yes" && (
                    <span style={{ fontSize:10, background:"#EEF7E8", color:"#4C6B2F", border:"1px solid #BDD6A6", borderRadius:5, padding:"1px 6px", fontWeight:600 }}>Agent informed</span>
                  )}
                </div>
                {item.notes && <div style={{ fontSize:10, color:t.mutedColor, marginTop:3 }}>{item.notes}</div>}
              </div>
              <button onClick={() => onDelete(item.id)}
                style={{ width:22, height:22, background:t.toolDelBg, border:`1px solid ${t.toolDelBorder}`, borderRadius:5, cursor:"pointer", color:t.toolDelColor, fontSize:11, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// FIX 5: EOD TAB — its own data only, never mixed with cases
// ─────────────────────────────────────────────
function EodTab({ onSave, eodEntries, onDeleteEod, t, isDark }) {
  const [f, setF] = useState({ ...BLANK_EOD });
  const u = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const [eodSpec, setEodSpec] = useState("All");

  const filteredEod = useMemo(() =>
    eodEntries
      .filter((e) => eodSpec === "All" || e.specialistName === eodSpec)
      .sort((a, b) => {
        const da = normalizeEodDate(a.date || a.createdAt || "");
        const db = normalizeEodDate(b.date || b.createdAt || "");
        return db.localeCompare(da);
      }),
    [eodEntries, eodSpec]
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      <FRow label="Specialist name" t={t}><FS value={f.specialistName} onChange={(v) => u("specialistName", v)} options={SPEC_OPTS} t={t} /></FRow>
      <FRow label="Date" t={t}><FI type="date" value={f.date} onChange={(v) => u("date", v)} t={t} /></FRow>
      <G2>
        <FRow label="Total dials for the day" t={t}><FI type="number" value={f.totalDials} onChange={(v) => u("totalDials", v)} placeholder="0" t={t} /></FRow>
        <FRow label="Total talk time (min)" t={t}><FI type="number" value={f.totalTalkTime} onChange={(v) => u("totalTalkTime", v)} placeholder="0" t={t} /></FRow>
      </G2>
      <FRow label="Clients reached via call or text" t={t}><FI type="number" value={f.clientsReached} onChange={(v) => u("clientsReached", v)} placeholder="0" t={t} /></FRow>
      <FRow label="Total welcome calls completed" t={t}><FI type="number" value={f.welcomeCallsCompleted} onChange={(v) => u("welcomeCallsCompleted", v)} placeholder="0" t={t} /></FRow>
      <G2>
        <FRow label="At risk resolved (pre)" t={t}><FI type="number" value={f.atRiskResolvedPre} onChange={(v) => u("atRiskResolvedPre", v)} placeholder="0" t={t} /></FRow>
        <FRow label="At risk resolved (conf)" t={t}><FI type="number" value={f.atRiskResolvedConfirmed} onChange={(v) => u("atRiskResolvedConfirmed", v)} placeholder="0" t={t} /></FRow>
      </G2>
      <G2>
        <FRow label="AP saved (pre)" t={t}><FI type="number" value={f.apSavedPre} onChange={(v) => u("apSavedPre", v)} placeholder="0" t={t} /></FRow>
        <FRow label="AP saved (conf)" t={t}><FI type="number" value={f.apSavedConfirmed} onChange={(v) => u("apSavedConfirmed", v)} placeholder="0" t={t} /></FRow>
      </G2>
      <G2>
        <FRow label="UW policies resolved" t={t}><FI type="number" value={f.uwPoliciesResolved} onChange={(v) => u("uwPoliciesResolved", v)} placeholder="0" t={t} /></FRow>
        <FRow label="Pending resolution" t={t}><FI type="number" value={f.pendingResolution} onChange={(v) => u("pendingResolution", v)} placeholder="0" t={t} /></FRow>
      </G2>
      <FRow label="Saved — pending confirmation (Client & Policy #)" t={t}><FTA value={f.savedPendingConfirmation} onChange={(v) => u("savedPendingConfirmation", v)} placeholder="John Smith - POLICY123" t={t} /></FRow>
      <FRow label="Saved — confirmed (Client & Policy #)" t={t}><FTA value={f.savedConfirmed} onChange={(v) => u("savedConfirmed", v)} placeholder="Jane Doe - POLICY456" t={t} /></FRow>
      <FRow label="UW resolved not yet confirmed (AP, Name, Resolution, Carrier & Policy #)" t={t}><FTA value={f.uwResolvedNotConfirmedDetails} onChange={(v) => u("uwResolvedNotConfirmedDetails", v)} placeholder="AP, Name, Resolution, Carrier, Policy #" t={t} /></FRow>
      <FRow label="UW confirmed resolved (AP, Name, Resolution, Carrier & Policy #)" t={t}><FTA value={f.uwConfirmedResolvedDetails} onChange={(v) => u("uwConfirmedResolvedDetails", v)} placeholder="AP, Name, Resolution, Carrier, Policy #" t={t} /></FRow>
      <FRow label="Escalations / agent action needed" t={t}><FTA value={f.escalationsAgentActionNeeded} onChange={(v) => u("escalationsAgentActionNeeded", v)} placeholder="Client info, policy details, agent name, action needed" t={t} /></FRow>
      <PrimaryBtn onClick={() => { onSave(f); setF({ ...BLANK_EOD }); }}>💾 Save EOD</PrimaryBtn>
      <ClearBtn onClick={() => setF({ ...BLANK_EOD })} t={t}>Clear</ClearBtn>

      {/* Separator */}
      <div style={{ borderTop:`1px solid ${t.cardBorder}`, margin:"4px 0" }} />

      {/* EOD-only history */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ fontSize:11, fontWeight:700, color:t.sideTitle, textTransform:"uppercase", letterSpacing:"0.08em" }}>
          EOD history ({filteredEod.length})
        </div>
        <select value={eodSpec} onChange={(e) => setEodSpec(e.target.value)}
          style={{ height:24, background:t.inputBg, border:`1px solid ${t.inputBorder}`, borderRadius:6, padding:"0 6px", fontSize:10, color:t.inputColor, outline:"none", fontFamily:"inherit" }}>
          <option value="All">All specialists</option>
          {["Nisha","Rick","Chen","Fernando","Claire"].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:5, maxHeight:320, overflowY:"auto" }}>
        {filteredEod.length === 0 && <div style={{ fontSize:11, color:t.dimColor, textAlign:"center", padding:"12px 0" }}>No EOD entries yet.</div>}
        {filteredEod.map((entry) => (
          <div key={entry.id} style={{ background:t.inboundCardBg, border:`1px solid ${t.cardBorder}`, borderRadius:8, padding:"9px 11px" }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:4 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:12, color:t.color }}>{entry.specialistName} — {normalizeEodDate(entry.date || entry.createdAt)}</div>
                <div style={{ fontSize:10, color:t.mutedColor, marginTop:2 }}>
                  Dials: {entry.totalDials || 0} · Talk: {entry.totalTalkTime || 0}min · Reached: {entry.clientsReached || 0}
                </div>
                <div style={{ fontSize:10, color:t.mutedColor }}>
                  AP pre: {cur(entry.apSavedPre)} · AP conf: {cur(entry.apSavedConfirmed)}
                </div>
                {entry.escalationsAgentActionNeeded && (
                  <div style={{ fontSize:10, color: isDark ? "#F08060" : "#9D3F23", marginTop:3 }}>
                    ⚠ {entry.escalationsAgentActionNeeded.slice(0, 70)}{entry.escalationsAgentActionNeeded.length > 70 ? "…" : ""}
                  </div>
                )}
              </div>
              <button onClick={() => onDeleteEod(entry.id)}
                style={{ width:22, height:22, background:t.toolDelBg, border:`1px solid ${t.toolDelBorder}`, borderRadius:5, cursor:"pointer", color:t.toolDelColor, fontSize:11, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// INBOUND EDIT MODAL
// ─────────────────────────────────────────────
function InboundEditModal({ item, onClose, onSave, t, isDark }) {
  const [f, setF] = useState({ ...item });
  const u = (k, v) => setF((x) => ({ ...x, [k]: v }));
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:t.modalBg, border:`1px solid ${t.cardBorder}`, borderRadius:14, width:"100%", maxWidth:480, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 24px 64px rgba(0,0,0,0.3)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"13px 17px", borderBottom:`1px solid ${t.cardBorder}`, background:t.sideHeadBg }}>
          <span style={{ fontSize:14, fontWeight:700, color:t.color }}>Edit inbound entry</span>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, color:t.mutedColor, fontFamily:"inherit" }}>✕</button>
        </div>
        <div style={{ padding:"15px 17px", display:"flex", flexDirection:"column", gap:9 }}>
          <FRow label="Client name" t={t}><FI value={f.clientName} onChange={(v) => u("clientName", v)} placeholder="Full name" t={t} /></FRow>
          <FRow label="Phone number" t={t}><FI type="tel" value={f.phoneNumber} onChange={(v) => u("phoneNumber", v)} placeholder="305-555-0000" t={t} /></FRow>
          <G2>
            <FRow label="Agent" t={t}><FI value={f.agentName} onChange={(v) => u("agentName", v)} placeholder="Agent name" t={t} /></FRow>
            <FRow label="Specialist" t={t}><FS value={f.specialistName} onChange={(v) => u("specialistName", v)} options={SPEC_OPTS} t={t} /></FRow>
          </G2>
          <FRow label="Date of call" t={t}><FI type="date" value={f.dateOfCall || ""} onChange={(v) => u("dateOfCall", v)} t={t} /></FRow>
          <G2>
            <FRow label="Resolved" t={t}><FS value={f.resolved} onChange={(v) => u("resolved", v)} options={["No","Yes"]} t={t} /></FRow>
            <FRow label="Agent informed" t={t}><FS value={f.agentInformed} onChange={(v) => u("agentInformed", v)} options={["No","Yes"]} t={t} /></FRow>
          </G2>
          <FRow label="Notes" t={t}><FTA value={f.notes} onChange={(v) => u("notes", v)} placeholder="Cancellation details, next steps…" rows={3} t={t} /></FRow>
        </div>
        <div style={{ padding:"11px 17px", borderTop:`1px solid ${t.cardBorder}`, background:t.sideHeadBg, display:"flex", justifyContent:"flex-end", gap:7 }}>
          <button onClick={onClose} style={{ height:31, padding:"0 14px", background:"transparent", border:`1px solid ${t.cardBorder}`, borderRadius:8, cursor:"pointer", color:t.mutedColor, fontSize:12, fontFamily:"inherit" }}>Cancel</button>
          <button onClick={() => onSave(f)} style={{ height:31, padding:"0 17px", background:t.saveBtnBg, color:t.saveBtnColor, border:"none", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Save changes</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// INBOUND MAIN PANEL — replaces entire left area when Inbound tab active
// ─────────────────────────────────────────────
function InboundMainPanel({ ibDate, setIbDate, inboundRows, onSave, onDelete, onEdit, t, isDark }) {
  const [f, setF] = useState({ clientName:"", phoneNumber:"", agentName:"", specialistName:"", resolved:"No", agentInformed:"No", notes:"" });
  const u = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const [ibQ,       setIbQ]       = useState("");
  const [ibRes,     setIbRes]     = useState("All");
  const [ibSpec,    setIbSpec]    = useState("All");
  const [ibPage,    setIbPage]    = useState(1);
  const [ibStart,   setIbStart]   = useState("");
  const [ibEnd,     setIbEnd]     = useState("");
  const [editItem,  setEditItem]  = useState(null);
  const IB_PER = 15;

  const filtered = useMemo(() => {
    const q = ibQ.trim().toLowerCase();
    return inboundRows.filter((r) => {
      const rowDate = r.dateOfCall || r.createdAt?.slice(0,10) || "";
      let md = true;
      if (ibStart && ibEnd)   md = rowDate >= ibStart && rowDate <= ibEnd;
      else if (ibStart)       md = rowDate === ibStart;
      else if (ibEnd)         md = rowDate === ibEnd;
      return (
        (ibRes  === "All" || r.resolved       === ibRes) &&
        (ibSpec === "All" || r.specialistName === ibSpec) &&
        md &&
        (!q || [r.clientName, r.agentName, r.phoneNumber, r.notes, r.specialistName].join(" ").toLowerCase().includes(q))
      );
    });
  }, [inboundRows, ibQ, ibRes, ibSpec, ibStart, ibEnd]);

  const totalPg = Math.max(1, Math.ceil(filtered.length / IB_PER));
  const safePg  = Math.min(ibPage, totalPg);
  const paged   = filtered.slice((safePg - 1) * IB_PER, safePg * IB_PER);

  const toolInp = { height:32, background:t.inputBg, border:`1px solid ${t.inputBorder}`, borderRadius:8, padding:"0 9px", fontSize:12, color:t.inputColor, outline:"none", fontFamily:"inherit" };

  return (
    <div style={{ display:"grid", gridTemplateColumns:"300px 1fr", gap:14, alignItems:"start" }}>
      {/* Edit modal */}
      {editItem && (
        <InboundEditModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSave={(updated) => { onEdit(updated); setEditItem(null); }}
          t={t} isDark={isDark}
        />
      )}

      {/* LEFT: Inbound entry form */}
      <div style={{ background:t.cardBg, border:`1px solid ${t.cardBorder}`, borderRadius:12, overflow:"hidden" }}>
        <div style={{ padding:"11px 15px", borderBottom:`1px solid ${t.cardBorder}`, background:t.sideHeadBg }}>
          <span style={{ fontSize:11, fontWeight:700, color:t.sideTitle, textTransform:"uppercase", letterSpacing:"0.09em" }}>Log inbound cancellation</span>
        </div>
        <div style={{ padding:14, display:"flex", flexDirection:"column", gap:8 }}>
          <FRow label="Client name" t={t}><FI value={f.clientName} onChange={(v) => u("clientName", v)} placeholder="Full name" t={t} /></FRow>
          <FRow label="Phone number" t={t}><FI type="tel" value={f.phoneNumber} onChange={(v) => u("phoneNumber", v)} placeholder="305-555-0000" t={t} /></FRow>
          <G2>
            <FRow label="Agent" t={t}><FI value={f.agentName} onChange={(v) => u("agentName", v)} placeholder="Agent name" t={t} /></FRow>
            <FRow label="Specialist" t={t}><FS value={f.specialistName} onChange={(v) => u("specialistName", v)} options={SPEC_OPTS} t={t} /></FRow>
          </G2>
          <FRow label="Date of call" t={t}><FI type="date" value={ibDate} onChange={setIbDate} t={t} /></FRow>
          <G2>
            <FRow label="Resolved" t={t}><FS value={f.resolved} onChange={(v) => u("resolved", v)} options={["No","Yes"]} t={t} /></FRow>
            <FRow label="Agent informed" t={t}><FS value={f.agentInformed} onChange={(v) => u("agentInformed", v)} options={["No","Yes"]} t={t} /></FRow>
          </G2>
          <FRow label="Notes" t={t}><FTA value={f.notes} onChange={(v) => u("notes", v)} placeholder="Cancellation details, next steps…" t={t} /></FRow>
          <PrimaryBtn onClick={() => {
            onSave({ ...f, dateOfCall:ibDate });
            setF({ clientName:"", phoneNumber:"", agentName:"", specialistName:"", resolved:"No", agentInformed:"No", notes:"" });
          }}>+ Save inbound cancellation</PrimaryBtn>
        </div>
      </div>

      {/* RIGHT: Full inbound list */}
      <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
        {/* Toolbar */}
        <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
          <div style={{ position:"relative", flex:1, minWidth:180 }}>
            <span style={{ position:"absolute", left:9, top:"50%", transform:"translateY(-50%)", fontSize:14, color:t.mutedColor, pointerEvents:"none" }}>⌕</span>
            <input value={ibQ} onChange={(e) => { setIbQ(e.target.value); setIbPage(1); }} placeholder="Search inbound entries…"
              style={{ ...toolInp, width:"100%", paddingLeft:28 }} />
          </div>

          {/* Date range picker — same component as cases */}
          <DateRangePicker
            filterStart={ibStart} filterEnd={ibEnd}
            setFilterStart={(v) => { setIbStart(v); setIbPage(1); }}
            setFilterEnd={(v)   => { setIbEnd(v);   setIbPage(1); }}
            t={t} isDark={isDark}
          />

          <select value={ibRes} onChange={(e) => { setIbRes(e.target.value); setIbPage(1); }}
            style={{ ...toolInp, width:"auto" }}>
            <option value="All">All statuses</option>
            <option value="Yes">Resolved</option>
            <option value="No">Unresolved</option>
          </select>
          <select value={ibSpec} onChange={(e) => { setIbSpec(e.target.value); setIbPage(1); }}
            style={{ ...toolInp, width:"auto" }}>
            <option value="All">All specialists</option>
            {["Nisha","Rick","Chen","Fernando","Claire"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <span style={{ fontSize:11, color:t.mutedColor, marginLeft:"auto" }}>{filtered.length} entr{filtered.length !== 1 ? "ies" : "y"}</span>
        </div>

        {/* Column headers */}
        <div style={{ display:"grid", gridTemplateColumns:"150px 105px 90px 85px 75px 1fr 64px", gap:8, padding:"0 14px" }}>
          {["Client","Agent","Phone","Date","Resolved","Notes",""].map((h) => (
            <div key={h} style={{ fontSize:10, fontWeight:700, color:t.dimColor, textTransform:"uppercase", letterSpacing:"0.07em" }}>{h}</div>
          ))}
        </div>

        {/* Inbound rows */}
        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
          {paged.length ? paged.map((item) => (
            <div key={item.id}
              style={{ background:t.cardBg, border:`1px solid ${t.cardBorder}`, borderRadius:10, padding:"10px 14px", display:"grid", gridTemplateColumns:"150px 105px 90px 85px 75px 1fr 64px", gap:8, alignItems:"center", transition:"border-color .14s,background .14s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = t.cardHover; e.currentTarget.style.borderColor = t.cardHoverBorder; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = t.cardBg;    e.currentTarget.style.borderColor = t.cardBorder; }}
            >
              <div>
                <div style={{ fontWeight:700, fontSize:12, color:t.color, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{item.clientName}</div>
                {item.specialistName && <div style={{ fontSize:10, color:t.mutedColor, marginTop:1 }}>{item.specialistName}</div>}
              </div>
              <div style={{ fontSize:11, color: isDark ? "#C8B89A" : "#6D6256", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{item.agentName || "—"}</div>
              <div style={{ fontSize:11, color:t.mutedColor, fontFamily:"monospace" }}>{item.phoneNumber || "—"}</div>
              <div style={{ fontSize:11, color:t.mutedColor }}>{item.dateOfCall || item.createdAt?.slice(0,10) || "—"}</div>
              <div><StatusChip status={item.resolved === "Yes" ? "RESOLVED" : "PENDING"} /></div>
              <div><NotesBubble notes={item.notes} isDark={isDark} /></div>
              {/* Edit + Delete buttons */}
              <div style={{ display:"flex", gap:4, justifyContent:"flex-end" }}>
                <button onClick={() => setEditItem({ ...item })} title="Edit"
                  style={{ width:28, height:28, background:t.toolEditBg, border:`1px solid ${t.toolEditBorder}`, borderRadius:7, cursor:"pointer", color:t.toolEditColor, fontSize:13, display:"flex", alignItems:"center", justifyContent:"center" }}>✎</button>
                <button onClick={() => onDelete(item.id)} title="Delete"
                  style={{ width:28, height:28, background:t.toolDelBg, border:`1px solid ${t.toolDelBorder}`, borderRadius:7, cursor:"pointer", color:t.toolDelColor, fontSize:12, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
              </div>
            </div>
          )) : (
            <div style={{ textAlign:"center", padding:"40px 20px", background:t.emptyBg, borderRadius:10 }}>
              <div style={{ fontSize:24, marginBottom:8, opacity:0.35 }}>◈</div>
              <div style={{ fontSize:13, fontWeight:700, color:t.mutedColor }}>No inbound entries found</div>
              <div style={{ fontSize:11, marginTop:4, color:t.dimColor }}>Try adjusting your filters or log a new entry on the left</div>
            </div>
          )}
        </div>

        {/* Pagination */}
        {filtered.length > IB_PER && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", fontSize:11, color:t.mutedColor }}>
            <span>{(safePg - 1) * IB_PER + 1}–{Math.min(safePg * IB_PER, filtered.length)} of {filtered.length}</span>
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              <button onClick={() => setIbPage((p) => Math.max(1, p - 1))} disabled={safePg === 1}
                style={{ height:28, padding:"0 12px", background:"transparent", border:`1px solid ${t.cardBorder}`, borderRadius:7, cursor: safePg === 1 ? "not-allowed" : "pointer", color:t.mutedColor, fontSize:11, fontFamily:"inherit", opacity: safePg === 1 ? 0.3 : 1 }}>← Prev</button>
              <span>{safePg} / {totalPg}</span>
              <button onClick={() => setIbPage((p) => Math.min(totalPg, p + 1))} disabled={safePg >= totalPg}
                style={{ height:28, padding:"0 12px", background:"transparent", border:`1px solid ${t.cardBorder}`, borderRadius:7, cursor: safePg >= totalPg ? "not-allowed" : "pointer", color:t.mutedColor, fontSize:11, fontFamily:"inherit", opacity: safePg >= totalPg ? 0.3 : 1 }}>Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// EOD MAIN PANEL — replaces entire left area when EOD tab active
// ─────────────────────────────────────────────
function EodMainPanel({ onSave, eodEntries, onDeleteEod, t, isDark }) {
  const [f, setF] = useState({ ...BLANK_EOD });
  const u = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const [eodSpec, setEodSpec] = useState("All");
  const [eodPage, setEodPage] = useState(1);
  const EOD_PER = 10;

  const filtered = useMemo(() =>
    eodEntries
      .filter((e) => eodSpec === "All" || e.specialistName === eodSpec)
      .sort((a, b) => {
        const da = normalizeEodDate(a.date || a.createdAt || "");
        const db = normalizeEodDate(b.date || b.createdAt || "");
        return db.localeCompare(da);
      }),
    [eodEntries, eodSpec]
  );

  const totalPg = Math.max(1, Math.ceil(filtered.length / EOD_PER));
  const safePg  = Math.min(eodPage, totalPg);
  const paged   = filtered.slice((safePg - 1) * EOD_PER, safePg * EOD_PER);

  const toolInp = { height:32, background:t.inputBg, border:`1px solid ${t.inputBorder}`, borderRadius:8, padding:"0 9px", fontSize:12, color:t.inputColor, outline:"none", fontFamily:"inherit" };

  return (
    <div style={{ display:"grid", gridTemplateColumns:"300px 1fr", gap:14, alignItems:"start" }}>
      {/* LEFT: EOD entry form */}
      <div style={{ background:t.cardBg, border:`1px solid ${t.cardBorder}`, borderRadius:12, overflow:"hidden" }}>
        <div style={{ padding:"11px 15px", borderBottom:`1px solid ${t.cardBorder}`, background:t.sideHeadBg }}>
          <span style={{ fontSize:11, fontWeight:700, color:t.sideTitle, textTransform:"uppercase", letterSpacing:"0.09em" }}>Submit EOD report</span>
        </div>
        <div style={{ padding:14, display:"flex", flexDirection:"column", gap:8 }}>
          <FRow label="Specialist name" t={t}><FS value={f.specialistName} onChange={(v) => u("specialistName", v)} options={SPEC_OPTS} t={t} /></FRow>
          <FRow label="Date" t={t}><FI type="date" value={f.date} onChange={(v) => u("date", v)} t={t} /></FRow>
          <G2>
            <FRow label="Total dials" t={t}><FI type="number" value={f.totalDials} onChange={(v) => u("totalDials", v)} placeholder="0" t={t} /></FRow>
            <FRow label="Talk time (min)" t={t}><FI type="number" value={f.totalTalkTime} onChange={(v) => u("totalTalkTime", v)} placeholder="0" t={t} /></FRow>
          </G2>
          <FRow label="Clients reached" t={t}><FI type="number" value={f.clientsReached} onChange={(v) => u("clientsReached", v)} placeholder="0" t={t} /></FRow>
          <FRow label="Welcome calls completed" t={t}><FI type="number" value={f.welcomeCallsCompleted} onChange={(v) => u("welcomeCallsCompleted", v)} placeholder="0" t={t} /></FRow>
          <G2>
            <FRow label="At risk resolved (pre)" t={t}><FI type="number" value={f.atRiskResolvedPre} onChange={(v) => u("atRiskResolvedPre", v)} placeholder="0" t={t} /></FRow>
            <FRow label="At risk resolved (conf)" t={t}><FI type="number" value={f.atRiskResolvedConfirmed} onChange={(v) => u("atRiskResolvedConfirmed", v)} placeholder="0" t={t} /></FRow>
          </G2>
          <G2>
            <FRow label="AP saved (pre)" t={t}><FI type="number" value={f.apSavedPre} onChange={(v) => u("apSavedPre", v)} placeholder="0" t={t} /></FRow>
            <FRow label="AP saved (conf)" t={t}><FI type="number" value={f.apSavedConfirmed} onChange={(v) => u("apSavedConfirmed", v)} placeholder="0" t={t} /></FRow>
          </G2>
          <G2>
            <FRow label="UW policies resolved" t={t}><FI type="number" value={f.uwPoliciesResolved} onChange={(v) => u("uwPoliciesResolved", v)} placeholder="0" t={t} /></FRow>
            <FRow label="Pending resolution" t={t}><FI type="number" value={f.pendingResolution} onChange={(v) => u("pendingResolution", v)} placeholder="0" t={t} /></FRow>
          </G2>
          <FRow label="Saved — pending confirmation" t={t}><FTA value={f.savedPendingConfirmation} onChange={(v) => u("savedPendingConfirmation", v)} placeholder="Client Name - POLICY123" t={t} /></FRow>
          <FRow label="Saved — confirmed" t={t}><FTA value={f.savedConfirmed} onChange={(v) => u("savedConfirmed", v)} placeholder="Client Name - POLICY456" t={t} /></FRow>
          <FRow label="UW resolved not yet confirmed (AP, Name, Resolution, Carrier & Policy #)" t={t}><FTA value={f.uwResolvedNotConfirmedDetails} onChange={(v) => u("uwResolvedNotConfirmedDetails", v)} placeholder="AP, Name, Resolution, Carrier, Policy #" t={t} /></FRow>
          <FRow label="UW confirmed resolved (AP, Name, Resolution, Carrier & Policy #)" t={t}><FTA value={f.uwConfirmedResolvedDetails} onChange={(v) => u("uwConfirmedResolvedDetails", v)} placeholder="AP, Name, Resolution, Carrier, Policy #" t={t} /></FRow>
          <FRow label="Escalations / agent action needed" t={t}><FTA value={f.escalationsAgentActionNeeded} onChange={(v) => u("escalationsAgentActionNeeded", v)} placeholder="Client info, policy details, agent name, action needed" t={t} /></FRow>
          <PrimaryBtn onClick={() => { onSave(f); setF({ ...BLANK_EOD }); }}>💾 Save EOD</PrimaryBtn>
          <ClearBtn onClick={() => setF({ ...BLANK_EOD })} t={t}>Clear</ClearBtn>
        </div>
      </div>

      {/* RIGHT: EOD history list */}
      <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
        {/* Toolbar */}
        <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
          <select value={eodSpec} onChange={(e) => { setEodSpec(e.target.value); setEodPage(1); }}
            style={{ ...toolInp, width:"auto" }}>
            <option value="All">All specialists</option>
            {["Nisha","Rick","Chen","Fernando","Claire"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <span style={{ fontSize:11, color:t.mutedColor, marginLeft:"auto" }}>{filtered.length} EOD entr{filtered.length !== 1 ? "ies" : "y"}</span>
        </div>

        {/* Column headers */}
        <div style={{ padding:"0 14px", display:"grid", gridTemplateColumns:"100px 80px 70px 80px 80px 80px 80px 1fr 32px", gap:8 }}>
          {["Date","Specialist","Dials","Talk (min)","Reached","AP Pre","AP Conf","Escalations",""].map((h) => (
            <div key={h} style={{ fontSize:10, fontWeight:700, color:t.dimColor, textTransform:"uppercase", letterSpacing:"0.07em" }}>{h}</div>
          ))}
        </div>

        {/* EOD rows */}
        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
          {paged.length ? paged.map((entry) => (
            <div key={entry.id}
              style={{ background:t.cardBg, border:`1px solid ${t.cardBorder}`, borderRadius:10, padding:"10px 14px", display:"grid", gridTemplateColumns:"100px 80px 70px 80px 80px 80px 80px 1fr 32px", gap:8, alignItems:"center" }}
            >
              <div style={{ fontSize:12, fontWeight:700, color:t.color }}>{normalizeEodDate(entry.date || entry.createdAt)}</div>
              <div style={{ fontSize:11, color: isDark ? "#C8B89A" : "#6D6256" }}>{entry.specialistName || "—"}</div>
              <div style={{ fontSize:11, color:t.mutedColor }}>{entry.totalDials || 0}</div>
              <div style={{ fontSize:11, color:t.mutedColor }}>{entry.totalTalkTime || 0}</div>
              <div style={{ fontSize:11, color:t.mutedColor }}>{entry.clientsReached || 0}</div>
              <div style={{ fontSize:11, color: isDark ? "#F0B84A" : "#C07820", fontWeight:600 }}>{cur(entry.apSavedPre)}</div>
              <div style={{ fontSize:11, color: isDark ? "#7DC860" : "#4C6B2F", fontWeight:600 }}>{cur(entry.apSavedConfirmed)}</div>
              <div style={{ fontSize:11, color: entry.escalationsAgentActionNeeded ? (isDark ? "#F08060" : "#9D3F23") : t.dimColor, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }} title={entry.escalationsAgentActionNeeded}>
                {entry.escalationsAgentActionNeeded ? `⚠ ${entry.escalationsAgentActionNeeded}` : "—"}
              </div>
              <button onClick={() => onDeleteEod(entry.id)}
                style={{ width:28, height:28, background:t.toolDelBg, border:`1px solid ${t.toolDelBorder}`, borderRadius:7, cursor:"pointer", color:t.toolDelColor, fontSize:12, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
            </div>
          )) : (
            <div style={{ textAlign:"center", padding:"40px 20px", background:t.emptyBg, borderRadius:10 }}>
              <div style={{ fontSize:24, marginBottom:8, opacity:0.35 }}>◈</div>
              <div style={{ fontSize:13, fontWeight:700, color:t.mutedColor }}>No EOD entries yet</div>
              <div style={{ fontSize:11, marginTop:4, color:t.dimColor }}>Use the form on the left to submit your first EOD</div>
            </div>
          )}
        </div>

        {/* Pagination */}
        {filtered.length > EOD_PER && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", fontSize:11, color:t.mutedColor }}>
            <span>{(safePg - 1) * EOD_PER + 1}–{Math.min(safePg * EOD_PER, filtered.length)} of {filtered.length}</span>
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              <button onClick={() => setEodPage((p) => Math.max(1, p - 1))} disabled={safePg === 1}
                style={{ height:28, padding:"0 12px", background:"transparent", border:`1px solid ${t.cardBorder}`, borderRadius:7, cursor: safePg === 1 ? "not-allowed" : "pointer", color:t.mutedColor, fontSize:11, fontFamily:"inherit", opacity: safePg === 1 ? 0.3 : 1 }}>← Prev</button>
              <span>{safePg} / {totalPg}</span>
              <button onClick={() => setEodPage((p) => Math.min(totalPg, p + 1))} disabled={safePg >= totalPg}
                style={{ height:28, padding:"0 12px", background:"transparent", border:`1px solid ${t.cardBorder}`, borderRadius:7, cursor: safePg >= totalPg ? "not-allowed" : "pointer", color:t.mutedColor, fontSize:11, fontFamily:"inherit", opacity: safePg >= totalPg ? 0.3 : 1 }}>Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// GOOGLE SHEETS API FUNCTIONS
// ─────────────────────────────────────────────
async function sendCaseToSheet(data) {
  try {
    const fd = new URLSearchParams();
    Object.entries({ ...data, recordType:"case" }).forEach(([k, v]) => fd.append(k, v ?? ""));
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
    fd.append("recordType","delete");
    await fetch(GOOGLE_SHEET_WEB_APP_URL, { method:"POST", mode:"no-cors", body:fd });
  } catch (e) { console.error("Sheet delete failed:", e); }
}
async function sendInboundToSheet(data) {
  try {
    const fd = new URLSearchParams();
    fd.append("recordType","inboundCancellation"); fd.append("forceSheet","Inbound Cancellations"); fd.append("inboundOnly","true");
    Object.entries(data).forEach(([k, v]) => fd.append(k, v ?? ""));
    await fetch(GOOGLE_SHEET_WEB_APP_URL, { method:"POST", mode:"no-cors", body:fd });
  } catch (e) { console.error("Inbound sync failed:", e); }
}
async function sendEodToSheet(data) {
  try {
    const fd = new URLSearchParams();
    fd.append("recordType","eodTest"); fd.append("forceSheet","EOD Test");
    Object.entries(data).forEach(([k, v]) => fd.append(k, v ?? ""));
    await fetch(GOOGLE_SHEET_WEB_APP_URL, { method:"POST", mode:"no-cors", body:fd });
  } catch (e) { console.error("EOD sync failed:", e); }
}
async function loadFromSheet() {
  const res = await fetch(GOOGLE_SHEET_WEB_APP_URL);
  return await res.json();
}

// ─────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────
function ChenTrackerApp() {
  const [rows,          setRows]          = useState(() => safeLoad(STORAGE_KEY,         []));
  const [inboundRows,   setInboundRows]   = useState(() => safeLoad(INBOUND_STORAGE_KEY, []));
  const [eodEntries,    setEodEntries]    = useState(() => safeLoad(EOD_STORAGE_KEY,     []));
  const [reminders,     setReminders]     = useState(() => safeLoad(REMINDER_KEY,        []));
  const [isDark,        setIsDark]        = useState(() => safeLoad(DARK_MODE_KEY,       false));
  const [activeTab,     setActiveTab]     = useState("case");
  const [specFilter,    setSpecFilter]    = useState("All");
  const [resultFilter,  setResultFilter]  = useState("All");
  const [query,         setQuery]         = useState("");
  const [filterStart,   setFilterStart]   = useState("");
  const [filterEnd,     setFilterEnd]     = useState("");
  const [form,          setForm]          = useState(BLANK_FORM);
  const [editRow,       setEditRow]       = useState(null);
  const [toast,         setToast]         = useState({ msg:"", color:"" });
  const [page,          setPage]          = useState(1);
  const [rptMode,       setRptMode]       = useState("wtd");
  const [rptStart,      setRptStart]      = useState("");
  const [rptEnd,        setRptEnd]        = useState("");
  const [ibDate,        setIbDate]        = useState(TODAY);
  const [isLoading,     setIsLoading]     = useState(false);
  const [showSheet,     setShowSheet]     = useState(false);
  const [showReminders, setShowReminders] = useState(false);
  const PER = 10;

  const t = useTheme(isDark);

  // ── persist ──
  useEffect(() => { safeSave(STORAGE_KEY,         rows);        }, [rows]);
  useEffect(() => { safeSave(INBOUND_STORAGE_KEY, inboundRows); }, [inboundRows]);
  useEffect(() => { safeSave(EOD_STORAGE_KEY,     eodEntries);  }, [eodEntries]);
  useEffect(() => { safeSave(DARK_MODE_KEY,       isDark);       }, [isDark]);

  // ── reminder alarm: check every 30s ──
  const alertedIds = useRef(new Set());
  const toastTimer = useRef(null);

  function showToast(msg, color) {
    setToast({ msg, color: color || t.toastInfo });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast({ msg:"", color:"" }), 2800);
  }

  useEffect(() => {
    const check = () => {
      const now = Date.now();
      reminders.forEach((r) => {
        if (r.done || alertedIds.current.has(r.id)) return;
        const dt   = new Date(r.datetime).getTime();
        const diff = dt - now;
        if (diff <= 10 * 60 * 1000 && diff > -60 * 1000) {
          alertedIds.current.add(r.id);
          playAlertSound();
          showToast(`🔔 Reminder: ${r.title}`, "#D8913D");
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Eterna Reminder", { body:r.title });
          }
        }
      });
    };
    check();
    const tid = setInterval(check, 30000);
    return () => clearInterval(tid);
  }, [reminders]); // eslint-disable-line

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    refreshData(); // eslint-disable-line
  }, []);

  // ── refresh ──
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await loadFromSheet();
      if (data.success && Array.isArray(data.rows)) {
        const clean = dedupeRows(data.rows.filter(isRealRow));
        setRows(clean); safeSave(STORAGE_KEY, clean);
      }
      if (Array.isArray(data.inboundCancellations)) {
        const ib = data.inboundCancellations.map((item) => ({
          id: item.id || crypto.randomUUID(), createdAt: item.createdAt || "",
          clientName: item.clientName || "", phoneNumber: item.phoneNumber || "",
          agentName: item.agentName || "", specialistName: item.specialistName || "",
          resolved: item.resolved || "No", agentInformed: item.agentInformed || "No",
          notes: item.notes || "",
        }));
        setInboundRows(ib); safeSave(INBOUND_STORAGE_KEY, ib);
      }
      if (Array.isArray(data.eodTestEntries)) {
        const normalized = data.eodTestEntries.map((e) => ({
          ...e,
          date: normalizeEodDate(e.date || e.Date || e.createdAt || e.CreatedAt || ""),
          specialistName: e.specialistName || e.SpecialistName || e.specialist || e.Specialist || "",
        }));
        setEodEntries((cur) => {
          const merged = [...normalized, ...cur].filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i);
          safeSave(EOD_STORAGE_KEY, merged);
          return merged;
        });
      }
      showToast("Data refreshed.", t.toastSuccess);
    } catch (e) {
      console.error("Refresh failed:", e);
      showToast("Refresh failed — check connection.", t.toastError);
    } finally { setIsLoading(false); }
  }, []); // eslint-disable-line

  // ── FIX: date filter — exact match when single date, range when both ──
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const ms = specFilter   === "All" || r.specialistName === specFilter;
      const mr = resultFilter === "All" || r.result         === resultFilter;
      const mq = !q || [r.clientName, r.policyNumber, r.agentName, r.notes, r.action].join(" ").toLowerCase().includes(q);
      const rowDate = r.updatedAt || r.createdAt || "";
      let md = true;
      if (filterStart && filterEnd)   md = rowDate >= filterStart && rowDate <= filterEnd;
      else if (filterStart)           md = rowDate === filterStart;
      else if (filterEnd)             md = rowDate === filterEnd;
      return ms && mr && mq && md;
    }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [rows, specFilter, resultFilter, query, filterStart, filterEnd]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER));
  const safePage   = Math.min(page, totalPages);
  const paged      = filtered.slice((safePage - 1) * PER, safePage * PER);

  const kpi = useMemo(() => {
    // Always use the fully-filtered set (spec + date + status + search)
    // so every KPI card reflects whatever the user has filtered to.
    // When no date filter is active, filtered = all rows for that specialist.
    const base = filtered;
    const ps   = base.filter((r) => (r.action || "").toLowerCase() === "pending save");
    const sv   = base.filter((r) => (r.action || "").toLowerCase() === "save");
    const uwr  = base.filter((r) => (r.action || "").toLowerCase() === "uw action resolved");
    const dateActive = filterStart || filterEnd;
    return {
      total:    base.length,
      resolved: base.filter((r) => r.result === "RESOLVED").length,
      pending:  base.filter((r) => r.result === "PENDING").length,
      lost:     base.filter((r) => r.result === "LOST").length,
      psCount:  ps.length,  psAp:  ps.reduce((s, r) => s + Number(r.ap || 0), 0),
      svCount:  sv.length,  svAp:  sv.reduce((s, r) => s + Number(r.ap || 0), 0),
      uwrCount: uwr.length,
      dateLabel: dateActive
        ? (filterStart && filterEnd ? `${filterStart} → ${filterEnd}` : filterStart || filterEnd)
        : TODAY,
    };
  }, [filtered, filterStart, filterEnd]);

  const rpt = useMemo(() => {
    const src   = specFilter === "All" ? rows : rows.filter((r) => r.specialistName === specFilter);
    const start = rptStart || (rptMode === "mtd" ? getMTD() : getWTD());
    const end   = rptEnd   || TODAY;
    const rr    = src.filter((r) => r.updatedAt >= start && r.updatedAt <= end);
    const ps    = rr.filter((r) => (r.action || "").toLowerCase() === "pending save");
    const sv    = rr.filter((r) => (r.action || "").toLowerCase() === "save");
    return {
      total: rr.length, resolved: rr.filter((r) => r.result === "RESOLVED").length,
      pending: rr.filter((r) => r.result === "PENDING").length, lost: rr.filter((r) => r.result === "LOST").length,
      psCount: ps.length, psAp: ps.reduce((s, r) => s + Number(r.ap || 0), 0),
      svCount: sv.length, svAp: sv.reduce((s, r) => s + Number(r.ap || 0), 0),
      start, end,
    };
  }, [rows, specFilter, rptMode, rptStart, rptEnd]);

  const agentMap = useMemo(() => {
    const m = {};
    rows.forEach((r) => { const k = r.agentName || "Unassigned"; m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const dueCount = useMemo(() =>
    reminders.filter((r) => !r.done && new Date(r.datetime).getTime() <= Date.now()).length,
    [reminders]
  );

  function addCase() {
    if (!form.clientName.trim()) { showToast("Enter a client name first.", t.toastError); return; }
    const dup = form.policyNumber.trim() && rows.some((r) => String(r.policyNumber || "").trim().toLowerCase() === form.policyNumber.trim().toLowerCase());
    if (dup && !window.confirm("This policy number already exists. Continue anyway?")) return;
    const newCase = { ...form, id:crypto.randomUUID(), ap:Number(form.ap||0), createdAt:TODAY };
    setRows((r) => [newCase, ...r]);
    setForm(BLANK_FORM); setPage(1);
    showToast("Case added. Syncing…", t.toastSuccess);
    sendCaseToSheet(newCase).then(() => setTimeout(refreshData, 1500));
  }
  function quickResolve(id) {
    const updated = rows.map((r) => r.id === id ? { ...r, result:"RESOLVED", updatedAt:TODAY } : r);
    setRows(updated); showToast("Marked as resolved.", t.toastSuccess);
    const row = updated.find((r) => r.id === id);
    if (row) updateCaseOnSheet(row);
  }
  function deleteRow(id) {
    const row = rows.find((r) => r.id === id);
    setRows((r) => r.filter((x) => x.id !== id));
    showToast("Case deleted.", t.toastError);
    if (row) deleteCaseOnSheet(row).then(() => setTimeout(refreshData, 1500));
  }
  function saveEdit(updated) {
    setRows((r) => r.map((x) => x.id === updated.id ? updated : x));
    setEditRow(null); showToast("Case updated.", t.toastSuccess);
    updateCaseOnSheet(updated);
  }
  function saveInbound(f) {
    if (!f.clientName.trim()) { showToast("Enter a client name.", t.toastError); return; }
    const entry = { ...f, id:crypto.randomUUID(), createdAt:new Date().toISOString() };
    setInboundRows((r) => [entry, ...r]);
    showToast("Inbound saved. Syncing…", t.toastSuccess);
    sendInboundToSheet(entry).then(() => setTimeout(refreshData, 1500));
  }
  function saveEod(f) {
    if (!f.specialistName) { showToast("Please select a specialist.", t.toastError); return; }
    if (!f.date)           { showToast("Please select a date.",        t.toastError); return; }
    const entry = { ...f, id:crypto.randomUUID(), date: normalizeEodDate(f.date), createdAt:new Date().toISOString() };
    setEodEntries((e) => [entry, ...e]);
    showToast("EOD saved. Syncing…", t.toastSuccess);
    sendEodToSheet(entry).then(() => setTimeout(refreshData, 2500));
  }

  const toolInp = { height:33, background:t.inputBg, border:`1px solid ${t.inputBorder}`, borderRadius:9, padding:"0 8px", fontSize:12, color:t.inputColor, outline:"none", fontFamily:"inherit" };
  const rptInp  = { height:26, background:t.inputBg, border:`1px solid ${t.inputBorder}`, borderRadius:6, padding:"0 6px", fontSize:11, color:t.inputColor, outline:"none", fontFamily:"inherit", flex:1, minWidth:88 };

  function RptModeBtn({ mode, label }) {
    const on = rptMode === mode;
    return (
      <button onClick={() => { setRptMode(mode); setRptStart(""); setRptEnd(""); }}
        style={{ flex:1, height:26, background: on ? t.pillOnBg : "transparent", color: on ? t.pillOnColor : t.mutedColor, border:`1px solid ${on ? t.pillOnBorder : t.cardBorder}`, borderRadius:6, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
        {label}
      </button>
    );
  }

  return (
    <div style={{ minHeight:"100vh", background:t.pageBg, color:t.color, fontFamily:"system-ui,-apple-system,sans-serif", padding:20, display:"flex", flexDirection:"column", gap:14 }}>
      <Toast message={toast.msg} color={toast.color} />
      {showSheet     && <SheetModal onClose={() => setShowSheet(false)} t={t} />}
      {showReminders && <RemindersModal reminders={reminders} setReminders={setReminders} onClose={() => setShowReminders(false)} t={t} isDark={isDark} />}
      {editRow       && <EditModal row={editRow} onClose={() => setEditRow(null)} onSave={saveEdit} t={t} />}

      {/* TOPBAR */}
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
            {["Nisha","Rick","Chen","Fernando","Claire"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <button onClick={() => setShowReminders(true)} style={{ position:"relative", height:31, background:"transparent", border:`1px solid ${isDark ? "#2D4035" : "#CDBAA3"}`, borderRadius:8, padding:"0 13px", fontSize:12, fontWeight:600, cursor:"pointer", color: isDark ? "#C8B89A" : "#6D6256", display:"inline-flex", alignItems:"center", gap:5, fontFamily:"inherit" }}>
            🔔 Reminders
            {dueCount > 0 && <span style={{ position:"absolute", top:-7, right:-7, background:"#F07850", color:"#fff", borderRadius:"50%", width:18, height:18, fontSize:10, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>{dueCount}</span>}
          </button>
          <GhostBtn onClick={() => setShowSheet(true)} isDark={isDark}>⊞ View sheet</GhostBtn>
          <button onClick={() => setIsDark((d) => !d)} style={{ background: isDark ? "#D4C8B4" : "#03071A", color: isDark ? "#1A1008" : "#fff", border:"none", borderRadius:8, padding:"0 13px", height:31, fontSize:12, fontWeight:600, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:5, fontFamily:"inherit" }}>
            {isDark ? "☀️ Light mode" : "🌙 Dark mode"}
          </button>
          <button onClick={refreshData} disabled={isLoading} style={{ background: isDark ? "#3A6E50" : "#5C7768", color:"#fff", border:"none", borderRadius:8, padding:"0 13px", height:31, fontSize:12, fontWeight:600, cursor: isLoading ? "not-allowed" : "pointer", display:"inline-flex", alignItems:"center", gap:5, fontFamily:"inherit", opacity: isLoading ? 0.7 : 1 }}>
            {isLoading ? "⟳ Refreshing…" : "↻ Refresh"}
          </button>
        </div>
      </div>

      {/* 7 KPI CARDS */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:8 }}>
        <KpiCard label="Total cases"        value={kpi.total}     sub={`${kpi.resolved} resolved · ${kpi.pending} pending · ${kpi.dateLabel}`} colorKey="total" isDark={isDark} t={t} />
        <KpiCard label="Pending save"       value={kpi.psCount}   sub={`${cur(kpi.psAp)} at stake`}                                             colorKey="ps"   isDark={isDark} t={t} />
        <KpiCard label="Saved"              value={kpi.svCount}   sub={`${cur(kpi.svAp)} locked in`}                                            colorKey="sv"   isDark={isDark} t={t} />
        <KpiCard label="UW Action Resolved" value={kpi.uwrCount}  sub={kpi.dateLabel}                                                           colorKey="uwr"  isDark={isDark} t={t} />
        <KpiCard label="Lost cases"         value={kpi.lost}      sub={kpi.dateLabel}                                                           colorKey="lost" isDark={isDark} t={t} />
        <KpiCard label="Pending Save AP"    value={cur(kpi.psAp)} sub="Action: Pending Save"                                                    colorKey="psAp" isDark={isDark} t={t} />
        <KpiCard label="Save AP"            value={cur(kpi.svAp)} sub="Action: Save"                                                            colorKey="svAp" isDark={isDark} t={t} />
      </div>

      {/* ── TAB SWITCHER — sits above everything, controls the entire left panel ── */}
      <div style={{ display:"flex", alignItems:"center", gap:4 }}>
        {[["case","📋 Cases"],["inbound","📞 Inbound"],["eod","📝 EOD"]].map(([id, lbl]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{
            height:34, padding:"0 18px", borderRadius:9, fontFamily:"inherit",
            fontSize:12, fontWeight:700, cursor:"pointer", border:"none",
            background: activeTab === id ? t.pillOnBg : t.cardBg,
            color:      activeTab === id ? t.pillOnColor : t.mutedColor,
            boxShadow:  activeTab === id ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
          }}>{lbl}</button>
        ))}
        {activeTab !== "case" && (
          <span style={{ fontSize:11, color:t.dimColor, marginLeft:6 }}>
            {activeTab === "inbound" ? `${inboundRows.length} inbound entries` : `${eodEntries.length} EOD entries`}
          </span>
        )}
      </div>

      {/* MAIN LAYOUT */}
      <div style={{ display:"grid", gridTemplateColumns: activeTab === "case" ? "1fr 300px" : "1fr 300px", gap:14, alignItems:"start" }}>

        {/* ── LEFT PANEL — switches entirely based on activeTab ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:9 }}>

          {/* ════════════════════════════════
              CASES TAB — form on left, list on right
          ════════════════════════════════ */}
          {activeTab === "case" && (
            <div style={{ display:"grid", gridTemplateColumns:"280px 1fr", gap:14, alignItems:"start" }}>

              {/* LEFT: Add new case form */}
              <SideSection title="Add new case" t={t}>
                <CaseForm form={form} setForm={setForm} onAdd={addCase} onClear={() => setForm(BLANK_FORM)} t={t} />
              </SideSection>

              {/* RIGHT: Case list */}
              <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
                {/* Search + date + status filters */}
                <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
                  <div style={{ position:"relative", flex:1, minWidth:160 }}>
                    <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", fontSize:15, color:t.mutedColor, pointerEvents:"none" }}>⌕</span>
                    <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search client, policy, agent, notes…"
                      style={{ ...toolInp, width:"100%", paddingLeft:29 }} />
                  </div>

                  {/* Single compact date range picker */}
                  <DateRangePicker
                    filterStart={filterStart} filterEnd={filterEnd}
                    setFilterStart={(v) => { setFilterStart(v); setPage(1); }}
                    setFilterEnd={(v)   => { setFilterEnd(v);   setPage(1); }}
                    t={t} isDark={isDark}
                  />

                  {["All","PENDING","RESOLVED","LOST"].map((v) => {
                    const m = STATUS_META[v];
                    return (
                      <GhostBtn key={v} active={resultFilter === v} onClick={() => { setResultFilter(v); setPage(1); }} isDark={isDark} style={{ fontSize:11 }}>
                        {v === "All" ? "All" : <><span style={{ width:6, height:6, borderRadius:"50%", background:m?.dot, display:"inline-block", marginRight:3 }} />{m?.label}</>}
                      </GhostBtn>
                    );
                  })}
                  {(filterStart || filterEnd) && (
                    <GhostBtn onClick={() => { setFilterStart(""); setFilterEnd(""); }} isDark={isDark} style={{ fontSize:11 }}>✕ Clear</GhostBtn>
                  )}
                  <span style={{ fontSize:11, color:t.mutedColor, marginLeft:"auto" }}>{filtered.length} case{filtered.length !== 1 ? "s" : ""}</span>
                </div>

                {/* Column headers */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:10, padding:"0 14px" }}>
                  <div style={{ display:"grid", gridTemplateColumns:"160px 95px 72px 84px 1fr 28px", gap:10 }}>
                    {["Client","AP","Stage","Status","Action","Notes"].map((h) => (
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
                      <div style={{ display:"grid", gridTemplateColumns:"160px 95px 72px 84px 1fr 28px", gap:10, alignItems:"center", minWidth:0 }}>
                        <div>
                          <div style={{ fontWeight:700, fontSize:13, color:t.color, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{row.clientName}</div>
                          <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:3 }}>
                            <span style={{ fontSize:10, color:t.mutedColor, fontFamily:"monospace" }}>{row.policyNumber || "—"}</span>
                            <PriorityChip priority={row.priority} />
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize:14, fontWeight:800, color: isDark ? "#E8B87A" : "#5B3320", letterSpacing:"-0.02em" }}>{cur(row.ap)}</div>
                          <div style={{ fontSize:10, color:t.mutedColor, marginTop:1 }}>premium</div>
                        </div>
                        <div><StageTag s={row.leadStatus} t={t} /></div>
                        <div><StatusChip status={row.result} /></div>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:600, color: isDark ? "#C8B89A" : "#6D6256", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{row.action || "—"}</div>
                        </div>
                        {/* Notes icon — hover to read, click to copy */}
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"center" }}>
                          <NotesBubble notes={row.notes} isDark={isDark} />
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
            </div>
          )}

          {/* ════════════════════════════════
              INBOUND TAB — full left panel, inbound data only
          ════════════════════════════════ */}
          {activeTab === "inbound" && (
            <InboundMainPanel
              ibDate={ibDate} setIbDate={setIbDate}
              inboundRows={inboundRows}
              onSave={saveInbound}
              onDelete={(id) => setInboundRows((r) => r.filter((x) => x.id !== id))}
              onEdit={(updated) => {
                setInboundRows((r) => r.map((x) => x.id === updated.id ? updated : x));
                showToast("Inbound entry updated.", t.toastSuccess);
              }}
              t={t} isDark={isDark}
            />
          )}

          {/* ════════════════════════════════
              EOD TAB — full left panel, EOD data only
          ════════════════════════════════ */}
          {activeTab === "eod" && (
            <EodMainPanel
              onSave={saveEod}
              eodEntries={eodEntries}
              onDeleteEod={(id) => setEodEntries((e) => e.filter((x) => x.id !== id))}
              t={t} isDark={isDark}
            />
          )}
        </div>

        {/* RIGHT SIDEBAR — report + agent load, always visible */}
        <div style={{ display:"flex", flexDirection:"column", gap:11 }}>

          {/* Report panel — always visible */}
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

          {/* Agent load — always visible */}
          <SideSection title="Agent load" t={t}>
            <AgentLoad agentMap={agentMap} isDark={isDark} t={t} />
          </SideSection>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ROOT APP — / and /admin routing
// ─────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"      element={<ChenTrackerApp />} />
        <Route path="/admin" element={<AdminEodRecap />} />
      </Routes>
    </BrowserRouter>
  );
}
