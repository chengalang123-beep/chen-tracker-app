// ═══════════════════════════════════════════════════════════════
// ETERNA RETENTION TRACKER — Admin EOD Recap Script
// Sheet: https://docs.google.com/spreadsheets/d/1O4I5rJSDvxVjDqis-l6McGrfy-WBaLFJk32meUmvvBg
//
// HOW TO DEPLOY:
//   1. Open the Google Sheet above
//   2. Extensions → Apps Script
//   3. Paste this entire file, replacing any existing code
//   4. Click Save, then Deploy → New deployment
//   5. Type: Web app | Execute as: Me | Who has access: Anyone
//   6. Copy the deployment URL
//   7. Paste it into AdminEodRecap.jsx as ADMIN_SHEET_URL
// ═══════════════════════════════════════════════════════════════

const RECIPIENT_EMAIL = "powerhouseteam.juchen@gmail.com, ejay@powerhouseadmins.com";
const SHEET_NAME      = "EOD Recaps";

// ── Entry point ──────────────────────────────────────────────
function doPost(e) {
  try {
    const p = e.parameter;

    if (p.action === "sendEodRecap") {
      const result = handleEodRecap(p);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success:false, error:"Unknown action" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success:false, error:err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Allow GET for health check
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ success:true, message:"Eterna Admin Script is running." }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Main handler ─────────────────────────────────────────────
function handleEodRecap(p) {
  const date       = p.date       || "";
  const recipient  = p.recipient  || RECIPIENT_EMAIL;
  const totals     = safeParseJSON(p.totals, {});
  const apSummary  = safeParseJSON(p.apSummary, {});
  const bySpec     = safeParseJSON(p.specialistData, {});

  // 1. Log to sheet
  logToSheet({
    date,
    submittedCount:        p.submittedCount        || 0,
    totalDials:            totals.totalDials        || 0,
    clientsReached:        totals.clientsReached    || 0,
    totalTalkTime:         totals.totalTalkTime     || 0,
    apSavedPre:            totals.apSavedPre        || 0,
    apSavedConfirmed:      totals.apSavedConfirmed  || 0,
    uwPoliciesResolved:    totals.uwPoliciesResolved || 0,
    welcomeCallsCompleted: totals.welcomeCallsCompleted || 0,
    cancellationsResolved: p.cancellationsResolved  || 0,
    rewritesResolved:      p.rewritesResolved       || 0,
    wtdAp:                 apSummary.wtdAp          || 0,
    mtdAp:                 apSummary.mtdAp          || 0,
    savedDetails:          p.savedDetails           || "",
    uwDetails:             p.uwDetails              || "",
    escalations:           p.escalations            || "",
    agentOpNotes:          p.agentOpNotes           || "",
    generalNotes:          p.generalNotes           || "",
    sentAt:                new Date().toISOString(),
  });

  // 2. Build and send email
  const html = buildEmailHtml({ date, totals, apSummary, bySpec, p });
  const plain = buildEmailPlain({ date, totals, apSummary, p });

  GmailApp.sendEmail(recipient, `Eterna EOD Recap — ${date}`, plain, {
    htmlBody:  html,
    replyTo:   "noreply@eterna.app",
    name:      "Eterna Retention Tracker",
  });

  return { success:true, message:`Recap sent to ${recipient}` };
}

// ── Log to Google Sheet ───────────────────────────────────────
function logToSheet(d) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let sheet   = ss.getSheetByName(SHEET_NAME);

  // Create sheet if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      "Date","Submitted","Total Dials","Clients Reached","Talk Time (min)",
      "AP Saved Pre","AP Saved Conf","UW Resolved","Welcome Calls",
      "Cancellations Resolved","Rewrites Resolved",
      "WTD AP Saved","MTD AP Saved",
      "Saved Details","UW Details","Escalations",
      "Agent & Op Notes","General Notes","Sent At"
    ]);
    // Style header row
    const header = sheet.getRange(1, 1, 1, 19);
    header.setBackground("#1A2E22").setFontColor("#E8B87A").setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  sheet.appendRow([
    d.date,
    d.submittedCount,
    d.totalDials,
    d.clientsReached,
    d.totalTalkTime,
    d.apSavedPre,
    d.apSavedConfirmed,
    d.uwPoliciesResolved,
    d.welcomeCallsCompleted,
    d.cancellationsResolved,
    d.rewritesResolved,
    d.wtdAp,
    d.mtdAp,
    d.savedDetails,
    d.uwDetails,
    d.escalations,
    d.agentOpNotes,
    d.generalNotes,
    d.sentAt,
  ]);
}

