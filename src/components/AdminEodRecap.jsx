import React, { useState, useMemo, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
const TRACKER_SHEET_URL =
  "https://script.google.com/macros/s/AKfycbxbNbAYvCGjA2oNLjEa_qVi_p4RWxMo9vHm9hXicdHcuIzZIYb_nGzXo9xzVHE_Bfc9/exec";

// Admin recap sheet — paste your deployed Apps Script URL here after setup
const ADMIN_SHEET_URL =
  "https://script.google.com/macros/s/AKfycbwtI6vlSXtGOJz7GhrT9-UqJ7hJqPSKewiP9Of6cgE0BtXyDYYFsnTgvS4VzOsD4-3W/exec";

const SPECIALISTS = ["Nisha", "Rick", "Chen", "Fernando", "Angie", "Claire"];

const TODAY = new Date().toISOString().slice(0, 10);

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

const cur = (v) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(v || 0));

const num = (v) => Number(v || 0);

// Normalize any date format to YYYY-MM-DD
function normalizeDate(val) {
  if (!val) return "";
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) {
    const [mo, dy, yr] = s.split("/");
    return `${yr}-${mo.padStart(2,"0")}-${dy.padStart(2,"0")}`;
  }
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0,10);
  } catch {}
  return s;
}

// ─────────────────────────────────────────────
// SMALL UI
// ─────────────────────────────────────────────
function FL({ children }) {
  return (
    <span style={{ display:"block", fontSize:10, fontWeight:700, color:"#7A9E8A", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:4 }}>
      {children}
    </span>
  );
}

function FieldInp({ value, onChange, type = "text", placeholder = "" }) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      style={{ width:"100%", height:34, background:"#0E1A15", border:"1px solid #2D4035", borderRadius:8, padding:"0 10px", fontSize:13, color:"#EAE0D0", outline:"none", fontFamily:"inherit", boxSizing:"border-box" }}
      onFocus={(e) => (e.target.style.borderColor = "#4A8A65")}
      onBlur={(e)  => (e.target.style.borderColor = "#2D4035")} />
  );
}

function FieldTa({ value, onChange, placeholder = "", rows = 3 }) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      style={{ width:"100%", background:"#0E1A15", border:"1px solid #2D4035", borderRadius:8, padding:"9px 10px", fontSize:13, color:"#EAE0D0", outline:"none", fontFamily:"inherit", boxSizing:"border-box", resize:"vertical", lineHeight:1.5 }}
      onFocus={(e) => (e.target.style.borderColor = "#4A8A65")}
      onBlur={(e)  => (e.target.style.borderColor = "#2D4035")} />
  );
}

function Card({ title, children, accent }) {
  return (
    <div style={{ background:"#162219", border:`1px solid #2D4035`, borderRadius:14, overflow:"hidden", borderLeft: accent ? `3px solid ${accent}` : undefined }}>
      {title && (
        <div style={{ padding:"12px 18px", borderBottom:"1px solid #2D4035", background:"#1A2E22" }}>
          <span style={{ fontSize:12, fontWeight:700, color:"#E8B87A", textTransform:"uppercase", letterSpacing:"0.09em" }}>{title}</span>
        </div>
      )}
      <div style={{ padding:18 }}>{children}</div>
    </div>
  );
}

function StatTile({ label, value, sub, accent = "#7DC860" }) {
  return (
    <div style={{ background:"#0E1A15", border:"1px solid #2D4035", borderRadius:10, padding:"14px 16px", borderLeft:`3px solid ${accent}` }}>
      <div style={{ fontSize:10, fontWeight:600, color:"#7A9E8A", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:800, color:accent, lineHeight:1, letterSpacing:"-0.02em" }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:"#5A7A68", marginTop:5 }}>{sub}</div>}
    </div>
  );
}

