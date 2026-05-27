# Koda Hyrox Simulation — Signup Site

Single-page signup form for the Hyrox Simulation event at Koda CrossFit Iron View on **June 7, 2026**. Submissions go to a Google Sheet via a Google Apps Script web app.

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