// ── Email HTML builder ────────────────────────────────────────
function buildEmailHtml({ date, totals, apSummary, bySpec, p }) {
  const SPECIALISTS = ["Nisha","Rick","Chen","Fernando","Angie","Claire"];

  const cur = (v) => {
    return "$" + Number(v||0).toLocaleString("en-US", { maximumFractionDigits:0 });
  };

  const specRows = SPECIALISTS.map((s) => {
    const d = bySpec[s] || {};
    const hasData = (Number(d.totalDials||0) + Number(d.clientsReached||0)) > 0;
    const bg = hasData ? "#1A2E22" : "#0E1A15";
    const c  = hasData ? "#EAE0D0" : "#334155";
    return `
      <tr style="background:${bg}">
        <td style="padding:8px 12px;color:${c};font-weight:${hasData?"700":"400"}">${s}${hasData ? " ✓" : ""}</td>
        <td style="padding:8px 12px;color:#60C0E0;text-align:center">${d.totalDials || "—"}</td>
        <td style="padding:8px 12px;color:#7DC860;text-align:center">${d.clientsReached || "—"}</td>
        <td style="padding:8px 12px;color:#C8B89A;text-align:center">${d.totalTalkTime || "—"}</td>
        <td style="padding:8px 12px;color:#F0B84A;text-align:center">${d.apSavedConfirmed ? cur(d.apSavedConfirmed) : "—"}</td>
        <td style="padding:8px 12px;color:#B0A0E0;text-align:center">${d.uwPoliciesResolved || "—"}</td>
        <td style="padding:8px 12px;color:#E8B87A;text-align:center">${d.welcomeCallsCompleted || "—"}</td>
      </tr>`;
  }).join("");

  const notesSection = (title, content, color) => content ? `
    <div style="margin-top:16px">
      <div style="font-size:11px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px">${title}</div>
      <div style="background:#0E1A15;border-radius:8px;padding:12px;color:#C8B89A;font-size:13px;line-height:1.6;border:1px solid #1A2E22;white-space:pre-wrap">${content}</div>
    </div>` : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body{background:#0A1410;color:#EAE0D0;font-family:system-ui,-apple-system,sans-serif;margin:0;padding:24px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{background:#1A2E22;color:#E8B87A;font-size:10px;text-transform:uppercase;letter-spacing:0.07em;padding:9px 12px;text-align:left}
  tr:nth-child(even){background:#12201A}
  .stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
  .stat{background:#162219;border:1px solid #2D4035;border-radius:10px;padding:12px 14px}
  .stat-label{font-size:10px;color:#7A9E8A;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px}
  .stat-val{font-size:20px;font-weight:800;line-height:1}
</style></head>
<body>
  <div style="max-width:700px;margin:0 auto">

    <!-- Header -->
    <div style="background:#162219;border-radius:14px;padding:20px 24px;margin-bottom:20px;border:1px solid #2D4035">
      <div style="font-size:22px;font-weight:800;color:#E8B87A">Eterna EOD Recap</div>
      <div style="font-size:13px;color:#7A9E8A;margin-top:4px">${date} · ${p.submittedCount || 0} of 5 specialists submitted</div>
    </div>

    <!-- Daily totals -->
    <div style="background:#162219;border-radius:14px;padding:20px 24px;margin-bottom:16px;border:1px solid #2D4035">
      <div style="font-size:12px;font-weight:700;color:#E8B87A;text-transform:uppercase;letter-spacing:0.09em;margin-bottom:14px">Daily totals</div>
      <table>
        <tr style="background:#1A2E22">
          <th>Metric</th><th>Value</th>
        </tr>
        <tr><td style="padding:8px 12px;color:#7A9E8A">Total dials</td><td style="padding:8px 12px;font-weight:700;color:#60C0E0">${totals.totalDials || 0}</td></tr>
        <tr style="background:#12201A"><td style="padding:8px 12px;color:#7A9E8A">Clients reached</td><td style="padding:8px 12px;font-weight:700;color:#7DC860">${totals.clientsReached || 0}</td></tr>
        <tr><td style="padding:8px 12px;color:#7A9E8A">Talk time</td><td style="padding:8px 12px;font-weight:700;color:#C8B89A">${totals.totalTalkTime || 0} min</td></tr>
        <tr style="background:#12201A"><td style="padding:8px 12px;color:#7A9E8A">AP saved (pre-confirmation)</td><td style="padding:8px 12px;font-weight:700;color:#F0B84A">${cur(totals.apSavedPre)}</td></tr>
        <tr><td style="padding:8px 12px;color:#7A9E8A">AP saved (confirmed)</td><td style="padding:8px 12px;font-weight:700;color:#F0B84A">${cur(totals.apSavedConfirmed)}</td></tr>
        <tr style="background:#12201A"><td style="padding:8px 12px;color:#7A9E8A">UW policies resolved</td><td style="padding:8px 12px;font-weight:700;color:#B0A0E0">${totals.uwPoliciesResolved || 0}</td></tr>
        <tr><td style="padding:8px 12px;color:#7A9E8A">Welcome calls completed</td><td style="padding:8px 12px;font-weight:700;color:#E8B87A">${totals.welcomeCallsCompleted || 0}</td></tr>
        <tr style="background:#12201A"><td style="padding:8px 12px;color:#7A9E8A">Cancellations resolved</td><td style="padding:8px 12px;font-weight:700;color:#7DC860">${p.cancellationsResolved || 0}</td></tr>
        <tr><td style="padding:8px 12px;color:#7A9E8A">Re-writes resolved</td><td style="padding:8px 12px;font-weight:700;color:#7DC860">${p.rewritesResolved || 0}</td></tr>
      </table>
    </div>

    <!-- AP Summary -->
    <div style="background:#162219;border-radius:14px;padding:20px 24px;margin-bottom:16px;border:1px solid #2D4035">
      <div style="font-size:12px;font-weight:700;color:#E8B87A;text-transform:uppercase;letter-spacing:0.09em;margin-bottom:14px">AP Saved summary</div>
      <table>
        <tr style="background:#1A2E22"><th>Period</th><th>AP Saved</th></tr>
        <tr><td style="padding:8px 12px;color:#7A9E8A">Week-to-date</td><td style="padding:8px 12px;font-weight:800;color:#F0B84A;font-size:16px">${cur(apSummary.wtdAp)}</td></tr>
        <tr style="background:#12201A"><td style="padding:8px 12px;color:#7A9E8A">Month-to-date</td><td style="padding:8px 12px;font-weight:800;color:#E8B87A;font-size:16px">${cur(apSummary.mtdAp)}</td></tr>
      </table>
    </div>

    <!-- Per-specialist -->
    <div style="background:#162219;border-radius:14px;padding:20px 24px;margin-bottom:16px;border:1px solid #2D4035">
      <div style="font-size:12px;font-weight:700;color:#E8B87A;text-transform:uppercase;letter-spacing:0.09em;margin-bottom:14px">Breakdown by specialist</div>
      <table>
        <tr><th>Specialist</th><th style="text-align:center">Dials</th><th style="text-align:center">Reached</th><th style="text-align:center">Talk(min)</th><th style="text-align:center">AP Saved</th><th style="text-align:center">UW Res.</th><th style="text-align:center">Wel. Calls</th></tr>
        ${specRows}
      </table>
    </div>

    <!-- Details -->
    ${p.savedDetails ? `
    <div style="background:#162219;border-radius:14px;padding:20px 24px;margin-bottom:16px;border:1px solid #2D4035">
      <div style="font-size:12px;font-weight:700;color:#7DC860;text-transform:uppercase;letter-spacing:0.09em;margin-bottom:10px">Saved clients</div>
      <div style="color:#C8B89A;font-size:13px;line-height:1.7;white-space:pre-wrap">${p.savedDetails}</div>
    </div>` : ""}

    ${p.uwDetails ? `
    <div style="background:#162219;border-radius:14px;padding:20px 24px;margin-bottom:16px;border:1px solid #2D4035">
      <div style="font-size:12px;font-weight:700;color:#B0A0E0;text-transform:uppercase;letter-spacing:0.09em;margin-bottom:10px">UW details</div>
      <div style="color:#C8B89A;font-size:13px;line-height:1.7;white-space:pre-wrap">${p.uwDetails}</div>
    </div>` : ""}

    ${p.escalations ? `
    <div style="background:#2A1A10;border-radius:14px;padding:20px 24px;margin-bottom:16px;border:1px solid #5A2A10">
      <div style="font-size:12px;font-weight:700;color:#F08060;text-transform:uppercase;letter-spacing:0.09em;margin-bottom:10px">Escalations / agent action needed</div>
      <div style="color:#F08060;font-size:13px;line-height:1.7;white-space:pre-wrap">${p.escalations}</div>
    </div>` : ""}

    ${p.agentOpNotes ? `
    <div style="background:#162219;border-radius:14px;padding:20px 24px;margin-bottom:16px;border:1px solid #2D4035">
      <div style="font-size:12px;font-weight:700;color:#7A9E8A;text-transform:uppercase;letter-spacing:0.09em;margin-bottom:10px">Agent & operational updates</div>
      <div style="color:#C8B89A;font-size:13px;line-height:1.7;white-space:pre-wrap">${p.agentOpNotes}</div>
    </div>` : ""}

    ${p.generalNotes ? `
    <div style="background:#162219;border-radius:14px;padding:20px 24px;margin-bottom:16px;border:1px solid #2D4035">
      <div style="font-size:12px;font-weight:700;color:#5A7A68;text-transform:uppercase;letter-spacing:0.09em;margin-bottom:10px">General notes</div>
      <div style="color:#C8B89A;font-size:13px;line-height:1.7;white-space:pre-wrap">${p.generalNotes}</div>
    </div>` : ""}

    <!-- Footer -->
    <div style="text-align:center;font-size:11px;color:#334155;margin-top:20px;padding-top:16px;border-top:1px solid #1A2E22">
      Sent by Eterna Retention Tracker · ${new Date().toLocaleString()}
    </div>
  </div>
</body>
</html>`;
}

// ── Plain text fallback ───────────────────────────────────────
function buildEmailPlain({ date, totals, apSummary, p }) {
  const cur = (v) => "$" + Number(v||0).toLocaleString("en-US", { maximumFractionDigits:0 });
  return [
    `ETERNA EOD RECAP — ${date}`,
    `${p.submittedCount || 0} of 5 specialists submitted`,
    "",
    "DAILY TOTALS",
    `Total dials:             ${totals.totalDials || 0}`,
    `Clients reached:         ${totals.clientsReached || 0}`,
    `Talk time:               ${totals.totalTalkTime || 0} min`,
    `AP saved (pre):          ${cur(totals.apSavedPre)}`,
    `AP saved (confirmed):    ${cur(totals.apSavedConfirmed)}`,
    `UW policies resolved:    ${totals.uwPoliciesResolved || 0}`,
    `Welcome calls:           ${totals.welcomeCallsCompleted || 0}`,
    `Cancellations resolved:  ${p.cancellationsResolved || 0}`,
    `Re-writes resolved:      ${p.rewritesResolved || 0}`,
    "",
    "AP SAVED SUMMARY",
    `Week-to-date:   ${cur(apSummary.wtdAp)}`,
    `Month-to-date:  ${cur(apSummary.mtdAp)}`,
    p.savedDetails  ? `\nSAVED CLIENTS\n${p.savedDetails}`      : "",
    p.uwDetails     ? `\nUW DETAILS\n${p.uwDetails}`            : "",
    p.escalations   ? `\nESCALATIONS\n${p.escalations}`         : "",
    p.agentOpNotes  ? `\nAGENT & OP UPDATES\n${p.agentOpNotes}` : "",
    p.generalNotes  ? `\nGENERAL NOTES\n${p.generalNotes}`      : "",
    "",
    `Sent by Eterna Retention Tracker — ${new Date().toLocaleString()}`,
  ].filter((l) => l !== "").join("\n");
}

// ── Helpers ───────────────────────────────────────────────────
function safeParseJSON(str, fallback) {
  try { return JSON.parse(str); }
  catch { return fallback; }
}
