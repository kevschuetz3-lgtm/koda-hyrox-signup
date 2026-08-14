# Koda Hyrox Simulation — Signup Site

Single-page signup form for the Hyrox Simulation at Koda CrossFit Iron View on **September 13, 2026** (heats every 10 min, 9:00–11:50 AM). **$25 per athlete, event shirt included** — each athlete picks black unisex tee or black crop and one of 9 logo colors (live mockup preview). Payment: Venmo / Zelle / credit card (Zen Planner). Submissions go to a Google Sheet via the same Google Apps Script web app used for the June 2026 event.

## September 13, 2026 event — how it works

- `index.html` posts `type: "sim0913"` to the existing web app (same `/exec` URL as June).
- **Athletes pick their own heat**: 18 slots (9:00–11:50 AM, every 10 min). Each slot has **8 lanes typed by weight setup — 1 Red (Men's Pro) + 3 Green (Men's Open / Women's Pro / Mixed) + 3 Blue (Women's Open) + 1 Scaled** (`SIM0913_GROUP_CAPS`); one lane per racing unit (a single, a doubles pair, or a relay team). The picker is gated until category+weights are chosen, then shows availability for that athlete's lane type. Live availability comes from `<exec-url>?action=sim0913Slots` (per-slot per-group counts); caps are enforced server-side under a script lock (a losing racer gets `slot_full` and is asked to repick). Test rows (name contains "test") don't count against capacity.
- **Category** (Men's / Women's / Mixed — Mixed only for doubles/relay) + weight category map to the weight setup from the Heat Times legend: Men Pro → Red 445/337/70/66/20·10ft; Men Open, Women Pro, Mixed → Green 335/227/53/44/14·10ft; Women Open → Blue 225/172/35/22/9·9ft; Scaled → custom. Stored per signup in the "Weights Setup" column so lanes can be planned per slot. (The expected-time question is gone — heats are self-selected.)
- The backend writes to its **own** spreadsheet, **[Koda Hyrox Simulation Signups — Sept 13 2026](https://docs.google.com/spreadsheets/d/1pu84aFSgRuBaqdUmN2TwK0MnbyJ2ZqWZhXgCAHxGCZc/edit)** (script property `SIM0913_SHEET_ID`, auto-created on first submission): a **Signups** tab (one row per submission, incl. a Paid? column to fill by hand) and a **Shirts** tab (one row per athlete — the print order, with each athlete's email).
- **Columns can be reordered/resized freely** — rows are written and read by matching the header text in row 1, not by column position. Don't *rename* headers (that's what the matching keys off); adding new columns is fine.
- Registrant gets a confirmation email with their heat time, payment instructions + canvas-rendered shirt mockups; kevschuetz3@gmail.com gets a notification. On doubles/relay signups, **teammates who supplied an optional email are CC'd** on that confirmation.
- Handy read-only actions: `?action=sim0913Info` (sheet name + URL), `?action=sim0913Health` (row counts), `?action=sim0913Leftovers` (finds stray QA/test rows by sheet row number).
- **Shirt tally for the printer:** open `<exec-url>?action=shirtTally0913` — rebuilds a "Shirt Tally" tab (garment × color × size, skips rows with "test" in a name). When emailing the printer, CC lasakcatherine@gmail.com.
- Shirt mockup assets live in `assets/mockups/` — three layers per garment: `*-base.jpg` (blank black shirt), `*-hyrox.png` (wordmark mask, tinted to the chosen vinyl), `*-koda.png` ("KODA CROSSFIT", always white). Source artwork is `assets/source/HYROX-Designs-01.ai`; rebuild with the scripts in `tools/` (see `tools/README.md`).
- Payment: Venmo @kevin-schuetz-5 / Zelle kodaironview@gmail.com / Zen Planner CC product `5F4A8380-AC28-409B-A664-E088BB910ED0` ($25, each athlete pays their own).
- `?action=sim0913FixHeaders` rewrites the header rows of both tabs to match the code (safe to re-run; used once when the heat/category columns were added).
- `feedback.html` and `class-times.html` are left over from the June event (unlinked but live).

---

## June 7, 2026 event (previous — kept for reference)

## Files

- `index.html` — the signup page (deploy this to GitHub Pages)
- `apps-script-backend.js` — paste into a Google Apps Script project to receive submissions
- `README.md` — this file

## One-time setup

### 1. Set up the Google Apps Script backend

1. Go to https://script.google.com → **New Project**
2. Delete the placeholder `function myFunction()` and paste in the entire contents of `apps-script-backend.js`
3. Click **Save** (give the project a name like "Koda Hyrox Signups")
4. In the function dropdown at the top, select **`setup`** → click **Run**
   - You'll be asked to authorize → click through and grant access
   - This creates the Google Sheet ("Koda Hyrox Simulation Signups") in your Drive
5. Open **View → Execution log** — you'll see the spreadsheet URL printed there. Open it to confirm the headers were created.
6. Click **Deploy → New Deployment**
   - Click the gear icon (top left of the dialog) → choose **Web app**
   - **Execute as:** Me (kevschuetz3@gmail.com)
   - **Who has access:** Anyone
   - Click **Deploy**
   - Authorize again if prompted
   - **Copy the Web App URL** — you'll need it next

### 2. Wire the URL into index.html

Open `index.html` and find this line near the bottom:

```js
var SCRIPT_URL = "YOUR_APPS_SCRIPT_WEB_APP_URL";
```

Replace the placeholder with your Web App URL from step 1.

### 3. Push to GitHub Pages

From this directory:

```bash
git init
git add index.html README.md
git commit -m "Initial Hyrox Simulation signup site"
gh repo create hyrox-simulation-signup --public --source=. --push
gh api -X POST repos/{owner}/hyrox-simulation-signup/pages -f source='{"branch":"main","path":"/"}'
```

GitHub Pages will publish the site at `https://<your-github-username>.github.io/hyrox-simulation-signup/` within ~1 minute.

> **Note:** The `apps-script-backend.js` file is fine to commit — there's nothing sensitive in it (the secret part is the deployed Web App URL, which you put into `index.html`).

## Updating the script later

If you change `apps-script-backend.js`, paste the new code into the Apps Script editor, then:

**Deploy → Manage deployments → pencil icon → Version: New version → Deploy**

The URL stays the same when you redeploy an existing deployment, so no need to update `index.html`.

## Form fields collected

| Field | Notes |
|---|---|
| First Name | required |
| Last Name | required |
| Email | required |
| Category | one of 14 specific categories (e.g. "Men Pro Singles", "Mixed Open Doubles", "Women's Open Relay") |
| Partner / Teammates | shown only for Doubles (1 name) or Relay (3 names) |
| Expected Time | required, used for heat placement |
| Home Gym | required |
| Comments | optional |

Each submission also notifies `kevschuetz3@gmail.com` by email — change `NOTIFY_EMAIL` at the top of `apps-script-backend.js` to disable or redirect.

## Shared-capacity groups

Multiple categories share the same equipment / weight setup on the floor, so they draw from one pool of spots. Sign-ups in any category in a group decrement the count for all categories in that group.

| Group | Capacity | Categories |
|---|---|---|
| A | 6 | Men Pro Singles · Men Pro Doubles |
| B | 6 | Men Open Singles · Women Pro Singles · Men's Open Doubles · Mixed Open Doubles |
| C | 4 | Women Open Singles · Men Scaled Singles · Men's Scaled Doubles · Women's Open Doubles · Women's Open Relay |
| D | 6 | Women Scaled Singles · Mixed Scaled Doubles · Women's Scaled Doubles |

Adjust capacities by editing the `GROUPS` constant at the top of `apps-script-backend.js`, then redeploy.

## Local preview

Just open `index.html` in a browser. While `SCRIPT_URL` is still the placeholder, the form runs in "preview mode" — submissions are logged to the browser console instead of being sent anywhere, and you'll still see the success screen.

---

## Post-event feedback survey

A second page, `feedback.html`, collects post-event feedback. It's served from the same GitHub Pages site at `.../feedback.html` and is **already live** — no extra setup needed.

### How it works

Rather than a separate Apps Script project, the feedback page posts to the **same** web app as signups (`apps-script/Code.js`). The backend looks for `type: "feedback"` in the payload and routes those submissions to their **own** spreadsheet — **"Koda Hyrox Feedback"** in your Drive — so feedback and signups never mix. This reuses the existing authorization, so nothing new had to be authorized.

To change the feedback questions/columns later, edit `apps-script/Code.js` (the `handleFeedback` / `FEEDBACK_HEADERS` section), then from the `apps-script/` folder:

```bash
clasp push
clasp redeploy AKfycbwWjHrhE6k3vVPDXD4qi3VLxZVAXMykAFIKocoUiq0BtXdv2XLy7Oo0GRfrP48fHytnyw -d "Update feedback"
```

(The URL stays the same across redeploys.) `apps-script-backend.js` in the repo root is a reference copy of the deployed `Code.js`.

### Questions collected

| Field | Type |
|---|---|
| Overall rating | 1–5 |
| Organization (check-in, heats, station flow) | 1–5 |
| Hyrox accuracy (stations, order, distances, transitions) | 1–5 |
| Likelihood to do another | 1–5 |
| Energy / atmosphere (music, cheering, judges) | 1–5 |
| Interested in a lead-up training program (next sim / Nov Denver Hyrox) | Yes / No |
| Interested in a free class at Koda Iron View | Yes / No |
| Suggested class times to add | checkbox grid (Mon–Fri × 6:30am, 7:30am, 11am, Noon, 4pm, 4:30pm, 5:00pm, 5:30pm) — shown only if "free class" = Yes |
| Comments | optional text |
| Name / Email | **required** (at the top of the form) |

Name and email are required; the rating/Yes-No questions are optional. The class-times grid only appears when they pick **Yes** for the free class. The training-program question is the last question.

---

## Class-time poll (for current members)

A third page, `class-times.html`, is a stripped-down poll for gym members who **didn't** do the simulation — it asks only for their **name** and their **preferred Hyrox class times** (same Mon–Fri grid). Send this one to people who already train at the gym.

It posts to the same web app with `type: "classtimes"` and lands in its **own** spreadsheet — **"Koda Hyrox Class Time Requests"** — separate from both signups and simulation feedback. To edit, change the `handleClassTimes` / `CLASSTIMES_HEADERS` section of `apps-script/Code.js`, then `clasp push` + `clasp redeploy` as above.

| Field | Type |
|---|---|
| Name | **required** |
| Preferred class times | checkbox grid (Mon–Fri × the 8 times), at least one required |
