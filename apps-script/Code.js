/**
 * KODA HYROX SIMULATION — Signup Backend
 *
 * SETUP:
 * 1. Go to https://script.google.com → New Project
 * 2. Paste this entire script (replace the default code)
 * 3. Click Run → select "setup" from the function dropdown → Run
 *    → Authorize with your Google account when prompted
 *    → This creates the spreadsheet and saves its ID
 * 4. Open the Execution Log (View → Execution log) to see the spreadsheet URL
 * 5. Click Deploy → New Deployment
 *    → Click the gear icon → Select "Web app"
 *    → Set "Execute as" → Me (kevschuetz3@gmail.com)
 *    → Set "Who has access" → Anyone
 *    → Click Deploy
 *    → Copy the Web App URL
 * 6. Paste that URL into index.html where it says YOUR_APPS_SCRIPT_WEB_APP_URL
 *
 * Whenever you change this script, you must:
 *    Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy
 *    (the URL stays the same when you redeploy an existing deployment)
 */

var EVENT_NAME = "Hyrox Simulation — June 7, 2026";

// Optional: notify this email on every signup. Leave blank to disable.
var NOTIFY_EMAIL = "kevschuetz3@gmail.com";

// ── SETUP — Run this once ──
function setup() {
  var ss = getOrCreateSpreadsheet();
  Logger.log("Spreadsheet URL: " + ss.getUrl());
  Logger.log("Spreadsheet ID: " + ss.getId());
  PropertiesService.getScriptProperties().setProperty("SHEET_ID", ss.getId());
  Logger.log("Setup complete.");
}

function getOrCreateSpreadsheet() {
  var id = PropertiesService.getScriptProperties().getProperty("SHEET_ID");
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* fall through and create */ }
  }

  var ss = SpreadsheetApp.create("Koda Hyrox Simulation Signups");
  var sheet = ss.getActiveSheet();
  sheet.setName("Signups");

  sheet.appendRow([
    "Timestamp",
    "First Name",
    "Last Name",
    "Email",
    "Division",
    "Partner / Teammates",
    "Weights",
    "Expected Time",
    "Home Gym",
    "Comments"
  ]);
  sheet.getRange(1, 1, 1, 10)
    .setFontWeight("bold")
    .setBackground("#0a0a0a")
    .setFontColor("#d6ff3f");
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 170);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 120);
  sheet.setColumnWidth(4, 220);
  sheet.setColumnWidth(5, 130);
  sheet.setColumnWidth(6, 280);
  sheet.setColumnWidth(7, 100);
  sheet.setColumnWidth(8, 150);
  sheet.setColumnWidth(9, 200);
  sheet.setColumnWidth(10, 320);

  return ss;
}

// In waitlist mode every new signup is tagged this way in the sheet
// and in the notification email subject.
var SIGNUP_STATUS = "WAITLIST";

// Lazily add a "Status" column to the right of the existing headers
// (and a "Tagged At" column so it's clear when the tag was applied),
// so we can distinguish waitlist signups from confirmed ones at a
// glance without breaking any existing tooling.
function ensureStatusColumn(sheet) {
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var hasStatus = false;
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim().toLowerCase() === "status") { hasStatus = true; break; }
  }
  if (!hasStatus) {
    var col = lastCol + 1;
    sheet.getRange(1, col)
      .setValue("Status")
      .setFontWeight("bold")
      .setBackground("#0a0a0a")
      .setFontColor("#d6ff3f");
    sheet.setColumnWidth(col, 120);
  }
}

// Build a row aligned to whatever headers the sheet actually has, so the
// values land in the right columns regardless of layout (and the Status
// value lands in the Status column even if it isn't the last one).
function buildAlignedRow(sheet, record) {
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  return headers.map(function(h) {
    switch (String(h).trim().toLowerCase()) {
      case "timestamp":            return record.timestamp;
      case "first name":           return record.firstName;
      case "last name":            return record.lastName;
      case "email":                return record.email;
      case "category":
      case "division":             return record.division;
      case "partner / teammates":
      case "partner/teammates":    return record.partners;
      case "weights":
      case "weight":               return record.weights;
      case "expected time":        return record.expectedTime;
      case "home gym":             return record.homeGym;
      case "comments":             return record.comments;
      case "status":               return record.status;
      default:                     return "";
    }
  });
}

// ── POST: Receive signup OR feedback ──
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // Feedback survey posts include type:"feedback" — route those to their
    // own spreadsheet, separate from signups.
    if (data.type === "feedback") {
      return handleFeedback(data);
    }

    // Class-time poll posts (for gym members) include type:"classtimes".
    if (data.type === "classtimes") {
      return handleClassTimes(data);
    }

    // Hyrox class-time survey (sent to the Sept 13 participants) — type:"survey0913".
    if (data.type === "survey0913") {
      return handleSurvey0913(data);
    }

    // September 13, 2026 simulation signups include type:"sim0913" —
    // their own spreadsheet, shirt orders, and payment instructions.
    if (data.type === "sim0913") {
      return handleSim0913(data);
    }

    // Auto-create the spreadsheet on first submission if it doesn't exist yet.
    var ss = getOrCreateSpreadsheet();
    PropertiesService.getScriptProperties().setProperty("SHEET_ID", ss.getId());
    var sheet = ss.getSheetByName("Signups");

    // Make sure a Status column exists so we can tag waitlist rows.
    ensureStatusColumn(sheet);

    // Combine partner / teammates into a single column for the sheet
    var partnersCol = data.partnerName || data.teammates || "";

    var record = {
      timestamp: new Date(),
      firstName: data.firstName || "",
      lastName: data.lastName || "",
      email: data.email || "",
      division: data.division || "",
      partners: partnersCol,
      weights: data.weights || "",
      expectedTime: data.expectedTime || "",
      homeGym: data.homeGym || "",
      comments: data.comments || "",
      status: SIGNUP_STATUS
    };
    sheet.appendRow(buildAlignedRow(sheet, record));

    if (NOTIFY_EMAIL) {
      try {
        MailApp.sendEmail({
          to: NOTIFY_EMAIL,
          subject: "[" + SIGNUP_STATUS + "] New Hyrox Simulation Signup — " + (data.firstName || "") + " " + (data.lastName || ""),
          htmlBody:
            "<h3>New signup for " + EVENT_NAME + "</h3>" +
            "<table style='border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px'>" +
            row("Status", SIGNUP_STATUS) +
            row("Name", (data.firstName || "") + " " + (data.lastName || "")) +
            row("Email", data.email || "") +
            row("Division", data.division || "") +
            (partnersCol ? row(data.teammates ? "Teammates" : "Partner", partnersCol) : "") +
            row("Weights", data.weights || "") +
            row("Expected Time", data.expectedTime || "") +
            row("Home Gym", data.homeGym || "") +
            (data.comments ? row("Comments", data.comments) : "") +
            "</table>" +
            "<p><a href='" + ss.getUrl() + "'>View all signups in the spreadsheet</a></p>"
        });
      } catch (mailErr) {
        // Don't fail the submission if email fails
        Logger.log("Email notification failed: " + mailErr);
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function row(label, value) {
  return "<tr><td style='padding:4px 12px 4px 0;color:#666;text-transform:uppercase;font-size:11px;letter-spacing:0.05em;vertical-align:top'>" +
    label + "</td><td style='padding:4px 0'>" + escapeHtml(value) + "</td></tr>";
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function(c) {
    return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
  });
}

// ═══════════════════════════════════════════════════════════════
// FEEDBACK SURVEY  (posted from feedback.html with type:"feedback")
// Writes to a SEPARATE spreadsheet ("Koda Hyrox Feedback") so it
// never mixes with signups.
// ═══════════════════════════════════════════════════════════════

var FEEDBACK_HEADERS = [
  "Timestamp",
  "Overall (1-5)",
  "Organization (1-5)",
  "Hyrox Accuracy (1-5)",
  "Likelihood to Repeat (1-5)",
  "Atmosphere (1-5)",
  "Training Program Interest",
  "Free Class Interest",
  "Suggested Class Times",
  "Name",
  "Email",
  "Comments"
];

function getOrCreateFeedbackSpreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("FEEDBACK_SHEET_ID");
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* fall through and create */ }
  }

  var ss = SpreadsheetApp.create("Koda Hyrox Feedback");
  var sheet = ss.getActiveSheet();
  sheet.setName("Feedback");
  sheet.appendRow(FEEDBACK_HEADERS);
  sheet.getRange(1, 1, 1, FEEDBACK_HEADERS.length)
    .setFontWeight("bold")
    .setBackground("#0a0a0a")
    .setFontColor("#d6ff3f");
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(7, 170);
  sheet.setColumnWidth(8, 150);
  sheet.setColumnWidth(9, 320);
  sheet.setColumnWidth(10, 140);
  sheet.setColumnWidth(11, 220);
  sheet.setColumnWidth(12, 380);

  props.setProperty("FEEDBACK_SHEET_ID", ss.getId());
  return ss;
}

function buildAlignedFeedbackRow(sheet, record) {
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  return headers.map(function(h) {
    switch (String(h).trim().toLowerCase()) {
      case "timestamp":                   return record.timestamp;
      case "overall (1-5)":               return record.overall;
      case "organization (1-5)":          return record.organization;
      case "hyrox accuracy (1-5)":        return record.accuracy;
      case "likelihood to repeat (1-5)":  return record.likelihood;
      case "atmosphere (1-5)":            return record.atmosphere;
      case "training program interest":   return record.trainingProgram;
      case "free class interest":         return record.freeClass;
      case "suggested class times":       return record.classTimes;
      case "name":                        return record.name;
      case "email":                       return record.email;
      case "comments":                    return record.comments;
      default:                            return "";
    }
  });
}

