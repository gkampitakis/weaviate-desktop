import { models } from "wailsjs/go/models";
import { BooleanBadge, InfoItem } from "../helpers";

interface Props {
  config?: models.w_MultiTenancyConfig;
}

export const MultiTenancySection = ({ config }: Props) => {
  if (!config?.enabled) {
    return (
      <p className="text-muted-foreground text-sm">
        Multi-tenancy is not enabled for this collection.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      <InfoItem
        label="Enabled"
        value={<BooleanBadge value={config.enabled} />}
      />
      <InfoItem
        label="Auto Tenant Creation"
        value={<BooleanBadge value={config.autoTenantCreation} />}
        tooltip="Whether tenants are auto-created on first write"
      />
      <InfoItem
        label="Auto Tenant Activation"
        value={<BooleanBadge value={config.autoTenantActivation} />}
        tooltip="Whether inactive tenants are auto-activated on access"
      />
    </div>
  );
};
