import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Newspaper, AlertCircle, User } from "lucide-react";
import { fetchNewsItems, type NewsItem } from "@/lib/nest-annotate-service";
import type { UserRole, AnnotationTaskStatus } from "@shared/schema";

function StatusBadge({ status }: { status: AnnotationTaskStatus }) {
  const statusConfig: Record<AnnotationTaskStatus, { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-slate-500/10 text-slate-600 dark:text-slate-400" },
    in_progress: { label: "In Progress", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
    review: { label: "In Review", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
    completed: { label: "Completed", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  };
  const config = statusConfig[status] || statusConfig.pending;
  return <Badge className={config.className}>{config.label}</Badge>;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { 
      year: "numeric", 
      month: "short", 
      day: "numeric" 
    });
  } catch {
    return dateStr;
  }
}

function NewsItemsTable({ items, isLoading }: { items: NewsItem[]; isLoading: boolean }) {
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Newspaper className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No News Items</h3>
          <p className="text-muted-foreground">
            No news items available for annotation at this time.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Newspaper className="h-5 w-5" />
          News Items
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Headline</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Publish Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned To</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow 
                key={item.id} 
                data-testid={`row-news-item-${item.id}`}
                className="cursor-pointer hover-elevate"
                onClick={() => setLocation(`/news/${item.id}`)}
              >
                <TableCell className="font-medium max-w-md" data-testid={`text-headline-${item.id}`}>
                  <div className="truncate" title={item.headline}>
                    {item.headline}
                  </div>
                </TableCell>
                <TableCell data-testid={`text-source-${item.id}`}>
                  {item.sourceName || "-"}
                </TableCell>
                <TableCell data-testid={`text-publish-date-${item.id}`}>
                  {formatDate(item.publishDate)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={item.status} />
                </TableCell>
                <TableCell data-testid={`text-assigned-to-${item.id}`}>
                  {item.assignedToName ? (
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">{item.assignedToName}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function NewsIntelligencePage() {
  const { user } = useAuth();

  const orgId = user?.orgId || "";
  const userId = user?.id || "";
  const userRole = (user?.role || "annotator") as UserRole;

  const { data: newsItems = [], isLoading, error } = useQuery({
    queryKey: ["news-intelligence", orgId, userId, userRole],
    queryFn: () => fetchNewsItems(orgId, userId, userRole),
    enabled: !!orgId && !!userId,
  });

  if (!user) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
            <p className="text-muted-foreground">Please log in to access News Intelligence.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAnnotator = userRole === "annotator";

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">News Intelligence</h1>
        <p className="text-muted-foreground">
          {isAnnotator 
            ? "Your assigned news articles for annotation" 
            : "Manage news annotation tasks across your organization"
          }
        </p>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>Failed to load news items. Please try again later.</span>
            </div>
          </CardContent>
        </Card>
      )}

      <NewsItemsTable items={newsItems} isLoading={isLoading} />
    </div>
  );
}
