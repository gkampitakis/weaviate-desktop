import type { Collection, Connection } from "@/types";
import { create } from "zustand";
import {
  GetConnections,
  RemoveConnection,
  SaveConnection,
  UpdateFavorite,
} from "wailsjs/go/sql/Storage";
import { models } from "wailsjs/go/models";
import {
  Connect,
  Disconnect,
  GetCollections,
} from "wailsjs/go/weaviate/Weaviate";
import { ConnectionStatus } from "@/types/enums";

interface ConnectionStore {
  connections: Connection[];
  save: (c: Omit<Connection, "id">) => Promise<void>;
  remove: (id: number) => Promise<void>;
  setFavorite: (id: number, favorite: boolean) => Promise<void>;
  connect: (id: number) => Promise<void>;
  disconnect: (id: number) => Promise<void>;
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  connections: [],
  save: async (c) => {
    const id = await SaveConnection(
      new models.w_Connection({
        uri: c.uri,
        name: c.name,
        favorite: c.favorite,
        api_key: c.api_key,
        color: c.color,
      })
    );
    set((state) => ({
      connections: [...state.connections, { ...c, id }].sort(sortConnections),
    }));
  },
  remove: async (id: number) => {
    await RemoveConnection(id);

    set((state) => ({
      connections: state.connections.filter((c) => c.id !== id),
    }));
  },
  connect: async (id: number) => {
    await Connect(id);
    const collections = await GetCollections(id);

    set((state) => ({
      connections: state.connections.map((c) =>
        c.id === id
          ? {
              ...c,
              status: ConnectionStatus.Connected,
              collections: collections
                .map((collection) => ({
                  name: collection.class!,
                  connection: {
                    id: c.id,
                    name: c.name,
                    color: c.color,
                  },
                  multiTenancyConfig: collection.multiTenancyConfig,
                }))
                .sort(sortCollections),
            }
          : c
      ),
    }));
  },
  disconnect: async (id: number) => {
    await Disconnect(id);

    set((state) => ({
      connections: state.connections.map((c) =>
        c.id === id
          ? { ...c, status: ConnectionStatus.Disconnected, collections: [] }
          : c
      ),
    }));
  },
  setFavorite: async (id: number, favorite: boolean) => {
    await UpdateFavorite(id, favorite);

    set((state) => ({
      connections: state.connections
        .map((c) => (c.id === id ? { ...c, favorite } : c))
        .sort(sortConnections),
    }));
  },
}));

GetConnections(false)
  .then((connections) =>
    useConnectionStore.setState({
      connections: connections.sort(sortConnections) || [],
    })
  )
  .catch(console.error);

const sortCollections = (a: Collection, b: Collection) =>
  a.name.localeCompare(b.name, undefined, {
    numeric: true,
    sensitivity: "base",
  });

const sortConnections = (a: Connection, b: Connection) => {
  if (a.favorite && !b.favorite) {
    return -1;
  }
  if (!a.favorite && b.favorite) {
    return 1;
  }

  return a.name.localeCompare(b.name, undefined, { numeric: true });
};