function handleFeedback(data) {
  var ss = getOrCreateFeedbackSpreadsheet();
  var sheet = ss.getSheetByName("Feedback");

  var record = {
    timestamp: new Date(),
    overall: data.overall || "",
    organization: data.organization || "",
    accuracy: data.accuracy || "",
    likelihood: data.likelihood || "",
    atmosphere: data.atmosphere || "",
    trainingProgram: data.trainingProgram || "",
    freeClass: data.freeClass || "",
    classTimes: data.classTimes || "",
    name: data.name || "",
    email: data.email || "",
    comments: data.comments || ""
  };
  sheet.appendRow(buildAlignedFeedbackRow(sheet, record));

  if (NOTIFY_EMAIL) {
    try {
      var wantsFollowUp = record.freeClass === "Yes" || record.trainingProgram === "Yes";
      MailApp.sendEmail({
        to: NOTIFY_EMAIL,
        subject: (wantsFollowUp ? "[FOLLOW UP] " : "") + "New Hyrox Feedback" +
                 (record.name ? " — " + record.name : ""),
        htmlBody:
          "<h3>New Hyrox Simulation feedback</h3>" +
          "<table style='border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px'>" +
          row("Overall", record.overall) +
          row("Organization", record.organization) +
          row("Hyrox Accuracy", record.accuracy) +
          row("Likelihood to Repeat", record.likelihood) +
          row("Atmosphere", record.atmosphere) +
          row("Training Program?", record.trainingProgram) +
          row("Free Class?", record.freeClass) +
          (record.classTimes ? row("Suggested Times", record.classTimes) : "") +
          (record.name ? row("Name", record.name) : "") +
          (record.email ? row("Email", record.email) : "") +
          (record.comments ? row("Comments", record.comments) : "") +
          "</table>" +
          "<p><a href='" + ss.getUrl() + "'>View all feedback in the spreadsheet</a></p>"
      });
    } catch (mailErr) {
      Logger.log("Feedback email notification failed: " + mailErr);
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ═══════════════════════════════════════════════════════════════
// CLASS-TIME POLL  (posted from class-times.html with type:"classtimes")
// For gym members who already train here — just name + preferred times.
// Writes to its OWN spreadsheet ("Koda Hyrox Class Time Requests").
// ═══════════════════════════════════════════════════════════════

var CLASSTIMES_HEADERS = [
  "Timestamp",
  "Name",
  "Preferred Class Times"
];

function getOrCreateClassTimesSpreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("CLASSTIMES_SHEET_ID");
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* fall through and create */ }
  }

  var ss = SpreadsheetApp.create("Koda Hyrox Class Time Requests");
  var sheet = ss.getActiveSheet();
  sheet.setName("Class Times");
  sheet.appendRow(CLASSTIMES_HEADERS);
  sheet.getRange(1, 1, 1, CLASSTIMES_HEADERS.length)
    .setFontWeight("bold")
    .setBackground("#0a0a0a")
    .setFontColor("#d6ff3f");
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 160);
  sheet.setColumnWidth(3, 420);

  props.setProperty("CLASSTIMES_SHEET_ID", ss.getId());
  return ss;
}

function buildAlignedClassTimesRow(sheet, record) {
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  return headers.map(function(h) {
    switch (String(h).trim().toLowerCase()) {
      case "timestamp":              return record.timestamp;
      case "name":                   return record.name;
      case "preferred class times":  return record.classTimes;
      default:                       return "";
    }
  });
}

function handleClassTimes(data) {
  var ss = getOrCreateClassTimesSpreadsheet();
  var sheet = ss.getSheetByName("Class Times");

  var record = {
    timestamp: new Date(),
    name: data.name || "",
    classTimes: data.classTimes || ""
  };
  sheet.appendRow(buildAlignedClassTimesRow(sheet, record));

  if (NOTIFY_EMAIL) {
    try {
      MailApp.sendEmail({
        to: NOTIFY_EMAIL,
        subject: "New Hyrox class-time request" + (record.name ? " — " + record.name : ""),
        htmlBody:
          "<h3>New class-time request</h3>" +
          "<table style='border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px'>" +
          row("Name", record.name) +
          row("Preferred Times", record.classTimes) +
          "</table>" +
          "<p><a href='" + ss.getUrl() + "'>View all class-time requests in the spreadsheet</a></p>"
      });
    } catch (mailErr) {
      Logger.log("Class-time email notification failed: " + mailErr);
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ═══════════════════════════════════════════════════════════════
// HYROX CLASS-TIME SURVEY  (posted from survey.html with type:"survey0913")
// Sent to the Sept 13 2026 simulation athletes after the event:
// name + email + "What class times should we add to our Hyrox schedule?"
// (Mon–Fri × SURVEY0913_TIMES checkbox grid).
// Own spreadsheet ("Koda Hyrox Class Time Survey"): a "Responses" tab
// (one row per person) + a formula-driven "Tally" tab (times × days counts
// that update themselves as responses land).
// ONE ROW PER EMAIL — resubmitting overwrites that person's earlier answer,
// so submit-retries (the 8/18 response-loss failure mode) can't create
// duplicates or skew the tally.
// ═══════════════════════════════════════════════════════════════

var SURVEY0913_SHEET_NAME = "Koda Hyrox Class Time Survey";
var SURVEY0913_HEADERS = ["Timestamp", "Name", "Email", "Requested Class Times"];
var SURVEY0913_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
// Must match GROUPS/TIMES in survey.html — unknown slots are dropped on save.
var SURVEY0913_TIMES = ["5am", "5:30am", "6am", "6:30am", "7am", "4pm", "4:30pm", "5pm", "5:30pm", "6pm"];

function survey0913Out(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSurvey0913Spreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("SURVEY0913_SHEET_ID");
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* fall through and create */ }
  }

  var ss = SpreadsheetApp.create(SURVEY0913_SHEET_NAME);
  var sheet = ss.getActiveSheet();
  sheet.setName("Responses");
  sheet.appendRow(SURVEY0913_HEADERS);
  sheet.getRange(1, 1, 1, SURVEY0913_HEADERS.length)
    .setFontWeight("bold")
    .setBackground("#0a0a0a")
    .setFontColor("#d6ff3f");
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 180);
  sheet.setColumnWidth(3, 240);
  sheet.setColumnWidth(4, 520);
  survey0913ApplyTextFormats(sheet);

  survey0913BuildTallyTab(ss);

  props.setProperty("SURVEY0913_SHEET_ID", ss.getId());
  return ss;
}

// "Tally" tab: rows = times, columns = days; each cell counts responses that
// asked for that slot. COUNTIF wildcards on the "Requested Class Times" text,
// so it stays live without any script involvement. Safe to rebuild any time.
function survey0913BuildTallyTab(ss) {
  var tally = ss.getSheetByName("Tally") || ss.insertSheet("Tally");
  tally.clear();

  var header = ["Time"].concat(SURVEY0913_DAYS).concat(["Total"]);
  var rows = [header];
  var lastTimeRow = SURVEY0913_TIMES.length + 1;           // last row holding a time
  var lastDayCol = String.fromCharCode(65 + SURVEY0913_DAYS.length); // "F" for 5 days

  SURVEY0913_TIMES.forEach(function(t, i) {
    var r = i + 2;
    var cells = [t];
    SURVEY0913_DAYS.forEach(function(d) {
      cells.push('=COUNTIF(Responses!$D$2:$D,"*' + d + ' ' + t + '*")');
    });
    cells.push("=SUM(B" + r + ":" + lastDayCol + r + ")");
    rows.push(cells);
  });

  var totalRow = ["Total"];
  SURVEY0913_DAYS.forEach(function(d, j) {
    var col = String.fromCharCode(66 + j); // B, C, D ...
    totalRow.push("=SUM(" + col + "2:" + col + lastTimeRow + ")");
  });
  var totalRowNum = lastTimeRow + 1;
  totalRow.push("=SUM(B" + totalRowNum + ":" + lastDayCol + totalRowNum + ")");
  rows.push(totalRow);

  // Force the Time column to TEXT before writing — otherwise Sheets coerces
  // "5am" / "5:30am" into time-of-day values (same gotcha as the sim0913 heats).
  tally.getRange(2, 1, rows.length - 1, 1).setNumberFormat("@");
  tally.getRange(1, 1, rows.length, header.length).setValues(rows);
  tally.getRange(1, 1, 1, header.length)
    .setFontWeight("bold").setBackground("#0a0a0a").setFontColor("#d6ff3f");
  tally.getRange(rows.length, 1, 1, header.length).setFontWeight("bold");
  tally.getRange(rows.length + 2, 1).setValue("Responses");
  tally.getRange(rows.length + 2, 2).setFormula("=COUNTA(Responses!$C$2:$C)");
  tally.getRange(rows.length + 2, 1, 1, 2).setFontWeight("bold");
  tally.setFrozenRows(1);
  tally.setColumnWidth(1, 90);
  return tally;
}

// Name / Email / Requested Class Times must stay TEXT — Sheets would otherwise
// parse a time-like answer (e.g. a lone "Mon 5am") into a Date, and both the
// COUNTIF tally and the Info summary would silently miss it.
function survey0913ApplyTextFormats(sheet) {
  var hm = survey0913HeaderMap(sheet);
  var rows = Math.max(sheet.getMaxRows() - 1, 1);
  ["name", "email", "requested class times"].forEach(function(key) {
    if (hm[key] != null) sheet.getRange(2, hm[key] + 1, rows, 1).setNumberFormat("@");
  });
}

function survey0913HeaderMap(sheet) {
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var idx = {};
  headers.forEach(function(h, i) { idx[String(h).trim().toLowerCase()] = i; });
  return idx;
}

// One past the last row with a real timestamp (NOT appendRow — a stray cell
// far down the sheet would otherwise maroon every new response there).
function survey0913NextRow(sheet, hm) {
  var col = hm["timestamp"] != null ? hm["timestamp"] : 0;
  var last = sheet.getLastRow();
  if (last < 2) return 2;
  var vals = sheet.getRange(2, col + 1, last - 1, 1).getValues();
  for (var i = vals.length - 1; i >= 0; i--) {
    if (String(vals[i][0]).trim() !== "") return i + 3;
  }
  return 2;
}

function survey0913FindRowByEmail(sheet, hm, email) {
  var col = hm["email"];
  if (col == null) return 0;
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var vals = sheet.getRange(2, col + 1, last - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]).trim().toLowerCase() === email) return i + 2;
  }
  return 0;
}

// Keep only slots we actually offered, in Mon→Fri / early→late order.
function survey0913NormalizeTimes(raw) {
  var wanted = {};
  String(raw || "").split(",").forEach(function(t) {
    var k = t.trim().toLowerCase();
    if (k) wanted[k] = true;
  });
  var kept = [];
  SURVEY0913_DAYS.forEach(function(d) {
    SURVEY0913_TIMES.forEach(function(t) {
      var label = d + " " + t;
      if (wanted[label.toLowerCase()]) kept.push(label);
    });
  });
  return kept;
}

