/** SSRF guards for user-supplied calendar feed URLs. Safe to import anywhere. */

const BLOCKED_HOST_SUFFIXES = [
  "localhost",
  ".localhost",
  ".local",
  ".internal",
  ".home.arpa",
];

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.goog",
  "instance-data",
]);

function isPrivateIpv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if ([a, Number(m[2]), Number(m[3]), Number(m[4])].some((n) => n > 255)) return true;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0) return true;
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateIpv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (!h.includes(":")) return false;
  if (h === "::" || h === "::1") return true;
  if (h.startsWith("fe80") || h.startsWith("fc") || h.startsWith("fd")) return true;
  const mapped = h.match(/::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  return false;
}

/** Throws a user-safe error when the URL is not a public https calendar feed. */
export function assertSafeFeedUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Enter a valid calendar link");
  }
  if (url.protocol !== "https:") {
    throw new Error("Calendar link must start with https://");
  }
  if (url.username || url.password) {
    throw new Error("Calendar link must not contain credentials");
  }
  if (url.port && url.port !== "443") {
    throw new Error("Calendar link must use the standard https port");
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    BLOCKED_HOSTNAMES.has(host) ||
    BLOCKED_HOST_SUFFIXES.some((s) => host === s.replace(/^\./, "") || host.endsWith(s)) ||
    !host.includes(".") ||
    isPrivateIpv4(host) ||
    isPrivateIpv6(host)
  ) {
    throw new Error("Calendar link must point to a public website");
  }
  return url;
}

/** Fetch a feed with manual redirect handling, re-validating every hop. */
export async function fetchPublicFeed(raw: string, maxRedirects = 3): Promise<Response> {
  let target = assertSafeFeedUrl(raw).toString();
  for (let i = 0; i <= maxRedirects; i++) {
    const res = await fetch(target, {
      redirect: "manual",
      headers: { Accept: "text/calendar, text/plain, */*" },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("Calendar link redirected to an invalid location");
      target = assertSafeFeedUrl(new URL(loc, target).toString()).toString();
      continue;
    }
    return res;
  }
  throw new Error("Calendar link redirected too many times");
}
