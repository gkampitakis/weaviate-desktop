import { Card } from "@/components/ui/card";
import { formatGibToReadable } from "@/lib/utils";
import { weaviate } from "wailsjs/go/models";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Database,
  HardDrive,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";

interface BackupCardProps {
  backup: weaviate.w_Backup;
}

const getStatusColor = (status?: string) => {
  switch (status) {
    case "SUCCESS":
      return "bg-green-500/10 text-green-500 border-green-500/20";
    case "FAILED":
      return "bg-red-500/10 text-red-500 border-red-500/20";
    case "STARTED":
    case "TRANSFERRING":
    case "TRANSFERRED":
      return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    case "CANCELED":
      return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    default:
      return "bg-gray-500/10 text-gray-500 border-gray-500/20";
  }
};

const formatDate = (dateString?: string) => {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleString();
  } catch {
    return dateString;
  }
};

export function BackupCard({ backup }: BackupCardProps) {
  const [showAllClasses, setShowAllClasses] = useState(false);
  const classLimit = 5;
  const hasMoreClasses = backup.classes && backup.classes.length > classLimit;
  const displayedClasses = showAllClasses
    ? backup.classes
    : backup.classes?.slice(0, classLimit);

  return (
    <Card className="p-4 transition-shadow hover:shadow-md">
      <div className="space-y-3">
        {/* Header with ID and Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold">
              {backup.id || "Unnamed Backup"}
            </h3>
          </div>
          <Badge className={getStatusColor(backup.status)}>
            {backup.status || "UNKNOWN"}
          </Badge>
        </div>

        {/* Classes */}
        {backup.classes && backup.classes.length > 0 && (
          <div className="flex items-start gap-2">
            <Database className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-muted-foreground text-xs">
                  Classes{" "}
                  {backup.classes.length > 1 && `(${backup.classes.length})`}
                </p>
                {hasMoreClasses && (
                  <button
                    onClick={() => setShowAllClasses(!showAllClasses)}
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
                  >
                    {showAllClasses ? (
                      <>
                        Show less
                        <ChevronUp className="h-3 w-3" />
                      </>
                    ) : (
                      <>
                        +{backup.classes.length - classLimit} more
                        <ChevronDown className="h-3 w-3" />
                      </>
                    )}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {displayedClasses?.map((cls: string, idx: number) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {cls}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-start gap-2">
            <Clock className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs">Started</p>
              <p
                className="truncate text-xs font-medium"
                title={formatDate(backup.startedAt)}
              >
                {formatDate(backup.startedAt)}
              </p>
            </div>
          </div>

          {backup.completedAt && (
            <div className="flex items-start gap-2">
              <Calendar className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-xs">Completed</p>
                <p
                  className="truncate text-xs font-medium"
                  title={formatDate(backup.completedAt)}
                >
                  {formatDate(backup.completedAt)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Size */}
        <div className="flex items-center gap-2">
          <HardDrive className="text-muted-foreground h-4 w-4 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-muted-foreground text-xs">Size</p>
            <p className="text-xs font-medium">
              {formatGibToReadable(backup.size)}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