function handleSurvey0913(data) {
  var name = String(data.name || "").trim();
  var email = String(data.email || "").trim().toLowerCase();
  var times = survey0913NormalizeTimes(data.classTimes);

  if (!name) return survey0913Out({ status: "error", saved: false, error: "Name is required." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return survey0913Out({ status: "error", saved: false, error: "A valid email is required." });
  }
  if (!times.length) return survey0913Out({ status: "error", saved: false, error: "Pick at least one class time." });

  var timesText = times.join(", ");
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  var ss, rowNum, updated = false;
  try {
    ss = getOrCreateSurvey0913Spreadsheet();
    var sheet = ss.getSheetByName("Responses") || ss.getSheets()[0];
    var hm = survey0913HeaderMap(sheet);

    rowNum = survey0913FindRowByEmail(sheet, hm, email);
    if (rowNum) updated = true; else rowNum = survey0913NextRow(sheet, hm);

    // Write only the columns we own (by header name), so any extra columns
    // Kevin adds to the sheet are never clobbered on an update.
    var values = {
      "timestamp": new Date(),
      "name": name,
      "email": email,
      "requested class times": timesText
    };
    Object.keys(values).forEach(function(key) {
      if (hm[key] == null) return;
      var cell = sheet.getRange(rowNum, hm[key] + 1);
      if (key !== "timestamp") cell.setNumberFormat("@");
      cell.setValue(values[key]);
    });
  } finally {
    lock.releaseLock();
  }

  if (NOTIFY_EMAIL && !/test/i.test(name) && !/test/i.test(email)) {
    try {
      MailApp.sendEmail({
        to: NOTIFY_EMAIL,
        subject: "Hyrox class-time survey — " + name + (updated ? " (updated answer)" : ""),
        htmlBody:
          "<h3>Hyrox class-time survey response" + (updated ? " (updated)" : "") + "</h3>" +
          "<table style='border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px'>" +
          row("Name", name) +
          row("Email", email) +
          row("Times", timesText) +
          "</table>" +
          "<p><a href='" + ss.getUrl() + "'>Open the survey sheet</a> — the Tally tab has live counts per slot.</p>"
      });
    } catch (mailErr) {
      Logger.log("Survey0913 email notification failed: " + mailErr);
    }
  }

  return survey0913Out({ status: "ok", saved: true, row: rowNum, updated: updated, times: timesText });
}

// Sheet URL + response count + per-slot tally (computed here, independent of
// the Tally tab's formulas). Test rows (name/email matching /test/i) excluded.
function survey0913Summary() {
  var ss = getOrCreateSurvey0913Spreadsheet();
  var sheet = ss.getSheetByName("Responses") || ss.getSheets()[0];
  var hm = survey0913HeaderMap(sheet);
  var iName = hm["name"], iEmail = hm["email"], iTimes = hm["requested class times"];
  var last = sheet.getLastRow();
  var vals = last >= 2 ? sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues() : [];
  var tally = {}, responses = 0, testRows = 0;
  SURVEY0913_DAYS.forEach(function(d) {
    SURVEY0913_TIMES.forEach(function(t) { tally[d + " " + t] = 0; });
  });
  vals.forEach(function(r) {
    var nm = String(iName != null ? r[iName] : "").trim();
    var em = String(iEmail != null ? r[iEmail] : "").trim();
    if (!nm && !em) return;
    if (/test/i.test(nm) || /test/i.test(em)) { testRows++; return; }
    responses++;
    String(iTimes != null ? r[iTimes] : "").split(",").forEach(function(t) {
      var k = t.trim();
      if (tally.hasOwnProperty(k)) tally[k]++;
    });
  });
  var ranked = Object.keys(tally)
    .filter(function(k) { return tally[k] > 0; })
    .sort(function(a, b) { return tally[b] - tally[a]; })
    .map(function(k) { return { slot: k, count: tally[k] }; });
  // Computed values of the formula-driven Tally tab (lets a caller verify the formulas evaluate).
  var tallyTab = null;
  var tt = ss.getSheetByName("Tally");
  if (tt) tallyTab = tt.getRange(1, 1, SURVEY0913_TIMES.length + 2, SURVEY0913_DAYS.length + 2).getValues();
  return { status: "ok", name: ss.getName(), url: ss.getUrl(), responses: responses, testRows: testRows, top: ranked.slice(0, 10), tally: tally, tallyTab: tallyTab };
}

// Delete rows whose Name or Email matches /test/i (bottom-up so indices hold).
function survey0913ClearTests() {
  var ss = getOrCreateSurvey0913Spreadsheet();
  var sheet = ss.getSheetByName("Responses") || ss.getSheets()[0];
  var hm = survey0913HeaderMap(sheet);
  var iName = hm["name"], iEmail = hm["email"];
  var last = sheet.getLastRow();
  var removed = [];
  if (last >= 2) {
    var vals = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
    for (var i = vals.length - 1; i >= 0; i--) {
      var nm = String(iName != null ? vals[i][iName] : "");
      var em = String(iEmail != null ? vals[i][iEmail] : "");
      if (/test/i.test(nm) || /test/i.test(em)) {
        sheet.deleteRow(i + 2);
        removed.push({ row: i + 2, name: nm.trim(), email: em.trim() });
      }
    }
  }
  return { status: "ok", removed: removed.length, rows: removed.reverse() };
}

// ═══════════════════════════════════════════════════════════════
// SEPTEMBER 13, 2026 SIMULATION  (posted from index.html with type:"sim0913")
// $25/athlete, shirt included (black tee or crop, custom logo color).
// Own spreadsheet: "Signups" tab (one row per submission) + "Shirts" tab
// (one row per athlete, for the print order) + on-demand "Shirt Tally".
// ═══════════════════════════════════════════════════════════════

var SIM0913_EVENT = "Hyrox Simulation — September 13, 2026";
var SIM0913_PRICE = 25;
var SIM0913_VENMO = "kevin-schuetz-5";
var SIM0913_ZELLE = "kodaironview@gmail.com";
var SIM0913_ZP_URL = "https://kodaironview.sites.zenplanner.com/retail-product.cfm?ProductId=5F4A8380-AC28-409B-A664-E088BB910ED0";

// Heats every 10 min, 9:00–11:50 AM. 8 lanes per slot, TYPED by weight
// setup — one lane/spot per racing unit (single, doubles pair, or relay
// team). Per Kevin (8/12): 1 red lane (Men's Pro), 3 green lanes
// (Men's Open / Women's Pro / Mixed / men's doubles+relay), 3 blue lanes
// (Women's Open incl. doubles/relay), 1 yellow lane (Scaled).
var SIM0913_SLOTS = [
  "9:00", "9:10", "9:20", "9:30", "9:40", "9:50",
  "10:00", "10:10", "10:20", "10:30", "10:40", "10:50",
  "11:00", "11:10", "11:20", "11:30", "11:40", "11:50"
];
var SIM0913_GROUP_CAPS = { "Red": 1, "Green": 3, "Blue": 3, "Scaled": 1 };

// ── Overflow heats (Kevin 9/6 noon; 12:10 added 9/12). An ORDERED chain of
// extra heats after the base 9:00–11:50 block. Each opens — and latches via its
// own script property — once EITHER shared 3-lane division, Green (Men's
// Open/Women's Pro/Mixed) or Blue (Women's Open), is fully booked across the
// base heats PLUS every earlier overflow heat already open. So 12:00 opens when
// the morning's Green/Blue sell out; 12:10 opens only after 12:00 exists AND its
// Green/Blue lanes are gone too. Latched so a heat stays open even if a lane
// later frees (athletes may already hold it). Same 1/3/3/1 split as every heat.
var SIM0913_NOON_SLOT = "12:00";           // kept for back-compat references
var SIM0913_NOON_PROP = "SIM0913_NOON_OPEN";
var SIM0913_OVERFLOW = [
  { slot: "12:00", prop: "SIM0913_NOON_OPEN", label: "12:00 noon" },
  { slot: "12:10", prop: "SIM0913_1210_OPEN", label: "12:10 PM" }
];

// Which overflow slots are currently open, cascading in order. Auto-latches and
// emails when a slot's trigger fires. Never opens a later slot before an earlier.
function sim0913OpenOverflowSlots(allCounts) {
  var counts = allCounts || sim0913CountsAllHeats();
  var props = PropertiesService.getScriptProperties();
  var open = [];
  var active = SIM0913_SLOTS.slice();  // heats counted toward the fill check so far
  for (var i = 0; i < SIM0913_OVERFLOW.length; i++) {
    var ov = SIM0913_OVERFLOW[i];
    var isOpen = props.getProperty(ov.prop) === "1";
    if (!isOpen) {
      var g = 0, b = 0;
      active.forEach(function(s) { g += ((counts[s] || {}).Green) || 0; b += ((counts[s] || {}).Blue) || 0; });
      var full = [];
      if (g >= active.length * SIM0913_GROUP_CAPS.Green) full.push("Men's Open / Women's Pro / Mixed (Green)");
      if (b >= active.length * SIM0913_GROUP_CAPS.Blue)  full.push("Women's Open (Blue)");
      if (full.length) {
        props.setProperty(ov.prop, "1");
        isOpen = true;
        if (NOTIFY_EMAIL) {
          try {
            MailApp.sendEmail({
              to: NOTIFY_EMAIL,
              subject: "Hyrox Sim 9/13 — " + ov.label + " heat auto-opened",
              htmlBody: full.join(" and ") + " filled up across every open heat, so the signup site just published the extra <strong>" + ov.label + "</strong> heat (standard 1 Red / 3 Green / 3 Blue / 1 Scaled lanes). No action needed."
            });
          } catch (e) { /* the latch must not fail on a mail error */ }
        }
      }
    }
    if (isOpen) { open.push(ov.slot); active.push(ov.slot); }
    else break;  // gate later overflow heats on the earlier one being open
  }
  return open;
}

function sim0913NoonOpen(allCounts) {
  return sim0913OpenOverflowSlots(allCounts).indexOf(SIM0913_NOON_SLOT) !== -1;
}

function sim0913EffectiveSlots(allCounts) {
  return SIM0913_SLOTS.concat(sim0913OpenOverflowSlots(allCounts));
}

// A heat is valid to book/audit if it's a base slot or a currently-open overflow slot.
function sim0913IsValidHeat(slot, allCounts) {
  return SIM0913_SLOTS.indexOf(slot) !== -1 ||
         sim0913OpenOverflowSlots(allCounts).indexOf(slot) !== -1;
}

function sim0913HeatLabel(slot) {
  for (var i = 0; i < SIM0913_OVERFLOW.length; i++) {
    if (SIM0913_OVERFLOW[i].slot === slot) return SIM0913_OVERFLOW[i].label;
  }
  return slot + " AM";
}

// "Status" is appended LAST (added after the sheet had live data, so appending
// keeps every existing column in place). Blank = active; "CANCELLED ..." frees
// the heat lane and drops the shirt from the print order.
var SIM0913_SIGNUP_HEADERS = [
  "Timestamp", "Registrant", "Email", "Division", "Sex", "Weights", "Weights Setup",
  "Home Gym", "Heat", "Athletes", "Shirts", "Payment Method", "Total Due", "Paid?", "Comments", "Status"
];
// NOTE: "Email" is appended LAST on purpose — it was added after the sheet
// had real data, and appending keeps every existing column in place. Rows
// are written by header name, so the column can be dragged anywhere.
var SIM0913_SHIRT_HEADERS = [
  "Timestamp", "Athlete", "Garment", "Size", "Logo Color", "Registrant", "Division", "Payment Method", "Email", "Status"
];

var SIM0913_CANCELLED_RE = /^\s*cancel/i;

// Header-aligned sheet IO: rows are written/read by matching the header
// text in row 1, so Kevin can reorder/resize columns freely. Don't RENAME
// headers — matching is by name (a missing header falls back to the
// canonical column position for reads, and drops the value for writes).
function sim0913HeaderMap(sheet) {
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    var k = String(headers[i]).trim().toLowerCase();
    if (k && map[k] === undefined) map[k] = i;
  }
  return map;
}

