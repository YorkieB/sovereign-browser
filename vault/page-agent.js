// The page agent: the only vault code that runs inside a web page.
//
// It assumes the page is hostile. Two consequences shape everything here:
//
//  * The UI lives in a CLOSED shadow root. The page cannot querySelector into
//    it, cannot read what is suggested, and cannot style it into invisibility
//    and trick the user into clicking something else.
//  * The agent never holds more than one password at a time, and only after a
//    real click. It does not pre-fill on page load: a page that could read a
//    pre-filled field would harvest credentials just by existing.
//
// Detection has to cope with honeypots (hidden fields planted to catch bots),
// search boxes that look like usernames, and registration forms that need a
// generated password rather than a stored one.

(() => {
  'use strict';
  if (window.__hollyAgentLoaded) return;
  window.__hollyAgentLoaded = true;

  const api = window.hollyVault;

  // ---- visibility -------------------------------------------------------
  // A field the user cannot see is not a field the user is filling in.
  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    if (el.type === 'hidden') return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (parseFloat(style.opacity) < 0.1) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    const r = el.getBoundingClientRect();
    if (r.width < 20 || r.height < 8) return false;
    // Pushed off-screen: a favourite honeypot trick.
    if (r.right < 0 || r.bottom < 0) return false;
    return true;
  }

  const HONEYPOT = /honeypot|fakepass|donotfill|bot[-_]?trap|nofill/i;
  function isHoneypot(el) {
    const hay = `${el.name || ''} ${el.id || ''} ${el.className || ''} ${el.getAttribute('autocomplete') || ''}`;
    return HONEYPOT.test(hay);
  }

  // ---- field discovery --------------------------------------------------
  const USERNAME_HINT = /user|email|login|account|identifier|phone/i;
  const SEARCH_HINT = /search|query|find|filter/i;

  function usernameFor(passwordEl, scope) {
    const candidates = Array.from(scope.querySelectorAll('input'))
      .filter((el) => ['text', 'email', 'tel', ''].includes((el.type || '').toLowerCase()))
      .filter((el) => isVisible(el) && !isHoneypot(el));

    // Prefer an explicit autocomplete declaration - it is the one signal sites
    // get right often enough to trust first.
    const declared = candidates.find((el) => /username|email/i.test(el.getAttribute('autocomplete') || ''));
    if (declared) return declared;

    // Otherwise the nearest preceding field that looks like an identifier and
    // does not look like a search box.
    const before = candidates.filter((el) =>
      passwordEl.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING);
    const named = before.reverse().find((el) => {
      const hay = `${el.name || ''} ${el.id || ''} ${el.placeholder || ''} ${el.getAttribute('aria-label') || ''}`;
      return USERNAME_HINT.test(hay) && !SEARCH_HINT.test(hay);
    });
    return named || null;
  }

  function classify(passwordEl, scope) {
    const ac = (passwordEl.getAttribute('autocomplete') || '').toLowerCase();
    if (ac.includes('new-password')) return 'register';
    if (ac.includes('current-password')) return 'login';
    const passwords = Array.from(scope.querySelectorAll('input[type="password"]'))
      .filter((el) => isVisible(el) && !isHoneypot(el));
    // Two visible password boxes is a password and its confirmation.
    if (passwords.length > 1) return 'register';
    const text = (scope.innerText || '').slice(0, 2000);
    if (/\b(sign up|create account|register|get started|join)\b/i.test(text)) return 'register';
    return 'login';
  }

  function findFields(root = document) {
    const out = [];
    const passwords = Array.from(root.querySelectorAll('input[type="password"]'));
    for (const p of passwords) {
      if (!isVisible(p) || isHoneypot(p)) continue;
      const scope = p.closest('form') || root.body || root;
      // A confirmation box is part of a pair already handled by the first.
      if (out.some((f) => f.scope === scope)) continue;
      out.push({ password: p, username: usernameFor(p, scope), kind: classify(p, scope), scope });
    }
    return out;
  }

  // ---- suggestion UI ----------------------------------------------------
  // Closed shadow root: the page holds no reference to it and cannot read it.
  let host = null;
  let shadow = null;

  function ensureHost() {
    if (host && host.isConnected) return shadow;
    host = document.createElement('div');
    host.setAttribute('data-holly', '');
    Object.assign(host.style, { position: 'absolute', top: '0', left: '0', width: '0', height: '0', zIndex: '2147483647' });
    (document.body || document.documentElement).appendChild(host);
    shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      .panel { position: absolute; min-width: 300px; max-width: 380px; background: #fff; color: #1c1c1c;
        border: 1px solid #e3e1de; border-radius: 14px; box-shadow: 0 12px 34px rgba(0,0,0,.16);
        font: 14px/1.4 system-ui, sans-serif; overflow: hidden; }
      .head { display: flex; align-items: center; justify-content: space-between;
        padding: 12px 14px 10px; font-weight: 700; font-size: 14px; }
      .close { border: 0; background: none; cursor: pointer; font-size: 18px; line-height: 1;
        color: #6b6b6b; padding: 0 2px; }
      .close:hover { color: #1c1c1c; }
      .list { max-height: 280px; overflow-y: auto; }
      .row { display: block; width: 100%; text-align: left; padding: 9px 14px; background: none;
        border: 0; cursor: pointer; font: inherit; }
      .row:hover { background: #f4f2ef; }
      .line1 { display: flex; gap: 6px; align-items: baseline; }
      .user { font-weight: 600; color: #1c1c1c; }
      .site { color: #6b6b6b; font-size: 12.5px; }
      .dots { color: #8a8a8a; letter-spacing: 2px; font-size: 13px; margin-top: 2px; }
      .sep { height: 1px; background: #eceae5; }
      .manage { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left;
        padding: 11px 14px; background: none; border: 0; cursor: pointer; font: inherit; color: #4a4a4a; }
      .manage:hover { background: #f4f2ef; }
      .gen { color: #0b5cad; font-weight: 600; }
      .note { padding: 8px 14px 12px; color: #6b6b6b; font-size: 12px; }
      .badge { position: absolute; display: flex; align-items: center; justify-content: center;
        min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; cursor: pointer;
        background: #7c4dff; color: #fff; font: 600 11px/1 system-ui, sans-serif;
        box-shadow: 0 1px 4px rgba(0,0,0,.25); }
      .badge-empty { background: #cfcbe6; color: #4a4458; font-size: 12px; }
    `;
    shadow.appendChild(style);
    return shadow;
  }

  function hidePanel() {
    if (!shadow) return;
    const p = shadow.querySelector('.panel');
    if (p) p.remove();
  }

  function showPanel(anchor, spec) {
    const sh = ensureHost();
    hidePanel();
    const r = anchor.getBoundingClientRect();
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.style.top = `${window.scrollY + r.bottom + 6}px`;
    panel.style.left = `${window.scrollX + r.left}px`;
    panel.style.width = `${Math.max(300, Math.min(380, r.width))}px`;

    const head = document.createElement('div');
    head.className = 'head';
    const title = document.createElement('span');
    title.textContent = spec.title;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'close';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '\u00d7';
    close.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); hidePanel(); });
    head.appendChild(title);
    head.appendChild(close);
    panel.appendChild(head);

    const list = document.createElement('div');
    list.className = 'list';
    for (const row of spec.rows) {
      if (row.kind === 'note') {
        const n = document.createElement('div');
        n.className = 'note';
        n.textContent = row.label;
        list.appendChild(n);
        continue;
      }
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'row';
      const line1 = document.createElement('div');
      line1.className = 'line1';
      const user = document.createElement('span');
      user.className = row.accent ? 'gen' : 'user';
      user.textContent = row.label;
      line1.appendChild(user);
      if (row.site) {
        const site = document.createElement('span');
        site.className = 'site';
        site.textContent = `(${row.site})`;
        line1.appendChild(site);
      }
      b.appendChild(line1);
      if (row.masked) {
        const dots = document.createElement('div');
        dots.className = 'dots';
        // Decorative only, and a FIXED length. Rendering the real password
        // length would put a fact about the secret into the page before the
        // user has chosen anything.
        dots.textContent = '\u2022'.repeat(10);
        b.appendChild(dots);
      }
      b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); hidePanel(); row.onPick(); });
      list.appendChild(b);
    }
    panel.appendChild(list);

    if (spec.manage) {
      const sep = document.createElement('div');
      sep.className = 'sep';
      panel.appendChild(sep);
      const m = document.createElement('button');
      m.type = 'button';
      m.className = 'manage';
      m.textContent = '\u2699  Manage passwords';
      m.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        hidePanel();
        if (api && api.openManager) api.openManager().catch(() => {});
      });
      panel.appendChild(m);
    }

    sh.appendChild(panel);
  }

  // A small count chip on the field, so it is obvious there is something to
  // fill without having to focus and hope.
  function showBadge(anchor, count, onClick) {
    const sh = ensureHost();
    const existing = sh.querySelector('.badge');
    if (existing) existing.remove();
    const r = anchor.getBoundingClientRect();
    if (r.width < 40) return;
    const b = document.createElement('div');
    // Always rendered. A count when there is something to fill, a key glyph
    // when there is not - so "nothing saved here" and "autofill is not
    // running" never look the same.
    b.className = count > 0 ? 'badge' : 'badge badge-empty';
    b.textContent = count > 0 ? String(count) : '\u26bf';
    b.title = count > 0
      ? `${count} saved ${count === 1 ? 'password' : 'passwords'} for this site`
      : 'Holly Keychain - no saved passwords for this site';
    b.style.top = `${window.scrollY + r.top + (r.height / 2) - 9}px`;
    b.style.left = `${window.scrollX + r.right - 28}px`;
    b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onClick(); });
    sh.appendChild(b);
  }

  function hideBadge() {
    if (!shadow) return;
    const b = shadow.querySelector('.badge');
    if (b) b.remove();
  }

  // ---- filling ----------------------------------------------------------
  // Setting .value directly does not notify frameworks; React and friends
  // listen for input events on the native setter, so both are needed or the
  // site's own state stays empty and the form submits blank.
  function setValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function offerSuggestions(field) {
    if (!api) return;
    if (field.kind === 'register') {
      showPanel(field.password, {
        title: 'Create a password',
        manage: true,
        rows: [
          { label: 'Generate a strong password', accent: true, onPick: async () => {
            const res = await api.generate({ length: 20 });
            if (!res.ok) return;
            setValue(field.password, res.value);
            const confirm = Array.from(field.scope.querySelectorAll('input[type="password"]'))
              .filter((el) => el !== field.password && isVisible(el));
            for (const c of confirm) setValue(c, res.value);
            pending = { username: field.username ? field.username.value : '', password: res.value };
          } },
          { kind: 'note', label: 'Holly will offer to save it when you submit.' },
        ],
      });
      return;
    }

    const anchor = field.username || field.password;
    const res = await api.suggestions();

    // The panel always opens. A silent nothing leaves you wondering whether
    // the vault is locked, whether nothing is stored, or whether autofill is
    // broken - three very different problems that deserve three answers.
    if (!res.ok) {
      const locked = res.code === 'LOCKED';
      showPanel(anchor, {
        title: 'Saved passwords',
        manage: true,
        rows: [{
          kind: 'note',
          label: locked
            ? 'Your vault is locked. Unlock Keychain to see saved passwords.'
            : 'Passwords are unavailable right now.',
        }],
      });
      return;
    }

    if (res.value.length === 0) {
      showPanel(anchor, {
        title: 'Saved passwords',
        manage: true,
        rows: [{ kind: 'note', label: `No passwords available for ${location.hostname}.` }],
      });
      return;
    }

    const site = location.hostname;
    showPanel(anchor, {
      title: 'Saved passwords',
      manage: true,
      rows: res.value.map((s) => ({
        label: s.username || '(no username)',
        site,
        masked: true,
        onPick: async () => {
          const f = await api.fill(s.id);
          if (!f.ok) return;
          if (field.username) setValue(field.username, f.value.username);
          setValue(field.password, f.value.password);
          markField(field);
        },
      })),
    });
  }

  // The badge sits on every login field, always - the same way Proton Pass
  // does it. Its absence would otherwise be ambiguous: no badge could mean
  // "nothing saved" or "autofill is not running here", and those need telling
  // apart. It shows a count when there are matches and a key glyph otherwise.
  async function markField(field) {
    if (!api || field.kind === 'register') return;
    const anchor = field.username || field.password;
    let count = 0;
    try {
      const res = await api.suggestions();
      count = res.ok ? res.value.length : 0;
    } catch (err) {
      count = 0;
    }
    showBadge(anchor, count, () => offerSuggestions(field));
  }

  // ---- save capture -----------------------------------------------------
  let pending = null;

  function capture(field) {
    const username = field.username ? field.username.value : '';
    const password = field.password.value;
    if (!password) return;
    pending = { username, password };
  }

  function flush() {
    if (!pending || !api) return;
    const { username, password } = pending;
    pending = null;
    api.offerSave(username, password).catch(() => { /* the browser decides; the page is told nothing */ });
  }

  function attach() {
    const fields = findFields(document);
    for (const field of fields) {
      const form = field.password.closest('form');
      if (form && !form.__hollyBound) {
        form.__hollyBound = true;
        form.addEventListener('submit', () => { capture(field); flush(); }, true);
      }
      markField(field);
    }
    return fields;
  }

  // Focus is the one signal that always arrives. Sites reveal login forms in
  // ways a MutationObserver can miss - a panel that was in the DOM all along
  // and is un-hidden by a class change fires no childList mutation at all,
  // which is exactly how Namecheap's sign-in dropdown behaved. Re-scanning
  // when a field is focused catches every such case, whatever the site did.
  document.addEventListener('focusin', (event) => {
    const el = event.target;
    if (!el || el.tagName !== 'INPUT') return;
    const type = (el.type || '').toLowerCase();
    if (!['password', 'text', 'email', 'tel', ''].includes(type)) return;
    const fields = attach();
    const field = fields.find((f) => f.password === el || f.username === el);
    if (field) offerSuggestions(field);
  }, true);

  document.addEventListener('click', (e) => {
    if (!host || !host.contains(e.target)) hidePanel();
  }, true);

  // Re-scan on mutation, throttled. Attributes are watched as well as
  // childList: revealing a hidden form by toggling a class or a style is a
  // pure attribute change and would otherwise go unnoticed.
  let scanTimer = null;
  const observer = new MutationObserver(() => {
    if (scanTimer) return;
    scanTimer = setTimeout(() => { scanTimer = null; attach(); }, 400);
  });
  const observeOptions = {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'type'],
  };
  if (document.body) observer.observe(document.body, observeOptions);
  else document.addEventListener('DOMContentLoaded', () => observer.observe(document.body, observeOptions));

  // Single-page apps navigate without unloading; a captured credential must
  // still be offered.
  window.addEventListener('beforeunload', flush);

  attach();

})();
