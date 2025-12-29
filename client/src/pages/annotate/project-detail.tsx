import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Upload,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  Play,
  UserPlus,
  FileSpreadsheet,
  Newspaper,
  Eye,
  FileText,
  Users,
  Plus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AnnotationTask {
  id: string;
  projectId: string;
  assignedTo: string | null;
  assignedToName: string | null;
  status: string;
  metadata: {
    headline?: string;
    source_name?: string;
    publish_date?: string;
    news_id?: string;
  };
  createdAt: string;
}

interface ProjectDetail {
  id: string;
  name: string;
  labelType: string;
  projectCategory: string;
  orgId: string;
  workContext: string;
  createdAt: string;
  tasks: AnnotationTask[];
}

interface OrgUser {
  id: string;
  displayName: string;
  role: string;
}

const statusIcons: Record<string, typeof Clock> = {
  pending: Clock,
  in_progress: Loader2,
  review: AlertCircle,
  completed: CheckCircle,
};

const statusColors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  review: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
};

export default function NestAnnotateProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userRole = user?.role || "annotator";
  const isManager = ["super_admin", "admin", "manager"].includes(userRole);
  const userId = user?.id;

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [uploading, setUploading] = useState(false);
  
  // Manual entry form state
  const [manualHeadline, setManualHeadline] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualSourceName, setManualSourceName] = useState("");
  const [manualPublishDate, setManualPublishDate] = useState("");
  const [manualRawText, setManualRawText] = useState("");
  
  // Team assignment state (multi-select)
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);

  const { data: project, isLoading } = useQuery<ProjectDetail>({
    queryKey: ["/api/nest-annotate/projects", projectId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/nest-annotate/projects/${projectId}`);
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: orgUsers } = useQuery<OrgUser[]>({
    queryKey: ["/api/nest-annotate/available-users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/nest-annotate/available-users");
      return res.json();
    },
    enabled: isManager,
  });

  const uploadNewsMutation = useMutation({
    mutationFn: async ({ articles, assignees }: { articles: any[]; assignees: string[] }) => {
      const res = await apiRequest("POST", `/api/nest-annotate/projects/${projectId}/upload-news`, {
        articles,
        assignees, // Pass selected assignees to backend
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Upload failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/nest-annotate/projects", projectId] });
      setUploadDialogOpen(false);
      // Reset form state
      setManualHeadline("");
      setManualUrl("");
      setManualSourceName("");
      setManualPublishDate("");
      setManualRawText("");
      setSelectedAssignees([]);
      toast({
        title: "Upload Complete",
        description: data.message,
      });
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload news",
        variant: "destructive",
      });
    },
  });

  const assignTaskMutation = useMutation({
    mutationFn: async ({ taskId, userId }: { taskId: string; userId: string | null }) => {
      const res = await apiRequest("PATCH", `/api/nest-annotate/tasks/${taskId}/assign`, { userId });
      if (!res.ok) throw new Error("Failed to assign task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nest-annotate/projects", projectId] });
      setAssignDialogOpen(false);
      toast({ title: "Task assigned successfully" });
    },
  });

  const claimTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await apiRequest("PATCH", `/api/nest-annotate/tasks/${taskId}/claim`, {});
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to claim task");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nest-annotate/projects", projectId] });
      toast({ title: "Task claimed successfully" });
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await apiRequest("PATCH", `/api/nest-annotate/tasks/${taskId}/complete`, {});
      if (!res.ok) throw new Error("Failed to complete task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nest-annotate/projects", projectId] });
      toast({ title: "Task marked as complete" });
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error("File must contain a header row and at least one data row");
      }

      const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g, ""));
      const requiredCols = ["headline", "url", "source_name", "publish_date", "raw_text"];
      const missingCols = requiredCols.filter(col => !headers.includes(col));
      
      if (missingCols.length > 0) {
        throw new Error(`Missing required columns: ${missingCols.join(", ")}`);
      }

      const articles = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length !== headers.length) continue;

        const article: Record<string, string> = {};
        headers.forEach((header, idx) => {
          article[header] = values[idx]?.replace(/^"|"$/g, "").trim() || "";
        });

        if (article.headline && article.raw_text) {
          articles.push({
            headline: article.headline,
            url: article.url || undefined,
            sourceName: article.source_name || undefined,
            publishDate: article.publish_date || undefined,
            rawText: article.raw_text,
            cleanedText: article.cleaned_text || undefined,
            language: article.language || undefined,
            articleState: (article.article_state as "pending" | "completed" | "not_relevant") || "pending",
          });
        }
      }

      if (articles.length === 0) {
        throw new Error("No valid articles found in file");
      }

      uploadNewsMutation.mutate({ articles, assignees: selectedAssignees });
    } catch (error) {
      toast({
        title: "Parse Error",
        description: error instanceof Error ? error.message : "Failed to parse file",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleManualSubmit = () => {
    if (!manualHeadline.trim() || !manualRawText.trim()) {
      toast({
        title: "Missing Required Fields",
        description: "Headline and article text are required",
        variant: "destructive",
      });
      return;
    }

    const article = {
      headline: manualHeadline.trim(),
      url: manualUrl.trim() || undefined,
      sourceName: manualSourceName.trim() || undefined,
      publishDate: manualPublishDate || undefined,
      rawText: manualRawText.trim(),
      articleState: "pending" as const,
    };

    uploadNewsMutation.mutate({ articles: [article], assignees: selectedAssignees });
  };

  const toggleAssignee = (userId: string) => {
    setSelectedAssignees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const isNewsProject = project?.projectCategory === "news";
  const tasks = project?.tasks || [];
  const pendingTasks = tasks.filter(t => t.status === "pending");
  const inProgressTasks = tasks.filter(t => t.status === "in_progress");
  const reviewTasks = tasks.filter(t => t.status === "review");
  const completedTasks = tasks.filter(t => t.status === "completed");

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Project Not Found</h3>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/annotate/projects">
            <Button variant="ghost" size="icon" data-testid="button-back-projects">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{project.name}</h1>
              {isNewsProject && (
                <Badge className="bg-primary/10 text-primary">
                  <Newspaper className="h-3 w-3 mr-1" />
                  News
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {tasks.length} tasks - {completedTasks.length} completed
            </p>
          </div>
        </div>
        {isManager && isNewsProject && (
          <Button onClick={() => setUploadDialogOpen(true)} data-testid="button-upload-news">
            <Upload className="h-4 w-4 mr-2" />
            Upload News
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{tasks.length}</p>
                <p className="text-xs text-muted-foreground">Total Items</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{pendingTasks.length}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{inProgressTasks.length}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{reviewTasks.length}</p>
                <p className="text-xs text-muted-foreground">In Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold">{completedTasks.length}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Tasks Yet</h3>
              <p className="text-muted-foreground mb-4">
                {isManager && isNewsProject
                  ? "Upload a CSV or Excel file with news articles to create tasks."
                  : "No tasks have been created for this project."}
              </p>
              {isManager && isNewsProject && (
                <Button onClick={() => setUploadDialogOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload News
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Article</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => {
                  const StatusIcon = statusIcons[task.status] || Clock;
                  const canClaim = task.status === "pending" && !task.assignedTo;
                  const canWorkOn = task.assignedTo === userId && task.status === "in_progress";
                  const canComplete = isManager && task.status === "review";

                  return (
                    <TableRow key={task.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm line-clamp-1">
                            {task.metadata?.headline || "Untitled"}
                          </p>
                          {task.metadata?.publish_date && (
                            <p className="text-xs text-muted-foreground">
                              {task.metadata.publish_date}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {task.metadata?.source_name || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[task.status]}>
                          <StatusIcon className={`h-3 w-3 mr-1 ${task.status === "in_progress" ? "animate-spin" : ""}`} />
                          {task.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {task.assignedToName || (task.assignedTo ? "Unknown" : "-")}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canClaim && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => claimTaskMutation.mutate(task.id)}
                              disabled={claimTaskMutation.isPending}
                              data-testid={`button-claim-task-${task.id}`}
                            >
                              <Play className="h-3 w-3 mr-1" />
                              Claim
                            </Button>
                          )}
                          {canWorkOn && (
                            <Link href={`/annotate/text/${task.id}`}>
                              <Button size="sm" data-testid={`button-work-task-${task.id}`}>
                                <Eye className="h-3 w-3 mr-1" />
                                Open
                              </Button>
                            </Link>
                          )}
                          {canComplete && (
                            <Button
                              size="sm"
                              onClick={() => completeTaskMutation.mutate(task.id)}
                              disabled={completeTaskMutation.isPending}
                              data-testid={`button-complete-task-${task.id}`}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Approve
                            </Button>
                          )}
                          {isManager && task.status === "pending" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedTaskId(task.id);
                                setSelectedAssignee(task.assignedTo || "");
                                setAssignDialogOpen(true);
                              }}
                              data-testid={`button-assign-task-${task.id}`}
                            >
                              <UserPlus className="h-3 w-3" />
                            </Button>
                          )}
                          {task.status !== "pending" && task.assignedTo === userId && (
                            <Link href={`/annotate/text/${task.id}`}>
                              <Button size="sm" variant="outline" data-testid={`button-view-task-${task.id}`}>
                                <Eye className="h-3 w-3 mr-1" />
                                View
                              </Button>
                            </Link>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add News Articles</DialogTitle>
            <DialogDescription>
              Upload via CSV or add a single article manually.
            </DialogDescription>
          </DialogHeader>
          
          {/* Team Assignment Section */}
          {orgUsers && orgUsers.length > 0 && (
            <div className="border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-medium text-sm">Assign To Team Members</h4>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Select users to assign tasks. Multiple users = one task per user.
              </p>
              <div className="flex flex-wrap gap-2">
                {orgUsers.map((u) => (
                  <div
                    key={u.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer transition-colors ${
                      selectedAssignees.includes(u.id)
                        ? "bg-primary/10 border-primary"
                        : "bg-background hover:bg-muted"
                    }`}
                    onClick={() => toggleAssignee(u.id)}
                    data-testid={`checkbox-assignee-${u.id}`}
                  >
                    <Checkbox
                      checked={selectedAssignees.includes(u.id)}
                      className="pointer-events-none"
                    />
                    <span className="text-sm">{u.displayName}</span>
                  </div>
                ))}
              </div>
              {selectedAssignees.length === 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  No selection = tasks remain unassigned
                </p>
              )}
            </div>
          )}

          <Tabs defaultValue="csv" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="csv" data-testid="tab-csv-upload">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                CSV Upload
              </TabsTrigger>
              <TabsTrigger value="manual" data-testid="tab-manual-entry">
                <Plus className="h-4 w-4 mr-2" />
                Manual Entry
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="csv" className="space-y-4 pt-4">
              <div className="border rounded-lg p-4 bg-muted/50">
                <h4 className="font-medium mb-2 text-sm">Required Columns:</h4>
                <p className="text-xs text-muted-foreground">
                  headline, url, source_name, publish_date, raw_text
                </p>
                <h4 className="font-medium mt-3 mb-1 text-sm">Optional:</h4>
                <p className="text-xs text-muted-foreground">
                  cleaned_text, language, article_state (pending/completed/not_relevant)
                </p>
              </div>
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  data-testid="input-file-upload"
                />
                <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || uploadNewsMutation.isPending}
                >
                  {(uploading || uploadNewsMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Select CSV File
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Supports CSV files with comma-separated values
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="manual" className="space-y-4 pt-4">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="manual-headline">Headline *</Label>
                  <Input
                    id="manual-headline"
                    value={manualHeadline}
                    onChange={(e) => setManualHeadline(e.target.value)}
                    placeholder="Article headline"
                    data-testid="input-manual-headline"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="manual-source">Source Name</Label>
                    <Input
                      id="manual-source"
                      value={manualSourceName}
                      onChange={(e) => setManualSourceName(e.target.value)}
                      placeholder="e.g. Reuters"
                      data-testid="input-manual-source"
                    />
                  </div>
                  <div>
                    <Label htmlFor="manual-date">Publish Date</Label>
                    <Input
                      id="manual-date"
                      type="date"
                      value={manualPublishDate}
                      onChange={(e) => setManualPublishDate(e.target.value)}
                      data-testid="input-manual-date"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="manual-url">URL</Label>
                  <Input
                    id="manual-url"
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    placeholder="https://..."
                    data-testid="input-manual-url"
                  />
                </div>
                <div>
                  <Label htmlFor="manual-text">Article Text *</Label>
                  <Textarea
                    id="manual-text"
                    value={manualRawText}
                    onChange={(e) => setManualRawText(e.target.value)}
                    placeholder="Paste article content here..."
                    rows={6}
                    data-testid="input-manual-text"
                  />
                </div>
                <Button
                  onClick={handleManualSubmit}
                  disabled={uploadNewsMutation.isPending || !manualHeadline.trim() || !manualRawText.trim()}
                  className="w-full"
                  data-testid="button-submit-manual"
                >
                  {uploadNewsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add Article
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Task</DialogTitle>
            <DialogDescription>
              Select a team member to assign this task to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Assign To</Label>
              <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                <SelectTrigger data-testid="select-assignee">
                  <SelectValue placeholder="Select a team member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {orgUsers?.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.displayName} ({u.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedTaskId) {
                    assignTaskMutation.mutate({
                      taskId: selectedTaskId,
                      userId: selectedAssignee === "unassigned" ? null : selectedAssignee,
                    });
                  }
                }}
                disabled={assignTaskMutation.isPending}
              >
                {assignTaskMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Assign
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
