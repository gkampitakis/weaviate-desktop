import { models } from "wailsjs/go/models";
import { BooleanBadge, InfoItem } from "../helpers";

interface Props {
  config?: models.w_ObjectTTLConfig;
}

const TTL_UNITS: Record<string, number> = {
  days: 86400,
  hours: 3600,
  minutes: 60,
};

const BUILTIN_DELETE_ON_LABELS: Record<string, string> = {
  _creationTimeUnix: "Creation time",
  _lastUpdateTimeUnix: "Last update time",
};

const formatDeleteOn = (deleteOn: string | undefined): string => {
  if (!deleteOn) return "-";
  return BUILTIN_DELETE_ON_LABELS[deleteOn] ?? deleteOn;
};

const formatTtl = (seconds: number): string => {
  if (!seconds || seconds <= 0) return "-";
  if (seconds % TTL_UNITS.days === 0) {
    const v = seconds / TTL_UNITS.days;
    return `${v} day${v === 1 ? "" : "s"}`;
  }
  if (seconds % TTL_UNITS.hours === 0) {
    const v = seconds / TTL_UNITS.hours;
    return `${v} hour${v === 1 ? "" : "s"}`;
  }
  const v = Math.max(1, Math.round(seconds / 60));
  return `${v} minute${v === 1 ? "" : "s"}`;
};

export const ObjectTTLSection = ({ config }: Props) => {
  if (!config) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <InfoItem
        label="Enabled"
        value={<BooleanBadge value={config.enabled} />}
      />
      <InfoItem
        label="Default TTL"
        value={formatTtl(config.defaultTtl)}
        tooltip="How long objects live before being expired"
      />
      <InfoItem
        label="Expiry reference"
        value={formatDeleteOn(config.deleteOn)}
        tooltip="Property used to compute expiry time"
      />
      <InfoItem
        label="Filter expired objects"
        value={<BooleanBadge value={config.filterExpiredObjects} />}
        tooltip="Whether expired objects are excluded from query results"
      />
    </div>
  );
};
