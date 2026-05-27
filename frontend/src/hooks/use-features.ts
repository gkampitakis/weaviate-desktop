import { useConnectionStore } from "@/store/connection-store";
import type { FeatureKey, Features } from "@/types";

export function useFeatures(connectionID: number): Features {
  return useConnectionStore(
    (state) => state.get(connectionID)?.features ?? {}
  );
}

export function useFeature(connectionID: number, key: FeatureKey): boolean {
  return useConnectionStore(
    (state) => state.get(connectionID)?.features?.[key] ?? false
  );
}
