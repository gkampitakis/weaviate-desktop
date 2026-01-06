import type { Collection, Connection } from "@/types";
import { create } from "zustand";
import {
  GetConnections,
  RemoveConnection,
  SaveConnection,
  UpdateConnection,
  UpdateFavorite,
} from "wailsjs/go/sql/Storage";
import { models } from "wailsjs/go/models";
import {
  BackupModulesEnabled,
  Connect,
  DeleteCollection,
  Disconnect,
  GetCollections,
  UsersEnabled,
} from "wailsjs/go/weaviate/Weaviate";
import { ConnectionStatus } from "@/types/enums";

interface ConnectionStore {
  connections: Connection[];
  save: (c: Omit<Connection, "id">) => Promise<void>;
  update: (c: Connection) => Promise<void>;
  remove: (id: number) => Promise<void>;
  setFavorite: (id: number, favorite: boolean) => Promise<void>;
  connect: (id: number) => Promise<void>;
  disconnect: (id: number) => Promise<void>;
  get(id: number): Connection | undefined;
  deleteCollection: (id: number, collection: string) => Promise<void>;
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  connections: [],
  get: (id: number): Connection | undefined => {
    return useConnectionStore.getState().connections.find((c) => c.id === id);
  },
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
  update: async (c) => {
    await UpdateConnection(c);

    set((state) => ({
      connections: state.connections
        .map((conn) => {
          if (conn.id !== c.id) return conn;
          const updatedConn = { ...conn, ...c };
          if (updatedConn.collections) {
            updatedConn.collections = updatedConn.collections.map(
              (collection) => ({
                ...collection,
                connection: {
                  id: updatedConn.id,
                  name: updatedConn.name,
                  color: updatedConn.color,
                },
              })
            );
          }

          return updatedConn;
        })
        .sort(sortConnections),
    }));
  },
  remove: async (id: number) => {
    await RemoveConnection(id);

    set((state) => ({
      connections: state.connections.filter((c) => c.id !== id),
    }));
  },
  deleteCollection: async (id: number, collection: string) => {
    await DeleteCollection(id, collection);

    set((state) => ({
      connections: state.connections.map((c) => {
        if (c.id !== id || !c.collections) return c;

        return {
          ...c,
          collections: c.collections.filter((col) => col.name !== collection),
        };
      }),
    }));
  },
  connect: async (id: number) => {
    await Connect(id);
    const [collections, usersEnabled, backupModules] = await Promise.all([
      GetCollections(id),
      UsersEnabled(id),
      BackupModulesEnabled(id),
    ]);

    set((state) => ({
      connections: state.connections.map((c) =>
        c.id === id
          ? {
              ...c,
              status: ConnectionStatus.Connected,
              usersEnabled: usersEnabled,
              backupModules: backupModules,
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

GetConnections(true)
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
