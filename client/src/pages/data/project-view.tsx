import { useState, useRef } from "react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ExternalLink,
  Upload,
  Users,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  Ban,
  Plus,
  Search,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";

interface ProjectItem {
  id: string;
  entityType: string;
  entityId: string;
  entityNameSnapshot: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  taskStatus: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProjectMember {
  id: string;
  userId: string;
  userName: string | null;
  role: string;
}

interface Project {
  id: string;
  name: string;
  projectType: string;
  description: string | null;
  status: string;
  items: ProjectItem[];
  members: ProjectMember[];
}

const statusIcons: Record<string, typeof Clock> = {
  pending: Clock,
  in_progress: Loader2,
  completed: CheckCircle,
  blocked: Ban,
};

const statusColors: Record<string, string> = {
  pending: "text-amber-500",
  in_progress: "text-blue-500",
  completed: "text-emerald-500",
  blocked: "text-red-500",
};

export default function DataNestProjectView() {
  const params = useParams();
  const projectId = params.id as string;
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [csvUploadOpen, setCsvUploadOpen] = useState(false);
  const [addEntityOpen, setAddEntityOpen] = useState(false);
  const [selectedEntityType, setSelectedEntityType] = useState("gp");
  const [entitySearch, setEntitySearch] = useState("");
  const [selectedEntity, setSelectedEntity] = useState<{ id: string; name: string } | null>(null);
  const [selectedEntityAssignee, setSelectedEntityAssignee] = useState("");

  const userRole = user?.role || "annotator";
  const isManager = ["super_admin", "admin", "manager"].includes(userRole);

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ["/api/datanest/projects", projectId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/datanest/projects/${projectId}`);
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: items, isLoading: itemsLoading, refetch: refetchItems } = useQuery<ProjectItem[]>({
    queryKey: ["/api/datanest/projects", projectId, "items", userRole],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/datanest/projects/${projectId}/items?role=${userRole}`);
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: orgUsers } = useQuery<Array<{ id: string; displayName: string }>>({
    queryKey: ["/api/users"],
    enabled: isManager,
  });

