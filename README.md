# Car Studio — "How to sell your used cars faster" lead page

A gated guide. The E-Book fills the screen, blurred, with the form on top of it as a modal;
sending the form dissolves the modal and brings the guide into focus. Colours, type scale and
layout were taken from the *Landing page* mock and the *Kurumsal Kimlik Kılavuzu 2023* brand
guideline; the dropdowns follow the supplied screenshots. The form POSTs straight to an **n8n
webhook**, which files the lead as a row in the ClickUp *Inbound Leads* table.

Plain HTML, CSS and JavaScript — no build step. The only dependency is pdf.js, vendored into
`public/vendor/` rather than pulled from a CDN.

```
public/                 ← the only folder that gets published
  how-to-sell-your-used-cars-faster.pdf/
    index.html          the page — the folder name is what makes the URL end in .pdf
  index.html            forwards the old address to the one above
  css/styles.css        design tokens + layout
  js/config.js          ← the only file you normally edit
  js/app.js             pdf rendering, the form modal, the n8n POST
  vendor/               pdf.js, served from our own origin (see below)
  img/                  logo variants + favicons (generated from the brand assets)
  files/                how-to-sell-your-used-cars-faster.pdf (the E-Book)
  favicon.ico
.github/workflows/
  deploy.yml            publishes public/ to GitHub Pages on every push to main
assets/                 source material — never published
```

---

## 1. Point it at your n8n webhook

Open [public/js/config.js](public/js/config.js) and set two values:

```js
WEBHOOK_URL: 'https://n8n.carstudio.ai/webhook/car-studio-guide',
EBOOK_URL:   'files/how-to-sell-your-used-cars-faster.pdf',
```

Use the **Production** URL. The `/webhook-test/` URL only accepts one request per
*Execute workflow* click in the editor, so it will look broken on a live page.

## 2. Set up n8n → ClickUp

The workflow behind the form lives in n8n itself — this repo holds only the page. It is one
webhook that ends in a ClickUp row:

```
Form webhook → Normalise & validate → Valid lead? ─┬─ Build Inbound Leads row
                                                   │        ↓
                                                   │  ClickUp: add row ─┬─ ok ──────────────→ Respond 200
                                                   │                    └─ failed → (alert) ─→ Respond 200
                                                   └─ Respond 400
```

Then:

1. **Webhook node → Options → Allowed Origins (CORS)**: enter the exact origin the page is served
   from, e.g. `https://romanamangeldiyev.github.io`. Use `*` only while testing. Without this the browser
   blocks the request before n8n ever sees it — the single most common reason a page like this
   "does nothing" on submit.
2. **Add a ClickUp credential** in n8n (*Credentials → New → ClickUp API*, personal token `pk_…`).
   The HTTP Request node picks it up automatically, so no token ends up in an export.
3. **Activate** the workflow.

### Where the rows land

Every submission adds one row to the **Inbound Leads** table — list `901817741951`, which is what
the `Inbound Leads` channel (`6-901817741951-8`) displays. In ClickUp's data model those rows are
tasks, which is why the API call is `POST /list/{id}/task`; in Table view they are simply rows.

The row follows the conventions already used in that table:

| Row property | Value |
|---|---|
| Name | `Company - First Last` (e.g. `Doe Motors - Jane Doe`) |
| Task type | **Lead** (`custom_item_id: 1001`) — the type every other row uses |
| Status | `new` |
| Tags | `contact request`, `landing page` |
| Assignee | left empty — your existing ClickUp automation assigns it |

Column mapping:

| Form field | ClickUp column |
|---|---|
| First + Last name | `👤 Contact Name` |
| Email | `👤 Email` |
| Company | `🏢 Company Name` |
| Phone (E.164) | `👤 Contact Number` |
| Business type | `Company Type` |
| — (fixed) | `📣 Where did they hear about us?` = *Free Guide Landing Form* |
| How did you hear about us? | `📣 Source` |
| — (fixed) | `📣 Channel` = *Contact Request* |
| Country code | `🏢 Country` (text) + `Country2` (dropdown) |
| submittedAt | `Lead Created Date` |

