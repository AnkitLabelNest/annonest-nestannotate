import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import {
  Type,
  Image,
  Video,
  AudioLines,
  Languages,
  FileText,
  FolderOpen,
  AlertCircle,
  Newspaper,
} from "lucide-react";
import {
  fetchProjectsWithStats,
  fetchLabelTypeSummary,
  fetchNewsIntelligenceCount,
  type LabelProjectWithStats,
  type LabelTypeSummary,
} from "@/lib/nest-annotate-service";
import type { LabelType, UserRole } from "@shared/schema";

const labelTypeIcons: Record<LabelType, typeof Type> = {
  text: Type,
  image: Image,
  video: Video,
  audio: AudioLines,
  transcription: FileText,
  translation: Languages,
};

const labelTypeLabels: Record<LabelType, string> = {
  text: "Text Label",
  image: "Image Label",
  video: "Video Label",
  audio: "Audio Label",
  transcription: "Transcription",
  translation: "Translation",
};

const labelTypeColors: Record<LabelType, string> = {
  text: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  image: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  video: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  audio: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  transcription: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  translation: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
};

function SummaryCard({ summary }: { summary: LabelTypeSummary }) {
  const Icon = labelTypeIcons[summary.labelType];
  return (
    <Card data-testid={`card-summary-${summary.labelType}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {labelTypeLabels[summary.labelType]}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" data-testid={`text-count-${summary.labelType}`}>
          {summary.openCount}
        </div>
        <p className="text-xs text-muted-foreground">Open items</p>
      </CardContent>
    </Card>
  );
}

function ProjectStatusBadge({ status }: { status: "not_started" | "in_progress" | "completed" }) {
  const statusConfig = {
    not_started: { label: "Not Started", className: "bg-slate-500/10 text-slate-600 dark:text-slate-400" },
    in_progress: { label: "In Progress", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
    completed: { label: "Completed", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  };
  const config = statusConfig[status];
  return <Badge className={config.className}>{config.label}</Badge>;
}

function WorkContextBadge({ context }: { context: string }) {
  const isInternal = context === "internal";
  return (
    <Badge className={isInternal 
      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" 
      : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
    }>
      {isInternal ? "Internal" : "Client"}
    </Badge>
  );
}

function LabelTypeBadge({ labelType }: { labelType: LabelType }) {
  return (
    <Badge className={labelTypeColors[labelType]}>
      {labelTypeLabels[labelType]}
    </Badge>
  );
}

function ProjectsTable({ projects, isLoading }: { projects: LabelProjectWithStats[]; isLoading: boolean }) {
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Projects Available</h3>
          <p className="text-muted-foreground">
            Projects are created automatically via ingestion pipelines.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          Projects
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project Name</TableHead>
              <TableHead>Label Type</TableHead>
              <TableHead>Context</TableHead>
              <TableHead className="text-center">Total Items</TableHead>
              <TableHead className="text-center">Completed</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow key={project.id} data-testid={`row-project-${project.id}`}>
                <TableCell className="font-medium" data-testid={`text-project-name-${project.id}`}>
                  {project.name}
                </TableCell>
                <TableCell>
                  <LabelTypeBadge labelType={project.labelType} />
                </TableCell>
                <TableCell>
                  <WorkContextBadge context={project.workContext} />
                </TableCell>
                <TableCell className="text-center" data-testid={`text-total-items-${project.id}`}>
                  {project.totalItems}
                </TableCell>
                <TableCell className="text-center" data-testid={`text-completed-items-${project.id}`}>
                  {project.completedItems}
                </TableCell>
                <TableCell>
                  <ProjectStatusBadge status={project.projectStatus} />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation(`/projects/${project.id}`)}
                    data-testid={`button-open-project-${project.id}`}
                  >
                    Open Project
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function NestAnnotatePage() {
  const { user } = useAuth();

  const orgId = user?.orgId || "";
  const userId = user?.id || "";
  const userRole = (user?.role || "annotator") as UserRole;

  const { data: summaries = [], isLoading: summaryLoading, error: summaryError } = useQuery({
    queryKey: ["nest-annotate-summary", orgId, userId, userRole],
    queryFn: () => fetchLabelTypeSummary(orgId, userId, userRole),
    enabled: !!orgId && !!userId,
  });

  const { data: projects = [], isLoading: projectsLoading, error: projectsError } = useQuery({
    queryKey: ["nest-annotate-projects", orgId, userId, userRole],
    queryFn: () => fetchProjectsWithStats(orgId, userId, userRole),
    enabled: !!orgId && !!userId,
  });

  const { data: newsCount = 0, isLoading: newsLoading } = useQuery({
    queryKey: ["news-intelligence-count", orgId, userId, userRole],
    queryFn: () => fetchNewsIntelligenceCount(orgId, userId, userRole),
    enabled: !!orgId && !!userId,
  });

  if (!user) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
            <p className="text-muted-foreground">Please log in to access NestAnnotate.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAnnotator = userRole === "annotator";
  const showNoWorkMessage = isAnnotator && projects.length === 0 && !projectsLoading;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">NestAnnotate</h1>
        <p className="text-muted-foreground">
          {isAnnotator 
            ? "Your assigned annotation projects" 
            : "Manage annotation projects across your organization"
          }
        </p>
      </div>

      {(summaryError || projectsError) && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>Failed to load data. Please try again later.</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-7">
        {summaryLoading || newsLoading ? (
          [...Array(7)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-12" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            {summaries.map((summary) => (
              <SummaryCard key={summary.labelType} summary={summary} />
            ))}
            <Card data-testid="card-summary-news-intelligence">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  News Intelligence
                </CardTitle>
                <Newspaper className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-count-news-intelligence">
                  {newsCount}
                </div>
                <p className="text-xs text-muted-foreground">Open items</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {showNoWorkMessage ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Work Assigned</h3>
            <p className="text-muted-foreground">
              No work assigned to you yet. Check back later or contact your manager.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ProjectsTable projects={projects} isLoading={projectsLoading} />
      )}
    </div>
  );
}
