import { models } from "wailsjs/go/models";
import { BooleanBadge, InfoItem } from "../helpers";

interface Props {
  replicationConfig?: models.w_ReplicationConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  shardingConfig?: any;
}

export const ReplicationShardingSection = ({
  replicationConfig,
  shardingConfig,
}: Props) => {
  return (
    <div className="space-y-4">
      {/* Replication */}
      <div className="rounded-md border p-3">
        <h4 className="mb-2 text-xs font-medium">Replication</h4>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <InfoItem
            label="Factor"
            value={replicationConfig?.factor || 1}
            tooltip="Number of copies of data stored across nodes"
          />
          <InfoItem
            label="Async Enabled"
            value={<BooleanBadge value={replicationConfig?.asyncEnabled} />}
            tooltip="Whether async replication is enabled"
          />
          <InfoItem
            label="Deletion Strategy"
            value={
              replicationConfig?.deletionStrategy || "NoAutomatedResolution"
            }
          />
        </div>
      </div>

      {/* Sharding */}
      {shardingConfig && (
        <div className="rounded-md border p-3">
          <h4 className="mb-2 text-xs font-medium">Sharding</h4>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <InfoItem
              label="Desired Count"
              value={shardingConfig.desiredCount}
            />
            <InfoItem label="Actual Count" value={shardingConfig.actualCount} />
            <InfoItem
              label="Virtual Per Physical"
              value={shardingConfig.virtualPerPhysical}
            />
            <InfoItem
              label="Desired Virtual Count"
              value={shardingConfig.desiredVirtualCount}
            />
            <InfoItem
              label="Actual Virtual Count"
              value={shardingConfig.actualVirtualCount}
            />
            <InfoItem label="Strategy" value={shardingConfig.strategy} />
          </div>
        </div>
      )}
    </div>
  );
};
