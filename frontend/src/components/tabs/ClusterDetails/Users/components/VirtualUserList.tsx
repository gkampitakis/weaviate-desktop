import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import { UserCard } from "./UserCard";
import { weaviate } from "wailsjs/go/models";

interface Props {
  users: weaviate.w_UserInfo[];
  connectionID: number;
  height: string;
  estimatedItemHeight: number;
}

export function VirtualUserList({
  users,
  height,
  estimatedItemHeight,
  connectionID,
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: users.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedItemHeight,
    overscan: 5,
  });

  const items = virtualizer.getVirtualItems();

  if (users.length === 0) {
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
              <UserCard
                user={users[virtualItem.index]}
                connectionID={connectionID}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
