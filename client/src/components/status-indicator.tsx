import type { MonitoringStatus } from "@shared/schema";

const statusConfig: Record<MonitoringStatus, { color: string; label: string }> = {
  running: { color: "bg-blue-500", label: "Running" },
  changed: { color: "bg-emerald-500", label: "Changed" },
  no_change: { color: "bg-gray-400", label: "No Change" },
  error: { color: "bg-red-500", label: "Error" },
};

interface StatusIndicatorProps {
  status: MonitoringStatus;
  showLabel?: boolean;
  size?: "sm" | "default";
}

export function StatusIndicator({
  status,
  showLabel = true,
  size = "default",
}: StatusIndicatorProps) {
  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2" data-testid={`status-${status}`}>
      <div
        className={`rounded-full ${config.color} ${
          size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5"
        }`}
      />
      {showLabel && (
        <span
          className={`text-muted-foreground ${
            size === "sm" ? "text-xs" : "text-sm"
          }`}
        >
          {config.label}
        </span>
      )}
    </div>
  );
}
