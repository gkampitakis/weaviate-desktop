import type { Connection } from "@/types";
import { create } from "zustand";
import {
  GetConnections,
  RemoveConnection,
  SaveConnection,
  UpdateFavorite,
} from "wailsjs/go/sql/Storage";
import { models } from "wailsjs/go/models";

interface ConnectionStore {
  connections: Connection[];
  save: (c: Omit<Connection, "id">) => Promise<void>;
  remove: (id: number) => Promise<void>;
  setFavorite: (id: number, favorite: boolean) => Promise<void>;
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  connections: [],
  save: async (c) => {
    const id = await SaveConnection(
      new models.Connection({
        uri: c.uri,
        name: c.name,
        favorite: c.favorite,
      })
    );
    set((state) => ({
      connections: [...state.connections, { ...c, id }],
    }));
  },
  remove: async (id: number) => {
    await RemoveConnection(id);

    set((state) => ({
      connections: state.connections.filter((c) => c.id !== id),
    }));
  },
  setFavorite: async (id: number, favorite: boolean) => {
    await UpdateFavorite(id, !favorite);

    set((state) => ({
      connections: state.connections.map((c) =>
        c.id === id ? { ...c, favorite } : c
      ),
    }));
  },
}));

GetConnections().then((connections) =>
  useConnectionStore.setState({ connections: connections || [] })
);