function sim0913Col(map, name, fallback) {
  return map[name] === undefined ? fallback : map[name];
}

function sim0913AppendAligned(sheet, record) {
  var map = sim0913HeaderMap(sheet);
  var width = sheet.getLastColumn();
  var row = [];
  for (var i = 0; i < width; i++) row.push("");
  for (var key in record) {
    var idx = map[key];
    if (idx !== undefined && idx < width) row[idx] = record[key];
  }
  var target = sim0913NextRow(sheet, "timestamp");
  sheet.getRange(target, 1, 1, row.length).setValues([row]);
}

var SIM0913_COLORS = ["Gold", "Hot Pink", "Lime Green", "Bright Blue", "Lavender", "Red", "Orange", "Silver", "White"];


// DIAGNOSTIC (read-only): raw tail of the Signups tab + every Drive file whose
// name looks like this event's spreadsheet, to catch (a) rows written blank or
// into the wrong columns and (b) a duplicate spreadsheet created by the
// get-or-create fallback.
function sim0913Diag(n) {
  var ss = getOrCreateSim0913Spreadsheet();
  var sg = ss.getSheetByName("Signups");
  var last = sg.getLastRow();
  var take = Math.min(parseInt(n || "8", 10), 40);
  var startRow = Math.max(2, last - take + 1);
  var width = sg.getLastColumn();
  var headers = sg.getRange(1, 1, 1, width).getValues()[0].map(function(h) { return String(h); });
  var rows = [];
  if (last >= 2) {
    sg.getRange(startRow, 1, last - startRow + 1, width).getValues().forEach(function(r, i) {
      var obj = { row: startRow + i, blank: r.every(function(v) { return String(v).trim() === ""; }) };
      headers.forEach(function(h, ci) { if (h) obj[h] = String(r[ci]); });
      rows.push(obj);
    });
  }
  var files = [];
  try {
    var it = DriveApp.getFilesByName("Koda Hyrox Simulation Signups — Sept 13 2026");
    while (it.hasNext()) {
      var fl = it.next();
      files.push({ id: fl.getId(), name: fl.getName(), created: String(fl.getDateCreated()), updated: String(fl.getLastUpdated()), isCurrent: fl.getId() === ss.getId() });
    }
  } catch (e) { files.push({ error: String(e) }); }
  return { status: "ok", sheetId: ss.getId(), url: ss.getUrl(), headers: headers, lastRow: last, rows: rows, driveMatches: files };
}

// AUDIT (read-only): every integrity problem we can detect from the sheet.
// Missing rows from the old false-success bug leave NO trace, but their
// side effects (duplicates, orphans, over-capacity, stray rows) do.
function sim0913Audit() {
  var ss = getOrCreateSim0913Spreadsheet();
  var sg = ss.getSheetByName("Signups"), sh = ss.getSheetByName("Shirts");
  var gm = sim0913HeaderMap(sg), sm = sim0913HeaderMap(sh);
  var G = {
    reg: sim0913Col(gm,"registrant",1), email: sim0913Col(gm,"email",2), div: sim0913Col(gm,"division",3),
    sex: sim0913Col(gm,"sex",4), wts: sim0913Col(gm,"weights",5), setup: sim0913Col(gm,"weights setup",6),
    heat: sim0913Col(gm,"heat",8), n: sim0913Col(gm,"athletes",9), status: sim0913Col(gm,"status",-1),
    ts: sim0913Col(gm,"timestamp",0)
  };
  var S = {
    ath: sim0913Col(sm,"athlete",1), gar: sim0913Col(sm,"garment",2), size: sim0913Col(sm,"size",3),
    col: sim0913Col(sm,"logo color",4), reg: sim0913Col(sm,"registrant",5), status: sim0913Col(sm,"status",-1)
  };
  var issues = [];
  var add = function(sev,type,msg,where){ issues.push({severity:sev,type:type,detail:msg,where:where}); };

  var gRows = sg.getDataRange().getValues().slice(1);
  var sRows = sh.getDataRange().getValues().slice(1);
  var isCancelled = function(v){ return SIM0913_CANCELLED_RE.test(String(v||"")); };
  var isTest = function(v){ return /test|canary|deleteme/i.test(String(v||"")); };

  // ---- Signups integrity ----
  var byName = {}, byEmail = {}, active = 0, capUse = {};
  gRows.forEach(function(r,i){
    var row=i+2, reg=String(r[G.reg]||"").trim();
    var blank = r.every(function(v){return String(v).trim()==="";});
    if (blank) { add("warn","blank-row","Signups row is entirely empty",row); return; }
    if (isTest(reg)) return;
    if (G.status>=0 && isCancelled(r[G.status])) return;
    active++;
    if (!reg) add("error","missing-name","Signups row has no registrant name",row);
    var em=String(r[G.email]||"").trim();
    if (!em) add("error","missing-email","No email — this athlete cannot be contacted: "+reg,row);
    else { var ek=em.toLowerCase(); (byEmail[ek]=byEmail[ek]||[]).push(row); }
    if (reg) { var nk=reg.toLowerCase(); (byName[nk]=byName[nk]||[]).push(row); }
    var heat = sim0913NormalizeHeat(r[G.heat]);
    if (!sim0913IsValidHeat(heat)) add("error","bad-heat","Heat \""+heat+"\" is not a valid slot: "+reg,row);
    var grp = String(r[G.setup]||"").split(" ")[0];
    if (!SIM0913_GROUP_CAPS[grp]) add("error","bad-group","No/unknown weight setup ("+grp+"): "+reg,row);
    else { var k=heat+"|"+grp; (capUse[k]=capUse[k]||[]).push(reg); }
    // athlete count vs shirt rows
    var declared = parseInt(r[G.n],10);
    if (!isNaN(declared)) {
      var actual=0;
      sRows.forEach(function(sr){ if(String(sr[S.reg]||"").trim().toLowerCase()===reg.toLowerCase() && !(S.status>=0 && isCancelled(sr[S.status]))) actual++; });
      if (actual!==declared) add("error","shirt-count","Says "+declared+" athlete(s) but has "+actual+" shirt row(s): "+reg,row);
    }
  });
  Object.keys(byName).forEach(function(k){ if(byName[k].length>1) add("warn","duplicate-name","Same registrant on rows "+byName[k].join(", ")+" — possible double submit",byName[k][0]); });
  Object.keys(byEmail).forEach(function(k){ if(byEmail[k].length>1) add("warn","duplicate-email","Same email ("+k+") on rows "+byEmail[k].join(", "),byEmail[k][0]); });
  Object.keys(capUse).forEach(function(k){
    var p=k.split("|"), cap=SIM0913_GROUP_CAPS[p[1]];
    if (capUse[k].length>cap) add("error","over-capacity",p[0]+" "+p[1]+" lanes: "+capUse[k].length+" booked but only "+cap+" exist ("+capUse[k].join(", ")+")",0);
  });

  // ---- Shirts integrity ----
  var regSet = {};
  gRows.forEach(function(r){ var k=String(r[G.reg]||"").trim().toLowerCase(); if(k) regSet[k]=true; });
  var VALID_SIZES = {"XS":1,"S":1,"M":1,"L":1,"XL":1,"2XL":1,"3XL":1};
  var shirtCount=0, maxRow=1;
  sRows.forEach(function(r,i){
    var row=i+2;
    var blank = r.every(function(v){return String(v).trim()==="";});
    if (blank) return;
    maxRow=row;
    var ath=String(r[S.ath]||"").trim(), reg=String(r[S.reg]||"").trim();
    if (isTest(ath)||isTest(reg)) { add("info","test-row","Leftover test row: "+(ath||reg),row); return; }
    if (S.status>=0 && isCancelled(r[S.status])) return;
    shirtCount++;
    if (!regSet[reg.toLowerCase()]) add("error","orphan-shirt","Shirt row has no matching registration ("+reg+" / "+ath+")",row);
    var sz=String(r[S.size]||"").trim();
    if (!VALID_SIZES[sz]) add("error","bad-size","Unrecognised size \""+sz+"\": "+ath,row);
    var co=String(r[S.col]||"").trim();
    if (SIM0913_COLORS.indexOf(co)===-1) add("error","bad-color","Unrecognised logo color \""+co+"\": "+ath,row);
    var ga=String(r[S.gar]||"").trim();
    if (ga!=="Unisex Tee" && ga!=="Cropped Tee") add("error","bad-garment","Unrecognised garment \""+ga+"\": "+ath,row);
  });
  if (sh.getLastRow() > maxRow + 1) add("warn","stray-content","Shirts tab reports "+sh.getLastRow()+" rows but the last real data is row "+maxRow+" — stray content/formatting below pushes new rows down",maxRow+1);

  return { status:"ok", activeRegistrations:active, activeShirts:shirtCount,
           signupsLastRow:sg.getLastRow(), shirtsLastRow:sh.getLastRow(),
           issueCount:issues.length, issues:issues };
}

// Lane map: for every heat, who occupies each lane type. Powers the visual
// heat/lane chart. Cancelled and test rows are excluded.
function sim0913Grid() {
  var ss = getOrCreateSim0913Spreadsheet();
  var sg = ss.getSheetByName("Signups");
  var m = sim0913HeaderMap(sg);
  var C = { reg: sim0913Col(m,"registrant",1), div: sim0913Col(m,"division",3), sex: sim0913Col(m,"sex",4),
            wts: sim0913Col(m,"weights",5), setup: sim0913Col(m,"weights setup",6), heat: sim0913Col(m,"heat",8),
            n: sim0913Col(m,"athletes",9), shirts: sim0913Col(m,"shirts",10),
            status: sim0913Col(m,"status",-1), paid: sim0913Col(m,"paid?",13) };
  var grid = {};
  var gridSlots = sim0913EffectiveSlots();
  gridSlots.forEach(function(t){ grid[t] = { Red:[], Green:[], Blue:[], Scaled:[] }; });
  var totalAthletes = 0, totalCrews = 0;
  sg.getDataRange().getValues().slice(1).forEach(function(r){
    var reg = String(r[C.reg]||"").trim();
    if (!reg || /test|canary|deleteme/i.test(reg)) return;
    if (C.status>=0 && SIM0913_CANCELLED_RE.test(String(r[C.status]||""))) return;
    var heat = sim0913NormalizeHeat(r[C.heat]);
    var grp = String(r[C.setup]||"").split(" ")[0];
    if (!grid[heat] || !grid[heat][grp]) return;
    var n = parseInt(r[C.n],10); if (isNaN(n)) n = 1;
    // Every athlete's name in the crew, from the "Shirts" summary column
    // ("Name — Garment / Size / Color" per line). Registrant first.
    var names = String(r[C.shirts]||"").split(/\r?\n/).map(function(ln){
      return ln.split("—")[0].split(" - ")[0].trim();
    }).filter(function(x){ return x; });
    if (!names.length) names = [reg];
    grid[heat][grp].push({ name: reg, names: names,
                           division: String(r[C.div]||""), sex: String(r[C.sex]||""),
                           weights: String(r[C.wts]||""), athletes: n,
                           paid: String(r[C.paid]||"").trim() !== "" });
    totalAthletes += n; totalCrews++;
  });
  return { status:"ok", slots: gridSlots, caps: SIM0913_GROUP_CAPS, grid: grid,
           totalCrews: totalCrews, totalAthletes: totalAthletes };
}

