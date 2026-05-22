function doPost(e) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

    const specialistName = e.parameter.specialistName || "Unassigned";
    const allowedSheets = ["Nisha", "Chen", "Rick"];
    const sheetName = allowedSheets.includes(specialistName)
      ? specialistName
      : "Unassigned";

    let sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
      setupMainHeader(sheet);
    }

    if (sheet.getLastRow() === 0) {
      setupMainHeader(sheet);
    }

    const todayKey = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "yyyy-MM-dd"
    );

    const todayLabel = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "MMMM d, yyyy"
    );

    const section = getOrCreateTodaySection(sheet, todayKey, todayLabel);

    const newRow = sheet.getLastRow() + 1;

    sheet.appendRow([
      new Date(),
      e.parameter.clientName || "",
      e.parameter.policyNumber || "",
      e.parameter.ap || "",
      e.parameter.leadStatus || "",
      e.parameter.agentName || "",
      e.parameter.result || "",
      e.parameter.action || "",
      e.parameter.notes || "",
      e.parameter.priority || "",
      e.parameter.updatedAt || "",
      specialistName,
      ""
    ]);

    const action = String(e.parameter.action || "").toLowerCase().trim();
    const rowColor = getActionColor(action);

    if (rowColor) {
      sheet.getRange(newRow, 1, 1, 12).setBackground(rowColor);
    }

    updateDailyCounter(sheet, section.counterRow, section.startDataRow);

    return ContentService
      .createTextOutput("Success")
      .setMimeType(ContentService.MimeType.TEXT);

  } catch (error) {
    return ContentService
      .createTextOutput("Error: " + error.message)
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

function setupMainHeader(sheet) {
  sheet.getRange(1, 1, 1, 12).setValues([[
    "Created At",
    "Client Name",
    "Policy Number",
    "AP",
    "Lead Status",
    "Agent Name",
    "Result",
    "Action",
    "Notes",
    "Priority",
    "Updated At",
    "Specialist Name"
  ]]);

  sheet.getRange(1, 1, 1, 12)
    .setBackground("#EFE4D6")
    .setFontWeight("bold")
    .setHorizontalAlignment("center");

  sheet.hideColumns(13);
  sheet.setFrozenRows(1);
}

function getOrCreateTodaySection(sheet, todayKey, todayLabel) {
  const marker = "DATE_KEY_" + todayKey;
  const lastRow = sheet.getLastRow();

  if (lastRow >= 1) {
    const markers = sheet.getRange(1, 13, lastRow, 1).getValues().flat();

    for (let i = 0; i < markers.length; i++) {
      if (String(markers[i]) === marker) {
        return {
          dateRow: i + 1,
          headerRow: i + 2,
          counterRow: i + 3,
          startDataRow: i + 4
        };
      }
    }
  }

  const dateRow = sheet.getLastRow() + 1;
  const headerRow = dateRow + 1;
  const counterRow = dateRow + 2;
  const startDataRow = dateRow + 3;

  sheet.getRange(dateRow, 1, 1, 12).merge();
  sheet.getRange(dateRow, 1).setValue(todayLabel);
  sheet.getRange(dateRow, 13).setValue(marker);

  sheet.getRange(dateRow, 1, 1, 12)
    .setBackground("#E8D8C3")
    .setFontWeight("bold")
    .setFontSize(12)
    .setHorizontalAlignment("center");

  sheet.getRange(headerRow, 1, 1, 7).setValues([[
    "Save",
    "Pending Save",
    "Welcome Call",
    "Onboarding",
    "UW Action Needed",
    "UW Resolved",
    "LOST"
  ]]);

  sheet.getRange(counterRow, 1, 1, 7).setValues([[0, 0, 0, 0, 0, 0, 0]]);

  sheet.getRange(headerRow, 1, 2, 7)
    .setBackground("#F7F1E8")
    .setFontWeight("bold")
    .setHorizontalAlignment("center");

  sheet.hideColumns(13);

  return {
    dateRow,
    headerRow,
    counterRow,
    startDataRow
  };
}

function updateDailyCounter(sheet, counterRow, startDataRow) {
  const lastRow = sheet.getLastRow();

  const counts = {
    save: 0,
    "pending save": 0,
    "welcome call": 0,
    onboarding: 0,
    "uw action needed": 0,
    "uw resolved": 0,
    lost: 0
  };

  for (let row = startDataRow; row <= lastRow; row++) {
    const marker = String(sheet.getRange(row, 13).getValue() || "");

    if (marker.startsWith("DATE_KEY_")) {
      break;
    }

    const action = String(sheet.getRange(row, 8).getValue() || "")
      .toLowerCase()
      .trim();

    if (counts.hasOwnProperty(action)) {
      counts[action]++;
    }
  }

  sheet.getRange(counterRow, 1, 1, 7).setValues([[
    counts["save"],
    counts["pending save"],
    counts["welcome call"],
    counts["onboarding"],
    counts["uw action needed"],
    counts["uw resolved"],
    counts["lost"]
  ]]);
}

function getActionColor(action) {
  if (action === "pending save") return "#D9EAF7";
  if (action === "save") return "#D9EAD3";
  if (action === "welcome call" || action === "onboarding") return "#FFF2CC";
  if (action === "lost") return "#F4CCCC";
  if (action === "uw action needed") return "#EADCF8";
  if (action === "uw resolved") return "#FCE5CD";
  return null;
}