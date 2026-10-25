import { models, weaviate } from "wailsjs/go/models";

export type ExpiryStatus = "ok" | "soon" | "imminent" | "expired";

export interface ExpiryInfo {
  expiresAtMs: number;
  status: ExpiryStatus;
  relative: string;
  absolute: string;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Resolve the timestamp (ms) for the configured `deleteOn` field on the object.
 * Returns null when the value is missing or can't be parsed.
 */
const resolveDeleteOnMs = (
  object: weaviate.w_WeaviateObject,
  deleteOn: string
): number | null => {
  if (deleteOn === "_creationTimeUnix") {
    return typeof object.creationTimeUnix === "number"
      ? object.creationTimeUnix
      : null;
  }

  if (deleteOn === "_lastUpdateTimeUnix") {
    return typeof object.lastUpdateTimeUnix === "number"
      ? object.lastUpdateTimeUnix
      : null;
  }

  // User-defined property: may be a date string or unix timestamp.
  const props = object.properties as Record<string, unknown> | undefined;
  const raw = props?.[deleteOn];

  if (raw === null || raw === undefined) {
    return null;
  }

  if (typeof raw === "number" && Number.isFinite(raw)) {
    // Heuristic: < 10^12 means seconds, otherwise ms.
    return raw < 1e12 ? raw * SECOND : raw;
  }

  if (typeof raw === "string") {
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

const formatRelative = (deltaMs: number): string => {
  const past = deltaMs < 0;
  const abs = Math.abs(deltaMs);

  let primary: string;
  if (abs >= DAY) {
    const d = Math.floor(abs / DAY);
    const h = Math.floor((abs % DAY) / HOUR);
    primary = h > 0 ? `${d}d ${h}h` : `${d}d`;
  } else if (abs >= HOUR) {
    const h = Math.floor(abs / HOUR);
    const m = Math.floor((abs % HOUR) / MINUTE);
    primary = m > 0 ? `${h}h ${m}m` : `${h}h`;
  } else if (abs >= MINUTE) {
    primary = `${Math.floor(abs / MINUTE)}m`;
  } else {
    primary = `${Math.max(1, Math.floor(abs / SECOND))}s`;
  }

  return past ? `Expired ${primary} ago` : `Expires in ${primary}`;
};

export const computeExpiry = (
  object: weaviate.w_WeaviateObject,
  ttl: models.w_ObjectTTLConfig | undefined,
  now: number = Date.now()
): ExpiryInfo | null => {
  if (!ttl || !ttl.enabled || !ttl.defaultTtl || !ttl.deleteOn) {
    return null;
  }

  const baseMs = resolveDeleteOnMs(object, ttl.deleteOn);
  if (baseMs === null) {
    return null;
  }

  const expiresAtMs = baseMs + ttl.defaultTtl * SECOND;
  const delta = expiresAtMs - now;

  let status: ExpiryStatus;
  if (delta <= 0) {
    status = "expired";
  } else if (delta < HOUR) {
    status = "imminent";
  } else if (delta < DAY) {
    status = "soon";
  } else {
    status = "ok";
  }

  return {
    expiresAtMs,
    status,
    relative: formatRelative(delta),
    absolute: new Date(expiresAtMs).toLocaleString(),
  };
};
