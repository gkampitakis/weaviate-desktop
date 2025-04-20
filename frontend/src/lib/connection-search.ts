import { Connection } from "@/types";
import Fuse from "fuse.js";

export function connectionSearch(connections: Connection[], search: string) {
  const fuse = new Fuse(connections, {
    keys: ["name", "collections.name"],
    threshold: 0.3, // Adjust for sensitivity
  });

  return !search
    ? connections
    : fuse.search(search).map(({ item }) => {
        if (!item.collections) {
          return item;
        }

        // Filter collections to only include matching ones
        const collectionFuse = new Fuse(item.collections, {
          keys: ["name"],
          threshold: 0.3,
        });

        const filteredCollections = collectionFuse
          .search(search)
          .map((res) => res.item);

        return {
          ...item,
          collections: filteredCollections, // Replace with filtered collections
        };
      });
}
