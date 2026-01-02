import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Building2,
  Users,
  Wallet,
  Briefcase,
  Plus,
  FolderKanban,
  ExternalLink,
  Landmark,
  HandshakeIcon,
  Loader2,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";

interface EntityCounts {
  lp: number;
  gp: number;
  fund: number;
  portfolio_company: number;
  deal: number;
  contact: number;
}

interface Project {
  id: string;
  name: string;
  type: string; // Supabase uses 'type' not 'projectType'
  status: string;
}

interface ProjectStats {
  total: number;
  todo: number;
  inProgress: number;
  blocked: number;
  done: number;
}

type ProjectStatsMap = Record<string, ProjectStats>;

const datasetCards = [
  { id: "lp", title: "LP", icon: Landmark, path: "/data/firms?type=lp", color: "bg-purple-500" },
  { id: "gp", title: "GP", icon: Building2, path: "/data/firms?type=gp", color: "bg-blue-500" },
  { id: "fund", title: "Fund", icon: Wallet, path: "/data/funds", color: "bg-indigo-500" },
  { id: "portfolio_company", title: "Portfolio Company", icon: Building2, path: "/data/firms?type=portfolio_company", color: "bg-amber-500" },
  { id: "deal", title: "Deal", icon: Briefcase, path: "/data/deals", color: "bg-cyan-500" },
  { id: "contact", title: "Contacts", icon: Users, path: "/data/contacts", color: "bg-pink-500" },
];


export default function DataNestPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectType, setNewProjectType] = useState("research");

  const userRole = user?.role || "annotator";
  const isManager = ["super_admin", "admin", "manager"].includes(userRole);

  const { data: entityCounts, isLoading: countsLoading } = useQuery<EntityCounts>({
    queryKey: ["/api/datanest/entity-counts"],
  });

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/datanest/projects", userRole],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/datanest/projects?role=${userRole}`);
      return res.json();
    },
  });

  // Fetch project stats separately (maintains architectural separation)
  const { data: projectStats } = useQuery<ProjectStatsMap>({
    queryKey: ["/api/datanest/projects-stats"],
  });

  const createProjectMutation = useMutation({
    mutationFn: async (data: { name: string; type: string }) => {
      const res = await apiRequest("POST", "/api/datanest/projects", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "/api/datanest/projects"
      });
      setCreateProjectOpen(false);
      setNewProjectName("");
      toast({ title: "Project created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create project", variant: "destructive" });
    },
  });

  const handleOpenEntityInNewTab = (entityType: string) => {
  const url = `/entity/${entityType}/new`;
  const newWindow = window.open(url, "_blank");
  if (!newWindow) {
    window.location.href = url;
  }
};



  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;
    createProjectMutation.mutate({ name: newProjectName, type: newProjectType });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      paused: "secondary",
      completed: "outline",
      archived: "secondary",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">DataNest Dashboard</h1>
          <p className="text-muted-foreground">
            Structured data hub for firms, contacts, funds, and deals
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isManager && (
            <Dialog open={createProjectOpen} onOpenChange={setCreateProjectOpen}>
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
                    Create a new data project to organize entity work.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="project-name">Project Name</Label>
                    <Input
                      id="project-name"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="Enter project name"
                      data-testid="input-project-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="project-type">Project Type</Label>
                    <Select value={newProjectType} onValueChange={setNewProjectType}>
                      <SelectTrigger data-testid="select-project-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="research">Research</SelectItem>
                        <SelectItem value="data_enrichment">Data Enrichment</SelectItem>
                        <SelectItem value="verification">Verification</SelectItem>
                        <SelectItem value="outreach">Outreach</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    onClick={handleCreateProject} 
                    disabled={createProjectMutation.isPending || !newProjectName.trim()}
                    className="w-full"
                    data-testid="button-confirm-create-project"
                  >
                    {createProjectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Project
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {datasetCards.map((card) => (
          <Link key={card.id} href={card.path}>
            <Card 
              className="cursor-pointer hover:border-primary/30 transition-all h-full"
              data-testid={`card-dataset-${card.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.color} text-white`}>
                    <card.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{card.title}</p>
                    {countsLoading ? (
                      <Skeleton className="h-6 w-12" />
                    ) : (
                      <p className="text-xl font-bold">
                        {entityCounts?.[card.id as keyof EntityCounts]?.toLocaleString() || 0}
                      </p>
                    )}
                  </div>
                </div>
                <Button
  size="sm"
  variant="ghost"
  className="w-full mt-2"
  onClick={(e) => {
    e.stopPropagation();
    e.preventDefault();
    handleOpenEntityInNewTab(card.id);
  }}
  data-testid={`button-add-${card.id}`}
>
  <Plus className="h-3 w-3 mr-1" />
  Add
</Button>

              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-medium">Projects</CardTitle>
          </div>
          <Link href="/data/my-work">
            <Button variant="outline" size="sm" data-testid="button-my-work">
              My Work
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {projectsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : projects && projects.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => {
                  const stats = projectStats?.[project.id];
                  return (
                    <TableRow key={project.id} data-testid={`row-project-${project.id}`}>
                      <TableCell className="font-medium">{project.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{project.type || "research"}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(project.status)}</TableCell>
                      <TableCell>
                        {stats ? (
                          <div className="flex items-center gap-3 text-xs">
                            <div className="flex items-center gap-1" title="Total Items">
                              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{stats.total}</span>
                            </div>
                            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400" title="Done">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>{stats.done}</span>
                            </div>
                            <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400" title="Pending">
                              <Clock className="h-3.5 w-3.5" />
                              <span>{stats.todo}</span>
                            </div>
                            {stats.blocked > 0 && (
                              <div className="flex items-center gap-1 text-red-600 dark:text-red-400" title="Blocked">
                                <AlertCircle className="h-3.5 w-3.5" />
                                <span>{stats.blocked}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/data/project/${project.id}`}>
                          <Button size="sm" variant="ghost" data-testid={`button-open-project-${project.id}`}>
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Open
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FolderKanban className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No projects found</p>
              {isManager && (
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setCreateProjectOpen(true)}
                  data-testid="button-create-first-project"
                >
                  Create your first project
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
