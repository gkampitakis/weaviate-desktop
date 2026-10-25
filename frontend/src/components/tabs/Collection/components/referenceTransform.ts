import { weaviate } from "wailsjs/go/models";

const shortenId = (id: string): string => {
  const head = id.split("-")[0] ?? id;
  return head.length > 8 ? head.slice(0, 8) : head;
};

export const formatReferenceValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return `[ ${value.length} ]`;
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    return `{ ${keys.length} }`;
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
};

export const referenceLabel = (target: weaviate.w_ReferenceTarget): string => {
  const properties = target.properties ?? {};
  for (const key of Object.keys(properties)) {
    const formatted = formatReferenceValue(properties[key]);
    if (formatted) return formatted;
  }
  return shortenId(target.id);
};

export const collectReferenceColumns = (
  objects: weaviate.w_WeaviateObject[]
): string[] => {
  const seen = new Set<string>();
  const order: string[] = [];
  const limit = Math.min(objects.length, 200);
  for (let i = 0; i < limit; i++) {
    for (const reference of objects[i].references ?? []) {
      if (!reference.property || seen.has(reference.property)) continue;
      seen.add(reference.property);
      order.push(reference.property);
    }
  }
  return order;
};

export const referencesByProperty = (
  object: weaviate.w_WeaviateObject
): Map<string, weaviate.w_ObjectReference> =>
  new Map((object.references ?? []).map((r) => [r.property, r]));