// The row a new record should occupy: one past the last row that actually has
// data in its key column. appendRow() targets one past the last row with ANY
// content, so a single stray cell far below the data silently pushes every new
// row hundreds of rows down (this happened on the Shirts tab, row 1001).
function sim0913NextRow(sheet, keyName) {
  var map = sim0913HeaderMap(sheet);
  var idx = sim0913Col(map, keyName, 0);
  var last = sheet.getLastRow();
  if (last < 2) return 2;
  var col = sheet.getRange(2, idx + 1, last - 1, 1).getValues();
  for (var i = col.length - 1; i >= 0; i--) {
    if (String(col[i][0]).trim() !== "") return i + 3;
  }
  return 2;
}

// Read-only: where the real data actually sits on the Shirts tab.
function sim0913ShirtsLayout() {
  var ss = getOrCreateSim0913Spreadsheet();
  var sh = ss.getSheetByName("Shirts");
  var last = sh.getLastRow(), width = sh.getLastColumn();
  var vals = last >= 2 ? sh.getRange(2, 1, last - 1, width).getValues() : [];
  var map = sim0913HeaderMap(sh);
  var iAth = sim0913Col(map, "athlete", 1);
  var runs = [], cur = null, realRows = 0;
  vals.forEach(function(r, i) {
    var row = i + 2;
    var any = r.some(function(v){ return String(v).trim() !== ""; });
    var real = String(r[iAth]||"").trim() !== "";
    if (real) realRows++;
    if (any) { if (!cur) { cur = { from: row, to: row, real: 0 }; runs.push(cur); } cur.to = row; if (real) cur.real++; }
    else cur = null;
  });
  return { status:"ok", lastRow:last, maxRows:sh.getMaxRows(), realRows:realRows,
           nextAppendRow: sim0913NextRow(sh, "timestamp"), runs: runs };
}

// Pull stray rows back up so the tab reads as one contiguous block, then clear
// whatever junk sat below. Content-only: no rows are deleted.
function sim0913CompactShirts() {
  var ss = getOrCreateSim0913Spreadsheet();
  var sh = ss.getSheetByName("Shirts");
  var last = sh.getLastRow(), width = sh.getLastColumn();
  if (last < 2) return { status:"ok", moved:0 };
  var map = sim0913HeaderMap(sh);
  var iAth = sim0913Col(map, "athlete", 1);
  var vals = sh.getRange(2, 1, last - 1, width).getValues();
  var keep = [], discarded = 0;
  vals.forEach(function(r) {
    if (String(r[iAth]||"").trim() !== "") keep.push(r);
    else if (r.some(function(v){ return String(v).trim() !== ""; })) discarded++;
  });
  sh.getRange(2, 1, last - 1, width).clearContent();
  if (keep.length) sh.getRange(2, 1, keep.length, width).setValues(keep);
  SpreadsheetApp.flush();
  return { status:"ok", rowsKept: keep.length, junkRowsCleared: discarded,
           lastRowBefore: last, lastRowAfter: sh.getLastRow(),
           nextAppendRow: sim0913NextRow(sh, "timestamp") };
}

// Read-only: everyone signed up for Sept 13 — registrants (Signups) plus every
// athlete row (Shirts). Used to avoid re-inviting people who already signed up.
// Teammates added before the Shirts "Email" column existed have no email, so
// names are returned too and should be matched as a fallback.
function sim0913Roster() {
  var ss = getOrCreateSim0913Spreadsheet();
  var out = { status: "ok", registrants: [], athletes: [] };

  var sg = ss.getSheetByName("Signups");
  var gmap = sim0913HeaderMap(sg);
  var iReg = sim0913Col(gmap, "registrant", 1), iEmail = sim0913Col(gmap, "email", 2);
  var iGStatus = sim0913Col(gmap, "status", -1);
  sg.getDataRange().getValues().slice(1).forEach(function(r) {
    var name = String(r[iReg] || "").trim();
    if (!name || /test/i.test(name)) return;
    if (iGStatus >= 0 && SIM0913_CANCELLED_RE.test(String(r[iGStatus] || ""))) return;
    out.registrants.push({ name: name, email: String(r[iEmail] || "").trim() });
  });

  var sh = ss.getSheetByName("Shirts");
  var smap = sim0913HeaderMap(sh);
  var iAth = sim0913Col(smap, "athlete", 1), iAEmail = sim0913Col(smap, "email", 8);
  var iSReg = sim0913Col(smap, "registrant", 5);
  var iSStatus = sim0913Col(smap, "status", -1);
  sh.getDataRange().getValues().slice(1).forEach(function(r) {
    var name = String(r[iAth] || "").trim();
    var reg = String(r[iSReg] || "").trim();
    if (!name || /test|canary|deleteme/i.test(name) || /test|canary|deleteme/i.test(reg)) return;
    if (iSStatus >= 0 && SIM0913_CANCELLED_RE.test(String(r[iSStatus] || ""))) return;
    out.athletes.push({ name: name, email: String(r[iAEmail] || "").trim() });
  });
  return out;
}

// Cancel a registration WITHOUT deleting it: stamps Status="CANCELLED <date>"
// on the Signups row and on every Shirts row for that registration. The lane is
// immediately released back to the heat picker and the shirts drop off the
// print order, but the payment trail (Payment Method / Paid?) survives so a
// refund can be tracked. Reversible — clear the Status cells to restore.
function sim0913Cancel(q, note) {
  var needle = String(q || "").trim().toLowerCase();
  if (!needle) return { status: "error", error: "no registrant" };
  var ss = getOrCreateSim0913Spreadsheet();
  var stamp = "CANCELLED " + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd") +
              (note ? " — " + note : "");
  var changed = { status: "ok", stamp: stamp, signups: [], shirts: [], freedLane: null };

  var sg = ss.getSheetByName("Signups");
  var gmap = sim0913HeaderMap(sg);
  var iReg = sim0913Col(gmap, "registrant", 1), iStatus = sim0913Col(gmap, "status", -1);
  var iHeat = sim0913Col(gmap, "heat", 8), iSetup = sim0913Col(gmap, "weights setup", 6);
  if (iStatus < 0) return { status: "error", error: "Signups tab has no Status column — run ?action=sim0913FixHeaders first" };
  sg.getDataRange().getValues().slice(1).forEach(function(r, i) {
    var reg = String(r[iReg] || "");
    if (reg.trim().toLowerCase().indexOf(needle) === -1) return;
    if (SIM0913_CANCELLED_RE.test(String(r[iStatus] || ""))) {
      changed.signups.push({ row: i + 2, registrant: reg, alreadyCancelled: true });
      return;
    }
    sg.getRange(i + 2, iStatus + 1).setValue(stamp);
    changed.signups.push({ row: i + 2, registrant: reg, heat: sim0913NormalizeHeat(r[iHeat]) });
    changed.freedLane = { heat: sim0913NormalizeHeat(r[iHeat]), group: String(r[iSetup] || "").split(" ")[0] };
  });

  var sh = ss.getSheetByName("Shirts");
  var smap = sim0913HeaderMap(sh);
  var iAth = sim0913Col(smap, "athlete", 1), iSReg = sim0913Col(smap, "registrant", 5);
  var iSStatus = sim0913Col(smap, "status", -1);
  if (iSStatus < 0) return { status: "error", error: "Shirts tab has no Status column — run ?action=sim0913FixHeaders first" };
  sh.getDataRange().getValues().slice(1).forEach(function(r, i) {
    var reg = String(r[iSReg] || ""), ath = String(r[iAth] || "");
    // cancel the whole registration: every shirt row filed under that registrant
    if (reg.trim().toLowerCase().indexOf(needle) === -1) return;
    if (SIM0913_CANCELLED_RE.test(String(r[iSStatus] || ""))) return;
    sh.getRange(i + 2, iSStatus + 1).setValue(stamp);
    changed.shirts.push({ row: i + 2, athlete: ath });
  });

  if (!changed.signups.length && !changed.shirts.length) changed.status = "not_found";
  return changed;
}

// Change one athlete's garment and/or size, keeping the Shirts row and the
// Signups "Shirts" summary line in lockstep (same contract as sim0913SetColor).
// Size is validated against the target garment's size range.
var SIM0913_GARMENT_SIZES = {
  "Unisex Tee":  ["XS","S","M","L","XL","2XL","3XL"],
  "Cropped Tee": ["S","M","L","XL","2XL"]
};

