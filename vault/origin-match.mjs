// Origin matching for page integration.
//
// This is the most safety-critical function in the vault. Everything the page
// agent does - suggesting credentials, filling them, offering to save - is
// gated on "does this page correspond to this stored entry?". A loose match
// here hands credentials to a lookalike site, so the rules are deliberately
// strict and the failure mode is "no match" rather than "probably fine".
//
// Rules, in order:
//   1. Only http and https pages take part. file:, data:, about:,
//      chrome-extension: and anything else are refused outright.
//   2. Hosts are compared exactly, after normalisation. No suffix matching,
//      no "contains", no subdomain widening. example.com does NOT match
//      sub.example.com, and crucially example.com.evil.co matches nothing.
//   3. The URL parser gives punycode for internationalised hosts, so a
//      homograph like exampIe.com or a Cyrillic lookalike normalises to a
//      different host string and cannot collide with the ASCII original.
//   4. An https entry is never filled into an http page. That would put a
//      credential known to belong on a secure origin onto the wire in clear.
//      The reverse (http entry, https page) is allowed - an upgrade is safe.
//   5. Port is ignored. A credential belongs to a host, and sites move between
//      :443 and :8443 without changing identity.
//
// Rule 2 means a user with credentials on both example.com and
// login.example.com needs two entries. That is a known cost, chosen over the
// alternative: any subdomain rule wide enough to be convenient is also wide
// enough to be abused by a site that hands out subdomains.

export class OriginError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'OriginError';
    this.code = code;
  }
}

const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

/**
 * Normalise a page or entry URL into { scheme, host } or null when the URL is
 * unusable for matching. Never throws on rubbish input - callers treat null as
 * "cannot participate".
 */
export function normaliseOrigin(input) {
  if (typeof input !== 'string' || input.trim() === '') return null;
  let url;
  try {
    url = new URL(input.trim());
  } catch (err) {
    // Entries are often saved as a bare host ("example.com"), so try once more
    // with a scheme before giving up.
    try {
      url = new URL('https://' + input.trim());
    } catch (err2) {
      return null;
    }
  }
  if (!ALLOWED_SCHEMES.has(url.protocol)) return null;

  // URL already lowercases and punycodes the host; strip a trailing root dot,
  // which is legal in DNS and would otherwise defeat an exact comparison.
  const host = url.hostname.replace(/\.$/, '');
  if (!host) return null;
  return { scheme: url.protocol, host };
}

/**
 * Does a stored entry's URL correspond to the page origin?
 * Returns { match: boolean, reason: string } - the reason is for logging and
 * tests, never shown to a page.
 */
export function originsMatch(pageUrl, entryUrl) {
  const page = normaliseOrigin(pageUrl);
  if (!page) return { match: false, reason: 'page origin unusable' };
  const entry = normaliseOrigin(entryUrl);
  if (!entry) return { match: false, reason: 'entry has no usable URL' };

  if (page.host !== entry.host) return { match: false, reason: 'host mismatch' };

  if (entry.scheme === 'https:' && page.scheme === 'http:') {
    return { match: false, reason: 'refusing to fill an https credential into an http page' };
  }
  return { match: true, reason: 'exact host match' };
}

/** Filter a list of vault entries down to those valid for this page. */
export function entriesForOrigin(entries, pageUrl) {
  if (!Array.isArray(entries)) return [];
  return entries.filter((e) => e && originsMatch(pageUrl, e.url).match);
}

/** Display host for prompts: what the user is told they are saving against. */
export function displayHost(pageUrl) {
  const o = normaliseOrigin(pageUrl);
  return o ? o.host : null;
}
