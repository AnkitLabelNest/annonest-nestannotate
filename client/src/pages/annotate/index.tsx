import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/data-table";
import { TaskPanel } from "@/components/task-panel";
import { WorkflowProgress } from "@/components/workflow-progress";
import {
  FileText,
  Image,
  Video,
  FileAudio,
  Languages,
  Plus,
  Filter,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Task } from "@shared/schema";

const subModules = [
  { id: "text", title: "Text Label", icon: FileText, count: 24, path: "/annotate/text" },
  { id: "image", title: "Image Label", icon: Image, count: 18, path: "/annotate/image" },
  { id: "video", title: "Video Label", icon: Video, count: 7, path: "/annotate/video" },
  { id: "transcription", title: "Transcription", icon: FileAudio, count: 12, path: "/annotate/transcription" },
  { id: "translation", title: "Translation", icon: Languages, count: 9, path: "/annotate/translation" },
];

const mockTasks: Task[] = [
  {
    id: "task-1",
    projectId: "proj-1",
    title: "Label Q4 Financial Report - Section 2.1",
    description: "Extract and label key financial metrics from quarterly report",
    status: "in_progress",
    priority: "high",
    inputType: "pdf",
    inputUrl: "https://example.com/reports/q4-2024.pdf",
    assignedTo: "user-annotator",
    createdBy: "user-manager",
    reviewedBy: null,
    confidenceScore: 78,
    pipelineStep: "entity_tagging",
  },
  {
    id: "task-2",
    projectId: "proj-1",
    title: "Review Product Images Batch #42",
    description: "Validate bounding boxes for product detection",
    status: "review",
    priority: "medium",
    inputType: "url",
    inputUrl: "https://example.com/images/batch42",
    assignedTo: "user-qa",
    createdBy: "user-manager",
    reviewedBy: null,
    confidenceScore: 92,
    pipelineStep: "qa",
  },
  {
    id: "task-3",
    projectId: "proj-2",
    title: "Transcribe Earnings Call - Q3",
    description: "Full transcription with speaker identification",
    status: "pending",
    priority: "medium",
    inputType: "url",
    inputUrl: "https://example.com/audio/earnings-q3.mp3",
    assignedTo: null,
    createdBy: "user-manager",
    reviewedBy: null,
    confidenceScore: null,
    pipelineStep: "input",
  },
  {
    id: "task-4",
    projectId: "proj-3",
    title: "Translate Press Release - Spanish",
    description: "Translate company announcement to Spanish",
    status: "completed",
    priority: "low",
    inputType: "text",
    inputUrl: null,
    assignedTo: "user-annotator",
    createdBy: "user-manager",
    reviewedBy: "user-qa",
    confidenceScore: 95,
    pipelineStep: "qa",
  },
];

export default function AnnotatePage() {
  const [, setLocation] = useLocation();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const taskColumns = [
    { key: "title", header: "Task", sortable: true },
    {
      key: "status",
      header: "Status",
      render: (task: Task) => {
        const statusColors: Record<string, string> = {
          pending: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
          in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
          review: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
          completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
          rejected: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
        };
        return (
          <Badge className={statusColors[task.status]}>
            {task.status.replace("_", " ")}
          </Badge>
        );
      },
    },
    {
      key: "priority",
      header: "Priority",
      render: (task: Task) => {
        const priorityColors: Record<string, string> = {
          low: "bg-gray-100 text-gray-600",
          medium: "bg-blue-100 text-blue-600",
          high: "bg-amber-100 text-amber-600",
          urgent: "bg-red-100 text-red-600",
        };
        return (
          <Badge variant="secondary" className={priorityColors[task.priority || "medium"]}>
            {task.priority}
          </Badge>
        );
      },
    },
    {
      key: "pipelineStep",
      header: "Pipeline",
      render: (task: Task) => (
        <WorkflowProgress currentStep={task.pipelineStep || "input"} compact />
      ),
    },
    {
      key: "confidenceScore",
      header: "Confidence",
      render: (task: Task) =>
        task.confidenceScore !== null ? (
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{ width: `${task.confidenceScore}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {task.confidenceScore}%
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        ),
    },
  ];

  const handleViewTask = (task: Task) => {
    setSelectedTask(task);
    setTaskPanelOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">NestAnnotate</h1>
          <p className="text-muted-foreground">
            Multi-format data annotation with workflow pipelines
          </p>
        </div>
        <Button data-testid="button-create-task">
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {subModules.map((module) => (
          <Link key={module.id} href={module.path}>
            <Card className="cursor-pointer hover:border-primary/30 hover:shadow-md transition-all">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <module.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{module.title}</p>
                  <p className="text-xs text-muted-foreground">{module.count} tasks</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
          <CardTitle>All Tasks</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
                data-testid="input-search-tasks"
              />
            </div>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList className="mb-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="in_progress">In Progress</TabsTrigger>
              <TabsTrigger value="review">Review</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
            </TabsList>
            <TabsContent value="all">
              <DataTable
                data={mockTasks}
                columns={taskColumns}
                onView={handleViewTask}
                emptyMessage="No tasks found"
              />
            </TabsContent>
            <TabsContent value="pending">
              <DataTable
                data={mockTasks.filter((t) => t.status === "pending")}
                columns={taskColumns}
                onView={handleViewTask}
                emptyMessage="No pending tasks"
              />
            </TabsContent>
            <TabsContent value="in_progress">
              <DataTable
                data={mockTasks.filter((t) => t.status === "in_progress")}
                columns={taskColumns}
                onView={handleViewTask}
                emptyMessage="No tasks in progress"
              />
            </TabsContent>
            <TabsContent value="review">
              <DataTable
                data={mockTasks.filter((t) => t.status === "review")}
                columns={taskColumns}
                onView={handleViewTask}
                emptyMessage="No tasks in review"
              />
            </TabsContent>
            <TabsContent value="completed">
              <DataTable
                data={mockTasks.filter((t) => t.status === "completed")}
                columns={taskColumns}
                onView={handleViewTask}
                emptyMessage="No completed tasks"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <TaskPanel
        open={taskPanelOpen}
        onClose={() => setTaskPanelOpen(false)}
        task={selectedTask}
      />
    </div>
  );
}