function sim0913SetShirt(q, garment, size) {
  var needle = String(q || "").trim().toLowerCase();
  if (!needle) return { status: "error", error: "no athlete" };

  var gIn = String(garment || "").trim().toLowerCase();
  var newGarment = null;
  if (gIn === "unisex tee" || gIn === "tee" || gIn === "unisex") newGarment = "Unisex Tee";
  if (gIn === "cropped tee" || gIn === "crop" || gIn === "cropped") newGarment = "Cropped Tee";
  if (garment && !newGarment) return { status: "error", error: "unknown garment: " + garment };

  var newSize = String(size || "").trim().toUpperCase() || null;

  var ss = getOrCreateSim0913Spreadsheet();
  var changes = [];

  var sh = ss.getSheetByName("Shirts");
  var smap = sim0913HeaderMap(sh);
  var iAth = sim0913Col(smap, "athlete", 1), iGar = sim0913Col(smap, "garment", 2), iSize = sim0913Col(smap, "size", 3);
  var iStatus = sim0913Col(smap, "status", -1);
  var targetGarment = null, targetSize = null;
  sh.getDataRange().getValues().slice(1).forEach(function(r, i) {
    var athlete = String(r[iAth] || "");
    if (athlete.trim().toLowerCase().indexOf(needle) === -1) return;
    if (iStatus >= 0 && SIM0913_CANCELLED_RE.test(String(r[iStatus] || ""))) return;
    var curGarment = String(r[iGar] || ""), curSize = String(r[iSize] || "");
    targetGarment = newGarment || curGarment;
    targetSize = newSize || curSize;
    var sizes = SIM0913_GARMENT_SIZES[targetGarment] || [];
    if (sizes.indexOf(targetSize) === -1) {
      changes.push({ tab: "Shirts", row: i + 2, athlete: athlete, error: "size " + targetSize + " not available for " + targetGarment + " (" + sizes.join("/") + ")" });
      return;
    }
    if (curGarment !== targetGarment) { sh.getRange(i + 2, iGar + 1).setValue(targetGarment); changes.push({ tab: "Shirts", row: i + 2, athlete: athlete, field: "Garment", before: curGarment, after: targetGarment }); }
    if (curSize !== targetSize) { sh.getRange(i + 2, iSize + 1).setValue(targetSize); changes.push({ tab: "Shirts", row: i + 2, athlete: athlete, field: "Size", before: curSize, after: targetSize }); }
    if (curGarment === targetGarment && curSize === targetSize) changes.push({ tab: "Shirts", row: i + 2, athlete: athlete, noop: true });
  });

  if (targetGarment) {
    var sg = ss.getSheetByName("Signups");
    var gmap = sim0913HeaderMap(sg);
    var iShirts = sim0913Col(gmap, "shirts", 10);
    sg.getDataRange().getValues().slice(1).forEach(function(r, i) {
      var text = String(r[iShirts] || "");
      if (!text) return;
      var touched = false;
      var next = text.split(String.fromCharCode(10)).map(function(line) {
        var sep = line.indexOf(" — ");
        if (sep === -1) return line;
        var name = line.slice(0, sep);
        if (name.trim().toLowerCase().indexOf(needle) === -1) return line;
        var parts = line.slice(sep + 3).split(" / ");
        if (parts.length < 3) return line;
        var rebuilt = name + " — " + targetGarment + " / " + targetSize + " / " + parts.slice(2).join(" / ");
        if (rebuilt !== line) { touched = true; changes.push({ tab: "Signups", row: i + 2, field: "Shirts line", before: line, after: rebuilt }); }
        return rebuilt;
      }).join(String.fromCharCode(10));
      if (touched) sg.getRange(i + 2, iShirts + 1).setValue(next);
    });
  }

  return { status: changes.length ? "ok" : "not_found", changes: changes };
}

// Read-only: find an athlete across both tabs (matches on the Shirts tab's
// "Athlete" and the Signups tab's "Registrant"), returning sheet row numbers
// and current values so a change can be reviewed before it is made.
function sim0913FindAthlete(q) {
  var needle = String(q || "").trim().toLowerCase();
  if (!needle) return { status: "error", error: "no query" };
  var ss = getOrCreateSim0913Spreadsheet();
  var out = { status: "ok", query: q, shirts: [], signups: [] };

  var sh = ss.getSheetByName("Shirts");
  var smap = sim0913HeaderMap(sh);
  var sHead = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  sh.getDataRange().getValues().slice(1).forEach(function(r, i) {
    var athlete = String(r[sim0913Col(smap, "athlete", 1)] || "");
    if (athlete.trim().toLowerCase().indexOf(needle) === -1) return;
    var o = { row: i + 2 };
    sHead.forEach(function(h, ci) { if (h) o[h] = String(r[ci]); });
    out.shirts.push(o);
  });

  var sg = ss.getSheetByName("Signups");
  var gmap = sim0913HeaderMap(sg);
  var iReg = sim0913Col(gmap, "registrant", 1), iShirts = sim0913Col(gmap, "shirts", 10);
  sg.getDataRange().getValues().slice(1).forEach(function(r, i) {
    var reg = String(r[iReg] || ""), shirts = String(r[iShirts] || "");
    if (reg.trim().toLowerCase().indexOf(needle) === -1 && shirts.toLowerCase().indexOf(needle) === -1) return;
    out.signups.push({
      row: i + 2, registrant: reg, division: String(r[sim0913Col(gmap, "division", 3)] || ""),
      heat: sim0913NormalizeHeat(r[sim0913Col(gmap, "heat", 8)]), shirts: shirts,
    });
  });
  return out;
}

// Change one athlete's logo color on the Shirts tab AND inside the matching
// "Shirts" summary line on their Signups row, so the print order and the
// registration row can never disagree. Returns exactly what it changed.
function sim0913SetColor(q, color) {
  var needle = String(q || "").trim().toLowerCase();
  var newColor = null;
  for (var i = 0; i < SIM0913_COLORS.length; i++) {
    if (SIM0913_COLORS[i].toLowerCase() === String(color || "").trim().toLowerCase()) newColor = SIM0913_COLORS[i];
  }
  if (!needle) return { status: "error", error: "no athlete" };
  if (!newColor) return { status: "error", error: "unknown color: " + color + " (valid: " + SIM0913_COLORS.join(", ") + ")" };

  var ss = getOrCreateSim0913Spreadsheet();
  var changes = [];

  var sh = ss.getSheetByName("Shirts");
  var smap = sim0913HeaderMap(sh);
  var iAth = sim0913Col(smap, "athlete", 1), iCol = sim0913Col(smap, "logo color", 4);
  sh.getDataRange().getValues().slice(1).forEach(function(r, i) {
    var athlete = String(r[iAth] || "");
    if (athlete.trim().toLowerCase().indexOf(needle) === -1) return;
    var before = String(r[iCol] || "");
    if (before === newColor) { changes.push({ tab: "Shirts", row: i + 2, athlete: athlete, before: before, after: newColor, noop: true }); return; }
    sh.getRange(i + 2, iCol + 1).setValue(newColor);
    changes.push({ tab: "Shirts", row: i + 2, athlete: athlete, before: before, after: newColor });
  });

  var sg = ss.getSheetByName("Signups");
  var gmap = sim0913HeaderMap(sg);
  var iShirts = sim0913Col(gmap, "shirts", 10);
  sg.getDataRange().getValues().slice(1).forEach(function(r, i) {
    var text = String(r[iShirts] || "");
    if (!text) return;
    var lines = text.split("\n");
    var touched = false;
    var next = lines.map(function(line) {
      // "<name> — <garment> / <size> / <color>"
      if (line.trim().toLowerCase().indexOf(needle) !== 0 &&
          line.split("—")[0].trim().toLowerCase().indexOf(needle) === -1) return line;
      var parts = line.split(" / ");
      if (parts.length < 3) return line;
      var before = parts[parts.length - 1];
      if (before.trim() === newColor) return line;
      parts[parts.length - 1] = newColor;
      touched = true;
      changes.push({ tab: "Signups", row: i + 2, field: "Shirts line", before: line, after: parts.join(" / ") });
      return parts.join(" / ");
    });
    if (touched) sg.getRange(i + 2, iShirts + 1).setValue(next.join("\n"));
  });

  return { status: changes.length ? "ok" : "not_found", color: newColor, changes: changes };
}

// Which weight setup a category uses (per the "Heat Times" tab legend):
// Blue 225/172/35/22/9·9ft, Green 335/227/53/44/14·10ft, Red 445/337/70/66/20·10ft.
function sim0913WeightSetup(sex, weights) {
  if (weights === "Scaled") return "Scaled — custom loads";
  if (weights === "Pro") {
    return sex === "Men's" ? "Red — 445/337/70/66/20 · 10ft" : "Green — 335/227/53/44/14 · 10ft";
  }
  // Open
  if (sex === "Women's") return "Blue — 225/172/35/22/9 · 9ft";
  return "Green — 335/227/53/44/14 · 10ft" + (sex === "Mixed" ? " (mixed*)" : "");
}

// Count non-test signups per heat slot, split by lane type (weight group).
// Group is the first word of the stored "Weights Setup" column.
// NOTE: Sheets coerces "11:50" to a time-of-day Date when the row is
// appended, so normalize whatever comes back into "H:MM".
function sim0913NormalizeHeat(v) {
  if (v instanceof Date) {
    return v.getHours() + ":" + ("0" + v.getMinutes()).slice(-2);
  }
  return String(v || "").trim();
}

// One pass over Signups: a bucket for every base slot (zeros included) plus
// any other heat that appears in the data (e.g. "12:00" once the noon heat
// exists). Callers decide which heats to expose.
function sim0913CountsAllHeats() {
  var ss = getOrCreateSim0913Spreadsheet();
  var sheet = ss.getSheetByName("Signups");
  var rows = sheet.getDataRange().getValues().slice(1);
  var counts = {};
  SIM0913_SLOTS.forEach(function(s) {
    counts[s] = { "Red": 0, "Green": 0, "Blue": 0, "Scaled": 0 };
  });
  var map = sim0913HeaderMap(sheet);
  var iReg = sim0913Col(map, "registrant", 1);
  var iSetup = sim0913Col(map, "weights setup", 6);
  var iHeat = sim0913Col(map, "heat", 8);
  var iStatus = sim0913Col(map, "status", -1);
  rows.forEach(function(r) {
    var registrant = String(r[iReg] || "");
    var heat = sim0913NormalizeHeat(r[iHeat]);
    var g = String(r[iSetup] || "").split(" ")[0]; // "Red"/"Green"/"Blue"/"Scaled"
    if (!heat || /test/i.test(registrant)) return;
    if (iStatus >= 0 && SIM0913_CANCELLED_RE.test(String(r[iStatus] || ""))) return; // lane is free again
    if (!SIM0913_GROUP_CAPS.hasOwnProperty(g)) return;
    if (!counts.hasOwnProperty(heat)) counts[heat] = { "Red": 0, "Green": 0, "Blue": 0, "Scaled": 0 };
    counts[heat][g]++;
  });
  return counts;
}

function sim0913SlotCounts() {
  var all = sim0913CountsAllHeats();
  var slots = sim0913EffectiveSlots(all);
  var counts = {};
  slots.forEach(function(s) {
    counts[s] = all[s] || { "Red": 0, "Green": 0, "Blue": 0, "Scaled": 0 };
  });
  return { status: "ok", caps: SIM0913_GROUP_CAPS, counts: counts };
}

function getOrCreateSim0913Spreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("SIM0913_SHEET_ID");
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* fall through and create */ }
  }

  var ss = SpreadsheetApp.create("Koda Hyrox Simulation Signups — Sept 13 2026");
  var styleHeader = function(sheet, headers, widths) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground("#0a0a0a")
      .setFontColor("#d6ff3f");
    sheet.setFrozenRows(1);
    for (var i = 0; i < widths.length; i++) if (widths[i]) sheet.setColumnWidth(i + 1, widths[i]);
  };

  var signups = ss.getActiveSheet();
  signups.setName("Signups");
  styleHeader(signups, SIM0913_SIGNUP_HEADERS,
    [170, 170, 220, 130, 90, 90, 220, 180, 70, 80, 340, 130, 90, 70, 300]);

  var shirts = ss.insertSheet("Shirts");
  styleHeader(shirts, SIM0913_SHIRT_HEADERS,
    [170, 170, 120, 70, 110, 170, 130, 130]);

  props.setProperty("SIM0913_SHEET_ID", ss.getId());
  return ss;
}

