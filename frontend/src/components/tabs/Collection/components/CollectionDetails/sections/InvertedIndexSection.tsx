import { models } from "wailsjs/go/models";
import { BooleanBadge, InfoItem } from "../helpers";

interface Props {
  config?: models.w_InvertedIndexConfig;
}

export const InvertedIndexSection = ({ config }: Props) => {
  if (!config) {
    return (
      <p className="text-muted-foreground text-sm">
        No inverted index configuration available.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <InfoItem
          label="Index Null State"
          value={<BooleanBadge value={config.indexNullState} />}
          tooltip="Whether null values are indexed"
        />
        <InfoItem
          label="Index Property Length"
          value={<BooleanBadge value={config.indexPropertyLength} />}
          tooltip="Whether property length is indexed for filtering"
        />
        <InfoItem
          label="Index Timestamps"
          value={<BooleanBadge value={config.indexTimestamps} />}
          tooltip="Whether timestamps are indexed"
        />
        <InfoItem
          label="Cleanup Interval"
          value={`${config.cleanupIntervalSeconds || 0}s`}
          tooltip="Interval in seconds for index cleanup"
        />
      </div>

      {config.bm25 && (
        <div className="rounded-md border p-3">
          <h4 className="mb-2 text-xs font-medium">BM25 Configuration</h4>
          <div className="grid grid-cols-2 gap-4">
            <InfoItem
              label="k1"
              value={config.bm25.k1}
              tooltip="Term saturation parameter (typical: 1.2-2.0)"
            />
            <InfoItem
              label="b"
              value={config.bm25.b}
              tooltip="Document length normalization (0=none, 1=full)"
            />
          </div>
        </div>
      )}

      {config.stopwords && (
        <div className="rounded-md border p-3">
          <h4 className="mb-2 text-xs font-medium">Stopwords</h4>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <InfoItem label="Preset" value={config.stopwords.preset || "-"} />
            <InfoItem
              label="Additions"
              value={
                config.stopwords.additions?.length
                  ? config.stopwords.additions.length
                  : 0
              }
            />
            <InfoItem
              label="Removals"
              value={
                config.stopwords.removals?.length
                  ? config.stopwords.removals.length
                  : 0
              }
            />
          </div>
        </div>
      )}
    </div>
  );
};
