/**
 * Utilities for replacing large numeric arrays in arbitrary JSON-like values
 * with string sentinels that we can intercept inside the JSON view.
 *
 * The JSON view component (@uiw/react-json-view) does not expose a hook to
 * override how a non-leaf node is rendered based on its parent. The closest
 * thing — `Str.render` — is invoked per-leaf-string value. To exploit that we
 * pre-process the value: any numeric array longer than VECTOR_PILL_THRESHOLD
 * is replaced with a sentinel string of the form `__VECTOR_PILL__:<id>`.
 *
 * The original array (and its JSON-pointer-style path) is stored in a
 * registry keyed by id so the custom Str renderer can:
 *  - look the values up and render the <VectorPill> instead of the raw string
 *  - report back the path when the user clicks "expand inline" so we can
 *    rebuild the transformed tree with that path excluded from pill-ification
 */

export const VECTOR_PILL_THRESHOLD = 32;
export const VECTOR_PILL_SENTINEL_PREFIX = "__VECTOR_PILL__:";

const SENTINEL_RE = /^__VECTOR_PILL__:([a-z0-9-]+)$/;

export interface VectorPillEntry {
  values: number[];
  path: string;
}

export type VectorPillRegistry = Map<string, VectorPillEntry>;

let counter = 0;
const nextId = () =>
  `${Date.now().toString(36)}-${(counter++).toString(36)}`;

const isPureNumberArray = (val: unknown): val is number[] => {
  if (!Array.isArray(val)) return false;
  if (val.length <= VECTOR_PILL_THRESHOLD) return false;
  for (let i = 0; i < val.length; i++) {
    if (typeof val[i] !== "number") return false;
  }
  return true;
};

/**
 * Walk an object/array tree, replacing every numeric array with length
 * > VECTOR_PILL_THRESHOLD by a sentinel string. The original array is stored
 * in the provided `registry` (which is cleared at the start of the call).
 * Paths in `expandedPaths` are passed through verbatim.
 */
export const transformWithExpansions = (
  value: unknown,
  registry: VectorPillRegistry,
  expandedPaths: ReadonlySet<string>
): unknown => {
  registry.clear();
  const walk = (node: unknown, path: string): unknown => {
    if (isPureNumberArray(node)) {
      if (expandedPaths.has(path)) return node;
      const id = nextId();
      registry.set(id, { values: node, path });
      return `${VECTOR_PILL_SENTINEL_PREFIX}${id}`;
    }
    if (Array.isArray(node)) {
      return node.map((v, i) => walk(v, `${path}/${i}`));
    }
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        out[k] = walk(v, `${path}/${k}`);
      }
      return out;
    }
    return node;
  };
  return walk(value, "");
};

/** Extract the id from a sentinel string, or null if not a sentinel. */
export const parseSentinel = (s: string): string | null => {
  const m = SENTINEL_RE.exec(s);
  return m ? m[1] : null;
};
