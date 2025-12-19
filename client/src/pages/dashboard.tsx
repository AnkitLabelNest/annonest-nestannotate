import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ModuleTile } from "@/components/module-tile";
import { AccessDeniedModal } from "@/components/access-denied-modal";
import { RoleBadge } from "@/components/role-badge";
import { useAuth } from "@/lib/auth-context";
import {
  Tags,
  Database,
  Radar,
  Users,
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Activity,
} from "lucide-react";
import type { UserRole } from "@shared/schema";

const modules = [
  {
    id: "nest_annotate",
    title: "NestAnnotate",
    description: "Text, image, video labeling with multi-step workflows",
    icon: Tags,
    path: "/annotate",
    subModules: [
      { name: "Text Label", count: 24 },
      { name: "Image Label", count: 18 },
      { name: "Video Label", count: 7 },
      { name: "Transcription", count: 12 },
      { name: "Translation", count: 9 },
    ],
    stats: [
      { label: "Active Tasks", value: 156 },
      { label: "Completed", value: 842 },
    ],
  },
  {
    id: "data_nest",
    title: "DataNest",
    description: "Structured data hub for firms, contacts, funds, and deals",
    icon: Database,
    path: "/data",
    subModules: [
      { name: "GP", count: 145 },
      { name: "LP", count: 89 },
      { name: "Service Provider", count: 67 },
      { name: "Company", count: 234 },
    ],
    stats: [
      { label: "Total Records", value: "2.4K" },
      { label: "Updated Today", value: 47 },
    ],
  },
  {
    id: "extraction_engine",
    title: "Extraction & Monitoring",
    description: "URL tracking, change detection, and data extraction",
    icon: Radar,
    path: "/extraction",
    subModules: [
      { name: "Firm URLs" },
      { name: "Contact URLs" },
      { name: "News" },
      { name: "Filings" },
    ],
    stats: [
      { label: "Monitored URLs", value: 1247 },
      { label: "Changes Detected", value: 23 },
    ],
  },
  {
    id: "contact_intelligence",
    title: "Contact Intelligence",
    description: "Advanced contact analysis and relationship mapping",
    icon: Users,
    path: "/intelligence",
    subModules: [],
    stats: [
      { label: "Coming Soon", value: "-" },
    ],
  },
];

const summaryStats = [
  { label: "Total Tasks", value: 998, icon: ClipboardList, trend: "+12%" },
  { label: "Completed Today", value: 47, icon: CheckCircle2, trend: "+8%" },
  { label: "Pending Review", value: 23, icon: Clock, trend: "-3%" },
  { label: "Flagged Items", value: 5, icon: AlertTriangle, trend: "0%" },
];

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { user, hasModuleAccess } = useAuth();
  const [accessDenied, setAccessDenied] = useState<{ open: boolean; moduleName: string }>({
    open: false,
    moduleName: "",
  });

  const handleModuleClick = (moduleId: string, path: string, title: string) => {
    if (hasModuleAccess(moduleId)) {
      setLocation(path);
    } else {
      setAccessDenied({ open: true, moduleName: title });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user?.displayName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Your role:</span>
          <RoleBadge role={user?.role as UserRole} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryStats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                <Badge
                  variant="secondary"
                  className={
                    stat.trend.startsWith("+")
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                      : stat.trend.startsWith("-")
                      ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                      : ""
                  }
                >
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {stat.trend}
                </Badge>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Modules</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="h-4 w-4" />
            <span>4 modules available</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {modules.map((module) => (
            <ModuleTile
              key={module.id}
              id={module.id}
              title={module.title}
              description={module.description}
              icon={module.icon}
              subModules={module.subModules}
              stats={module.stats}
              isLocked={!hasModuleAccess(module.id)}
              onClick={() =>
                handleModuleClick(module.id, module.path, module.title)
              }
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-base font-medium">Recent Activity</CardTitle>
            <Button variant="ghost" size="sm">View All</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { action: "Completed annotation task", user: "Anna A.", time: "2 min ago", type: "success" },
                { action: "New firm added to DataNest", user: "Morgan M.", time: "15 min ago", type: "info" },
                { action: "URL change detected", user: "System", time: "1 hour ago", type: "warning" },
                { action: "QA review approved", user: "Quinn Q.", time: "2 hours ago", type: "success" },
                { action: "Task assigned", user: "Morgan M.", time: "3 hours ago", type: "info" },
              ].map((activity, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      activity.type === "success"
                        ? "bg-emerald-500"
                        : activity.type === "warning"
                        ? "bg-amber-500"
                        : "bg-blue-500"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{activity.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {activity.user} · {activity.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-base font-medium">Your Tasks</CardTitle>
            <Button variant="ghost" size="sm">View All</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { title: "Label Q4 financial documents", status: "in_progress", priority: "high" },
                { title: "Review image annotations batch #42", status: "pending", priority: "medium" },
                { title: "Transcribe earnings call recording", status: "pending", priority: "low" },
                { title: "Validate firm data entries", status: "review", priority: "medium" },
              ].map((task, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover-elevate cursor-pointer"
                >
                  <div
                    className={`h-2 w-2 rounded-full ${
                      task.status === "in_progress"
                        ? "bg-blue-500"
                        : task.status === "review"
                        ? "bg-amber-500"
                        : "bg-gray-400"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {task.status.replace("_", " ")}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={
                      task.priority === "high"
                        ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                        : task.priority === "medium"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                        : ""
                    }
                  >
                    {task.priority}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <AccessDeniedModal
        open={accessDenied.open}
        onClose={() => setAccessDenied({ open: false, moduleName: "" })}
        moduleName={accessDenied.moduleName}
        requiredRole="manager or admin"
      />
    </div>
  );
}
