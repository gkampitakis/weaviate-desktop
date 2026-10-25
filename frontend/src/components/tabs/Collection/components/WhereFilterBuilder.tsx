import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Filter, Plus, X } from "lucide-react";
import { useMemo } from "react";

/**
 * Mirror of the Go `weaviate.WhereFilter` shape used for both UI state and
 * what we send across the wire. The frontend always emits an `And` group
 * containing the leaf clauses (MVP — see report).
 */
export type WhereValueType =
  | "text"
  | "string"
  | "int"
  | "number"
  | "boolean"
  | "date";

export type WhereOperator =
  | "Equal"
  | "NotEqual"
  | "GreaterThan"
  | "GreaterThanEqual"
  | "LessThan"
  | "LessThanEqual"
  | "Like"
  | "IsNull"
  | "ContainsAny"
  | "ContainsAll";

export interface WhereLeaf {
  id: string;
  property: string; // schema property name
  valueType: WhereValueType;
  operator: WhereOperator;
  // raw text the user typed — interpreted per valueType at submit time
  valueText: string;
  valueBoolean: boolean;
}

export interface WireWhereFilter {
  operator: string;
  path?: string[];
  valueType?: string;
  valueText?: string;
  valueString?: string;
  valueInt?: number;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueDate?: string;
  valueTexts?: string[];
  valueInts?: number[];
  valueNumbers?: number[];
  operands?: WireWhereFilter[];
}

export interface SchemaProperty {
  name: string;
  dataType: string;
}

const OPERATORS_FOR: Record<WhereValueType, WhereOperator[]> = {
  text: [
    "Equal",
    "NotEqual",
    "Like",
    "ContainsAny",
    "ContainsAll",
    "IsNull",
  ],
  string: ["Equal", "NotEqual", "ContainsAny", "ContainsAll", "IsNull"],
  int: [
    "Equal",
    "NotEqual",
    "GreaterThan",
    "GreaterThanEqual",
    "LessThan",
    "LessThanEqual",
    "ContainsAny",
    "ContainsAll",
    "IsNull",
  ],
  number: [
    "Equal",
    "NotEqual",
    "GreaterThan",
    "GreaterThanEqual",
    "LessThan",
    "LessThanEqual",
    "ContainsAny",
    "ContainsAll",
    "IsNull",
  ],
  boolean: ["Equal", "NotEqual", "IsNull"],
  date: [
    "Equal",
    "NotEqual",
    "GreaterThan",
    "GreaterThanEqual",
    "LessThan",
    "LessThanEqual",
    "IsNull",
  ],
};

const NUMERIC_TYPES = new Set([
  "int",
  "number",
  "int[]",
  "number[]",
  "uuid",
  "uuid[]",
]);

/** Map a Weaviate dataType (first element of `dataType[]`) to our internal value type. */
export const valueTypeFor = (dataType: string): WhereValueType => {
  const dt = (dataType || "").toLowerCase().replace(/\[]$/, "");
  switch (dt) {
    case "int":
      return "int";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "date":
      return "date";
    case "string":
      return "string";
    case "text":
    case "uuid":
    case "geocoordinates":
    case "phonenumber":
    case "blob":
    default:
      return "text";
  }
};

/** Filter the schema down to properties that we can sensibly filter on. */
export const filterableProperties = (
  props: SchemaProperty[]
): SchemaProperty[] =>
  props.filter((p) => {
    if (!p.name || !p.dataType) return false;
    if (p.dataType.startsWith("[]")) return false;
    // Cross-references (PascalCase class name) — skip for MVP, would need path traversal.
    const first = p.dataType[0];
    if (first && first === first.toUpperCase() && /[A-Z]/.test(first)) {
      // text/int/number/etc. all start lowercase; numeric arrays handled above.
      // Anything starting with a capital is a reference type — skip.
      if (!NUMERIC_TYPES.has(p.dataType.toLowerCase())) return false;
    }
    return true;
  });

