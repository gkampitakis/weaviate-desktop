import { weaviate } from "wailsjs/go/models";
import type { WireWhereFilter } from "./WhereFilterBuilder";

export const collectionDetailsQueryKey = (
  connectionID: number,
  collectionName: string
) => ["collection-details", connectionID, collectionName];

export const toWireFilter = (
  where: WireWhereFilter | null
): weaviate.w_WhereFilter => where as unknown as weaviate.w_WhereFilter;

export const BROWSE_WHERE_FILTER: WireWhereFilter | null = null;