Everything else — device, referrer, the full UTM set, gclid/fbclid, locale, timezone, page URL —
goes into the row's **description**, the same way the GetSiteControl integration does it.

### Columns this deliberately leaves alone

Checked against real rows in the list before mapping anything:

- **`📣 Where did they hear about us?` holds the form name**, not the visitor's answer — existing
  rows read *GetSiteControl Visitor Form* and *Meta Lead Form*. So it gets `Free Guide Landing
  Form`, and the visitor's own answer (*LinkedIn*, *Search Engine*, *Generative AI*…) goes to
  `📣 Source`, which is where the Meta automation writes `fb`.
- **`📣 Campaign Name`, `📣 Adset Name`, `📣 Ad Name` are Meta Ads names** (*English - Lead - 2*,
  *Görsel 37*). Writing a `utm_campaign` from an organic link there would put made-up campaigns
  into ad reporting, so they stay empty. To enable them for a paid push to the guide, add
  `fields.push({ id: F.campaign, value: L.utmCampaign })` in the **Build Inbound Leads row** node.
- **`⚙️ Device` is an onboarding field**, not the browser. It is empty on every row, and
  GetSiteControl puts its "Device Info" line in the description — so this does the same.
- **`📣 Channel` is empty on every existing row**, including Meta leads. Filling it with
  *Contact Request* is the one place this writes something no other automation does. Set
  `CHANNEL_OPTION = ''` in the node to leave it empty and match the existing data exactly.

One thing it quietly fixes: GetSiteControl rows leave `Lead Created Date` empty, which makes the
`First Response Time (hrs)` formula return blank for them. These rows fill it, so the SLA metric
works for guide leads.

### Two things you may want to change

- **`📣 Channel` is set to *Contact Request***, because that dropdown has no e-book option and
  `contact request` is the tag comparable rows already carry. To split guide leads out in
  reporting, add a *Guide Download* option to the `📣 Channel` field in ClickUp, then paste its
  option id into `CHANNEL_OPTION` at the top of the **Build Inbound Leads row** node — or set it
  to `''` to leave the column empty like every other row.
- **A ClickUp failure does not block the visitor.** The HTTP node's error branch still returns
  `200`, so the lead gets their guide even if ClickUp is down, and the submission stays in the n8n
  execution log. Wire a Slack or email alert onto the **ClickUp write failed** node so that never
  passes unnoticed.

> If you add or rename columns, re-read the ids with
> `GET https://api.clickup.com/api/v2/list/901817741951/field` and update the `F` map at the top
> of the **Build Inbound Leads row** node.

> `⚙️ Admin URL` is marked *required* on this list. In ClickUp that only blocks closing a task,
> not creating one, so new rows arrive fine with it empty.

> `Respond 200` answers with a bare `{"ok": true}` and the page serves the PDF from its own
> `EBOOK_URL`, which takes priority. To hand out signed or expiring links from the workflow
> instead, clear `EBOOK_URL` and return `downloadUrl` — note that a cross-origin URL opens in a
> new tab rather than downloading.

### What the page sends

```json
{
  "formId": "car-studio-guide-v1",
  "source": "landing:how-to-sell-used-cars-faster",
  "firstName": "Jane", "lastName": "Doe", "fullName": "Jane Doe",
  "email": "jane@dealership.com",
  "company": "Doe Motors",
  "countryCode": "TR", "dialCode": "+90",
  "phone": "532 000 00 00", "phoneE164": "+90532000000",
  "businessType": "Dealership",
  "heardFrom": "Search Engine",
  "meta": {
    "submittedAt": "2026-09-03T12:00:00.000Z",
    "pageUrl": "...", "pageTitle": "...", "referrer": "...",
    "params": { "utm_source": "linkedin", "utm_campaign": "guide-q3" },
    "locale": "tr-TR", "timezone": "Europe/Istanbul",
    "screen": "1440x900", "userAgent": "...", "fillMs": 41230
  }
}
```

