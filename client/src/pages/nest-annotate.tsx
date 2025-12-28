import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation, Link } from "wouter";
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
  Filter,
  Plus,
  Loader2,
  ClipboardList,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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
  text: "Text Annotation",
  image: "Image Labeling",
  video: "Video Labeling",
  audio: "Audio Labeling",
  transcription: "Transcription",
  translation: "Translation",
};

type FilterType = LabelType | "news_intelligence" | "all";

const labelTypeColors: Record<LabelType, string> = {
  text: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  image: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  video: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  audio: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  transcription: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  translation: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
};

function getProjectDisplayInfo(labelType: LabelType, projectCategory?: string): { label: string; colorClass: string } {
  if (projectCategory === "news") {
    return {
      label: "News Intelligence",
      colorClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    };
  }
  return {
    label: labelTypeLabels[labelType],
    colorClass: labelTypeColors[labelType],
  };
}

interface SummaryCardProps {
  summary: LabelTypeSummary;
  isSelected: boolean;
  onClick: () => void;
}

function SummaryCard({ summary, isSelected, onClick }: SummaryCardProps) {
  const Icon = labelTypeIcons[summary.labelType];
  return (
    <Card 
      className={`cursor-pointer transition-all ${isSelected ? "ring-2 ring-primary bg-primary/5" : "hover-elevate"}`}
      onClick={onClick}
      data-testid={`card-summary-${summary.labelType}`}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className={`text-sm font-medium ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
          {labelTypeLabels[summary.labelType]}
        </CardTitle>
        <Icon className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
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

interface NewsIntelligenceCardProps {
  count: number;
  isSelected: boolean;
  onClick: () => void;
}

function NewsIntelligenceCard({ count, isSelected, onClick }: NewsIntelligenceCardProps) {
  return (
    <Card 
      className={`cursor-pointer transition-all ${isSelected ? "ring-2 ring-primary bg-primary/5" : "hover-elevate"}`}
      onClick={onClick}
      data-testid="card-summary-news-intelligence"
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className={`text-sm font-medium ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
          News Intelligence
        </CardTitle>
        <Newspaper className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" data-testid="text-count-news-intelligence">
          {count}
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

function LabelTypeBadge({ labelType, projectCategory }: { labelType: LabelType; projectCategory?: string }) {
  const { label, colorClass } = getProjectDisplayInfo(labelType, projectCategory);
  
  return (
    <Badge className={colorClass}>
      {label}
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
                  <LabelTypeBadge labelType={project.labelType} projectCategory={project.projectCategory} />
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedLabelType, setSelectedLabelType] = useState<FilterType>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [labelType, setLabelType] = useState("text");
  const [projectCategory, setProjectCategory] = useState("general");

  const orgId = user?.orgId || "";
  const userId = user?.id || "";
  const userRole = (user?.role || "annotator") as UserRole;
  const isManager = ["super_admin", "admin", "manager"].includes(userRole);

  const createProjectMutation = useMutation({
    mutationFn: async (data: { name: string; labelType: string; projectCategory: string }) => {
      const res = await apiRequest("POST", "/api/nest-annotate/projects", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create project");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nest-annotate-projects", orgId, userId, userRole] });
      setCreateDialogOpen(false);
      setProjectName("");
      setLabelType("text");
      setProjectCategory("general");
      toast({ title: "Project created successfully" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create project",
        variant: "destructive",
      });
    },
  });

  const handleCreateProject = () => {
    if (!projectName.trim()) {
      toast({ title: "Please enter a project name", variant: "destructive" });
      return;
    }
    createProjectMutation.mutate({
      name: projectName,
      labelType,
      projectCategory,
    });
  };

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

  const handleCardClick = (type: FilterType) => {
    setSelectedLabelType(selectedLabelType === type ? "all" : type);
  };

  const filteredProjects = projects.filter((project) => {
    let matchesLabelType = true;
    let matchesStatus = true;

    if (selectedLabelType !== "all") {
      if (selectedLabelType === "news_intelligence") {
        matchesLabelType = project.projectCategory === "news";
      } else {
        matchesLabelType = project.labelType === selectedLabelType && project.projectCategory !== "news";
      }
    }

    if (selectedStatus !== "all") {
      matchesStatus = project.projectStatus === selectedStatus;
    }

    return matchesLabelType && matchesStatus;
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">NestAnnotate</h1>
          <p className="text-muted-foreground">
            {isAnnotator 
              ? "Your assigned annotation projects" 
              : "Manage annotation projects across your organization"
            }
          </p>
        </div>
        {isManager && (
          <div className="flex gap-2 flex-wrap">
            <Link href="/annotate/shell-profiles">
              <Button variant="outline" data-testid="button-shell-profiles">
                <ClipboardList className="h-4 w-4 mr-2" />
                Shell Profiles
              </Button>
            </Link>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-project">
                  <Plus className="h-4 w-4 mr-2" />
                  New Project
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Project</DialogTitle>
                  <DialogDescription>
                    Set up a new annotation project. News projects support bulk article upload and entity tagging.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="project-name">Project Name</Label>
                    <Input
                      id="project-name"
                      placeholder="e.g., Q4 News Analysis"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      data-testid="input-project-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Label Type</Label>
                    <Select value={labelType} onValueChange={setLabelType}>
                      <SelectTrigger data-testid="select-label-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text Labeling</SelectItem>
                        <SelectItem value="image">Image Labeling</SelectItem>
                        <SelectItem value="video">Video Labeling</SelectItem>
                        <SelectItem value="audio">Audio Labeling</SelectItem>
                        <SelectItem value="transcription">Transcription</SelectItem>
                        <SelectItem value="translation">Translation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Project Category</Label>
                    <Select value={projectCategory} onValueChange={setProjectCategory}>
                      <SelectTrigger data-testid="select-project-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="news">News (Entity Tagging)</SelectItem>
                        <SelectItem value="research">Research</SelectItem>
                        <SelectItem value="training">Training</SelectItem>
                      </SelectContent>
                    </Select>
                    {projectCategory === "news" && (
                      <p className="text-xs text-muted-foreground">
                        News projects allow bulk CSV/Excel upload of articles and entity tagging workflows.
                      </p>
                    )}
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateProject}
                      disabled={createProjectMutation.isPending}
                      data-testid="button-submit-create-project"
                    >
                      {createProjectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Create Project
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
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
              <SummaryCard 
                key={summary.labelType} 
                summary={summary} 
                isSelected={selectedLabelType === summary.labelType}
                onClick={() => handleCardClick(summary.labelType)}
              />
            ))}
            <NewsIntelligenceCard 
              count={newsCount}
              isSelected={selectedLabelType === "news_intelligence"}
              onClick={() => handleCardClick("news_intelligence")}
            />
          </>
        )}
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filters:</span>
        </div>
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-40" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="not_started">Not Started</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        {(selectedLabelType !== "all" || selectedStatus !== "all") && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => { setSelectedLabelType("all"); setSelectedStatus("all"); }}
            data-testid="button-clear-filters"
          >
            Clear filters
          </Button>
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
        <ProjectsTable projects={filteredProjects} isLoading={projectsLoading} />
      )}
    </div>
  );
}
