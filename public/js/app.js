/* ==========================================================================
   Car Studio lead form
   - progressive enhancement: the form works with plain native selects if this
     file fails to load; touch devices keep the native picker on purpose
   - client-side validation, then a JSON POST to the n8n webhook
   ========================================================================== */

(function () {
  'use strict';

  var CFG = window.CS_CONFIG || {};
  var doc = document;
  var $  = function (sel, root) { return (root || doc).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); };

  var form         = $('#lead-form');
  var formPanel    = $('#form-panel');
  var successPanel = $('#success-panel');
  var alertBox     = $('#form-alert');
  var submitBtn    = $('#submit-btn');
  var yearEl       = $('#year');

  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
  if (!form) return;

  var startedAt   = Date.now();
  var submitting  = false;
  var wasSubmitted = false;

  /* ======================================================= custom select == */

  var USE_NATIVE_SELECTS = doc.documentElement.classList.contains('native-select');

  function CustomSelect(wrap) {
    var native = $('select[data-native]', wrap);
    // Nothing to enhance — leave the native control visible rather than
    // hiding a select that has no replacement.
    if (!native || !native.id) { wrap.classList.add('is-native'); return; }

    this.wrap    = wrap;
    this.native  = native;
    this.id      = native.id;
    this.open    = false;
    this.active  = -1;
    this.typed   = '';
    this.typedAt = 0;

    this.label = $('label[for="' + CSS.escape(this.id) + '"]');
    if (this.label && !this.label.id) this.label.id = this.id + '-label';

    this.build();
    this.bind();
    this.syncFromNative();

    // The native select stays in the DOM to carry the value, but it must not be
    // reachable: hidden with opacity/clip it would still take a Tab stop (with no
    // visible focus ring) and be announced as a second combobox for the same field.
    // tabIndex -1 first, so aria-hidden is never applied to a focusable element.
    native.tabIndex = -1;
    native.setAttribute('aria-hidden', 'true');

    wrap.classList.add('is-enhanced');
  }

  CustomSelect.prototype.build = function () {
    var t = doc.createElement('button');
    t.type = 'button';
    t.className = 'select-trigger';
    t.id = this.id + '-trigger';
    t.setAttribute('role', 'combobox');
    t.setAttribute('aria-haspopup', 'listbox');
    t.setAttribute('aria-expanded', 'false');
    t.setAttribute('aria-controls', this.id + '-list');
    if (this.native.required) t.setAttribute('aria-required', 'true');
    var describedBy = this.native.getAttribute('aria-describedby');
    if (describedBy) t.setAttribute('aria-describedby', describedBy);

    var val = doc.createElement('span');
    val.className = 'select-value';
    val.id = this.id + '-value';

    var chev = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chev.setAttribute('class', 'select-chevron');
    chev.setAttribute('viewBox', '0 0 24 24');
    chev.setAttribute('fill', 'none');
    chev.setAttribute('stroke', 'currentColor');
    chev.setAttribute('stroke-width', '2');
    chev.setAttribute('stroke-linecap', 'round');
    chev.setAttribute('stroke-linejoin', 'round');
    chev.setAttribute('aria-hidden', 'true');
    var path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'm6 9 6 6 6-6');
    chev.appendChild(path);

    t.appendChild(val);
    t.appendChild(chev);
    if (this.label) t.setAttribute('aria-labelledby', this.label.id + ' ' + val.id);

    var list = doc.createElement('ul');
    list.className = 'select-list';
    list.id = this.id + '-list';
    list.setAttribute('role', 'listbox');
    if (this.label) list.setAttribute('aria-labelledby', this.label.id);
    list.hidden = true;

    this.options = [];
    var self = this;
    Array.prototype.forEach.call(this.native.options, function (opt) {
      if (opt.value === '') return;            // the placeholder is not a choice
      var li = doc.createElement('li');
      li.className = 'select-option';
      li.id = self.id + '-opt-' + self.options.length;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      li.dataset.value = opt.value;

      if (opt.dataset.name && opt.dataset.short) {
        var n = doc.createElement('span');
        n.textContent = opt.dataset.name;
        var d = doc.createElement('span');
        d.className = 'opt-dial';
        d.textContent = opt.dataset.short;
        li.appendChild(n);
        li.appendChild(d);
      } else {
        li.textContent = opt.textContent;
      }
      list.appendChild(li);
      self.options.push({ el: li, value: opt.value, option: opt });
    });

    this.wrap.appendChild(t);
    this.wrap.appendChild(list);
    this.trigger = t;
    this.valueEl = val;
    this.list = list;
  };

  CustomSelect.prototype.displayFor = function (opt) {
    if (!opt) return '';
    return opt.dataset.short || opt.textContent;
  };

  CustomSelect.prototype.syncFromNative = function () {
    var opt = this.native.options[this.native.selectedIndex];
    var isPlaceholder = !opt || opt.value === '';
    var text = isPlaceholder
      ? (this.native.dataset.placeholder || (opt ? opt.textContent : ''))
      : this.displayFor(opt);

    this.valueEl.textContent = text;
    this.trigger.classList.toggle('is-placeholder', isPlaceholder);

    var value = this.native.value;
    this.options.forEach(function (o) {
      o.el.setAttribute('aria-selected', o.value === value ? 'true' : 'false');
    });
  };

  CustomSelect.prototype.indexOfValue = function (v) {
    for (var i = 0; i < this.options.length; i++) if (this.options[i].value === v) return i;
    return -1;
  };

  CustomSelect.prototype.setActive = function (i) {
    if (!this.options.length) return;
    i = Math.max(0, Math.min(this.options.length - 1, i));
    if (this.active > -1 && this.options[this.active]) {
      this.options[this.active].el.classList.remove('is-active');
    }
    this.active = i;
    var el = this.options[i].el;
    el.classList.add('is-active');
    this.trigger.setAttribute('aria-activedescendant', el.id);
    if (this.open) el.scrollIntoView({ block: 'nearest' });
  };

  /* Flip the list upwards when there is not enough room below the trigger. */
  CustomSelect.prototype.position = function () {
    if (!this.open) return;
    var rect = this.trigger.getBoundingClientRect();
    var below = window.innerHeight - rect.bottom;
    var needs = Math.min(this.list.scrollHeight + 12, 300);
    this.list.classList.toggle('drop-up', below < needs && rect.top > below);
  };

  CustomSelect.prototype.openList = function () {
    if (this.open || !this.options.length) return;
    this.open = true;
    this.list.hidden = false;
    this.trigger.setAttribute('aria-expanded', 'true');
    this.position();

    var sel = this.indexOfValue(this.native.value);
    this.setActive(sel > -1 ? sel : 0);
  };

  CustomSelect.prototype.closeList = function () {
    if (!this.open) return;
    this.open = false;
    this.list.hidden = true;
    this.list.classList.remove('drop-up');
    this.trigger.setAttribute('aria-expanded', 'false');
    this.trigger.removeAttribute('aria-activedescendant');
    if (this.active > -1 && this.options[this.active]) {
      this.options[this.active].el.classList.remove('is-active');
    }
    this.active = -1;
  };

  CustomSelect.prototype.choose = function (i) {
    var o = this.options[i];
    if (!o) return;
    this.native.value = o.value;
    this.native.dispatchEvent(new Event('input',  { bubbles: true }));
    this.native.dispatchEvent(new Event('change', { bubbles: true }));
    this.syncFromNative();
    this.closeList();
    this.trigger.focus();
  };

  CustomSelect.prototype.typeahead = function (ch) {
    var now = Date.now();
    this.typed = (now - this.typedAt > 700 ? '' : this.typed) + ch.toLowerCase();
    this.typedAt = now;
    var start = this.active > -1 ? this.active : 0;
    for (var k = 0; k < this.options.length; k++) {
      var i = (start + (this.typed.length > 1 ? 0 : 1) + k) % this.options.length;
      var text = this.options[i].el.textContent.trim().toLowerCase();
      if (text.indexOf(this.typed) === 0) {
        if (this.open) this.setActive(i); else this.choose(i);
        return;
      }
    }
  };

  CustomSelect.prototype.bind = function () {
    var self = this;

    if (this.label) {
      this.label.addEventListener('click', function (e) {
        e.preventDefault();
        self.trigger.focus();
      });
    }

    this.trigger.addEventListener('click', function () {
      self.open ? self.closeList() : self.openList();
    });

    this.trigger.addEventListener('keydown', function (e) {
      var k = e.key;
      if (k === 'ArrowDown' || k === 'ArrowUp') {
        e.preventDefault();
        if (!self.open) { self.openList(); return; }
        self.setActive(self.active + (k === 'ArrowDown' ? 1 : -1));
      } else if (k === 'Home' || k === 'End') {
        if (!self.open) return;
        e.preventDefault();
        self.setActive(k === 'Home' ? 0 : self.options.length - 1);
      } else if (k === 'Enter' || k === ' ' || k === 'Spacebar') {
        e.preventDefault();
        if (self.open) self.choose(self.active); else self.openList();
      } else if (k === 'Escape') {
        if (self.open) { e.preventDefault(); e.stopPropagation(); self.closeList(); }
      } else if (k === 'Tab') {
        self.closeList();
      } else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        self.typeahead(k);
      }
    });

    this.list.addEventListener('mousemove', function (e) {
      var li = e.target.closest('.select-option');
      if (!li) return;
      var i = self.options.findIndex(function (o) { return o.el === li; });
      if (i > -1 && i !== self.active) self.setActive(i);
    });

    this.list.addEventListener('click', function (e) {
      var li = e.target.closest('.select-option');
      if (!li) return;
      var i = self.options.findIndex(function (o) { return o.el === li; });
      if (i > -1) self.choose(i);
    });

    // keep the custom UI in step if anything else changes the native value
    this.native.addEventListener('change', function () { self.syncFromNative(); });

    doc.addEventListener('pointerdown', function (e) {
      if (self.open && !self.wrap.contains(e.target)) self.closeList();
    });

    // Re-measure rather than close: on mobile a resize is usually just the
    // soft keyboard or the URL bar, and closing there would be maddening.
    window.addEventListener('resize', function () { self.position(); });
    window.addEventListener('orientationchange', function () { self.closeList(); });
  };

  /* ============================================================ dial codes = */

  function buildDialCodes() {
    var sel = $('#dialCode');
    if (!sel) return;
    var list = CFG.DIAL_CODES || [];
    var def  = CFG.DEFAULT_COUNTRY || 'TR';

    list.forEach(function (c) {
      var o = doc.createElement('option');
      o.value = c.iso;
      // Code first: on the touch path this select is narrow, and if the text has
      // to clip it must be the country name that goes, never the dial code.
      o.textContent = c.dial + ' ' + c.name;
      o.dataset.dial  = c.dial;
      o.dataset.short = c.dial;
      o.dataset.name  = c.name;
      if (c.iso === def) o.selected = true;
      sel.appendChild(o);
    });
    if (!sel.value && sel.options.length) sel.selectedIndex = 0;
  }

  function currentDial() {
    var sel = $('#dialCode');
    if (!sel) return '';
    var opt = sel.options[sel.selectedIndex];
    return (opt && opt.dataset.dial) || '';
  }

  /* ============================================================ validation = */

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  var RULES = {
    firstName: function (v) { return v ? '' : 'Please enter your first name.'; },
    lastName:  function (v) { return v ? '' : 'Please enter your last name.'; },
    email: function (v) {
      if (!v) return 'Please enter your email address.';
      return EMAIL_RE.test(v) ? '' : 'That email address does not look right.';
    },
    company: function (v) { return v ? '' : 'Please enter your company name.'; },
    phone: function (v) {
      if (!v) return '';                                    // optional
      var digits = v.replace(/\D/g, '');
      if (digits.length < 6 || digits.length > 15) return 'Please enter a valid phone number.';
      return '';
    },
    businessType: function (v) { return v ? '' : 'Please choose a business type.'; },
    heardFrom: function () { return ''; }                   // optional
  };

  function fieldOf(el) { return el.closest('.field'); }

  function controlFor(el) {
    // where focus should land when a field is invalid
    var wrap = el.parentElement && el.parentElement.classList.contains('select-wrap')
      ? el.parentElement : null;
    if (wrap) {
      var trig = $('.select-trigger', wrap);
      if (trig && wrap.classList.contains('is-enhanced')) return trig;
    }
    return el;
  }

  function showError(el, msg) {
    var field = fieldOf(el);
    var err = field && $('.err', field);
    var ctrl = controlFor(el);
    if (field) field.classList.toggle('is-invalid', !!msg);
    if (err) {
      err.textContent = msg;
      err.hidden = !msg;
    }
    if (msg) {
      ctrl.setAttribute('aria-invalid', 'true');
      if (ctrl !== el) el.setAttribute('aria-invalid', 'true');
    } else {
      ctrl.removeAttribute('aria-invalid');
      if (ctrl !== el) el.removeAttribute('aria-invalid');
    }
  }

  function validateField(el) {
    var rule = RULES[el.name];
    if (!rule) return '';
    var msg = rule(String(el.value || '').trim());
    showError(el, msg);
    return msg;
  }

  function validateAll() {
    var firstBad = null;
    Object.keys(RULES).forEach(function (name) {
      var el = form.elements[name];
      if (!el) return;
      if (validateField(el) && !firstBad) firstBad = el;
    });
    return firstBad;
  }

  /* =============================================================== payload = */

  function utmParams() {
    var q = new URLSearchParams(window.location.search);
    var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
                'gclid', 'fbclid', 'msclkid', 'ttclid', 'li_fat_id'];
    var out = {};
    keys.forEach(function (k) { if (q.get(k)) out[k] = q.get(k); });
    return out;
  }

  function val(name) {
    var el = form.elements[name];
    return el ? String(el.value || '').trim() : '';
  }

  /* Build an E.164 number without prefixing a country code that is already there.
   *   "0532 000 00 00"  + TR  ->  +905320000000   (trunk prefix dropped)
   *   "+90 532 000 00 00"      ->  +905320000000   (already international)
   *   "0090 532 000 00 00"     ->  +905320000000   (00 international prefix)
   * Only an explicit "+" or "00" counts as international — guessing from bare
   * digits would mangle numbers that legitimately start with the dial code. */
  function toE164(raw, dial) {
    var trimmed = String(raw || '').trim();
    var digits = trimmed.replace(/\D/g, '');
    if (!digits) return '';
    if (trimmed.charAt(0) === '+') return '+' + digits;
    if (digits.indexOf('00') === 0) return '+' + digits.slice(2);
    return dial + digits.replace(/^0+/, '');
  }

  function buildPayload() {
    var dial = currentDial();
    var first = val('firstName'), last = val('lastName');
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}

    return {
      formId: 'car-studio-guide-v1',
      source: 'landing:how-to-sell-used-cars-faster',

      firstName: first,
      lastName:  last,
      fullName:  (first + ' ' + last).trim(),
      email:     val('email').toLowerCase(),
      company:   val('company'),

      countryCode: val('dialCode'),
      dialCode:    dial,
      phone:       val('phone'),
      phoneE164:   toE164(val('phone'), dial),

      businessType: val('businessType'),
      heardFrom:    val('heardFrom'),

      meta: {
        submittedAt: new Date().toISOString(),
        pageUrl:   window.location.href,
        pageTitle: doc.title,
        referrer:  doc.referrer || '',
        params:    utmParams(),
        locale:    navigator.language || '',
        timezone:  tz,
        screen:    (window.screen ? window.screen.width + 'x' + window.screen.height : ''),
        userAgent: navigator.userAgent || '',
        fillMs:    Date.now() - startedAt
      }
    };
  }

  /* ================================================================ submit = */

  function setBusy(busy) {
    submitting = busy;
    submitBtn.disabled = busy;
    submitBtn.classList.toggle('is-busy', busy);
    submitBtn.setAttribute('aria-busy', busy ? 'true' : 'false');
    $('.submit-label', submitBtn).textContent = busy ? 'Sending…' : 'Show me the guide';
  }

  function showAlert(msg) {
    if (!alertBox) return;
    alertBox.textContent = msg;
    alertBox.hidden = !msg;
    if (msg) alertBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function isSameOrigin(url) {
    try { return new URL(url, window.location.href).origin === window.location.origin; }
    catch (e) { return false; }
  }

  // The response comes from n8n, but it still ends up in an href — only let
  // real http(s) URLs through, never javascript:, data: or anything exotic.
  function safeUrl(url) {
    if (!url || typeof url !== 'string' || !url.trim()) return '';
    try {
      var u = new URL(url.trim(), window.location.href);
      return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : '';
    } catch (e) { return ''; }
  }

  function showSuccess(downloadUrl, firstName) {
    var nameEl = $('#success-name');
    if (nameEl && firstName) nameEl.textContent = ', ' + firstName;

    var btn = $('#download-btn');
    var href = safeUrl(downloadUrl) || safeUrl(CFG.EBOOK_URL) || '';
    if (btn) {
      if (href) {
        btn.href = href;
        if (isSameOrigin(href)) {
          btn.setAttribute('download', CFG.EBOOK_FILENAME || '');
          btn.removeAttribute('target');
          btn.removeAttribute('rel');
        } else {
          btn.removeAttribute('download');
          btn.target = '_blank';
          btn.rel = 'noopener noreferrer';
        }
      } else {
        btn.hidden = true;
      }
    }

    formPanel.hidden = true;
    successPanel.hidden = false;
    successPanel.focus();

    if (typeof window.dataLayer !== 'undefined' && window.dataLayer.push) {
      window.dataLayer.push({ event: 'generate_lead', form_id: 'car-studio-guide-v1' });
    }
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (submitting) return;
    wasSubmitted = true;
    showAlert('');

    var firstBad = validateAll();
    if (firstBad) {
      var ctrl = controlFor(firstBad);
      ctrl.focus();
      ctrl.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }

    // honeypot — a real person never sees this field
    var hp = form.elements.companyWebsite;
    if (hp && hp.value) { showSuccess(null, val('firstName')); return; }

    var payload = buildPayload();
    if (payload.meta.fillMs < (CFG.MIN_FILL_MS || 0)) payload.meta.suspiciouslyFast = true;

    var url = CFG.WEBHOOK_URL || '';
    if (!url || url.indexOf('YOUR-N8N-HOST') > -1) {
      console.error('[car-studio] WEBHOOK_URL is not configured in js/config.js');
      showAlert(CFG.ERROR_MESSAGE || 'Something went wrong. Please try again.');
      return;
    }

    setBusy(true);

    var ctrl2 = new AbortController();
    var timer = setTimeout(function () { ctrl2.abort(); }, CFG.TIMEOUT_MS || 15000);

    fetch(url, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl2.signal
    })
      .then(function (res) {
        return res.text().then(function (text) {
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (err) { /* not JSON */ }
          if (!res.ok) {
            var m = (data && (data.message || data.error)) || ('Request failed (' + res.status + ')');
            throw new Error(m);
          }
          return data;
        });
      })
      .then(function (data) {
        if (data && data.ok === false) throw new Error(data.message || 'Rejected');
        showSuccess(data && data.downloadUrl, payload.firstName);
      })
      .catch(function (err) {
        console.error('[car-studio] submit failed:', err);
        showAlert(CFG.ERROR_MESSAGE || 'Something went wrong. Please try again.');
        setBusy(false);
      })
      .finally(function () { clearTimeout(timer); });
  });

  // re-validate a field once the user has already tried to submit
  form.addEventListener('input', function (e) {
    if (!wasSubmitted || !e.target.name || !RULES[e.target.name]) return;
    if (fieldOf(e.target) && fieldOf(e.target).classList.contains('is-invalid')) validateField(e.target);
  });
  form.addEventListener('change', function (e) {
    if (!wasSubmitted || !e.target.name || !RULES[e.target.name]) return;
    validateField(e.target);
  });
  form.addEventListener('blur', function (e) {
    if (!wasSubmitted || !e.target.name || !RULES[e.target.name]) return;
    validateField(e.target);
  }, true);

  /* ================================================================== init = */

  buildDialCodes();
  if (!USE_NATIVE_SELECTS) {
    $$('[data-select]').forEach(function (wrap) {
      try {
        new CustomSelect(wrap);
      } catch (err) {
        console.error('[car-studio] select enhancement failed:', err);
        wrap.classList.add('is-native');   // fall back to the native control
      }
    });
  }
})();
