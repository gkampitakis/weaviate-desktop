import { useQuery } from "@tanstack/react-query";
import { GetCollection } from "wailsjs/go/weaviate/Weaviate";
import { errorReporting } from "@/lib/utils";
import RefreshButton from "@/components/ui/refresh-button";
import { ErrorState } from "@/components/ui/error-state";
import {
  Database,
  Settings,
  Layers,
  Server,
  Users,
  Search,
} from "lucide-react";
import { collectionDetailsQueryKey } from "../constants";
import { Section } from "./helpers";
import {
  PropertiesSection,
  VectorConfigSection,
  InvertedIndexSection,
  ReplicationShardingSection,
  MultiTenancySection,
  ModuleConfigSection,
} from "./sections";

interface Props {
  connectionID: number;
  collectionName: string;
}

const CollectionDetails: React.FC<Props> = ({
  connectionID,
  collectionName,
}) => {
  const {
    data: collection,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: collectionDetailsQueryKey(connectionID, collectionName),
    queryFn: async () => {
      try {
        return await GetCollection(connectionID, collectionName);
      } catch (error) {
        errorReporting(error);
        throw error;
      }
    },
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Loading collection details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        message="Failed loading collection details"
        onRetry={() => refetch()}
        isRetrying={isFetching}
      />
    );
  }

  if (!collection) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Collection not found.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-auto p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          <h2 className="text-xl font-semibold">{collection.class}</h2>
          <RefreshButton
            isRefreshing={isFetching}
            refresh={() => refetch({ cancelRefetch: false })}
            tooltipText="Refresh collection details"
          />
        </div>
      </div>
      {collection.description && (
        <p className="text-muted-foreground text-sm">
          {collection.description}
        </p>
      )}
      <div className="space-y-4">
        <Section title="Properties" icon={Layers} defaultOpen={true}>
          <PropertiesSection properties={collection.properties || []} />
        </Section>
        <Section title="Vector Configuration" icon={Search} defaultOpen={true}>
          <VectorConfigSection
            vectorConfig={collection.vectorConfig}
            vectorizer={collection.vectorizer}
            vectorIndexType={collection.vectorIndexType}
            vectorIndexConfig={collection.vectorIndexConfig}
          />
        </Section>
        <Section title="Inverted Index" icon={Settings} defaultOpen={false}>
          <InvertedIndexSection config={collection.invertedIndexConfig} />
        </Section>
        <Section
          title="Replication & Sharding"
          icon={Server}
          defaultOpen={false}
        >
          <ReplicationShardingSection
            replicationConfig={collection.replicationConfig}
            shardingConfig={collection.shardingConfig}
          />
        </Section>
        <Section title="Multi-tenancy" icon={Users} defaultOpen={false}>
          <MultiTenancySection config={collection.multiTenancyConfig} />
        </Section>
        <Section
          title="Module Configuration"
          icon={Settings}
          defaultOpen={false}
        >
          <ModuleConfigSection moduleConfig={collection.moduleConfig} />
        </Section>
      </div>
    </div>
  );
};

export default CollectionDetails;