export const makeLeaf = (props: SchemaProperty[]): WhereLeaf => {
  const first = props[0];
  const vt = first ? valueTypeFor(first.dataType) : "text";
  const ops = OPERATORS_FOR[vt];
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    property: first?.name ?? "",
    valueType: vt,
    operator: ops[0],
    valueText: "",
    valueBoolean: false,
  };
};

/**
 * Convert UI leaves into the wire WhereFilter the backend expects.
 * Returns null when nothing valid is set, so callers can omit the field.
 */
export const leavesToFilter = (
  leaves: WhereLeaf[]
): WireWhereFilter | null => {
  const operands: WireWhereFilter[] = [];

  for (const leaf of leaves) {
    if (!leaf.property) continue;
    if (leaf.operator !== "IsNull" && leaf.valueType !== "boolean") {
      // For non-null, non-boolean leaves, require a value entered.
      if (leaf.valueText.trim() === "") continue;
    }

    const base: WireWhereFilter = {
      operator: leaf.operator,
      path: [leaf.property],
      valueType: leaf.valueType,
    };

    if (leaf.operator === "IsNull") {
      base.valueBoolean = leaf.valueBoolean;
      operands.push(base);
      continue;
    }

    const isContains =
      leaf.operator === "ContainsAny" || leaf.operator === "ContainsAll";

    switch (leaf.valueType) {
      case "text":
      case "string": {
        if (isContains) {
          const parts = leaf.valueText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          base.valueTexts = parts;
          // Mirror under valueText too for backend's fallback path
          if (parts.length === 1) {
            if (leaf.valueType === "string") base.valueString = parts[0];
            else base.valueText = parts[0];
          }
        } else if (leaf.valueType === "string") {
          base.valueString = leaf.valueText;
        } else {
          base.valueText = leaf.valueText;
        }
        break;
      }
      case "int": {
        if (isContains) {
          const parts = leaf.valueText
            .split(",")
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => Number.isFinite(n));
          base.valueInts = parts;
        } else {
          const n = parseInt(leaf.valueText, 10);
          if (!Number.isFinite(n)) continue;
          base.valueInt = n;
        }
        break;
      }
      case "number": {
        if (isContains) {
          const parts = leaf.valueText
            .split(",")
            .map((s) => parseFloat(s.trim()))
            .filter((n) => Number.isFinite(n));
          base.valueNumbers = parts;
        } else {
          const n = parseFloat(leaf.valueText);
          if (!Number.isFinite(n)) continue;
          base.valueNumber = n;
        }
        break;
      }
      case "boolean": {
        base.valueBoolean = leaf.valueBoolean;
        break;
      }
      case "date": {
        // Convert datetime-local "YYYY-MM-DDTHH:mm" -> RFC3339
        const raw = leaf.valueText.trim();
        if (!raw) continue;
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) continue;
        base.valueDate = d.toISOString();
        break;
      }
    }

    operands.push(base);
  }

  if (operands.length === 0) return null;
  if (operands.length === 1) return operands[0];
  return { operator: "And", operands };
};

interface Props {
  schema: SchemaProperty[];
  leaves: WhereLeaf[];
  onChange: (leaves: WhereLeaf[]) => void;
}

