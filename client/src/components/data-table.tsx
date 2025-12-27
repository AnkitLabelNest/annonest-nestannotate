import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Eye, Edit, Trash2, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { EntityType } from "@shared/schema";

interface Column<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  isLoading?: boolean;
  onView?: (item: T) => void;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  emptyMessage?: string;
  showAudit?: boolean;
  getAuditInfo?: (item: T) => { viewedBy?: string[]; lastEditedBy?: string };
  entityType?: EntityType;
  openInNewTab?: boolean;
}

function openEntityInNewTab(entityType: EntityType, entityId: string, mode: "view" | "edit") {
  const url = `/entity/${entityType}/${entityId}?mode=${mode}`;
  const newWindow = window.open(url, "_blank", "noopener,noreferrer");
  if (!newWindow) {
    window.location.href = url;
  }
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  isLoading,
  onView,
  onEdit,
  onDelete,
  emptyMessage = "No data available",
  showAudit,
  getAuditInfo,
  entityType,
  openInNewTab = false,
}: DataTableProps<T>) {
  
  const handleView = (item: T) => {
    if (openInNewTab && entityType) {
      openEntityInNewTab(entityType, item.id, "view");
    } else if (onView) {
      onView(item);
    }
  };

  const handleEdit = (item: T) => {
    if (openInNewTab && entityType) {
      openEntityInNewTab(entityType, item.id, "edit");
    } else if (onEdit) {
      onEdit(item);
    }
  };
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key as string}>
                  <Skeleton className="h-4 w-20" />
                </TableHead>
              ))}
              <TableHead>
                <Skeleton className="h-4 w-16" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3, 4, 5].map((i) => (
              <TableRow key={i}>
                {columns.map((col) => (
                  <TableCell key={col.key as string}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
                <TableCell>
                  <Skeleton className="h-8 w-20" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border p-12 text-center">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            {columns.map((col) => (
              <TableHead key={col.key as string}>
                <div className="flex items-center gap-2">
                  {col.header}
                  {col.sortable && (
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </TableHead>
            ))}
            {(onView || onEdit || onDelete || (openInNewTab && entityType)) && (
              <TableHead className="text-right">Actions</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item, index) => {
            const auditInfo = showAudit && getAuditInfo ? getAuditInfo(item) : null;
            return (
              <TableRow
                key={item.id}
                className={index % 2 === 0 ? "" : "bg-muted/30"}
                data-testid={`row-${item.id}`}
              >
                {columns.map((col) => (
                  <TableCell key={col.key as string}>
                    {col.render
                      ? col.render(item)
                      : String((item as Record<string, unknown>)[col.key as string] ?? "")}
                  </TableCell>
                ))}
                {(onView || onEdit || onDelete || (openInNewTab && entityType)) && (
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {(onView || (openInNewTab && entityType)) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleView(item)}
                          data-testid={`button-view-${item.id}`}
                          title={openInNewTab ? "Open in new tab" : "View"}
                        >
                          {openInNewTab ? <ExternalLink className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      )}
                      {(onEdit || (openInNewTab && entityType)) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(item)}
                          data-testid={`button-edit-${item.id}`}
                          title={openInNewTab ? "Edit in new tab" : "Edit"}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(item)}
                          data-testid={`button-delete-${item.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                    {auditInfo && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {auditInfo.lastEditedBy && (
                          <span>Edited by {auditInfo.lastEditedBy}</span>
                        )}
                      </div>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
