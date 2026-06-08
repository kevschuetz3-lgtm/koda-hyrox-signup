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

// ── GET: Health check ──
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok", message: "Hyrox Simulation signup API running" }))
    .setMimeType(ContentService.MimeType.JSON);
}