const WhereFilterBuilder: React.FC<Props> = ({ schema, leaves, onChange }) => {
  const filterable = useMemo(() => filterableProperties(schema), [schema]);
  const activeCount = useMemo(
    () =>
      leaves.filter((l) => {
        if (!l.property) return false;
        if (l.operator === "IsNull" || l.valueType === "boolean") return true;
        return l.valueText.trim() !== "";
      }).length,
    [leaves]
  );

  const updateLeaf = (id: string, patch: Partial<WhereLeaf>) => {
    onChange(leaves.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const removeLeaf = (id: string) => {
    onChange(leaves.filter((l) => l.id !== id));
  };

  const addLeaf = () => {
    onChange([...leaves, makeLeaf(filterable)]);
  };

  const handlePropertyChange = (id: string, propertyName: string) => {
    const schemaProp = filterable.find((p) => p.name === propertyName);
    if (!schemaProp) return;
    const vt = valueTypeFor(schemaProp.dataType);
    const ops = OPERATORS_FOR[vt];
    updateLeaf(id, {
      property: propertyName,
      valueType: vt,
      operator: ops[0],
      valueText: "",
      valueBoolean: false,
    });
  };

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0 gap-1.5 px-2.5"
              aria-label="Where filter"
            >
              <Filter className="size-3.5" />
              {activeCount > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-px text-[10px] font-medium leading-none text-primary-foreground">
                  {activeCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Filters (where clause)</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[460px] max-w-[90vw] p-0"
      >
        <div className="border-b px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Where filter
          <span className="ml-1 normal-case text-muted-foreground/70">
            (rows combined with AND)
          </span>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filterable.length === 0 ? (
            <div className="px-2 py-6 text-center text-xs text-muted-foreground">
              No filterable properties in this collection.
            </div>
          ) : leaves.length === 0 ? (
            <div className="px-2 py-4 text-center text-xs text-muted-foreground">
              No filters added.
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {leaves.map((leaf) => {
                const ops = OPERATORS_FOR[leaf.valueType];
                const showValueInput =
                  leaf.operator !== "IsNull" && leaf.valueType !== "boolean";
                return (
                  <li
                    key={leaf.id}
                    className="flex items-center gap-1.5 rounded-md border bg-muted/30 p-1.5"
                  >
                    <select
                      value={leaf.property}
                      onChange={(e) =>
                        handlePropertyChange(leaf.id, e.target.value)
                      }
                      className="h-7 max-w-[120px] flex-1 truncate rounded-md border bg-background px-1.5 text-xs focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {filterable.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={leaf.operator}
                      onChange={(e) =>
                        updateLeaf(leaf.id, {
                          operator: e.target.value as WhereOperator,
                        })
                      }
                      className="h-7 rounded-md border bg-background px-1.5 text-xs focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {ops.map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </select>
                    {leaf.valueType === "boolean" &&
                    leaf.operator !== "IsNull" ? (
                      <select
                        value={leaf.valueBoolean ? "true" : "false"}
                        onChange={(e) =>
                          updateLeaf(leaf.id, {
                            valueBoolean: e.target.value === "true",
                          })
                        }
                        className="h-7 flex-1 rounded-md border bg-background px-1.5 text-xs focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : leaf.operator === "IsNull" ? (
                      <select
                        value={leaf.valueBoolean ? "true" : "false"}
                        onChange={(e) =>
                          updateLeaf(leaf.id, {
                            valueBoolean: e.target.value === "true",
                          })
                        }
                        className="h-7 flex-1 rounded-md border bg-background px-1.5 text-xs focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="true">is null</option>
                        <option value="false">not null</option>
                      </select>
                    ) : showValueInput ? (
                      <input
                        type={
                          leaf.valueType === "date"
                            ? "datetime-local"
                            : leaf.valueType === "int" ||
                                leaf.valueType === "number"
                              ? leaf.operator === "ContainsAny" ||
                                leaf.operator === "ContainsAll"
                                ? "text"
                                : "number"
                              : "text"
                        }
                        step={leaf.valueType === "number" ? "any" : undefined}
                        placeholder={
                          leaf.operator === "ContainsAny" ||
                          leaf.operator === "ContainsAll"
                            ? "comma,separated,values"
                            : leaf.operator === "Like"
                              ? "pattern* with wildcards"
                              : "value"
                        }
                        value={leaf.valueText}
                        onChange={(e) =>
                          updateLeaf(leaf.id, { valueText: e.target.value })
                        }
                        className="h-7 flex-1 rounded-md border bg-background px-2 text-xs focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => removeLeaf(leaf.id)}
                      aria-label="Remove filter"
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t px-3 py-2">
          <button
            type="button"
            onClick={addLeaf}
            disabled={filterable.length === 0}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="size-3" />
            Add filter
          </button>
          {leaves.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default WhereFilterBuilder;
