import React, { useState, useEffect, useMemo, useCallback } from "react";

// ─────────────────────────────────────────────
// Shared constants (kept in sync with App.tsx)
// ─────────────────────────────────────────────
const GOOGLE_SHEET_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbxbNbAYvCGjA2oNLjEa_qVi_p4RWxMo9vHm9hXicdHcuIzZIYb_nGzXo9xzVHE_Bfc9/exec";
const EOD_STORAGE_KEY = "eterna-eod-v1";
const SPECIALISTS = ["Nisha", "Rick", "Chen", "Fernando", "Claire"];
const TODAY = new Date().toISOString().slice(0, 10);

function safeLoad(key, fallback) {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback; }
  catch { return fallback; }
}
function safeSave(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function normalizeEodDate(val) {
  if (!val) return "";
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) {
    const [mo, dy, yr] = s.split("/");
    return `${yr}-${mo.padStart(2, "0")}-${dy.padStart(2, "0")}`;
  }
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch {}
  return s;
}

const cur = (v) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(v || 0));

const num = (v) => Number(v || 0);

async function loadFromSheet() {
  const res = await fetch(GOOGLE_SHEET_WEB_APP_URL);
  return await res.json();
}

// ─────────────────────────────────────────────
// Theme (light, admin-focused)
// ─────────────────────────────────────────────
const theme = {
  pageBg: "linear-gradient(135deg,#F6EFE4 0%,#E7DCCB 45%,#D6C8B5 100%)",
  color: "#2B1A12",
  cardBg: "#FCF8F2",
  cardBorder: "#DDD0BB",
  headBg: "#F6EEE3",
  muted: "#8A6A55",
  dim: "#B28A6B",
  accent: "#5B3320",
};

function Stat({ label, value, color }) {
  return (
    <div style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: 12, padding: "12px 14px", borderLeft: `3px solid ${color || theme.accent}` }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: theme.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || theme.accent, letterSpacing: "-0.03em" }}>{value}</div>
    </div>
  );
}