`meta.params` picks up `utm_*`, `gclid`, `fbclid`, `msclkid`, `ttclid` and `li_fat_id` from the
URL, so campaign attribution arrives with the lead.

### What the page expects back

| Response | Page behaviour |
|---|---|
| `200` + `{"ok":true}` ← what the workflow sends | success panel, download button uses `EBOOK_URL` |
| `200` + empty body | success panel, download button uses `EBOOK_URL` |
| `200` + `{"ok":true,"downloadUrl":"…"}` | `EBOOK_URL` still wins; `downloadUrl` is used only when `EBOOK_URL` is empty |
| `200` + `{"ok":false,"message":"…"}` | error banner, form stays filled in |
| any `4xx` / `5xx`, timeout, or network failure | error banner, form stays filled in |

## 3. Put the E-Book somewhere

Already done: the guide sits at `public/files/how-to-sell-your-used-cars-faster.pdf` (468 KB, 8 pages) and
`EBOOK_URL` points at it. If you swap the file, keep the name ASCII — no spaces, no Turkish
characters — and update `EBOOK_URL` and `EBOOK_FILENAME` in [public/js/config.js](public/js/config.js).

Keep it same-origin. A file served from the site downloads straight away; a cross-origin URL opens
in a new tab instead, because browsers ignore the `download` attribute across origins.

## 4. Run it

Any static host works — Netlify, Vercel, S3, nginx. Serve the `public/` directory.

```bash
npx serve public          # http://localhost:3000
python -m http.server 8000 --directory public
```

## 5. Deploy to GitHub Pages

[.github/workflows/deploy.yml](.github/workflows/deploy.yml) publishes **only `public/`** on every
push to `main`. Anything outside `public/` stays in the repo but never reaches the web.

> **Make the repo private.** `assets/` holds the brand guideline and the landing mock. Those are
> not published by the workflow, but in a *public* repo anyone can still download them straight
> from GitHub. Private repos need GitHub Pro/Team for Pages — if you are on the free plan, either
> upgrade or move `assets/` out of the repo before pushing.

```bash
git init -b main
git add .
git commit -m "Car Studio guide landing page"
git remote add origin git@github.com:<org>/<repo>.git
git push -u origin main
```

Then in the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
The first run takes a minute; after that every push redeploys.

### Where it lands

No custom domain: the site is served from the repository's own Pages URL, and the link to hand
out is the one that ends in `.pdf`:

```
https://romanamangeldiyev.github.io/pdf_n8n/how-to-sell-your-used-cars-faster.pdf
```

Every path in the page is relative, so the `/pdf_n8n/` prefix costs nothing — CSS, JS, images and
the PDF all resolve under it, and the E-Book stays same-origin so the download button really
downloads.

**Why that link works.** `how-to-sell-your-used-cars-faster.pdf` is a *folder*, not a file, and the
page is the `index.html` inside it. A request without the trailing slash gets a `301` to the folder,
which is served as HTML — the extension in the URL never reaches a `Content-Type` header. Naming an
HTML *file* `.pdf` would not work: GitHub Pages types it from the extension and the browser would
try to parse the page as a PDF.

Two things follow from the page living one folder down, and both are already done:

- every asset in `index.html` is reached with `../`, and so are `EBOOK_URL` and `PDFJS_WORKER` in
  `config.js` — those resolve against the page, not the site root;
- `public/index.html` forwards the old address to the new one, carrying `?utm_…` and any fragment
  with it, so links already in the wild keep working and keep their campaign tags.

### Adding a domain later

Two steps, whenever you want one:

1. Create `public/CNAME` containing the host on a single line, e.g. `guide.carstudio.ai`.
2. Add a DNS record — `carstudio.ai` is on **Route 53**:
   `CNAME` · name `guide` · value `romanamangeldiyev.github.io` (no repository name).

Then put the same host in **Settings → Pages → Custom domain**, wait for the DNS check to go
green and tick **Enforce HTTPS**. Update the n8n webhook's Allowed Origins to match, because the
origin changes.