function sim0913PayHtml(data) {
  var n = (data.athletes || []).length || 1;
  var total = n * SIM0913_PRICE;
  var note = "Hyrox Sim 9/13 — " + (data.firstName || "") + " " + (data.lastName || "");
  var each = n > 1
    ? "<p><strong>Each athlete pays their own $" + SIM0913_PRICE + "</strong> (total for your crew: $" + total + "). Please share these instructions with your teammates.</p>"
    : "";
  var btn = function(href, label) {
    return "<p><a href='" + href + "' style='display:inline-block;background:#d6ff3f;color:#000;font-weight:bold;" +
      "padding:10px 22px;border-radius:8px;text-decoration:none'>" + label + "</a></p>";
  };
  if (data.payment === "Venmo") {
    var venmoUrl = "https://venmo.com/?txn=pay&audience=public&recipients=" + SIM0913_VENMO +
      "&amount=" + SIM0913_PRICE + "&note=" + encodeURIComponent(note);
    return "<h3 style='margin-bottom:4px'>Pay with Venmo</h3>" + each +
      "<p>Send <strong>$" + SIM0913_PRICE + "</strong> to <strong>@" + SIM0913_VENMO + "</strong> with the note \"" + escapeHtml(note) + "\"" +
      (n > 1 ? " (teammates: use your own name in the note)" : "") + ".</p>" +
      btn(venmoUrl, "Pay $" + SIM0913_PRICE + " on Venmo →");
  }
  if (data.payment === "Zelle") {
    return "<h3 style='margin-bottom:4px'>Pay with Zelle</h3>" + each +
      "<p>Send <strong>$" + SIM0913_PRICE + "</strong> via Zelle to <strong>" + SIM0913_ZELLE + "</strong> with \"" + escapeHtml(note) + "\" in the memo" +
      (n > 1 ? " (teammates: use your own name)" : "") + ".</p>";
  }
  return "<h3 style='margin-bottom:4px'>Pay by Credit Card</h3>" + each +
    "<p>Complete a <strong>$" + SIM0913_PRICE + "</strong> checkout on our secure Zen Planner store" +
    (n > 1 ? " — one checkout per athlete" : "") + ".</p>" +
    btn(SIM0913_ZP_URL, "Pay $" + SIM0913_PRICE + " on Zen Planner →");
}

