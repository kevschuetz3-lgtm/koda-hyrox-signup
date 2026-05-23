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
    "Waitlist?",
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
  sheet.getRange(1, 1, 1, 11)
    .setFontWeight("bold")
    .setBackground("#0a0a0a")
    .setFontColor("#d6ff3f");
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 170);
  sheet.setColumnWidth(2, 90);
  sheet.setColumnWidth(3, 120);
  sheet.setColumnWidth(4, 120);
  sheet.setColumnWidth(5, 220);
  sheet.setColumnWidth(6, 130);
  sheet.setColumnWidth(7, 280);
  sheet.setColumnWidth(8, 100);
  sheet.setColumnWidth(9, 150);
  sheet.setColumnWidth(10, 200);
  sheet.setColumnWidth(11, 320);

  return ss;
}

// Ensure the sheet has the "Waitlist?" column (for sheets created before this column existed).
function ensureWaitlistColumn(sheet) {
  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (header.indexOf("Waitlist?") !== -1) return;
  // Insert "Waitlist?" as column B (after Timestamp).
  sheet.insertColumnBefore(2);
  sheet.getRange(1, 2).setValue("Waitlist?")
    .setFontWeight("bold")
    .setBackground("#0a0a0a")
    .setFontColor("#d6ff3f");
  sheet.setColumnWidth(2, 90);
}

// ── POST: Receive signup ──
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // Auto-create the spreadsheet on first submission if it doesn't exist yet.
    var ss = getOrCreateSpreadsheet();
    PropertiesService.getScriptProperties().setProperty("SHEET_ID", ss.getId());
    var sheet = ss.getSheetByName("Signups");
    ensureWaitlistColumn(sheet);

    // Combine partner / teammates into a single column for the sheet
    var partnersCol = data.partnerName || data.teammates || "";
    var isWaitlist = data.waitlist === true || data.waitlist === "true";

    sheet.appendRow([
      new Date(),
      isWaitlist ? "YES" : "",
      data.firstName || "",
      data.lastName || "",
      data.email || "",
      data.division || "",
      partnersCol,
      data.weights || "",
      data.expectedTime || "",
      data.homeGym || "",
      data.comments || ""
    ]);

    if (isWaitlist) {
      // Highlight waitlist rows so they're easy to scan in the sheet.
      var lastRow = sheet.getLastRow();
      sheet.getRange(lastRow, 1, 1, 11).setBackground("#fff8d6");
    }

    if (NOTIFY_EMAIL) {
      try {
        MailApp.sendEmail({
          to: NOTIFY_EMAIL,
          subject: (isWaitlist ? "[WAITLIST] " : "") + "New Hyrox Simulation Signup — " + (data.firstName || "") + " " + (data.lastName || ""),
          htmlBody:
            (isWaitlist
              ? "<h3 style='color:#a8cc1f'>WAITLIST signup for " + EVENT_NAME + "</h3><p style='font-size:13px;color:#666'>Sign-ups are frozen — this athlete added themselves to the waitlist.</p>"
              : "<h3>New signup for " + EVENT_NAME + "</h3>") +
            "<table style='border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px'>" +
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

// ── GET: Health check ──
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok", message: "Hyrox Simulation signup API running" }))
    .setMimeType(ContentService.MimeType.JSON);
}