function SpecialistRow({ name, data }) {
  const hasData = data && (num(data.totalDials) + num(data.clientsReached) + num(data.welcomeCallsCompleted)) > 0;
  return (
    <div style={{ display:"grid", gridTemplateColumns:"120px repeat(6, 1fr)", gap:8, alignItems:"center", padding:"10px 14px", background: hasData ? "#162219" : "#0E1A15", border:"1px solid #2D4035", borderRadius:9, opacity: hasData ? 1 : 0.45 }}>
      <div>
        <div style={{ fontWeight:700, fontSize:13, color: hasData ? "#EAE0D0" : "#5A7A68" }}>{name}</div>
        <div style={{ fontSize:10, color:"#5A7A68", marginTop:1 }}>{hasData ? "✓ submitted" : "no data"}</div>
      </div>
      {[
        ["Dials",     data?.totalDials            || 0, "#60C0E0"],
        ["Reached",   data?.clientsReached        || 0, "#7DC860"],
        ["Talk(min)", data?.totalTalkTime         || 0, "#C8B89A"],
        ["AP Saved",  cur(data?.apSavedConfirmed) || "$0", "#F0B84A"],
        ["UW Res.",   data?.uwPoliciesResolved    || 0, "#B0A0E0"],
        ["Wel. Calls",data?.welcomeCallsCompleted || 0, "#E8B87A"],
      ].map(([lbl, val, col]) => (
        <div key={lbl} style={{ textAlign:"center" }}>
          <div style={{ fontSize:16, fontWeight:800, color: hasData ? col : "#334155", lineHeight:1 }}>{val}</div>
          <div style={{ fontSize:9, color:"#5A7A68", marginTop:2, textTransform:"uppercase", letterSpacing:"0.05em" }}>{lbl}</div>
        </div>
      ))}
    </div>
  );
}