export default function AdminEodRecap() {
  const [eodEntries, setEodEntries] = useState(() => safeLoad(EOD_STORAGE_KEY, []));
  const [isLoading, setIsLoading] = useState(false);
  const [specFilter, setSpecFilter] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expanded, setExpanded] = useState(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await loadFromSheet();
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
    } catch (e) {
      console.error("Admin refresh failed:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    return eodEntries
      .filter((e) => specFilter === "All" || e.specialistName === specFilter)
      .filter((e) => {
        const d = normalizeEodDate(e.date || e.createdAt || "");
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
        return true;
      })
      .sort((a, b) => normalizeEodDate(b.date || b.createdAt).localeCompare(normalizeEodDate(a.date || a.createdAt)));
  }, [eodEntries, specFilter, startDate, endDate]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, e) => ({
        totalDials: acc.totalDials + num(e.totalDials),
        totalTalkTime: acc.totalTalkTime + num(e.totalTalkTime),
        clientsReached: acc.clientsReached + num(e.clientsReached),
        welcomeCallsCompleted: acc.welcomeCallsCompleted + num(e.welcomeCallsCompleted),
        atRiskResolvedPre: acc.atRiskResolvedPre + num(e.atRiskResolvedPre),
        atRiskResolvedConfirmed: acc.atRiskResolvedConfirmed + num(e.atRiskResolvedConfirmed),
        apSavedPre: acc.apSavedPre + num(e.apSavedPre),
        apSavedConfirmed: acc.apSavedConfirmed + num(e.apSavedConfirmed),
        uwPoliciesResolved: acc.uwPoliciesResolved + num(e.uwPoliciesResolved),
        pendingResolution: acc.pendingResolution + num(e.pendingResolution),
        escalations: acc.escalations + (e.escalationsAgentActionNeeded ? 1 : 0),
      }),
      { totalDials: 0, totalTalkTime: 0, clientsReached: 0, welcomeCallsCompleted: 0, atRiskResolvedPre: 0, atRiskResolvedConfirmed: 0, apSavedPre: 0, apSavedConfirmed: 0, uwPoliciesResolved: 0, pendingResolution: 0, escalations: 0 }
    );
  }, [filtered]);

  const bySpecialist = useMemo(() => {
    const m = {};
    filtered.forEach((e) => {
      const k = e.specialistName || "Unassigned";
      if (!m[k]) m[k] = { count: 0, apSavedConfirmed: 0, apSavedPre: 0, dials: 0 };
      m[k].count += 1;
      m[k].apSavedConfirmed += num(e.apSavedConfirmed);
      m[k].apSavedPre += num(e.apSavedPre);
      m[k].dials += num(e.totalDials);
    });
    return Object.entries(m).sort((a, b) => b[1].apSavedConfirmed - a[1].apSavedConfirmed);
  }, [filtered]);

  const inp = { height: 33, background: "#fff", border: `1px solid ${theme.cardBorder}`, borderRadius: 8, padding: "0 10px", fontSize: 12, color: theme.color, outline: "none", fontFamily: "inherit" };

  return (
    <div style={{ minHeight: "100vh", background: theme.pageBg, color: theme.color, fontFamily: "system-ui,-apple-system,sans-serif", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: theme.headBg, border: `1px solid ${theme.cardBorder}`, borderRadius: 14, padding: "14px 20px", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em", color: theme.accent }}>🛠️ Admin — EOD Recap</div>
          <div style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>Aggregated end-of-day reports across all specialists</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <a href="/" style={{ height: 33, display: "inline-flex", alignItems: "center", padding: "0 14px", borderRadius: 8, border: `1px solid ${theme.cardBorder}`, color: theme.accent, fontSize: 12, fontWeight: 700, textDecoration: "none", background: "#fff" }}>← Back to tracker</a>
          <select value={specFilter} onChange={(e) => setSpecFilter(e.target.value)} style={inp}>
            <option value="All">All specialists</option>
            {SPECIALISTS.map((s) => <option key={s}>{s}</option>)}
          </select>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inp} />
          <span style={{ fontSize: 11, color: theme.dim }}>→</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inp} />
          {(startDate || endDate || specFilter !== "All") && (
            <button onClick={() => { setStartDate(""); setEndDate(""); setSpecFilter("All"); }}
              style={{ height: 33, padding: "0 12px", background: "transparent", border: `1px solid ${theme.cardBorder}`, borderRadius: 8, fontSize: 12, cursor: "pointer", color: theme.muted, fontFamily: "inherit" }}>
              ✕ Clear
            </button>
          )}
          <button onClick={refresh} disabled={isLoading}
            style={{ height: 33, padding: "0 14px", background: "#5C7768", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: isLoading ? "not-allowed" : "pointer", opacity: isLoading ? 0.7 : 1, fontFamily: "inherit" }}>
            {isLoading ? "⟳ Refreshing…" : "↻ Refresh"}
          </button>
        </div>
      </div>

      {/* Totals */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10, marginBottom: 16 }}>
        <Stat label="EOD reports" value={filtered.length} />
        <Stat label="Total dials" value={totals.totalDials} />
        <Stat label="Clients reached" value={totals.clientsReached} />
        <Stat label="AP saved (pending)" value={cur(totals.apSavedPre)} color="#C07820" />
        <Stat label="AP saved (confirmed)" value={cur(totals.apSavedConfirmed)} color="#4C6B2F" />
        <Stat label="Escalations flagged" value={totals.escalations} color="#9D3F23" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, alignItems: "start" }}>
        {/* Leaderboard */}
        <div style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "11px 15px", borderBottom: `1px solid ${theme.cardBorder}`, background: theme.headBg }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: theme.accent, textTransform: "uppercase", letterSpacing: "0.09em" }}>Specialist leaderboard</span>
          </div>
          <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {bySpecialist.length ? bySpecialist.map(([name, s]) => (
              <div key={name} style={{ borderBottom: `1px solid ${theme.cardBorder}`, paddingBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700 }}>
                  <span>{name}</span>
                  <span style={{ color: "#4C6B2F" }}>{cur(s.apSavedConfirmed)}</span>
                </div>
                <div style={{ fontSize: 10, color: theme.muted, marginTop: 2 }}>
                  {s.count} report{s.count !== 1 ? "s" : ""} · {s.dials} dials · {cur(s.apSavedPre)} pending
                </div>
              </div>
            )) : <div style={{ fontSize: 12, color: theme.dim }}>No EOD data yet.</div>}
          </div>
        </div>

        {/* Table */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "100px 110px 70px 90px 90px 90px 1fr 32px", gap: 8, padding: "0 14px" }}>
            {["Date", "Specialist", "Dials", "Reached", "AP Pending", "AP Confirmed", "Escalations", ""].map((h) => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, color: theme.dim, textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {filtered.length ? filtered.map((e) => (
              <div key={e.id}>
                <div
                  onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                  style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: 10, padding: "10px 14px", display: "grid", gridTemplateColumns: "100px 110px 70px 90px 90px 90px 1fr 32px", gap: 8, alignItems: "center", cursor: "pointer" }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{normalizeEodDate(e.date || e.createdAt)}</div>
                  <div style={{ fontSize: 12 }}>{e.specialistName || "—"}</div>
                  <div style={{ fontSize: 12, color: theme.muted }}>{e.totalDials || 0}</div>
                  <div style={{ fontSize: 12, color: theme.muted }}>{e.clientsReached || 0}</div>
                  <div style={{ fontSize: 12, color: "#C07820", fontWeight: 600 }}>{cur(e.apSavedPre)}</div>
                  <div style={{ fontSize: 12, color: "#4C6B2F", fontWeight: 600 }}>{cur(e.apSavedConfirmed)}</div>
                  <div style={{ fontSize: 12, color: e.escalationsAgentActionNeeded ? "#9D3F23" : theme.dim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {e.escalationsAgentActionNeeded ? `⚠ ${e.escalationsAgentActionNeeded}` : "—"}
                  </div>
                  <div style={{ fontSize: 12, textAlign: "center", color: theme.muted }}>{expanded === e.id ? "▲" : "▼"}</div>
                </div>
                {expanded === e.id && (
                  <div style={{ background: theme.headBg, border: `1px solid ${theme.cardBorder}`, borderTop: "none", borderRadius: "0 0 10px 10px", padding: "12px 16px", fontSize: 12, lineHeight: 1.6 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div><b>Talk time:</b> {e.totalTalkTime || 0} min</div>
                      <div><b>Welcome calls completed:</b> {e.welcomeCallsCompleted || 0}</div>
                      <div><b>At-risk resolved (pre):</b> {e.atRiskResolvedPre || 0}</div>
                      <div><b>At-risk resolved (confirmed):</b> {e.atRiskResolvedConfirmed || 0}</div>
                      <div><b>UW policies resolved:</b> {e.uwPoliciesResolved || 0}</div>
                      <div><b>Pending resolution:</b> {e.pendingResolution || 0}</div>
                    </div>
                    {e.savedPendingConfirmation && <div style={{ marginTop: 8 }}><b>Saved — pending confirmation:</b><br />{e.savedPendingConfirmation}</div>}
                    {e.savedConfirmed && <div style={{ marginTop: 8 }}><b>Saved — confirmed:</b><br />{e.savedConfirmed}</div>}
                    {e.uwResolvedNotConfirmedDetails && <div style={{ marginTop: 8 }}><b>UW resolved (not confirmed):</b><br />{e.uwResolvedNotConfirmedDetails}</div>}
                    {e.uwConfirmedResolvedDetails && <div style={{ marginTop: 8 }}><b>UW confirmed resolved:</b><br />{e.uwConfirmedResolvedDetails}</div>}
                    {e.escalationsAgentActionNeeded && <div style={{ marginTop: 8, color: "#9D3F23" }}><b>Escalations / agent action needed:</b><br />{e.escalationsAgentActionNeeded}</div>}
                  </div>
                )}
              </div>
            )) : (
              <div style={{ textAlign: "center", padding: "44px 20px", background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: 10 }}>
                <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.35 }}>◈</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: theme.muted }}>No EOD reports match your filters</div>
                <div style={{ fontSize: 11, marginTop: 4, color: theme.dim }}>Try clearing filters, or wait for specialists to submit reports.</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, fontSize: 10, color: theme.dim, textAlign: "center" }}>
        Data as of {TODAY} · syncs from the shared Google Sheet
      </div>
    </div>
  );
}
