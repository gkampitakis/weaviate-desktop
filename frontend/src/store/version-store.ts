import { create } from "zustand";
import {
  CheckForUpdates,
  GetVersion,
  ReleaseByTagURL,
} from "wailsjs/go/updater/Updater";

interface VersionStore {
  version: string;
  releaseTagURL: string;
  newVersion?: {
    version: string;
    size: string;
  };
}

export const useVersionStore = create<VersionStore>(() => ({
  version: "",
  releaseTagURL: "",
  newVersion: undefined,
}));

Promise.all([GetVersion(), ReleaseByTagURL()]).then(
  ([version, releaseTagURL]) =>
    useVersionStore.setState({ version, releaseTagURL })
);

CheckForUpdates()
  .then((newVersion) => {
    if (newVersion.Exists) {
      useVersionStore.setState({
        newVersion: {
          version: newVersion.LatestVersion,
          size: newVersion.Size,
        },
      });
    }
  })
  .catch(console.error);
