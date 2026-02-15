import { Badge } from "@/components/ui/badge";
import { models } from "wailsjs/go/models";
import { BooleanBadge, InfoItem } from "../helpers";

interface Props {
  vectorConfig?: Record<string, models.w_VectorConfig>;
  vectorizer?: string;
  vectorIndexType?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vectorIndexConfig?: any;
}

// Helper to extract model name from vectorizer config
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getModelName = (vectorizer: any): string | null => {
  if (!vectorizer || typeof vectorizer !== "object") return null;

  // vectorizer is like {"text2vec-openai": {"model": "text-embedding-3-small"}}
  const moduleName = Object.keys(vectorizer)[0];
  if (!moduleName) return null;

  const moduleConfig = vectorizer[moduleName];
  if (moduleConfig && typeof moduleConfig === "object") {
    return moduleConfig.model || moduleConfig.modelId || null;
  }
  return null;
};

// Helper to get quantizer/compression info
const getQuantizerInfo = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vectorIndexConfig: any
): { type: string; enabled: boolean } | null => {
  if (!vectorIndexConfig) return null;

  const quantizer = vectorIndexConfig.quantizer;
  if (quantizer) {
    return {
      type: quantizer.type || "unknown",
      enabled: quantizer.enabled === true,
    };
  }

  // Check all quantization types and return the enabled one first
  // Order matters: check enabled ones before disabled ones
  const quantizerTypes = [
    { key: "bq", label: "BQ" },
    { key: "pq", label: "PQ" },
    { key: "sq", label: "SQ" },
    { key: "rq", label: "RQ" },
  ];

  // First pass: find an enabled quantizer
  for (const { key, label } of quantizerTypes) {
    if (vectorIndexConfig[key]?.enabled === true) {
      let typeLabel = label;
      if (key === "rq") {
        // Show (8 bits) or (1 bit) for RQ
        const bits = vectorIndexConfig[key]?.bits;
        if (bits === 1) {
          typeLabel += " (1 bit)";
        } else {
          typeLabel += " (8 bits)";
        }
      }
      return { type: typeLabel, enabled: true };
    }
  }

  // Second pass: return first configured quantizer (even if disabled)
  for (const { key, label } of quantizerTypes) {
    if (vectorIndexConfig[key]) {
      let typeLabel = label;
      if (key === "rq") {
        const bits = vectorIndexConfig[key]?.bits;
        if (bits === 1) {
          typeLabel += " (1 bit)";
        } else {
          typeLabel += " (8 bits)";
        }
      }
      return { type: typeLabel, enabled: false };
    }
  }

  return null;
};

export const VectorConfigSection = ({
  vectorConfig,
  vectorizer,
  vectorIndexType,
  vectorIndexConfig,
}: Props) => {
  // Named vectors
  if (vectorConfig && Object.keys(vectorConfig).length > 0) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-xs">
          This collection uses named vectors.
        </p>
        <div className="grid gap-4">
          {Object.entries(vectorConfig).map(([name, config]) => {
            const modelName = getModelName(config.vectorizer);
            const quantizerInfo = getQuantizerInfo(config.vectorIndexConfig);

            return (
              <div key={name} className="rounded-md border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant="default" className="font-mono text-xs">
                    {name}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <InfoItem
                    label="Vectorizer"
                    value={
                      config.vectorizer
                        ? typeof config.vectorizer === "object"
                          ? Object.keys(config.vectorizer)[0]
                          : String(config.vectorizer)
                        : "-"
                    }
                  />
                  {modelName && (
                    <InfoItem
                      label="Model"
                      value={modelName}
                      tooltip="The embedding model used for vectorization"
                    />
                  )}
                  <InfoItem
                    label="Index Type"
                    value={config.vectorIndexType || "-"}
                  />
                  {config.vectorIndexConfig && (
                    <>
                      <InfoItem
                        label="Distance"
                        value={config.vectorIndexConfig.distance}
                      />
                      {quantizerInfo && (
                        <>
                          <InfoItem
                            label="Compression"
                            value={quantizerInfo.type}
                            tooltip="Vector quantization method to reduce memory usage"
                          />
                          <InfoItem
                            label="Compression Enabled"
                            value={
                              <BooleanBadge value={quantizerInfo.enabled} />
                            }
                          />
                        </>
                      )}
                      {config.vectorIndexConfig.ef !== undefined && (
                        <InfoItem
                          label="EF"
                          value={config.vectorIndexConfig.ef}
                          tooltip="The size of the dynamic list for the nearest neighbors"
                        />
                      )}
                      {config.vectorIndexConfig.efConstruction !==
                        undefined && (
                        <InfoItem
                          label="EF Construction"
                          value={config.vectorIndexConfig.efConstruction}
                          tooltip="Controls index construction time vs. search speed tradeoff"
                        />
                      )}
                      {config.vectorIndexConfig.maxConnections !==
                        undefined && (
                        <InfoItem
                          label="Max Connections"
                          value={config.vectorIndexConfig.maxConnections}
                          tooltip="Maximum number of connections per element in the HNSW graph"
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Single/legacy vector configuration
  const quantizerInfo = getQuantizerInfo(vectorIndexConfig);

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      <InfoItem label="Vectorizer" value={vectorizer || "none"} />
      <InfoItem label="Index Type" value={vectorIndexType || "-"} />
      {vectorIndexConfig && (
        <>
          <InfoItem label="Distance" value={vectorIndexConfig.distance} />
          {quantizerInfo && (
            <>
              <InfoItem
                label="Compression"
                value={quantizerInfo.type}
                tooltip="Vector quantization method to reduce memory usage"
              />
              <InfoItem
                label="Compression Enabled"
                value={<BooleanBadge value={quantizerInfo.enabled} />}
              />
            </>
          )}
          {vectorIndexConfig.ef !== undefined && (
            <InfoItem
              label="EF"
              value={vectorIndexConfig.ef}
              tooltip="The size of the dynamic list for the nearest neighbors"
            />
          )}
          {vectorIndexConfig.efConstruction !== undefined && (
            <InfoItem
              label="EF Construction"
              value={vectorIndexConfig.efConstruction}
              tooltip="Controls index construction time vs. search speed tradeoff"
            />
          )}
          {vectorIndexConfig.maxConnections !== undefined && (
            <InfoItem
              label="Max Connections"
              value={vectorIndexConfig.maxConnections}
              tooltip="Maximum number of connections per element in the HNSW graph"
            />
          )}
        </>
      )}
    </div>
  );
};