function handleSim0913(data) {
  var ss = getOrCreateSim0913Spreadsheet();
  var signups = ss.getSheetByName("Signups");
  var shirts = ss.getSheetByName("Shirts");

  var now = new Date();
  var registrant = (data.firstName || "") + " " + (data.lastName || "");
  var athletes = data.athletes || [];
  var total = athletes.length * SIM0913_PRICE;
  var shirtLines = athletes.map(function(a) {
    return a.name + " — " + a.garment + " / " + a.size + " / " + a.color;
  }).join("\n");
  var setup = sim0913WeightSetup(data.sex || "", data.weights || "");

  // Heat slot: validate + enforce the per-lane-type cap under a lock so
  // two simultaneous signups can't both grab the last lane of a type.
  var slot = String(data.heat || "").trim();
  if (!sim0913IsValidHeat(slot)) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", error: "Invalid heat time." }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var group = setup.split(" ")[0]; // "Red"/"Green"/"Blue"/"Scaled"
  var groupCap = SIM0913_GROUP_CAPS[group] || 0;
  if (!groupCap) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", error: "Invalid category/weights combination." }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var savedRow = 0;
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var taken = (sim0913SlotCounts().counts[slot] || {})[group] || 0;
    if (taken >= groupCap) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: "slot_full", slot: slot, group: group }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    savedRow = signups.getLastRow() + 1;
    sim0913AppendAligned(signups, {
      "timestamp": now,
      "registrant": registrant,
      "email": data.email || "",
      "division": data.division || "",
      "sex": data.sex || "",
      "weights": data.weights || "",
      "weights setup": setup,
      "home gym": data.homeGym || "",
      "heat": slot,
      "athletes": athletes.length,
      "shirts": shirtLines,
      "payment method": data.payment || "",
      "total due": "$" + total,
      "comments": data.comments || ""
    });
  } finally {
    lock.releaseLock();
  }

  athletes.forEach(function(a, ai) {
    sim0913AppendAligned(shirts, {
      "timestamp": now,
      "athlete": a.name || "",
      "garment": a.garment || "",
      "size": a.size || "",
      "logo color": a.color || "",
      "registrant": registrant,
      "division": data.division || "",
      "payment method": data.payment || "",
      "email": (ai === 0 ? (data.email || "") : (a.email || ""))
    });
  });

  // Teammates who supplied an email get copied on the confirmation, so the
  // whole crew has the heat time and payment instructions.
  var teammateEmails = athletes.slice(1)
    .map(function(a) { return String(a.email || "").trim(); })
    .filter(function(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); });

  // Inline mockup images (rendered client-side, base64 JPEG)
  var inlineImages = {};
  var mockupHtml = "";
  (data.mockups || []).slice(0, 4).forEach(function(m, i) {
    try {
      var key = "mock" + i;
      inlineImages[key] = Utilities.newBlob(Utilities.base64Decode(m.jpeg), "image/jpeg", key + ".jpg");
      mockupHtml += "<div style='display:inline-block;margin:6px;text-align:center'>" +
        "<img src='cid:" + key + "' width='240' style='border-radius:8px;border:1px solid #ddd'><br>" +
        "<span style='font-size:12px;color:#555'>" + escapeHtml(m.name || "") + "</span></div>";
    } catch (imgErr) { /* skip bad image */ }
  });

  var detailsTable =
    "<table style='border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px'>" +
    row("Event", SIM0913_EVENT) +
    row("Heat Time", sim0913HeatLabel(slot)) +
    row("Division", (data.sex ? data.sex + " " : "") + (data.division || "")) +
    row("Weights", (data.weights || "") + " (" + setup + ")") +
    row("Home Gym", data.homeGym || "") +
    row("Payment", (data.payment || "") + " — $" + total + (athletes.length > 1 ? " ($" + SIM0913_PRICE + " each)" : "")) +
    athletes.map(function(a, i) {
      var mail = i === 0 ? (data.email || "") : (a.email || "");
      return row("Athlete " + (i + 1), a.name + " · " + a.garment + " · " + a.size + " · " + a.color + " logo" +
        (mail ? " · " + mail : ""));
    }).join("") +
    (data.comments ? row("Comments", data.comments) : "") +
    "</table>";

  // Confirmation to the registrant
  if (data.email) {
    try {
      var mailOpts = {
        to: data.email,
        replyTo: NOTIFY_EMAIL,
        subject: "You're in! " + SIM0913_EVENT + " — Koda CrossFit Iron View",
        htmlBody:
          "<div style='font-family:Arial,sans-serif;max-width:600px'>" +
          "<h2 style='margin-bottom:4px'>You're in, " + escapeHtml(data.firstName || "") + "!</h2>" +
          "<p>You're signed up for the <strong>" + SIM0913_EVENT + "</strong> at Koda CrossFit Iron View, " +
          "740 S Pierce Ave, Louisville, CO. <strong>Your heat goes off at " + sim0913HeatLabel(slot) + "</strong> — " +
          "plan to arrive early to check in and warm up.</p>" +
          (teammateEmails.length
            ? "<p style='color:#555'>" + (teammateEmails.length === 1 ? "Your teammate is" : "Your teammates are") +
              " copied on this email, so everyone has the heat time and payment details.</p>"
            : "") +
          "<div style='background:#f6f6f6;border-radius:10px;padding:14px 16px;margin:14px 0'>" + sim0913PayHtml(data) + "</div>" +
          detailsTable +
          (mockupHtml ? "<h3 style='margin-top:18px'>Your shirts</h3>" + mockupHtml : "") +
          "<p style='color:#777;font-size:13px;margin-top:18px'>Questions? Just reply to this email.</p>" +
          "</div>",
        inlineImages: inlineImages
      };
      if (teammateEmails.length) mailOpts.cc = teammateEmails.join(",");
      MailApp.sendEmail(mailOpts);
    } catch (mailErr) {
      Logger.log("Sim0913 confirmation email failed: " + mailErr);
    }
  }

  // Notify the gym
  if (NOTIFY_EMAIL) {
    try {
      MailApp.sendEmail({
        to: NOTIFY_EMAIL,
        subject: "New Hyrox Sim 9/13 signup — " + registrant + " (" + sim0913HeatLabel(slot) + ", " +
                 (data.sex ? data.sex + " " : "") + (data.division || "") + ", " +
                 athletes.length + (athletes.length === 1 ? " shirt" : " shirts") + ", " + (data.payment || "") + ")",
        htmlBody:
          "<h3>New signup for " + SIM0913_EVENT + "</h3>" +
          "<table style='border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px'>" +
          row("Registrant", registrant) +
          row("Email", data.email || "") +
          "</table>" + detailsTable +
          (mockupHtml ? "<h3 style='margin-top:16px'>Shirts</h3>" + mockupHtml : "") +
          "<p><a href='" + ss.getUrl() + "'>View all signups in the spreadsheet</a></p>",
        inlineImages: inlineImages
      });
    } catch (mailErr) {
      Logger.log("Sim0913 notify email failed: " + mailErr);
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok", saved: true, row: savedRow }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Rebuild the "Shirt Tally" tab (garment × color × size counts) on demand:
//   GET  <exec-url>?action=shirtTally0913
function sim0913ShirtTally() {
  var ss = getOrCreateSim0913Spreadsheet();
  var shirts = ss.getSheetByName("Shirts");
  var rows = shirts.getDataRange().getValues().slice(1);

  var GARMENTS = ["Unisex Tee", "Cropped Tee"];
  var SIZES = { "Unisex Tee": ["XS","S","M","L","XL","2XL","3XL"], "Cropped Tee": ["S","M","L","XL","2XL"] };
  var COLORS = ["Gold","Hot Pink","Lime Green","Bright Blue","Lavender","Red","Orange","Silver","White"];

  var map = sim0913HeaderMap(shirts);
  var iAth = sim0913Col(map, "athlete", 1), iGar = sim0913Col(map, "garment", 2),
      iSize = sim0913Col(map, "size", 3), iCol = sim0913Col(map, "logo color", 4),
      iReg = sim0913Col(map, "registrant", 5);
  var iStatus = sim0913Col(map, "status", -1);
  var counts = {}; // garment|color|size -> n
  var totalShirts = 0;
  rows.forEach(function(r) {
    var athlete = String(r[iAth] || ""), garment = String(r[iGar] || ""), size = String(r[iSize] || ""), color = String(r[iCol] || "");
    var reg = String(r[iReg] || "");
    if (/test/i.test(athlete) || /test/i.test(reg)) return; // skip test rows
    if (iStatus >= 0 && SIM0913_CANCELLED_RE.test(String(r[iStatus] || ""))) return; // don't print cancelled shirts
    if (!garment) return;
    var k = garment + "|" + color + "|" + size;
    counts[k] = (counts[k] || 0) + 1;
    totalShirts++;
  });

  var old = ss.getSheetByName("Shirt Tally");
  if (old) ss.deleteSheet(old);
  var tally = ss.insertSheet("Shirt Tally");

  var rowsOut = [["Garment", "Logo Color"].concat(SIZES["Unisex Tee"]).concat(["Total"])];
  GARMENTS.forEach(function(g) {
    COLORS.forEach(function(c) {
      var line = [g, c];
      var sum = 0;
      SIZES["Unisex Tee"].forEach(function(s) {
        var n = (SIZES[g].indexOf(s) !== -1) ? (counts[g + "|" + c + "|" + s] || 0) : "";
        line.push(n === "" ? "" : n);
        sum += (n || 0);
      });
      line.push(sum);
      if (sum > 0) rowsOut.push(line);
    });
  });
  rowsOut.push([]);
  rowsOut.push(["TOTAL SHIRTS", "", "", "", "", "", "", "", "", totalShirts]);

  tally.getRange(1, 1, rowsOut.length, rowsOut[0].length).setValues(rowsOut.map(function(r) {
    while (r.length < rowsOut[0].length) r.push("");
    return r;
  }));
  tally.getRange(1, 1, 1, rowsOut[0].length)
    .setFontWeight("bold").setBackground("#0a0a0a").setFontColor("#d6ff3f");
  tally.setFrozenRows(1);
  return { status: "ok", shirts: totalShirts, rows: rowsOut.length - 3 };
}

// One-time header migration (safe to re-run): rewrites row 1 of both tabs
// to the current header lists. Data rows are untouched.
//   GET  <exec-url>?action=sim0913FixHeaders
function sim0913FixHeaders() {
  var ss = getOrCreateSim0913Spreadsheet();
  var fix = function(sheetName, headers) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;
    var lastCol = Math.max(sheet.getLastColumn(), headers.length);
    sheet.getRange(1, 1, 1, lastCol).clearContent();
    sheet.getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setFontWeight("bold")
      .setBackground("#0a0a0a")
      .setFontColor("#d6ff3f");
  };
  fix("Signups", SIM0913_SIGNUP_HEADERS);
  fix("Shirts", SIM0913_SHIRT_HEADERS);
  return { status: "ok", signupHeaders: SIM0913_SIGNUP_HEADERS.length, shirtHeaders: SIM0913_SHIRT_HEADERS.length };
}

// ── GET: Health check + on-demand actions ──
function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : "";
  if (action === "shirtTally0913") {
    return ContentService
      .createTextOutput(JSON.stringify(sim0913ShirtTally()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === "sim0913Slots") {
    return ContentService
      .createTextOutput(JSON.stringify(sim0913SlotCounts()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === "sim0913FixHeaders") {
    return ContentService
      .createTextOutput(JSON.stringify(sim0913FixHeaders()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  // Audit (read-only): find leftover QA rows on either tab — anything whose
  // athlete/registrant looks like a test or the "Canary" verification row.
  // Reports sheet row numbers so they can be deleted by hand. The canary
  // matters most: its name has no "test", so the tally COUNTS it.
  if (action === "sim0913Leftovers") {
    var ssL = getOrCreateSim0913Spreadsheet();
    var pat = /test|canary|deleteme|delete me|please.?ignore/i;
    var found = [];
    [["Signups", "registrant"], ["Shirts", "athlete"]].forEach(function(pair) {
      var shL = ssL.getSheetByName(pair[0]);
      if (!shL) return;
      var mapL = sim0913HeaderMap(shL);
      var iA = sim0913Col(mapL, pair[1], 1);
      var iR = sim0913Col(mapL, "registrant", pair[0] === "Shirts" ? 5 : 1);
      shL.getDataRange().getValues().slice(1).forEach(function(r, idx) {
        var who = String(r[iA] || ""), reg = String(r[iR] || "");
        if (pat.test(who) || pat.test(reg)) {
          found.push({ tab: pair[0], row: idx + 2, who: who, registrant: reg,
                       countedInTally: !/test/i.test(who) && !/test/i.test(reg) });
        }
      });
    });
    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok", leftovers: found }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  // Debug: dump rows whose Registrant matches /test/i, keyed by header
  // (only ever exposes our own test rows, never real athletes).
  if (action === "sim0913TestRows") {
    var ssT = getOrCreateSim0913Spreadsheet();
    var shT = ssT.getSheetByName("Signups");
    var headT = shT.getRange(1, 1, 1, shT.getLastColumn()).getValues()[0];
    var iRegT = sim0913Col(sim0913HeaderMap(shT), "registrant", 1);
    var outT = shT.getDataRange().getValues().slice(1)
      .filter(function(r) { return /test/i.test(String(r[iRegT] || "")); })
      .map(function(r) {
        var o = {};
        headT.forEach(function(h, i) { if (String(r[i]) !== "") o[h] = String(r[i]); });
        return o;
      });
    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok", rows: outT }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === "sim0913Cancel") {
    return ContentService
      .createTextOutput(JSON.stringify(sim0913Cancel(e.parameter.registrant, e.parameter.note)))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === "sim0913Diag") {
    return ContentService
      .createTextOutput(JSON.stringify(sim0913Diag(e.parameter.n)))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === "sim0913Audit") {
    return ContentService
      .createTextOutput(JSON.stringify(sim0913Audit()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === "sim0913Grid") {
    return ContentService
      .createTextOutput(JSON.stringify(sim0913Grid()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === "sim0913ShirtsLayout") {
    return ContentService
      .createTextOutput(JSON.stringify(sim0913ShirtsLayout()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === "sim0913CompactShirts") {
    return ContentService
      .createTextOutput(JSON.stringify(sim0913CompactShirts()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === "sim0913Roster") {
    return ContentService
      .createTextOutput(JSON.stringify(sim0913Roster()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === "sim0913FindAthlete") {
    return ContentService
      .createTextOutput(JSON.stringify(sim0913FindAthlete(e.parameter.q)))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === "sim0913SetShirt") {
    return ContentService
      .createTextOutput(JSON.stringify(sim0913SetShirt(e.parameter.athlete, e.parameter.garment, e.parameter.size)))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === "sim0913SetColor") {
    return ContentService
      .createTextOutput(JSON.stringify(sim0913SetColor(e.parameter.athlete, e.parameter.color)))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === "sim0913NoonStatus") {
    var allNS = sim0913CountsAllHeats();
    var propsNS = PropertiesService.getScriptProperties();
    var openNS = sim0913OpenOverflowSlots(allNS);  // cascades + latches as needed
    // Per-overflow fill status against the heats open BEFORE it (base + earlier overflow).
    var chainNS = [], activeNS = SIM0913_SLOTS.slice();
    SIM0913_OVERFLOW.forEach(function(ov) {
      var g = 0, b = 0;
      activeNS.forEach(function(s) { g += ((allNS[s] || {}).Green) || 0; b += ((allNS[s] || {}).Blue) || 0; });
      chainNS.push({
        slot: ov.slot, label: ov.label,
        greenUsed: g, blueUsed: b, cap: activeNS.length * SIM0913_GROUP_CAPS.Green,
        latched: propsNS.getProperty(ov.prop) === "1",
        open: openNS.indexOf(ov.slot) !== -1
      });
      if (openNS.indexOf(ov.slot) !== -1) activeNS.push(ov.slot);
    });
    return ContentService
      .createTextOutput(JSON.stringify({
        status: "ok",
        openOverflow: openNS,
        chain: chainNS,
        noonOpen: openNS.indexOf(SIM0913_NOON_SLOT) !== -1
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === "sim0913SetNoon") {
    // Manual override for an overflow-heat latch. ?open=1 force-opens (default),
    // ?open=0 resets; ?slot=12:10 targets a specific overflow heat (default 12:00).
    var propsSN = PropertiesService.getScriptProperties();
    var slotSN = e.parameter.slot || SIM0913_NOON_SLOT;
    var ovSN = SIM0913_OVERFLOW.filter(function(o) { return o.slot === slotSN; })[0];
    if (!ovSN) return ContentService
      .createTextOutput(JSON.stringify({ status: "error", error: "unknown overflow slot: " + slotSN,
        validSlots: SIM0913_OVERFLOW.map(function(o){return o.slot;}) }))
      .setMimeType(ContentService.MimeType.JSON);
    var openSN = String(e.parameter.open == null ? "1" : e.parameter.open) === "1";
    if (openSN) propsSN.setProperty(ovSN.prop, "1");
    else propsSN.deleteProperty(ovSN.prop);
    return ContentService
      .createTextOutput(JSON.stringify({
        status: "ok",
        slot: slotSN,
        forcedOpen: openSN,
        latched: propsSN.getProperty(ovSN.prop) === "1"
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === "sim0913Health") {
    var ssH = getOrCreateSim0913Spreadsheet();
    return ContentService
      .createTextOutput(JSON.stringify({
        status: "ok",
        signupsRows: ssH.getSheetByName("Signups").getLastRow() - 1,
        shirtsRows: ssH.getSheetByName("Shirts").getLastRow() - 1
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === "survey0913Info") {
    return survey0913Out(survey0913Summary());
  }
  if (action === "survey0913ClearTests") {
    return survey0913Out(survey0913ClearTests());
  }
  if (action === "survey0913RebuildTally") {
    var ssRT = getOrCreateSurvey0913Spreadsheet();
    survey0913ApplyTextFormats(ssRT.getSheetByName("Responses") || ssRT.getSheets()[0]);
    survey0913BuildTallyTab(ssRT);
    return survey0913Out({ status: "ok", rebuilt: "Tally" });
  }
  if (action === "sim0913Info") {
    var ss0913 = getOrCreateSim0913Spreadsheet();
    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok", name: ss0913.getName(), url: ss0913.getUrl() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService
    .createTextOutput(JSON.stringify({ status: "service_ok", saved: false, message: "Hyrox Simulation signup API running" }))
    .setMimeType(ContentService.MimeType.JSON);
}
