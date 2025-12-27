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
  ArrowLeft,
  ExternalLink,
  ClipboardList,
  CheckCircle,
  Clock,
  Loader2,
  Ban,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface MyWorkItem {
  id: string;
  projectId: string;
  entityType: string;
  entityId: string;
  entityNameSnapshot: string | null;
  taskStatus: string;
  notes: string | null;
  updatedAt: string;
  projectName: string | null;
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

export default function MyWorkPage() {
  const { data: items, isLoading } = useQuery<MyWorkItem[]>({
    queryKey: ["/api/datanest/my-work"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/datanest/my-work");
      return res.json();
    },
  });

  const handleOpenEntity = (entityType: string, entityId: string) => {
    const url = `/entity/${entityType}/${entityId}?mode=edit`;
    const newWindow = window.open(url, "_blank");
    if (!newWindow) {
      window.location.href = url;
    }
  };

  const pendingItems = items?.filter(i => i.taskStatus !== "completed") || [];
  const completedItems = items?.filter(i => i.taskStatus === "completed") || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/data">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">My Work</h1>
          <p className="text-muted-foreground">
            All tasks assigned to you across all projects
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900 text-amber-600">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending Tasks</p>
              <p className="text-2xl font-bold" data-testid="text-pending-count">{pendingItems.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900 text-emerald-600">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completed Tasks</p>
              <p className="text-2xl font-bold" data-testid="text-completed-count">{completedItems.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Your Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : items && items.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity Name</TableHead>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>Project</TableHead>
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
                      <TableCell className="font-medium">
                        {item.entityNameSnapshot || item.entityId.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{item.entityType}</Badge>
                      </TableCell>
                      <TableCell>
                        <Link href={`/data/project/${item.projectId}`}>
                          <span className="text-primary hover:underline cursor-pointer">
                            {item.projectName || "Unknown Project"}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StatusIcon className={`h-4 w-4 ${statusColors[item.taskStatus]}`} />
                          <span className="capitalize">{item.taskStatus.replace("_", " ")}</span>
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
              <ClipboardList className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No tasks assigned to you yet.</p>
              <Link href="/data">
                <Button variant="outline" className="mt-4">
                  Go to DataNest Dashboard
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
