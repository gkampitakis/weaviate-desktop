import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import { weaviate } from "wailsjs/go/models";
import { BackupCard } from "./BackupCard";

interface VirtualBackupListProps {
  backups: weaviate.w_Backup[];
  connectionID: number;
  height?: string;
  estimatedItemHeight?: number;
}

export function VirtualBackupList({
  backups,
  connectionID,
  height = "600px",
  estimatedItemHeight = 250,
}: VirtualBackupListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: backups.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedItemHeight,
    overscan: 5, // Render 5 extra items before and after the visible area
  });

  const items = virtualizer.getVirtualItems();

  if (backups.length === 0) {
    return null;
  }

  return (
    <div
      ref={parentRef}
      className="overflow-auto"
      style={{
        height,
        contain: "strict",
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            transform: `translateY(${items[0]?.start ?? 0}px)`,
          }}
        >
          {items.map((virtualItem) => (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                padding: "8px",
              }}
            >
              <BackupCard
                backup={backups[virtualItem.index]}
                connectionID={connectionID}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
