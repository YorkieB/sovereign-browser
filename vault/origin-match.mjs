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
  return { scheme: url.protocol, host, baseHost: stripWww(host) };
}

/**
 * www is treated as equivalent to the apex, and ONLY www. Every mainstream
 * browser and password manager does this, because sites move between the two
 * freely and users cannot be expected to keep an entry for each. No other
 * subdomain is folded: login.example.com stays distinct from example.com,
 * because services that hand out subdomains would otherwise let one tenant
 * claim another's credentials.
 *
 * Only stripped when something of substance remains, so a hypothetical host of
 * exactly "www.uk" cannot collapse to a bare suffix.
 */
function stripWww(host) {
  if (!host.startsWith('www.')) return host;
  const rest = host.slice(4);
  return rest.split('.').length >= 2 ? rest : host;
}

/**
 * A vault entry's URL field frequently holds SEVERAL urls - Proton exports
 * write them comma-separated, and hand-edited entries use newlines. Parsed as
 * one string, only the first host could ever match and the rest were dead.
 * Splitting is conservative: newline and semicolon always, and a comma only
 * when it separates rather than sits inside a query string.
 */
export function entryUrls(input) {
  if (typeof input !== 'string') return [];
  return input
    .split(/[\r\n;]+|,\s*(?=https?:\/\/)|,\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Does a stored entry's URL correspond to the page origin?
 * Returns { match: boolean, reason: string } - the reason is for logging and
 * tests, never shown to a page.
 */
export function originsMatch(pageUrl, entryUrl) {
  const page = normaliseOrigin(pageUrl);
  if (!page) return { match: false, reason: 'page origin unusable' };

  const candidates = entryUrls(entryUrl);
  if (candidates.length === 0) return { match: false, reason: 'entry has no usable URL' };

  let sawUsable = false;
  let downgrade = false;
  for (const candidate of candidates) {
    const entry = normaliseOrigin(candidate);
    if (!entry) continue;
    sawUsable = true;
    if (page.baseHost !== entry.baseHost) continue;
    if (entry.scheme === 'https:' && page.scheme === 'http:') { downgrade = true; continue; }
    return {
      match: true,
      reason: page.host === entry.host ? 'exact host match' : 'www/apex equivalent host',
    };
  }
  if (downgrade) {
    return { match: false, reason: 'refusing to fill an https credential into an http page' };
  }
  return { match: false, reason: sawUsable ? 'host mismatch' : 'entry has no usable URL' };
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