An apex domain like `carstudio.ai` cannot work here — Pages takes the whole host, which would
take down the main Vercel site. A path such as `carstudio.ai/guide` would need the page to live
in the Next.js project, or a Vercel rewrite pointing at this Pages site.

### Then wire the two ends together

1. **n8n → Form webhook → Allowed Origins**: `https://romanamangeldiyev.github.io` — the exact
   origin (scheme + host, no path), or the browser blocks every submission.
2. **n8n must be on HTTPS.** An `https://` page cannot POST to an `http://` webhook; the browser
   blocks it as mixed content.
3. **`WEBHOOK_URL`** in [public/js/config.js](public/js/config.js) → the **Production** webhook URL.
4. The E-Book is already at `public/files/how-to-sell-your-used-cars-faster.pdf` and `EBOOK_URL`
   matches it. If you swap the file, keep the name ASCII — no spaces, no Turkish characters.

Because the PDF is served from the same origin as the page, the download button really downloads
instead of opening a tab. That only works while the file stays same-origin.

### One thing to know before it goes live

The webhook URL sits in client-side JavaScript, so it is public — that is true of any browser form.
Allowed Origins does not stop a direct `curl`. What protects you today: the honeypot field, and the
`Normalise & validate` node rejecting junk before it reaches ClickUp. If you ever start seeing spam
rows, add rate limiting in front of n8n or a Cloudflare Turnstile check to the form.

---

## Design notes

Everything below came out of the supplied assets rather than being invented:

| | |
|---|---|
| Orange | `#EC6D1C` — brand guideline primary (the mock's `#EB6316` is the same colour, off by a hair) |
| Ink / body / muted | `#131A33` / `#5B6275` / `#9BA1B4` |
| Page ground | `#FFFCFA` |
| Type | Montserrat, per the guideline's typography page |
| Layout | 1400px design canvas: 660px left column, 511px card, 63px gutter |
| Logo | `public/img/logo.png` and the favicons were generated from the official wordmark |

Two deliberate departures, both easy to undo:

- **The mock is set in Poppins**, but the brand guideline specifies Montserrat. The guideline won.
  To switch back, change the Google Fonts link in `index.html` and `--font` in `styles.css`.
- **The phone field has a country selector** (defaulting to `+90`) instead of a fixed `+90` prefix,
  so international dealers can submit a usable number. n8n receives it normalised as `phoneE164`.

### How the gate works

The guide is rendered into the page with **pdf.js**, one `<canvas>` per page, and the whole viewer
is blurred (`filter: blur(9px)`) under a dark veil while `<html>` carries the `gated` class. The
form sits above it as a real modal: `role="dialog"`, `aria-modal`, a focus trap, and no dismiss
affordance — it can only be passed by submitting. `html.gated` also locks page scrolling.

On success the `gated` class is removed: the blur and veil animate away, scrolling is released, and
a slim bar appears at the bottom with the thank-you and a Download PDF button.

**Why pdf.js and not an `<iframe>`.** iOS Safari renders only the first page of a PDF in an iframe
and will not scroll it, and mobile Chrome sometimes downloads the file instead of displaying it.
For a lead magnet where most traffic is mobile, neither is acceptable.

**Why pdf.js is vendored.** `new Worker()` cannot load a script from another origin, so pulling the
worker from a CDN silently drops pdf.js onto the main thread — it still works, but rendering then
blocks the UI. Serving both files from `public/vendor/` keeps the real worker and removes a
third-party request. To upgrade, replace both files with a matching pair and keep
`PDFJS_WORKER` in `config.js` pointing at the local worker.

**If the guide cannot be rendered** — pdf.js missing, a corrupt file, a stalled network — the
viewer falls back to the headline after `PDF_TIMEOUT_MS` (12s). The form keeps working either way;
it never depends on the PDF.

### The page rail

Every page of the guide is drawn a second time as a thumbnail, in a rail down the left (a strip
across the top under 900px wide). Clicking one scrolls the viewer to that page, and whichever page
fills most of the screen is marked as you read. The rail only appears when the file has more than
one page, and the pages give up the width it takes, so nothing sits underneath it.

Thumbnails are drawn at `THUMBNAIL_WIDTH` (124 CSS px) in `config.js`. They render after the pages
themselves, so a slow first paint is never made slower by them.

### Clickable buttons in the guide

The call to action on the last page is artwork — the PDF carries no link annotations, so nothing in
it is clickable on its own. `PDF_LINKS` in [public/js/config.js](public/js/config.js) puts that
right: each entry is matched, case insensitively, against a line of text on every page, and a
transparent `<a>` is laid over the line it finds.

```js
PDF_LINKS: [
  {
    text:  'Try it free',                             // matched against the page
    url:   'https://app.carstudio.ai/en/register',    // where the button goes
    label: 'Try Car Studio free — 3 credits included',// what a screen reader says
    pad:   { x: 2, top: 2.15, bottom: 1.45 }          // text box → drawn button
  }
]
```

`pad` grows the text's own box out to the edges of the drawn button, in multiples of that line's
font size: `x` on both sides, `top` and `bottom` measured from the baseline. The defaults match the
orange button on page 8 — if you swap the PDF for artwork with a different button, these are the
numbers to nudge. The link is positioned in percentages of the page, so it stays on the button at
every window size, and it is inert while the guide is still gated.

### Behaviour worth knowing

- **No JavaScript?** The form still renders with styled native `<select>` elements and the
  headline stands in for the guide. Submitting needs JS.
- **Touch devices** keep the native picker on purpose — the OS wheel/sheet beats any custom
  listbox on a phone. Desktop gets the custom dropdown from the screenshots.
- **Keyboard** works throughout the custom select: arrows, Home/End, type-ahead, Enter, Escape.
- **Spam:** an off-screen honeypot field blocks the obvious bots, and a submit faster than
  2.5 seconds is flagged as `meta.suspiciouslyFast` (flagged, not blocked — real people using
  autofill are fast too). n8n re-checks the honeypot server-side.

### Adding a KVKK / GDPR consent checkbox

The mock has no consent control, so neither does the page — it carries a fine-print line instead.
If your legal position needs explicit opt-in, paste this above the submit button in
`index.html` and it will validate and submit with everything else:

```html
<div class="field">
  <label style="display:flex; gap:10px; align-items:flex-start; font-weight:500;">
    <input type="checkbox" id="consent" name="consent" required style="margin-top:3px;">
    <span>I agree to receive the guide and occasional product updates from Car Studio.</span>
  </label>
  <p class="err" id="consent-err" hidden></p>
</div>
```

then add a rule in `js/app.js` next to the others:

```js
consent: function (v, el) { return el && el.checked ? '' : 'Please tick the box to continue.'; },
```

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| Submit shows the error banner, console says CORS | Webhook node → Options → **Allowed Origins** does not list your origin |
| Works once, then fails | You are using the `/webhook-test/` URL. Switch to Production and activate the workflow |
| Request hangs until the 15 s timeout | The webhook is set to *Respond: Using Respond to Webhook node* but a branch has no Respond node |
| Download button opens instead of downloading | The E-Book is on another origin — expected browser behaviour |
| Fields look unstyled | `css/styles.css` did not load — check the path if you moved files |
| Visitor gets the guide but no row appears | The ClickUp call failed — open the execution and look at the **ClickUp write failed** branch |
| ClickUp returns `401` | No ClickUp credential on the HTTP Request node, or the token lost access to the list |
| ClickUp returns `400 Custom field not found` | A column was deleted or recreated — re-read the ids with `GET /api/v2/list/901817741951/field` and update the `F` map |
| Row appears but a column is empty | That column's id changed, or the value was blank — blank values are skipped on purpose |
| `📣 Channel` shows the wrong option | `CHANNEL_OPTION` in the **Build Inbound Leads row** node points at a different option id |
