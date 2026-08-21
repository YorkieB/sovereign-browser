// The page-facing vault surface.
//
// Separate from the vault window's API and deliberately much narrower, because
// this one is reachable from web pages. What a page may do:
//
//   query(pageUrl)          which of MY credentials exist - username + label
//                           only, never a password
//   fill(pageUrl, id)       one password, for one entry, matching MY origin
//   generate(options)       a new password; touches no stored data
//   prepareSave(...)        work out what a save prompt should offer
//
// What a page may never do: list the vault, read another origin's entries,
// learn whether the vault exists or is unlocked beyond a coarse code, or write
// anything. Saving is committed only after the user accepts a prompt drawn by
// the browser, never by the page.

import { entriesForOrigin, originsMatch, displayHost, normaliseOrigin } from './origin-match.mjs';

export class PageVaultError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PageVaultError';
    this.code = code;
  }
}

const MAX_SUGGESTIONS = 12;

export function createPageVault({ service, generate }) {
  if (!service) throw new Error('createPageVault requires a vault service.');
  if (typeof generate !== 'function') throw new Error('createPageVault requires a generate function.');

  const requireUnlocked = () => {
    if (service.state !== 'unlocked') {
      throw new PageVaultError('LOCKED', 'The vault is locked.');
    }
  };

  const requireUsableOrigin = (pageUrl) => {
    const o = normaliseOrigin(pageUrl);
    if (!o) throw new PageVaultError('BAD_ORIGIN', 'This page cannot use the vault.');
    return o;
  };

  return {
    /** Usernames and labels for this origin only. No passwords, ever. */
    query(pageUrl) {
      requireUsableOrigin(pageUrl);
      requireUnlocked();
      return entriesForOrigin(service.list(), pageUrl)
        .slice(0, MAX_SUGGESTIONS)
        .map((e) => ({ id: e.id, username: e.username, service: e.service }));
    },

    /**
     * One password, for one entry the caller's origin actually owns. The id is
     * re-checked against the origin here: a page that guesses or replays an id
     * from another site gets NO_MATCH, not a password.
     */
    fill(pageUrl, id) {
      requireUsableOrigin(pageUrl);
      requireUnlocked();
      if (typeof id !== 'string' || !id) throw new PageVaultError('BAD_REQUEST', 'Bad entry id.');
      const entry = service.get(id);
      if (!entry) throw new PageVaultError('NO_MATCH', 'No such entry.');
      const verdict = originsMatch(pageUrl, entry.url);
      if (!verdict.match) throw new PageVaultError('NO_MATCH', 'No such entry.');
      return { id: entry.id, username: entry.username, password: entry.password };
    },

    /** Generation touches nothing stored, so it works with the vault locked. */
    generate(options) {
      return generate(options || {});
    },

    /**
     * Decide what a save prompt should offer, without saving anything.
     *   'create'  nothing stored for this origin + username
     *   'update'  same username, different password - a change
     *   'none'    already stored, identical; nothing to ask
     */
    prepareSave(pageUrl, { username, password }) {
      const origin = requireUsableOrigin(pageUrl);
      if (typeof password !== 'string' || password === '') {
        throw new PageVaultError('BAD_REQUEST', 'No password to save.');
      }
      const user = typeof username === 'string' ? username : '';
      if (service.state !== 'unlocked') {
        // Worth knowing: the user must unlock before this can be committed,
        // but the prompt can still be offered.
        return { action: 'create', needsUnlock: true, host: origin.host, username: user };
      }
      const existing = entriesForOrigin(service.list(), pageUrl)
        .find((e) => (e.username || '') === user);
      if (!existing) {
        return { action: 'create', needsUnlock: false, host: origin.host, username: user };
      }
      if (existing.password === password) {
        return { action: 'none', needsUnlock: false, host: origin.host, username: user, entryId: existing.id };
      }
      return { action: 'update', needsUnlock: false, host: origin.host, username: user, entryId: existing.id };
    },

    /**
     * Commit a save. Only ever called by main AFTER the user accepts a prompt
     * drawn by the browser - never straight from a page message.
     */
    commitSave(pageUrl, { username, password, action, entryId }) {
      const origin = requireUsableOrigin(pageUrl);
      requireUnlocked();
      if (typeof password !== 'string' || password === '') {
        throw new PageVaultError('BAD_REQUEST', 'No password to save.');
      }
      if (action === 'update') {
        if (typeof entryId !== 'string' || !entryId) throw new PageVaultError('BAD_REQUEST', 'No entry to update.');
        const entry = service.get(entryId);
        if (!entry || !originsMatch(pageUrl, entry.url).match) {
          throw new PageVaultError('NO_MATCH', 'No such entry.');
        }
        return service.update(entryId, { password });
      }
      return service.add({
        service: origin.host,
        username: typeof username === 'string' ? username : '',
        password,
        url: `${origin.scheme}//${origin.host}`,
        category: 'Other',
      });
    },

    displayHost,
  };
}
