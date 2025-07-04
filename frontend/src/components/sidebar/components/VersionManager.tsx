import { Button } from "@/components/ui/button";
import { WLink } from "@/components/ui/wLink";
import { Progress } from "@/components/ui/progress";
import { Run, Restart } from "wailsjs/go/updater/Updater";
import { useVersionStore } from "@/store/version-store";
import { useEffect, useState } from "react";
import { EventsOff, EventsOn } from "wailsjs/runtime/runtime";
import { errorReporting } from "@/lib/utils";
import { toast } from "sonner";
import { useShallow } from "zustand/shallow";

export const VersionManager = () => {
  const { version, releaseTagURL, newVersion } = useVersionStore(
    (state) => state
  );

  useEffect(() => {
    if (!newVersion) return;

    toast(VersionToast, {
      position: "bottom-right",
      duration: 500000000,
      closeButton: true,
    });
  }, [newVersion]);

  return (
    <div className="flex flex-col justify-center border-t border-gray-200 p-4">
      <WLink className="text-center" href={releaseTagURL}>
        {version}
      </WLink>
    </div>
  );
};

const VersionToast = () => {
  const { newVersion } = useVersionStore(
    useShallow((state) => ({
      newVersion: state.newVersion,
    }))
  );

  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [restart, setRestart] = useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    setProgress(0);

    try {
      await Run();

      setRestart(true);
    } catch (error) {
      errorReporting(error);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  useEffect(() => {
    EventsOn("download-progress", (p) => {
      const percentage = Math.floor(p);
      if (percentage > progress) {
        setProgress(percentage);
      }
    });

    return () => {
      EventsOff("download-progress");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newVersion]);

  return (
    <div className="flex w-[320px] flex-col gap-2">
      {!loading && (
        <>
          <span>Version {newVersion?.version} available</span>
          <div className="flex justify-end gap-2">
            {restart ? (
              <Button
                onClick={Restart}
                className="h-8 !rounded-none !px-1 !py-0 text-xs"
              >
                Restart
              </Button>
            ) : (
              <Button
                onClick={handleUpdate}
                className="h-8 !rounded-none !px-1 !py-0 text-xs"
              >
                Download
              </Button>
            )}
          </div>
        </>
      )}
      {loading && (
        <div className="flex flex-row items-center">
          <Progress value={progress} className="mr-2 flex-1" />
          <span className="text-xs">{progress}%</span>
        </div>
      )}
    </div>
  );
};
