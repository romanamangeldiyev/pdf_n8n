/* ==========================================================================
   Car Studio lead form — configuration
   This is the only file you normally need to edit.
   ========================================================================== */

window.CS_CONFIG = {

  /* ------------------------------------------------------------------ n8n --
   * The Production URL of your n8n Webhook node. In n8n:
   *   Webhook node → HTTP Method: POST
   *                → Path: car-studio-guide
   *                → Respond: "Using Respond to Webhook node"
   *                → Options → Allowed Origins (CORS): your site's origin,
   *                  e.g. https://guide.carstudio.ai   (or * while testing)
   *
   * Use the *Production* URL for the live site; the /webhook-test/ URL only
   * accepts one request per "Execute workflow" click in the editor.
   */
  WEBHOOK_URL: 'https://n8n.carstudio.ai/webhook/car-studio-guide',

  /* Where the E-Book lives. Shown as the download button after a successful
   * submit. Can be a same-origin file (e.g. 'files/car-studio-guide.pdf') or
   * any absolute URL. If n8n returns a `downloadUrl` in its response, that
   * value wins over this one. */
  EBOOK_URL: 'files/how-to-sell-your-used-cars-faster.pdf',

  /* Filename suggested to the browser when the E-Book is same-origin.
   * Cross-origin URLs ignore the download attribute — the file opens instead. */
  EBOOK_FILENAME: 'car-studio-how-to-sell-your-used-cars-faster.pdf',

  /* pdf.js worker. It MUST be same-origin: browsers refuse to construct a
   * Worker from another origin, and pdf.js then hangs instead of erroring —
   * which is why both files are vendored into public/vendor/ (v3.11.174)
   * rather than pulled from a CDN. Keep the two in the same version. */
  PDFJS_WORKER: 'vendor/pdf.worker.min.js',

  /* If the guide has not rendered by then, show the headline instead of an
   * empty frame. */
  PDF_TIMEOUT_MS: 12000,

  /* Clickable areas laid over the rendered pages.
   *
   * The buttons in the guide are artwork: the PDF carries no link annotations,
   * so nothing in it is clickable on its own. Each entry here is matched — case
   * insensitively — against a line of text on every page, and a transparent
   * link is placed over the line it finds.
   *
   * `pad` grows that text box out to the drawn button, in multiples of the
   * line's own font size (x = both sides, top and bottom from the baseline).
   * The defaults match the orange CTA on the last page; change them only if the
   * artwork changes. `label` is what a screen reader announces. */
  PDF_LINKS: [
    {
      text:  'Try it free',
      url:   'https://app.carstudio.ai/en/register',
      label: 'Try Car Studio free — 3 credits included',
      pad:   { x: 2, top: 2.15, bottom: 1.45 }
    }
  ],

  /* Width, in CSS pixels, that each page thumbnail in the left rail is drawn
   * at. The rail shows them smaller than this on a phone, so a little headroom
   * keeps them sharp. */
  THUMBNAIL_WIDTH: 124,

  /* Give up on the request after this many milliseconds. */
  TIMEOUT_MS: 15000,

  /* Anything submitted faster than this is treated as a bot. */
  MIN_FILL_MS: 2500,

  /* Default country calling code (ISO 3166-1 alpha-2). */
  DEFAULT_COUNTRY: 'TR',

  /* Shown when the webhook is unreachable or returns an error. */
  ERROR_MESSAGE:
    'We could not send your details just now. Please try again — or email ' +
    'info@carstudio.ai and we will send the guide straight over.',

  /* Calling codes offered in the phone field, most relevant first. */
  DIAL_CODES: [
    { iso: 'TR', dial: '+90',  name: 'Türkiye' },
    { iso: 'GB', dial: '+44',  name: 'United Kingdom' },
    { iso: 'DE', dial: '+49',  name: 'Germany' },
    { iso: 'US', dial: '+1',   name: 'United States' },
    { iso: 'AE', dial: '+971', name: 'United Arab Emirates' },
    { iso: 'NL', dial: '+31',  name: 'Netherlands' },
    { iso: 'FR', dial: '+33',  name: 'France' },
    { iso: 'ES', dial: '+34',  name: 'Spain' },
    { iso: 'IT', dial: '+39',  name: 'Italy' },
    { iso: 'PL', dial: '+48',  name: 'Poland' },
    { iso: 'RO', dial: '+40',  name: 'Romania' },
    { iso: 'BE', dial: '+32',  name: 'Belgium' },
    { iso: 'AT', dial: '+43',  name: 'Austria' },
    { iso: 'CH', dial: '+41',  name: 'Switzerland' },
    { iso: 'SE', dial: '+46',  name: 'Sweden' },
    { iso: 'NO', dial: '+47',  name: 'Norway' },
    { iso: 'DK', dial: '+45',  name: 'Denmark' },
    { iso: 'IE', dial: '+353', name: 'Ireland' },
    { iso: 'PT', dial: '+351', name: 'Portugal' },
    { iso: 'CZ', dial: '+420', name: 'Czechia' },
    { iso: 'GR', dial: '+30',  name: 'Greece' },
    { iso: 'BG', dial: '+359', name: 'Bulgaria' },
    { iso: 'RU', dial: '+7',   name: 'Russia' },
    { iso: 'UA', dial: '+380', name: 'Ukraine' },
    { iso: 'AZ', dial: '+994', name: 'Azerbaijan' },
    { iso: 'GE', dial: '+995', name: 'Georgia' },
    { iso: 'SA', dial: '+966', name: 'Saudi Arabia' },
    { iso: 'QA', dial: '+974', name: 'Qatar' },
    { iso: 'KW', dial: '+965', name: 'Kuwait' },
    { iso: 'EG', dial: '+20',  name: 'Egypt' },
    { iso: 'MA', dial: '+212', name: 'Morocco' },
    { iso: 'ZA', dial: '+27',  name: 'South Africa' },
    { iso: 'IN', dial: '+91',  name: 'India' },
    { iso: 'AU', dial: '+61',  name: 'Australia' },
    { iso: 'CA', dial: '+1',   name: 'Canada' },
    { iso: 'BR', dial: '+55',  name: 'Brazil' },
    { iso: 'MX', dial: '+52',  name: 'Mexico' },
    { iso: 'JP', dial: '+81',  name: 'Japan' },
    { iso: 'KR', dial: '+82',  name: 'South Korea' },
    { iso: 'CN', dial: '+86',  name: 'China' }
  ]
};
