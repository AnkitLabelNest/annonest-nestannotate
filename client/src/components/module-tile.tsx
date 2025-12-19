import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ModuleTileProps {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  subModules?: { name: string; count?: number }[];
  isLocked: boolean;
  onClick: () => void;
  stats?: { label: string; value: string | number }[];
}

export function ModuleTile({
  id,
  title,
  description,
  icon: Icon,
  subModules,
  isLocked,
  onClick,
  stats,
}: ModuleTileProps) {
  return (
    <Card
      className={`relative p-6 transition-all duration-200 cursor-pointer group ${
        isLocked
          ? "opacity-60 bg-muted/30"
          : "hover:shadow-lg hover:border-primary/30"
      }`}
      onClick={onClick}
      data-testid={`tile-module-${id}`}
    >
      {isLocked && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[1px] rounded-lg z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              Locked
            </span>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between mb-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-lg ${
            isLocked ? "bg-muted" : "bg-primary/10"
          }`}
        >
          <Icon
            className={`h-6 w-6 ${
              isLocked ? "text-muted-foreground" : "text-primary"
            }`}
          />
        </div>
        {!isLocked && (
          <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>

      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>

      {subModules && subModules.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {subModules.map((sub) => (
            <Badge
              key={sub.name}
              variant="secondary"
              className="text-xs font-normal"
            >
              {sub.name}
              {sub.count !== undefined && (
                <span className="ml-1 text-muted-foreground">({sub.count})</span>
              )}
            </Badge>
          ))}
        </div>
      )}

      {stats && stats.length > 0 && (
        <div className="flex gap-4 pt-4 border-t border-border">
          {stats.map((stat) => (
            <div key={stat.label}>
              <p className="text-lg font-semibold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