function Toast({ msg, color }) {
  if (!msg) return null;
  return (
    <div style={{ position:"fixed", bottom:22, left:"50%", transform:"translateX(-50%)", background:color||"#3A6E50", color:"#fff", borderRadius:10, padding:"10px 22px", fontSize:13, fontWeight:700, zIndex:9999, pointerEvents:"none", boxShadow:"0 4px 20px rgba(0,0,0,0.4)" }}>
      {msg}
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN ADMIN PAGE
// ─────────────────────────────────────────────
export default function AdminEodRecap() {
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [eodEntries,   setEodEntries]   = useState([]);
  const [allRows,      setAllRows]      = useState([]);
  const [isLoading,    setIsLoading]    = useState(false);
  const [isSending,    setIsSending]    = useState(false);
  const [toast,        setToast]        = useState({ msg:"", color:"" });

  // Manual inputs
  const [cancellationsResolved, setCancellationsResolved] = useState("");
  const [rewritesResolved,      setRewritesResolved]      = useState("");
  const [agentOpNotes,          setAgentOpNotes]          = useState("");
  const [generalNotes,          setGeneralNotes]          = useState("");
  const [recipientEmail,        setRecipientEmail]        = useState("powerhouseteam.juchen@gmail.com, ejay@powerhouseadmins.com");

  const toastTimer = React.useRef(null);
  function showToast(msg, color = "#3A6E50") {
    setToast({ msg, color });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast({ msg:"", color:"" }), 3000);
  }

  // Load data from tracker Google Sheet + localStorage fallback
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Always load from localStorage first so locally submitted EODs show instantly
      const localEod = safeLoad("eterna-eod-v1", []);
      const localRows = safeLoad("eterna-tracker-rows-v1", []);

      const res  = await fetch(TRACKER_SHEET_URL);
      const data = await res.json();

      // Merge sheet EODs with local EODs — deduplicate by id
      const sheetEod = Array.isArray(data.eodTestEntries) ? data.eodTestEntries : [];
      const merged = [...sheetEod, ...localEod].filter((e, i, arr) =>
        arr.findIndex((x) => x.id === e.id) === i
      );
      setEodEntries(merged);

      // Merge sheet rows with local rows — normalize fields
      const sheetRows = Array.isArray(data.rows) ? data.rows.map((r) => ({
        ...r,
        action:    r.action    || r.Action    || r.action    || "",
        ap:        Number(r.ap || r.AP || r.annualPremium || 0),
        updatedAt: normalizeDate(r.updatedAt  || r.UpdatedAt || r.createdAt || r.CreatedAt || ""),
        createdAt: normalizeDate(r.createdAt  || r.CreatedAt || ""),
      })) : [];
      const mergedRows = [...sheetRows, ...localRows].filter((r, i, arr) =>
        arr.findIndex((x) => x.id === r.id) === i
      );
      setAllRows(mergedRows.length ? mergedRows : localRows);

      showToast("Data loaded.", "#3A6E50");
    } catch (e) {
      console.error(e);
      // On network failure, fall back entirely to localStorage
      const localEod  = safeLoad("eterna-eod-v1", []);
      const localRows = safeLoad("eterna-tracker-rows-v1", []);
      setEodEntries(localEod);
      setAllRows(localRows);
      showToast("Loaded from local data (sheet unavailable).", "#C07820");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Filter EOD for selected date — handles any date format from the sheet
  const dayEntries = useMemo(() =>
    eodEntries.filter((e) => {
      // Check all possible date fields
      const d = e.date || e.Date || e.createdAt || e.submittedAt || "";
      return normalizeDate(d) === selectedDate;
    }),
    [eodEntries, selectedDate]
  );

  // Map by specialist — handle field name variations from the sheet
  const bySpec = useMemo(() => {
    const m = {};
    dayEntries.forEach((e) => {
      const name = e.specialistName || e.SpecialistName || e.specialist || "";
      if (name) m[name] = e;
    });
    return m;
  }, [dayEntries]);

  // Totals for the day — handle both camelCase and raw sheet column names
  const totals = useMemo(() => {
    const g = (e, ...keys) => {
      for (const k of keys) { if (e[k] !== undefined && e[k] !== "") return num(e[k]); }
      return 0;
    };
    return {
      totalDials:             dayEntries.reduce((s, e) => s + g(e, "totalDials",            "Total Dials",             "totaldials"),            0),
      clientsReached:         dayEntries.reduce((s, e) => s + g(e, "clientsReached",         "Clients Reached",         "clientsreached"),         0),
      totalTalkTime:          dayEntries.reduce((s, e) => s + g(e, "totalTalkTime",          "Total Talk Time",         "totaltalktime"),          0),
      apSavedPre:             dayEntries.reduce((s, e) => s + g(e, "apSavedPre",             "AP Saved Pre",            "apsavedpre"),             0),
      apSavedConfirmed:       dayEntries.reduce((s, e) => s + g(e, "apSavedConfirmed",       "AP Saved Confirmed",      "apsavedconfirmed"),       0),
      uwPoliciesResolved:     dayEntries.reduce((s, e) => s + g(e, "uwPoliciesResolved",     "UW Policies Resolved",    "uwpoliciesresolved"),     0),
      welcomeCallsCompleted:  dayEntries.reduce((s, e) => s + g(e, "welcomeCallsCompleted",  "Welcome Calls Completed", "welcomecallscompleted"),  0),
      atRiskResolvedPre:      dayEntries.reduce((s, e) => s + g(e, "atRiskResolvedPre",      "At Risk Resolved Pre",    "atriskresolvedpre"),      0),
      atRiskResolvedConfirmed:dayEntries.reduce((s, e) => s + g(e, "atRiskResolvedConfirmed","At Risk Resolved Conf",   "atriskresolvedconfirmed"),0),
      pendingResolution:      dayEntries.reduce((s, e) => s + g(e, "pendingResolution",      "Pending Resolution",      "pendingresolution"),      0),
    };
  }, [dayEntries]);

  // AP Saved WTD and MTD — matches exactly how the tracker calculates it
  // Uses case rows where action = "Save" (same logic as tracker KPI cards)
  const apSummary = useMemo(() => {
    const wtdStart = getWTD();
    const mtdStart = getMTD();

    // Normalize action field — match any casing
    const isSave = (r) => String(r.action || r.Action || "").trim().toLowerCase() === "save";

    // Normalize date field
    const getDate = (r) => normalizeDate(r.updatedAt || r.UpdatedAt || r.createdAt || r.CreatedAt || "");

    // Normalize AP value
    const getAp = (r) => num(r.ap || r.AP || r.annualPremium || 0);

    const saves  = allRows.filter(isSave);
    const wtd    = saves.filter((r) => getDate(r) >= wtdStart);
    const mtd    = saves.filter((r) => getDate(r) >= mtdStart);

    return {
      wtdAp:    wtd.reduce((s, r) => s + getAp(r), 0),
      mtdAp:    mtd.reduce((s, r) => s + getAp(r), 0),
      wtdCount: wtd.length,
      mtdCount: mtd.length,
    };
  }, [allRows]);

  // Collect all escalations from the day
  const escalations = useMemo(() =>
    dayEntries
      .filter((e) => e.escalationsAgentActionNeeded?.trim())
      .map((e) => `[${e.specialistName}] ${e.escalationsAgentActionNeeded.trim()}`),
    [dayEntries]
  );

  // Collect all saved details
  const savedDetails = useMemo(() =>
    dayEntries
      .filter((e) => e.savedConfirmed?.trim() || e.savedPendingConfirmation?.trim())
      .map((e) => {
        const parts = [];
        if (e.savedConfirmed?.trim())            parts.push(`Confirmed: ${e.savedConfirmed.trim()}`);
        if (e.savedPendingConfirmation?.trim())   parts.push(`Pending: ${e.savedPendingConfirmation.trim()}`);
        return `[${e.specialistName}] ${parts.join(" | ")}`;
      }),
    [dayEntries]
  );

  // Collect UW details
  const uwDetails = useMemo(() =>
    dayEntries
      .filter((e) => e.uwConfirmedResolvedDetails?.trim() || e.uwResolvedNotConfirmedDetails?.trim())
      .map((e) => {
        const parts = [];
        if (e.uwConfirmedResolvedDetails?.trim())     parts.push(`Confirmed: ${e.uwConfirmedResolvedDetails.trim()}`);
        if (e.uwResolvedNotConfirmedDetails?.trim())  parts.push(`Not confirmed: ${e.uwResolvedNotConfirmedDetails.trim()}`);
        return `[${e.specialistName}] ${parts.join(" | ")}`;
      }),
    [dayEntries]
  );

  // ── Send recap ──
  async function sendRecap() {
    if (!recipientEmail.trim()) { showToast("Please enter a recipient email.", "#9D3F23"); return; }
    setIsSending(true);
    try {
      const payload = {
        action: "sendEodRecap",
        date: selectedDate,
        recipient: recipientEmail.trim(),
        totals,
        apSummary,
        cancellationsResolved: num(cancellationsResolved),
        rewritesResolved:      num(rewritesResolved),
        agentOpNotes:    agentOpNotes.trim(),
        generalNotes:    generalNotes.trim(),
        escalations:     escalations.join("\n"),
        savedDetails:    savedDetails.join("\n"),
        uwDetails:       uwDetails.join("\n"),
        specialistData:  JSON.stringify(bySpec),
        submittedCount:  dayEntries.length,
      };

      const fd = new URLSearchParams();
      Object.entries(payload).forEach(([k, v]) => fd.append(k, typeof v === "object" ? JSON.stringify(v) : String(v)));

      await fetch(ADMIN_SHEET_URL, { method:"POST", mode:"no-cors", body:fd });
      showToast(`EOD recap sent to ${recipientEmail}!`, "#3A6E50");
    } catch (e) {
      console.error(e);
      showToast("Send failed — check Admin Script URL.", "#9D3F23");
    } finally {
      setIsSending(false);
    }
  }

  const G2 = ({ children }) => <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>{children}</div>;
  const G3 = ({ children }) => <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>{children}</div>;
  const G4 = ({ children }) => <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>{children}</div>;

  return (
    <div style={{ minHeight:"100vh", background:"#0A1410", color:"#EAE0D0", fontFamily:"system-ui,-apple-system,sans-serif", padding:24 }}>
      <Toast msg={toast.msg} color={toast.color} />

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24, flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ fontSize:24, fontWeight:800, color:"#E8B87A", letterSpacing:"-0.02em" }}>🔐 Admin — EOD Recap</div>
          <div style={{ fontSize:12, color:"#5A7A68", marginTop:3 }}>
            <a href="/" style={{ color:"#7A9E8A", textDecoration:"none" }}>← Back to Tracker</a>
            &nbsp;·&nbsp; Eterna Retention Tracker
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div>
            <FL>Report date</FL>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
              style={{ height:36, background:"#162219", border:"1px solid #2D4035", borderRadius:9, padding:"0 12px", fontSize:13, color:"#EAE0D0", outline:"none", fontFamily:"inherit" }} />
          </div>
          <button onClick={loadData} disabled={isLoading}
            style={{ height:36, padding:"0 18px", background:"#3A6E50", color:"#fff", border:"none", borderRadius:9, fontSize:13, fontWeight:700, cursor: isLoading ? "not-allowed" : "pointer", fontFamily:"inherit", marginTop:16, opacity: isLoading ? 0.7 : 1 }}>
            {isLoading ? "⟳ Loading…" : "↻ Refresh data"}
          </button>
        </div>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:18 }}>

        {/* ── DAY TOTALS ── */}
        <Card title={`📊 Daily totals — ${selectedDate} (${dayEntries.length} / ${SPECIALISTS.length} specialists submitted)`} accent="#60C0E0">
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:10, marginBottom:16 }}>
            <StatTile label="Total dials"      value={totals.totalDials}            accent="#60C0E0" />
            <StatTile label="Clients reached"  value={totals.clientsReached}        accent="#7DC860" />
            <StatTile label="Talk time (min)"  value={totals.totalTalkTime}         accent="#C8B89A" />
            <StatTile label="AP Saved (pre)"   value={cur(totals.apSavedPre)}       accent="#F0B84A" />
            <StatTile label="AP Saved (conf)"  value={cur(totals.apSavedConfirmed)} accent="#F0B84A" />
            <StatTile label="UW Resolved"      value={totals.uwPoliciesResolved}    accent="#B0A0E0" />
            <StatTile label="Welcome calls"    value={totals.welcomeCallsCompleted} accent="#E8B87A" />
          </div>

          {/* Per-specialist breakdown */}
          <div style={{ fontSize:11, fontWeight:700, color:"#7A9E8A", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>Breakdown by specialist</div>
          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
            {/* Column headers */}
            <div style={{ display:"grid", gridTemplateColumns:"120px repeat(6,1fr)", gap:8, padding:"0 14px" }}>
              {["Specialist","Dials","Reached","Talk (min)","AP Saved","UW Res.","Wel. Calls"].map((h) => (
                <div key={h} style={{ fontSize:9, fontWeight:700, color:"#334155", textTransform:"uppercase", letterSpacing:"0.07em", textAlign: h === "Specialist" ? "left" : "center" }}>{h}</div>
              ))}
            </div>
            {SPECIALISTS.map((s) => <SpecialistRow key={s} name={s} data={bySpec[s]} />)}
          </div>
        </Card>

        {/* ── AP SAVED SUMMARY ── */}
        <Card title="💰 AP Saved summary" accent="#F0B84A">
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
            <StatTile label="Week-to-date AP saved"  value={cur(apSummary.wtdAp)}  sub={`${apSummary.wtdCount} saves this week`}  accent="#F0B84A" />
            <StatTile label="Month-to-date AP saved" value={cur(apSummary.mtdAp)}  sub={`${apSummary.mtdCount} saves this month`} accent="#E8B87A" />
            <StatTile label="Today AP saved (pre)"   value={cur(totals.apSavedPre)}       sub="Pre-confirmation"  accent="#7A9E8A" />
            <StatTile label="Today AP saved (conf)"  value={cur(totals.apSavedConfirmed)} sub="Confirmed"         accent="#7DC860" />
          </div>
        </Card>

        {/* ── MANUAL INPUTS ── */}
        <Card title="✏️ Manual inputs" accent="#C8B89A">
          <G2>
            <div>
              <FL>Cancellations resolved today</FL>
              <FieldInp value={cancellationsResolved} onChange={setCancellationsResolved} type="number" placeholder="0" />
            </div>
            <div>
              <FL>Re-writes resolved today</FL>
              <FieldInp value={rewritesResolved} onChange={setRewritesResolved} type="number" placeholder="0" />
            </div>
          </G2>
        </Card>

        {/* ── SAVED & UW DETAILS (auto-collected) ── */}
        {(savedDetails.length > 0 || uwDetails.length > 0) && (
          <Card title="📋 Saved & UW details (auto-collected from EOD)" accent="#7DC860">
            {savedDetails.length > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#7DC860", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>Saved clients</div>
                {savedDetails.map((d, i) => (
                  <div key={i} style={{ fontSize:12, color:"#C8B89A", lineHeight:1.6, background:"#0E1A15", borderRadius:7, padding:"7px 10px", marginBottom:5, border:"1px solid #1A2E22" }}>{d}</div>
                ))}
              </div>
            )}
            {uwDetails.length > 0 && (
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:"#B0A0E0", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>UW details</div>
                {uwDetails.map((d, i) => (
                  <div key={i} style={{ fontSize:12, color:"#C8B89A", lineHeight:1.6, background:"#0E1A15", borderRadius:7, padding:"7px 10px", marginBottom:5, border:"1px solid #1A2E22" }}>{d}</div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* ── ESCALATIONS (auto-collected) ── */}
        {escalations.length > 0 && (
          <Card title="⚠️ Escalations / agent action needed (auto-collected)" accent="#F08060">
            {escalations.map((e, i) => (
              <div key={i} style={{ fontSize:12, color:"#F08060", lineHeight:1.6, background:"#0E1A15", borderRadius:7, padding:"7px 10px", marginBottom:5, border:"1px solid #2A1A10" }}>{e}</div>
            ))}
          </Card>
        )}

        {/* ── NOTES ── */}
        <Card title="📝 Agent & operational updates" accent="#7A9E8A">
          <FieldTa value={agentOpNotes} onChange={setAgentOpNotes} placeholder="Enter agent and operational updates here…" rows={5} />
        </Card>

        <Card title="📝 General notes" accent="#5A7A68">
          <FieldTa value={generalNotes} onChange={setGeneralNotes} placeholder="Enter general notes here…" rows={4} />
        </Card>

        {/* ── SEND ── */}
        <Card title="📤 Send EOD recap" accent="#3A6E50">
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div>
              <FL>Recipient email</FL>
              <FieldInp value={recipientEmail} onChange={setRecipientEmail} type="email" placeholder="email@example.com" />
            </div>

            {/* Preview summary */}
            <div style={{ background:"#0E1A15", borderRadius:10, padding:"14px 16px", border:"1px solid #1A2E22", fontSize:12, color:"#7A9E8A", lineHeight:1.7 }}>
              <div style={{ fontWeight:700, color:"#E8B87A", marginBottom:8 }}>Recap preview — {selectedDate}</div>
              <div>📞 Total dials: <strong style={{ color:"#EAE0D0" }}>{totals.totalDials}</strong></div>
              <div>👥 Clients reached: <strong style={{ color:"#EAE0D0" }}>{totals.clientsReached}</strong></div>
              <div>⏱ Talk time: <strong style={{ color:"#EAE0D0" }}>{totals.totalTalkTime} min</strong></div>
              <div>💰 AP saved (conf): <strong style={{ color:"#F0B84A" }}>{cur(totals.apSavedConfirmed)}</strong></div>
              <div>🔒 UW resolved: <strong style={{ color:"#EAE0D0" }}>{totals.uwPoliciesResolved}</strong></div>
              <div>👋 Welcome calls: <strong style={{ color:"#EAE0D0" }}>{totals.welcomeCallsCompleted}</strong></div>
              <div>❌ Cancellations resolved: <strong style={{ color:"#EAE0D0" }}>{cancellationsResolved || 0}</strong></div>
              <div>🔄 Re-writes resolved: <strong style={{ color:"#EAE0D0" }}>{rewritesResolved || 0}</strong></div>
              <div>📈 WTD AP saved: <strong style={{ color:"#F0B84A" }}>{cur(apSummary.wtdAp)}</strong></div>
              <div>📈 MTD AP saved: <strong style={{ color:"#F0B84A" }}>{cur(apSummary.mtdAp)}</strong></div>
              {escalations.length > 0 && <div style={{ color:"#F08060" }}>⚠️ {escalations.length} escalation{escalations.length !== 1 ? "s" : ""} included</div>}
            </div>

            <button onClick={sendRecap} disabled={isSending}
              style={{ height:44, background: isSending ? "#2A3A2A" : "#3A6E50", color:"#fff", border:"none", borderRadius:10, fontSize:14, fontWeight:700, cursor: isSending ? "not-allowed" : "pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:8, opacity: isSending ? 0.7 : 1 }}>
              {isSending ? "⟳ Sending…" : "📤 Send EOD recap to Google Sheet & email"}
            </button>
            <div style={{ fontSize:11, color:"#5A7A68", textAlign:"center" }}>
              Data will be logged to the admin Google Sheet and emailed to the recipient above.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
