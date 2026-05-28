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

// ══════════════════════════════════════════════════════════
// SHARED CAPACITY GROUPS
// Categories within the same group share a single pool of spots
// (they use the same equipment / weight setup, so they compete
// for the same slots on the floor).
// ══════════════════════════════════════════════════════════
var GROUPS = {
  A: {
    capacity: 6,
    categories: ["Men Pro Singles", "Men Pro Doubles"]
  },
  B: {
    capacity: 6,
    categories: ["Men Open Singles", "Women Pro Singles", "Men's Open Doubles", "Mixed Open Doubles"]
  },
  C: {
    capacity: 4,
    categories: ["Women Open Singles", "Men Scaled Singles", "Men's Scaled Doubles", "Women's Open Doubles", "Women's Open Relay"]
  },
  D: {
    capacity: 6,
    categories: ["Women Scaled Singles", "Mixed Scaled Doubles", "Women's Scaled Doubles"]
  }
};

// All valid categories (derived from GROUPS).
function allCategories() {
  var out = [];
  for (var g in GROUPS) {
    GROUPS[g].categories.forEach(function(c) { out.push(c); });
  }
  return out;
}

// Find which group a category belongs to (or null).
function groupForCategory(cat) {
  for (var g in GROUPS) {
    if (GROUPS[g].categories.indexOf(cat) !== -1) return g;
  }
  return null;
}

// Extract the weight class (Pro / Open / Scaled) from a category name, so a
// legacy sheet that still has a "Weights" column gets a meaningful value.
function weightFromCategory(cat) {
  if (/pro/i.test(cat)) return "Pro";
  if (/scaled/i.test(cat)) return "Scaled";
  if (/open/i.test(cat)) return "Open";
  return "";
}

// Build a row array that lines up with the sheet's actual header row.
// Maps each header (case-insensitively) to the matching record field, so
// adding/removing columns or reordering them won't shift data into the
// wrong column. Legacy "Division" maps to category; "Weights" gets the
// parsed weight class; unknown headers are left blank.
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
      case "division":             return record.category;
      case "partner / teammates":
      case "partner/teammates":
      case "partner / teammate":   return record.partners;
      case "weights":
      case "weight":               return record.weights;
      case "expected time":        return record.expectedTime;
      case "home gym":             return record.homeGym;
      case "comments":             return record.comments;
      default:                     return "";
    }
  });
}

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
    "Category",
    "Partner / Teammates",
    "Expected Time",
    "Home Gym",
    "Comments"
  ]);
  sheet.getRange(1, 1, 1, 9)
    .setFontWeight("bold")
    .setBackground("#0a0a0a")
    .setFontColor("#d6ff3f");
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 170);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 120);
  sheet.setColumnWidth(4, 220);
  sheet.setColumnWidth(5, 200);
  sheet.setColumnWidth(6, 280);
  sheet.setColumnWidth(7, 150);
  sheet.setColumnWidth(8, 200);
  sheet.setColumnWidth(9, 320);

  return ss;
}

// Count signups per category, ignoring rows whose Category cell doesn't
// match a known category (this naturally excludes legacy waitlist rows
// from the old form that wrote "Singles" / "Doubles" / etc).
function countSignupsByCategory() {
  var ss = getOrCreateSpreadsheet();
  var sheet = ss.getSheetByName("Signups");
  if (!sheet) return {};

  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return {};

  // Find the Category column by header (falls back to column 5 / index 4).
  var headers = values[0];
  var catIdx = -1;
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i] || "").toLowerCase();
    if (h === "category" || h === "division") { catIdx = i; break; }
  }
  if (catIdx === -1) catIdx = 4;

  var valid = allCategories();
  var counts = {};
  valid.forEach(function(c) { counts[c] = 0; });

  for (var r = 1; r < values.length; r++) {
    var cat = String(values[r][catIdx] || "").trim();
    if (counts.hasOwnProperty(cat)) counts[cat]++;
  }
  return counts;
}

// Returns { groups: { A: 6, B: 6, ... }, categories: { "Men Pro Singles": 6, ... } }
function getRemainingSpots() {
  var counts = countSignupsByCategory();

  var groupRemaining = {};
  for (var g in GROUPS) {
    var used = 0;
    GROUPS[g].categories.forEach(function(c) { used += counts[c] || 0; });
    groupRemaining[g] = Math.max(0, GROUPS[g].capacity - used);
  }

  var catRemaining = {};
  for (var g2 in GROUPS) {
    GROUPS[g2].categories.forEach(function(c) {
      catRemaining[c] = groupRemaining[g2];
    });
  }

  return { groups: groupRemaining, categories: catRemaining };
}

// ── GET: Return remaining spot counts (used by the page on load) ──
function doGet(e) {
  try {
    var data = getRemainingSpots();
    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok", spots: data }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── POST: Receive signup ──
function doPost(e) {
  // Use a script lock so two concurrent signups can't both grab the last spot.
  var lock = LockService.getScriptLock();
  try { lock.waitLock(8000); } catch (lockErr) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", error: "Server busy, please retry." }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var data = JSON.parse(e.postData.contents);
    var category = (data.category || "").toString().trim();

    if (!category || allCategories().indexOf(category) === -1) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: "error", error: "Invalid category." }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Capacity check — server-side guard against over-signups.
    var remaining = getRemainingSpots();
    if ((remaining.categories[category] || 0) <= 0) {
      return ContentService
        .createTextOutput(JSON.stringify({
          status: "error",
          error: "This category is full. Please pick another.",
          spots: remaining
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var ss = getOrCreateSpreadsheet();
    PropertiesService.getScriptProperties().setProperty("SHEET_ID", ss.getId());
    var sheet = ss.getSheetByName("Signups");

    // Combine partner / teammates into a single column for the sheet.
    var partnersCol = data.partnerName || data.teammates || "";

    // Write the row aligned to the sheet's ACTUAL header row, so this works
    // whether the sheet uses the new "Category" schema or the legacy
    // "Division + Weights" schema (an older sheet won't have been rebuilt).
    var record = {
      timestamp: new Date(),
      firstName: data.firstName || "",
      lastName: data.lastName || "",
      email: data.email || "",
      category: category,
      partners: partnersCol,
      weights: weightFromCategory(category),
      expectedTime: data.expectedTime || "",
      homeGym: data.homeGym || "",
      comments: data.comments || ""
    };
    sheet.appendRow(buildAlignedRow(sheet, record));

    // Recompute after writing so the response carries fresh counts.
    var updated = getRemainingSpots();

    if (NOTIFY_EMAIL) {
      try {
        MailApp.sendEmail({
          to: NOTIFY_EMAIL,
          subject: "New Hyrox Simulation Signup — " + (data.firstName || "") + " " + (data.lastName || ""),
          htmlBody:
            "<h3>New signup for " + EVENT_NAME + "</h3>" +
            "<table style='border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px'>" +
            row("Name", (data.firstName || "") + " " + (data.lastName || "")) +
            row("Email", data.email || "") +
            row("Category", category) +
            (partnersCol ? row(data.teammates ? "Teammates" : "Partner", partnersCol) : "") +
            row("Expected Time", data.expectedTime || "") +
            row("Home Gym", data.homeGym || "") +
            (data.comments ? row("Comments", data.comments) : "") +
            "</table>" +
            "<p><a href='" + ss.getUrl() + "'>View all signups in the spreadsheet</a></p>"
        });
      } catch (mailErr) {
        Logger.log("Email notification failed: " + mailErr);
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok", spots: updated }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
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
