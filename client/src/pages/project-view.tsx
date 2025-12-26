import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  AlertCircle,
  FileText,
  Users,
  CheckCircle2,
  Clock,
  Filter,
  Shuffle,
} from "lucide-react";
import {
  fetchProjectById,
  fetchProjectItems,
  fetchOrgUsers,
  bulkAssignItems,
  assignItemsEvenly,
  type ProjectDetails,
  type ProjectItem,
  type OrgUser,
} from "@/lib/nest-annotate-service";
import type { UserRole, AnnotationTaskStatus } from "@shared/schema";

const statusLabels: Record<AnnotationTaskStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  review: "Review",
  completed: "Completed",
};

const statusColors: Record<AnnotationTaskStatus, string> = {
  pending: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  in_progress: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  review: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

function StatusBadge({ status }: { status: AnnotationTaskStatus }) {
  return (
    <Badge className={statusColors[status]}>
      {statusLabels[status]}
    </Badge>
  );
}

function ProjectHeader({ project }: { project: ProjectDetails }) {
  const [, setLocation] = useLocation();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/nest-annotate")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-project-name">
            {project.name}
          </h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400">
              {project.labelType}
            </Badge>
            <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400">
              {project.projectCategory}
            </Badge>
            <Badge className={project.workContext === "internal" 
              ? "bg-slate-500/10 text-slate-600 dark:text-slate-400"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            }>
              {project.workContext === "internal" ? "Internal" : "Client"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <div>
              <div className="text-2xl font-bold" data-testid="text-total-items">
                {project.totalItems}
              </div>
              <div className="text-xs text-muted-foreground">Total Items</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <div>
              <div className="text-2xl font-bold" data-testid="text-completed-items">
                {project.completedItems}
              </div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-amber-500" />
            <div>
              <div className="text-2xl font-bold" data-testid="text-pending-items">
                {project.pendingItems}
              </div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ProjectViewPage() {
  const [, params] = useRoute("/projects/:projectId");
  const projectId = params?.projectId || "";
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const orgId = user?.orgId || "";
  const userId = user?.id || "";
  const userRole = (user?.role || "annotator") as UserRole;
  const canManage = userRole === "super_admin" || userRole === "admin" || userRole === "manager";

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [assignedFilter, setAssignedFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false);
  const [assignEvenlyDialogOpen, setAssignEvenlyDialogOpen] = useState(false);
  const [selectedAssignUser, setSelectedAssignUser] = useState<string>("");
  const [selectedEvenlyUsers, setSelectedEvenlyUsers] = useState<Set<string>>(new Set());

  const isAuthReady = !!user && !!orgId && !!userId;

  const { data: project, isLoading: projectLoading, error: projectError } = useQuery({
    queryKey: ["project", projectId, orgId],
    queryFn: () => fetchProjectById(projectId, orgId),
    enabled: !!projectId && isAuthReady,
  });

  const { data: items = [], isLoading: itemsLoading, error: itemsError } = useQuery({
    queryKey: ["project-items", projectId, orgId, userId, userRole],
    queryFn: () => fetchProjectItems(projectId, orgId, userId, userRole),
    enabled: !!projectId && isAuthReady,
  });

  const { data: orgUsers = [] } = useQuery({
    queryKey: ["org-users", orgId],
    queryFn: () => fetchOrgUsers(orgId),
    enabled: isAuthReady && canManage,
  });

  const bulkAssignMutation = useMutation({
    mutationFn: ({ itemIds, assignToUserId }: { itemIds: string[]; assignToUserId: string }) =>
      bulkAssignItems(itemIds, assignToUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-items", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      setSelectedItems(new Set());
      setBulkAssignDialogOpen(false);
      setSelectedAssignUser("");
      toast({ title: "Items assigned successfully" });
    },
    onError: () => {
      toast({ title: "Failed to assign items", variant: "destructive" });
    },
  });

  const assignEvenlyMutation = useMutation({
    mutationFn: ({ itemIds, userIds }: { itemIds: string[]; userIds: string[] }) =>
      assignItemsEvenly(itemIds, userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-items", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      setSelectedItems(new Set());
      setAssignEvenlyDialogOpen(false);
      setSelectedEvenlyUsers(new Set());
      toast({ title: "Items distributed evenly" });
    },
    onError: () => {
      toast({ title: "Failed to distribute items", variant: "destructive" });
    },
  });

  const uniqueSources = useMemo(() => {
    const sources = new Set<string>();
    items.forEach((item) => {
      if (item.sourceName) {
        sources.add(item.sourceName);
      }
    });
    return Array.from(sources);
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }
      if (assignedFilter === "me" && item.assignedTo !== userId) {
        return false;
      }
      if (assignedFilter === "unassigned" && item.assignedTo !== null) {
        return false;
      }
      if (assignedFilter !== "all" && assignedFilter !== "me" && assignedFilter !== "unassigned" && item.assignedTo !== assignedFilter) {
        return false;
      }
      if (sourceFilter !== "all" && item.sourceName !== sourceFilter) {
        return false;
      }
      return true;
    });
  }, [items, statusFilter, assignedFilter, sourceFilter, userId]);

  const toggleSelectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map((i) => i.id)));
    }
  };

  const toggleSelectItem = (itemId: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(itemId)) {
      newSet.delete(itemId);
    } else {
      newSet.add(itemId);
    }
    setSelectedItems(newSet);
  };

  const handleBulkAssign = () => {
    if (!selectedAssignUser || selectedItems.size === 0) return;
    bulkAssignMutation.mutate({
      itemIds: Array.from(selectedItems),
      assignToUserId: selectedAssignUser,
    });
  };

  const handleAssignEvenly = () => {
    if (selectedEvenlyUsers.size === 0 || selectedItems.size === 0) return;
    assignEvenlyMutation.mutate({
      itemIds: Array.from(selectedItems),
      userIds: Array.from(selectedEvenlyUsers),
    });
  };

  const toggleEvenlyUser = (userId: string) => {
    const newSet = new Set(selectedEvenlyUsers);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedEvenlyUsers(newSet);
  };

  const handleRowClick = (item: ProjectItem) => {
    if (!project) return;
    const labelType = project.labelType;
    setLocation(`/annotate/${labelType}?taskId=${item.id}`);
  };

  if (!user) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
            <p className="text-muted-foreground">Please log in to access this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (projectLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (projectError || !project) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Project Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The project you're looking for doesn't exist or you don't have access to it.
            </p>
            <Button onClick={() => setLocation("/nest-annotate")} data-testid="button-back-to-dashboard">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isNewsProject = project.projectCategory === "news";

  return (
    <div className="p-6 space-y-6">
      <ProjectHeader project={project} />

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36" data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={assignedFilter} onValueChange={setAssignedFilter}>
                <SelectTrigger className="w-40" data-testid="select-assigned-filter">
                  <SelectValue placeholder="Assigned To" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="me">Assigned to Me</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {canManage && orgUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.displayName || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {isNewsProject && uniqueSources.length > 0 && (
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="w-40" data-testid="select-source-filter">
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    {uniqueSources.map((source) => (
                      <SelectItem key={source} value={source}>
                        {source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {canManage && selectedItems.size > 0 && (
        <Card className="border-primary">
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <span className="font-medium">{selectedItems.size} item(s) selected</span>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setBulkAssignDialogOpen(true)}
                  data-testid="button-bulk-assign"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Bulk Assign
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setAssignEvenlyDialogOpen(true)}
                  data-testid="button-assign-evenly"
                >
                  <Shuffle className="h-4 w-4 mr-2" />
                  Assign Evenly
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Items ({filteredItems.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {itemsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : itemsError ? (
            <div className="text-center py-8 text-destructive">
              <AlertCircle className="h-8 w-8 mx-auto mb-2" />
              <p>Failed to load items</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Items Found</h3>
              <p className="text-muted-foreground">
                {items.length === 0
                  ? "No items in this project yet"
                  : "No items match the current filters"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {canManage && (
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                        onCheckedChange={toggleSelectAll}
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                  )}
                  <TableHead>Headline / Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer hover-elevate"
                    onClick={() => handleRowClick(item)}
                    data-testid={`row-item-${item.id}`}
                  >
                    {canManage && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedItems.has(item.id)}
                          onCheckedChange={() => toggleSelectItem(item.id)}
                          data-testid={`checkbox-item-${item.id}`}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-medium" data-testid={`text-headline-${item.id}`}>
                      {item.headline}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                    <TableCell data-testid={`text-assigned-${item.id}`}>
                      {item.assignedToEmail || (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={bulkAssignDialogOpen} onOpenChange={setBulkAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Assign Items</DialogTitle>
            <DialogDescription>
              Assign {selectedItems.size} selected item(s) to a single user.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedAssignUser} onValueChange={setSelectedAssignUser}>
              <SelectTrigger data-testid="select-bulk-assign-user">
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                {orgUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.displayName || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkAssign}
              disabled={!selectedAssignUser || bulkAssignMutation.isPending}
              data-testid="button-confirm-bulk-assign"
            >
              {bulkAssignMutation.isPending ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignEvenlyDialogOpen} onOpenChange={setAssignEvenlyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Evenly</DialogTitle>
            <DialogDescription>
              Distribute {selectedItems.size} selected item(s) evenly across selected users.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2 max-h-64 overflow-auto">
            {orgUsers.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 p-2 rounded-md hover-elevate"
                onClick={() => toggleEvenlyUser(u.id)}
              >
                <Checkbox
                  checked={selectedEvenlyUsers.has(u.id)}
                  onCheckedChange={() => toggleEvenlyUser(u.id)}
                  data-testid={`checkbox-evenly-user-${u.id}`}
                />
                <span>{u.displayName || u.email}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignEvenlyDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssignEvenly}
              disabled={selectedEvenlyUsers.size === 0 || assignEvenlyMutation.isPending}
              data-testid="button-confirm-assign-evenly"
            >
              {assignEvenlyMutation.isPending ? "Distributing..." : `Distribute to ${selectedEvenlyUsers.size} user(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
