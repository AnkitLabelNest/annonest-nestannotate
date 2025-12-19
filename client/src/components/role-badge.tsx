import { Badge } from "@/components/ui/badge";
import type { UserRole } from "@shared/schema";

const roleColors: Record<UserRole, string> = {
  admin: "bg-purple-600 text-white hover:bg-purple-700",
  manager: "bg-blue-600 text-white hover:bg-blue-700",
  annotator: "bg-emerald-600 text-white hover:bg-emerald-700",
  qa: "bg-amber-500 text-white hover:bg-amber-600",
};

const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  manager: "Manager",
  annotator: "Annotator",
  qa: "QA",
};

interface RoleBadgeProps {
  role: UserRole;
  size?: "sm" | "default";
}

export function RoleBadge({ role, size = "default" }: RoleBadgeProps) {
  return (
    <Badge
      className={`${roleColors[role]} ${size === "sm" ? "text-xs px-2 py-0.5" : ""}`}
      data-testid={`badge-role-${role}`}
    >
      {roleLabels[role]}
    </Badge>
  );
}
