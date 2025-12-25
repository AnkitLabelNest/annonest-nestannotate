import { Badge } from "@/components/ui/badge";
import type { UserRole } from "@shared/schema";

const roleColors: Record<UserRole, string> = {
  super_admin: "bg-rose-600 text-white hover:bg-rose-700",
  admin: "bg-purple-600 text-white hover:bg-purple-700",
  manager: "bg-blue-600 text-white hover:bg-blue-700",
  researcher: "bg-cyan-600 text-white hover:bg-cyan-700",
  qa: "bg-amber-500 text-white hover:bg-amber-600",
  annotator: "bg-emerald-600 text-white hover:bg-emerald-700",
  guest: "bg-slate-500 text-white hover:bg-slate-600",
};

const roleLabels: Record<UserRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  researcher: "Researcher",
  qa: "QA",
  annotator: "Annotator",
  guest: "Guest",
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
