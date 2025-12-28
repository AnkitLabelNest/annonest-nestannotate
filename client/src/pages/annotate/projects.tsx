import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  FolderOpen,
  Newspaper,
  FileText,
  Image,
  Video,
  FileAudio,
  Languages,
  Loader2,
  ArrowLeft,
  Upload,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface NestAnnotateProject {
  id: string;
  name: string;
  labelType: string;
  projectCategory: string;
  orgId: string;
  workContext: string;
  createdAt: string;
  totalItems: number;
  completedItems: number;
  projectStatus: string;
}

const labelTypeIcons: Record<string, typeof FileText> = {
  text: FileText,
  image: Image,
  video: Video,
  audio: FileAudio,
  transcription: FileAudio,
  translation: Languages,
};

const labelTypeLabels: Record<string, string> = {
  text: "Text Labeling",
  image: "Image Labeling",
  video: "Video Labeling",
  audio: "Audio Labeling",
  transcription: "Transcription",
  translation: "Translation",
};

const categoryLabels: Record<string, string> = {
  general: "General",
  news: "News",
  research: "Research",
  training: "Training",
};

const statusColors: Record<string, string> = {
  not_started: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
};

export default function NestAnnotateProjectsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userRole = user?.role || "annotator";
  const isManager = ["super_admin", "admin", "manager"].includes(userRole);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [labelType, setLabelType] = useState("text");
  const [projectCategory, setProjectCategory] = useState("general");

  const { data: projects, isLoading } = useQuery<NestAnnotateProject[]>({
    queryKey: ["/api/nest-annotate/projects", userRole],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/nest-annotate/projects?role=${userRole}`);
      return res.json();
    },
  });

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
      queryClient.invalidateQueries({ queryKey: ["/api/nest-annotate/projects"] });
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

  const newsProjects = projects?.filter(p => p.projectCategory === "news") || [];
  const otherProjects = projects?.filter(p => p.projectCategory !== "news") || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/annotate">
            <Button variant="ghost" size="icon" data-testid="button-back-annotate">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">NestAnnotate Projects</h1>
            <p className="text-muted-foreground">
              Manage annotation projects and news tagging workflows
            </p>
          </div>
        </div>
        {isManager && (
          <div className="flex gap-2">
            <Link href="/annotate/shell-profiles">
              <Button variant="outline" data-testid="button-shell-profiles">
                Shell Profile Queue
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

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-4 w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {newsProjects.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Newspaper className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">News Projects</h2>
                <Badge variant="secondary">{newsProjects.length}</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {newsProjects.map((project) => {
                  const Icon = labelTypeIcons[project.labelType] || FileText;
                  return (
                    <Link key={project.id} href={`/annotate/projects/${project.id}`}>
                      <Card className="cursor-pointer hover:border-primary/30 transition-colors">
                        <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                              <Newspaper className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-base">{project.name}</CardTitle>
                              <p className="text-xs text-muted-foreground">
                                {labelTypeLabels[project.labelType]}
                              </p>
                            </div>
                          </div>
                          <Badge className={statusColors[project.projectStatus]}>
                            {project.projectStatus.replace("_", " ")}
                          </Badge>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              {project.completedItems} / {project.totalItems} tasks
                            </span>
                            {project.totalItems > 0 && (
                              <div className="flex items-center gap-2">
                                <div className="w-20 h-1.5 rounded-full bg-muted overflow-visible">
                                  <div
                                    className="h-full bg-primary rounded-full"
                                    style={{ width: `${(project.completedItems / project.totalItems) * 100}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {Math.round((project.completedItems / project.totalItems) * 100)}%
                                </span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {otherProjects.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Other Projects</h2>
                <Badge variant="secondary">{otherProjects.length}</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {otherProjects.map((project) => {
                  const Icon = labelTypeIcons[project.labelType] || FileText;
                  return (
                    <Link key={project.id} href={`/annotate/projects/${project.id}`}>
                      <Card className="cursor-pointer hover:border-primary/30 transition-colors">
                        <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                              <Icon className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                              <CardTitle className="text-base">{project.name}</CardTitle>
                              <p className="text-xs text-muted-foreground">
                                {labelTypeLabels[project.labelType]} - {categoryLabels[project.projectCategory]}
                              </p>
                            </div>
                          </div>
                          <Badge className={statusColors[project.projectStatus]}>
                            {project.projectStatus.replace("_", " ")}
                          </Badge>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              {project.completedItems} / {project.totalItems} tasks
                            </span>
                            {project.totalItems > 0 && (
                              <div className="flex items-center gap-2">
                                <div className="w-20 h-1.5 rounded-full bg-muted overflow-visible">
                                  <div
                                    className="h-full bg-primary rounded-full"
                                    style={{ width: `${(project.completedItems / project.totalItems) * 100}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {Math.round((project.completedItems / project.totalItems) * 100)}%
                                </span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {(!projects || projects.length === 0) && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Projects Yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  {isManager
                    ? "Create your first annotation project to get started."
                    : "No projects have been assigned to you yet."}
                </p>
                {isManager && (
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Project
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
