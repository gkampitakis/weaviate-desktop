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

  let action = (
    <Button
      onClick={handleUpdate}
      className="h-8 !rounded-none !px-1 !py-0 text-xs"
    >
      Download
    </Button>
  );

  if (restart) {
    action = (
      <Button
        onClick={Restart}
        className="h-8 !rounded-none !px-1 !py-0 text-xs"
      >
        Restart
      </Button>
    );
  }
  if (loading) {
    action = (
      <div className="flex h-8 w-full flex-row items-center gap-2">
        <Progress value={progress} className="flex-1" />
        <span className="text-xs">{progress}%</span>
      </div>
    );
  }

  return (
    <div className="flex w-[320px] flex-col gap-2">
      <span>
        Version {newVersion?.version} available ({newVersion?.size})
      </span>
      <span>
        <WLink href={newVersion?.releaseTagURL || ""}>Release notes </WLink>
      </span>
      <div className="flex justify-end gap-2">{action}</div>
    </div>
  );
};