  const { data: availableEntities, isLoading: entitiesLoading } = useQuery<Array<{ id: string; name: string; entityType: string }>>({
    queryKey: ["/api/datanest/entities", selectedEntityType, entitySearch],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/datanest/entities/${selectedEntityType}?search=${encodeURIComponent(entitySearch)}&limit=50`);
      return res.json();
    },
    enabled: addEntityOpen && isManager,
  });

  const addEntityMutation = useMutation({
    mutationFn: async (data: { entityType: string; entityId: string; entityNameSnapshot: string; assignedTo: string }) => {
      const res = await apiRequest("POST", `/api/datanest/projects/${projectId}/items`, data);
      return res.json();
    },
    onSuccess: () => {
      refetchItems();
      setAddEntityOpen(false);
      setSelectedEntity(null);
      setSelectedEntityAssignee("");
      setEntitySearch("");
      toast({ title: "Entity added successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to add entity", 
        description: error.message || "Could not add entity to project",
        variant: "destructive" 
      });
    },
  });

  const handleAddEntity = () => {
    if (!selectedEntity || !selectedEntityAssignee) return;
    addEntityMutation.mutate({
      entityType: selectedEntityType,
      entityId: selectedEntity.id,
      entityNameSnapshot: selectedEntity.name,
      assignedTo: selectedEntityAssignee,
    });
  };

  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, data }: { itemId: string; data: any }) => {
      const res = await apiRequest("PUT", `/api/datanest/projects/${projectId}/items/${itemId}`, data);
      return res.json();
    },
    onSuccess: () => {
      refetchItems();
      toast({ title: "Task updated" });
    },
  });

  const bulkAssignMutation = useMutation({
    mutationFn: async (data: { itemIds: string[]; assignedTo: string }) => {
      const res = await apiRequest("POST", `/api/datanest/projects/${projectId}/items/assign`, data);
      return res.json();
    },
    onSuccess: () => {
      refetchItems();
      setSelectedItems([]);
      setAssignDialogOpen(false);
      toast({ title: "Tasks assigned successfully" });
    },
  });

  const bulkUploadMutation = useMutation({
    mutationFn: async (items: Array<{ entity_type: string; entity_id: string; assigned_to: string; task_status?: string }>) => {
      const res = await apiRequest("POST", `/api/datanest/projects/${projectId}/items/bulk`, { items });
      return res.json();
    },
    onSuccess: (data) => {
      refetchItems();
      setCsvUploadOpen(false);
      toast({ title: `${data.inserted} tasks added successfully` });
    },
    onError: (error: any) => {
      toast({ 
        title: "Upload failed", 
        description: error.message || "Validation errors in CSV",
        variant: "destructive" 
      });
    },
  });

  const handleOpenEntity = (entityType: string, entityId: string) => {
    const url = `/entity/${entityType}/${entityId}?mode=edit`;
    const newWindow = window.open(url, "_blank");
    if (!newWindow) {
      window.location.href = url;
    }
  };

  const handleStatusChange = (itemId: string, newStatus: string) => {
    updateItemMutation.mutate({ itemId, data: { taskStatus: newStatus } });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && items) {
      setSelectedItems(items.map(i => i.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (itemId: string, checked: boolean) => {
    if (checked) {
      setSelectedItems([...selectedItems, itemId]);
    } else {
      setSelectedItems(selectedItems.filter(id => id !== itemId));
    }
  };

  const handleBulkAssign = () => {
    if (!selectedAssignee || selectedItems.length === 0) return;
    bulkAssignMutation.mutate({ itemIds: selectedItems, assignedTo: selectedAssignee });
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").filter(line => line.trim());
      
      if (lines.length < 2) {
        toast({ title: "Invalid CSV", description: "No data rows found", variant: "destructive" });
        return;
      }

      const headers = lines[0].toLowerCase().split(",").map(h => h.trim());
      const entityTypeIdx = headers.indexOf("entity_type");
      const entityIdIdx = headers.indexOf("entity_id");
      const assignedToIdx = headers.indexOf("assigned_to");
      const taskStatusIdx = headers.indexOf("task_status");

      if (entityTypeIdx === -1 || entityIdIdx === -1 || assignedToIdx === -1) {
        toast({ 
          title: "Invalid CSV format", 
          description: "Required columns: entity_type, entity_id, assigned_to",
          variant: "destructive" 
        });
        return;
      }

      const items = lines.slice(1).map(line => {
        const values = line.split(",").map(v => v.trim());
        return {
          entity_type: values[entityTypeIdx],
          entity_id: values[entityIdIdx],
          assigned_to: values[assignedToIdx],
          task_status: taskStatusIdx !== -1 ? values[taskStatusIdx] : "pending",
        };
      }).filter(item => item.entity_type && item.entity_id && item.assigned_to);

      if (items.length === 0) {
        toast({ title: "No valid rows found", variant: "destructive" });
        return;
      }

      bulkUploadMutation.mutate(items);
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/data">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" data-testid="text-project-name">{project.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary">{project.projectType}</Badge>
            <Badge variant={project.status === "active" ? "default" : "secondary"}>
              {project.status}
            </Badge>
            {project.description && (
              <span className="text-sm text-muted-foreground">{project.description}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isManager && selectedItems.length > 0 && (
            <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-bulk-assign">
                  <Users className="h-4 w-4 mr-2" />
                  Assign ({selectedItems.length})
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign Tasks</DialogTitle>
                  <DialogDescription>
                    Assign {selectedItems.length} selected tasks to a team member.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Assign To</Label>
                    <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                      <SelectTrigger data-testid="select-assignee">
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent>
                        {orgUsers?.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    onClick={handleBulkAssign} 
                    disabled={bulkAssignMutation.isPending || !selectedAssignee}
                    className="w-full"
                    data-testid="button-confirm-assign"
                  >
                    {bulkAssignMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Assign Tasks
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          {isManager && (
            <Dialog open={csvUploadOpen} onOpenChange={setCsvUploadOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-csv-upload">
                  <Upload className="h-4 w-4 mr-2" />
                  Bulk Add (CSV)
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Bulk Add Tasks (CSV)</DialogTitle>
                  <DialogDescription>
                    Upload a CSV file with tasks. Required columns: entity_type, entity_id, assigned_to. Optional: task_status.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleCsvUpload}
                      className="hidden"
                      id="csv-upload"
                      data-testid="input-csv-file"
                    />
                    <label 
                      htmlFor="csv-upload" 
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Click to upload CSV file
                      </span>
                    </label>
                  </div>
                  {bulkUploadMutation.isPending && (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Uploading...</span>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}
          {isManager && (
            <Dialog open={addEntityOpen} onOpenChange={(open) => {
              setAddEntityOpen(open);
              if (!open) {
                setSelectedEntity(null);
                setEntitySearch("");
                setSelectedEntityAssignee("");
              }
            }}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-entity">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Entity
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add Entity to Project</DialogTitle>
                  <DialogDescription>
                    Select an entity type, search for the entity, and assign it to a team member.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Entity Type</Label>
                    <Select value={selectedEntityType} onValueChange={(val) => {
                      setSelectedEntityType(val);
                      setSelectedEntity(null);
                      setEntitySearch("");
                    }}>
                      <SelectTrigger data-testid="select-entity-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gp">GP (General Partner)</SelectItem>
                        <SelectItem value="lp">LP (Limited Partner)</SelectItem>
                        <SelectItem value="fund">Fund</SelectItem>
                        <SelectItem value="portfolio_company">Portfolio Company</SelectItem>
                        <SelectItem value="service_provider">Service Provider</SelectItem>
                        <SelectItem value="contact">Contact</SelectItem>
                        <SelectItem value="deal">Deal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Search Entity</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        value={entitySearch}
                        onChange={(e) => setEntitySearch(e.target.value)}
                        placeholder="Type to search..."
                        className="pl-9"
                        data-testid="input-entity-search"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Select Entity</Label>
                    <div className="border rounded-md max-h-48 overflow-y-auto">
                      {entitiesLoading ? (
                        <div className="p-4 flex items-center justify-center">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          <span className="text-sm text-muted-foreground">Loading...</span>
                        </div>
                      ) : availableEntities && availableEntities.length > 0 ? (
                        <div className="divide-y">
                          {availableEntities.map((entity) => (
                            <div 
                              key={entity.id}
                              className={`p-3 cursor-pointer hover-elevate ${selectedEntity?.id === entity.id ? 'bg-accent' : ''}`}
                              onClick={() => setSelectedEntity(entity)}
                              data-testid={`entity-option-${entity.id}`}
                            >
                              <span className="text-sm">{entity.name}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          No entities found. Try a different search.
                        </div>
                      )}
                    </div>
                    {selectedEntity && (
                      <div className="text-sm text-muted-foreground">
                        Selected: <span className="font-medium text-foreground">{selectedEntity.name}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Assign To</Label>
                    <Select value={selectedEntityAssignee} onValueChange={setSelectedEntityAssignee}>
                      <SelectTrigger data-testid="select-entity-assignee">
                        <SelectValue placeholder="Select team member" />
                      </SelectTrigger>
                      <SelectContent>
                        {orgUsers?.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    onClick={handleAddEntity} 
                    disabled={addEntityMutation.isPending || !selectedEntity || !selectedEntityAssignee}
                    className="w-full"
                    data-testid="button-confirm-add-entity"
                  >
                    {addEntityMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Add Entity
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Project Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {itemsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : items && items.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  {isManager && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedItems.length === items.length && items.length > 0}
                        onCheckedChange={handleSelectAll}
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                  )}
                  <TableHead>Entity Name</TableHead>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const StatusIcon = statusIcons[item.taskStatus] || Clock;
                  return (
                    <TableRow key={item.id} data-testid={`row-task-${item.id}`}>
                      {isManager && (
                        <TableCell>
                          <Checkbox
                            checked={selectedItems.includes(item.id)}
                            onCheckedChange={(checked) => handleSelectItem(item.id, !!checked)}
                            data-testid={`checkbox-task-${item.id}`}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">
                        {item.entityNameSnapshot || item.entityId.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{item.entityType}</Badge>
                      </TableCell>
                      <TableCell>{item.assignedToName || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StatusIcon className={`h-4 w-4 ${statusColors[item.taskStatus]}`} />
                          {isManager ? (
                            <Select 
                              value={item.taskStatus} 
                              onValueChange={(v) => handleStatusChange(item.id, v)}
                            >
                              <SelectTrigger className="w-28 h-8" data-testid={`select-status-${item.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="blocked">Blocked</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="capitalize">{item.taskStatus.replace("_", " ")}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          size="sm" 
                          onClick={() => handleOpenEntity(item.entityType, item.entityId)}
                          data-testid={`button-start-task-${item.id}`}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Start
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No tasks in this project yet.</p>
              {isManager && (
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setCsvUploadOpen(true)}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Add tasks via CSV
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
