import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { WorkflowProgress } from "./workflow-progress";
import { X, User, Calendar, Flag, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import type { Task } from "@shared/schema";

interface TaskPanelProps {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  onStatusChange?: (taskId: string, status: string) => void;
}

const statusConfig = {
  pending: { icon: Clock, color: "text-gray-500", bg: "bg-gray-100 dark:bg-gray-800" },
  in_progress: { icon: AlertCircle, color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-900" },
  review: { icon: AlertCircle, color: "text-amber-500", bg: "bg-amber-100 dark:bg-amber-900" },
  completed: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-900" },
  rejected: { icon: X, color: "text-red-500", bg: "bg-red-100 dark:bg-red-900" },
};

const priorityColors = {
  low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export function TaskPanel({ open, onClose, task, onStatusChange }: TaskPanelProps) {
  if (!task) return null;

  const StatusIcon = statusConfig[task.status as keyof typeof statusConfig]?.icon || Clock;
  const statusStyle = statusConfig[task.status as keyof typeof statusConfig];

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[540px] p-0" data-testid="panel-task-details">
        <SheetHeader className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-semibold">Task Details</SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              data-testid="button-close-task-panel"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">{task.title}</h2>
              <p className="text-muted-foreground">{task.description || "No description"}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge className={statusStyle?.bg}>
                <StatusIcon className={`h-3 w-3 mr-1 ${statusStyle?.color}`} />
                {task.status.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase())}
              </Badge>
              {task.priority && (
                <Badge className={priorityColors[task.priority as keyof typeof priorityColors]}>
                  <Flag className="h-3 w-3 mr-1" />
                  {task.priority}
                </Badge>
              )}
            </div>

            <Separator />

            {task.pipelineStep && (
              <div>
                <h3 className="text-sm font-medium mb-3">Pipeline Progress</h3>
                <WorkflowProgress currentStep={task.pipelineStep} />
              </div>
            )}

            <Separator />

            <div className="space-y-4">
              <h3 className="text-sm font-medium">Details</h3>
              
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Assigned to</p>
                  <p className="text-sm font-medium">{task.assignedTo || "Unassigned"}</p>
                </div>
              </div>

              {task.inputType && (
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Input Type</p>
                    <p className="text-sm font-medium capitalize">{task.inputType}</p>
                  </div>
                </div>
              )}

              {task.inputUrl && (
                <div className="rounded-lg border border-border p-3 bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Input URL</p>
                  <a
                    href={task.inputUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline break-all"
                  >
                    {task.inputUrl}
                  </a>
                </div>
              )}

              {task.confidenceScore !== null && task.confidenceScore !== undefined && (
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground mb-2">Confidence Score</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${task.confidenceScore}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{task.confidenceScore}%</span>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="text-sm font-medium">Actions</h3>
              <div className="flex flex-wrap gap-2">
                {task.status === "pending" && (
                  <Button
                    size="sm"
                    onClick={() => onStatusChange?.(task.id, "in_progress")}
                    data-testid="button-start-task"
                  >
                    Start Task
                  </Button>
                )}
                {task.status === "in_progress" && (
                  <Button
                    size="sm"
                    onClick={() => onStatusChange?.(task.id, "review")}
                    data-testid="button-submit-review"
                  >
                    Submit for Review
                  </Button>
                )}
                {task.status === "review" && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => onStatusChange?.(task.id, "completed")}
                      data-testid="button-approve-task"
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onStatusChange?.(task.id, "rejected")}
                      data-testid="button-reject-task"
                    >
                      Reject
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
