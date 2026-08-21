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
      .panel { position: absolute; min-width: 260px; background: #fff; color: #1c1c1c;
        border: 1px solid #d8d5d0; border-radius: 10px; box-shadow: 0 8px 28px rgba(0,0,0,.18);
        font: 14px/1.4 system-ui, sans-serif; overflow: hidden; }
      .row { display: block; width: 100%; text-align: left; padding: 10px 12px; background: none;
        border: 0; cursor: pointer; font: inherit; }
      .row:hover { background: #f2efe9; }
      .user { font-weight: 600; }
      .site { color: #6b6b6b; font-size: 12px; }
      .sep { height: 1px; background: #eceae5; }
      .gen { color: #0b5cad; font-weight: 600; }
      .note { padding: 8px 12px; color: #6b6b6b; font-size: 12px; }
    `;
    shadow.appendChild(style);
    return shadow;
  }

  function hidePanel() {
    if (!shadow) return;
    const p = shadow.querySelector('.panel');
    if (p) p.remove();
  }

  function showPanel(anchor, rows) {
    const sh = ensureHost();
    hidePanel();
    const r = anchor.getBoundingClientRect();
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.style.top = `${window.scrollY + r.bottom + 4}px`;
    panel.style.left = `${window.scrollX + r.left}px`;
    panel.style.width = `${Math.max(260, r.width)}px`;
    for (const row of rows) {
      if (row.kind === 'sep') { const s = document.createElement('div'); s.className = 'sep'; panel.appendChild(s); continue; }
      if (row.kind === 'note') { const n = document.createElement('div'); n.className = 'note'; n.textContent = row.label; panel.appendChild(n); continue; }
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'row';
      b.innerHTML = row.sub
        ? `<span class="user">${escapeHtml(row.label)}</span><br><span class="site">${escapeHtml(row.sub)}</span>`
        : `<span class="${row.accent ? 'gen' : 'user'}">${escapeHtml(row.label)}</span>`;
      b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); hidePanel(); row.onPick(); });
      panel.appendChild(b);
    }
    sh.appendChild(panel);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
      showPanel(field.password, [
        { kind: 'row', label: 'Generate a strong password', accent: true, onPick: async () => {
          const res = await api.generate({ length: 20 });
          if (!res.ok) return;
          setValue(field.password, res.value);
          const confirm = Array.from(field.scope.querySelectorAll('input[type="password"]'))
            .filter((el) => el !== field.password && isVisible(el));
          for (const c of confirm) setValue(c, res.value);
          pending = { username: field.username ? field.username.value : '', password: res.value };
        } },
        { kind: 'note', label: 'Saved to your vault when you submit.' },
      ]);
      return;
    }
    const res = await api.suggestions();
    if (!res.ok || res.value.length === 0) return;
    const rows = res.value.map((s) => ({
      kind: 'row', label: s.username || '(no username)', sub: s.service,
      onPick: async () => {
        const f = await api.fill(s.id);
        if (!f.ok) return;
        if (field.username) setValue(field.username, f.value.username);
        setValue(field.password, f.value.password);
      },
    }));
    showPanel(field.username || field.password, rows);
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
      const focusTarget = field.username || field.password;
      if (!focusTarget.__hollyBound) {
        focusTarget.__hollyBound = true;
        focusTarget.addEventListener('focus', () => offerSuggestions(field));
      }
      if (!field.password.__hollyBound) {
        field.password.__hollyBound = true;
        field.password.addEventListener('focus', () => offerSuggestions(field));
      }
      const form = field.password.closest('form');
      if (form && !form.__hollyBound) {
        form.__hollyBound = true;
        form.addEventListener('submit', () => { capture(field); flush(); }, true);
      }
    }
    return fields;
  }

  document.addEventListener('click', (e) => {
    if (!host || !host.contains(e.target)) hidePanel();
  }, true);

  // Sites render forms late and swap them out; re-scan on mutation, throttled.
  let scanTimer = null;
  const observer = new MutationObserver(() => {
    if (scanTimer) return;
    scanTimer = setTimeout(() => { scanTimer = null; attach(); }, 400);
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  else document.addEventListener('DOMContentLoaded', () => observer.observe(document.body, { childList: true, subtree: true }));

  // Single-page apps navigate without unloading; a captured credential must
  // still be offered.
  window.addEventListener('beforeunload', flush);

  attach();

})();
