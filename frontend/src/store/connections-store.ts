import { Connection } from "@/types";
import { create } from "zustand";
import { GetConnections } from "wailsjs/go/sql/Storage";

interface ConnectionStore {
  connections: Connection[];
  save: (c: Connection) => void;
  remove: (id: number) => void;
  setFavorite: (id: number, favorite: boolean) => void;
}

export const useConnectionsStore = create<ConnectionStore>((set) => ({
  connections: [],
  save: async (connection) =>
    set((state) => ({ connections: [...state.connections, connection] })),
  remove: (id: number) =>
    set((state) => ({
      connections: state.connections.filter((c) => c.id !== id),
    })),
  setFavorite: (id: number, favorite: boolean) =>
    set((state) => ({
      connections: state.connections.map((c) =>
        c.id === id ? { ...c, favorite } : c
      ),
    })),
}));

GetConnections().then((connections) =>
  useConnectionsStore.setState({ connections: connections || [] })
);
