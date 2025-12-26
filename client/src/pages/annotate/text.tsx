import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import {
  ArrowLeft,
  AlertCircle,
  FileText,
  Tag,
  Trash2,
  Save,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import {
  fetchAnnotationTaskById,
  type AnnotationTaskDetail,
} from "@/lib/nest-annotate-service";
import { supabase } from "../../../lib/supabase";

interface TextLabelMetadata {
  text_content?: string;
  labels?: Array<{ text: string; type: string; start: number; end: number }>;
  confidence?: number;
  notes?: string;
}

const entityTypes = [
  { id: "person", label: "Person", color: "bg-blue-500" },
  { id: "organization", label: "Organization", color: "bg-purple-500" },
  { id: "location", label: "Location", color: "bg-emerald-500" },
  { id: "date", label: "Date", color: "bg-amber-500" },
  { id: "amount", label: "Amount", color: "bg-red-500" },
  { id: "product", label: "Product", color: "bg-pink-500" },
];

export default function TextLabelPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const orgId = user?.orgId || "";

  const [textContent, setTextContent] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [labels, setLabels] = useState<Array<{ text: string; type: string; start: number; end: number }>>([]);
  const [confidence, setConfidence] = useState([85]);
  const [notes, setNotes] = useState("");

  const isAuthReady = !!user && !!orgId;

  const {
    data: task,
    isLoading,
    error,
  } = useQuery<AnnotationTaskDetail | null>({
    queryKey: ["/api/annotation-tasks", taskId],
    queryFn: () => fetchAnnotationTaskById(taskId!, orgId),
    enabled: !!taskId && isAuthReady,
  });

  useEffect(() => {
    if (task?.metadata) {
      const meta = task.metadata as TextLabelMetadata;
      setTextContent(meta.text_content || "");
      setLabels(meta.labels || []);
      setConfidence([meta.confidence ?? 85]);
      setNotes(meta.notes || "");
    }
  }, [task]);

  const saveMutation = useMutation({
    mutationFn: async (status?: string) => {
      const metadata: TextLabelMetadata = {
        text_content: textContent,
        labels,
        confidence: confidence[0],
        notes,
      };
      const updateData: Record<string, unknown> = { metadata };
      if (status) {
        updateData.status = status;
      }
      const { error } = await supabase
        .from("annotation_tasks")
        .update(updateData)
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/annotation-tasks", taskId] });
      toast({
        title: "Saved",
        description: "Annotation saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save",
        variant: "destructive",
      });
    },
  });

  const handleTextSelect = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      setSelectedText(selection.toString().trim());
    }
  };

  const addLabel = (type: string) => {
    if (!selectedText) return;
    const start = textContent.indexOf(selectedText);
    if (start !== -1) {
      setLabels([
        ...labels,
        { text: selectedText, type, start, end: start + selectedText.length },
      ]);
      setSelectedText("");
    }
  };

  const removeLabel = (index: number) => {
    setLabels(labels.filter((_, i) => i !== index));
  };

  const getHighlightedText = () => {
    if (!textContent) return null;

    const sortedLabels = [...labels].sort((a, b) => a.start - b.start);
    const elements: JSX.Element[] = [];
    let lastEnd = 0;

    sortedLabels.forEach((label, i) => {
      if (label.start > lastEnd) {
        elements.push(
          <span key={`text-${i}`}>{textContent.slice(lastEnd, label.start)}</span>
        );
      }
      const entityType = entityTypes.find((e) => e.id === label.type);
      elements.push(
        <span
          key={`label-${i}`}
          className={`${entityType?.color} text-white px-1 rounded cursor-pointer`}
          title={label.type}
        >
          {label.text}
        </span>
      );
      lastEnd = label.end;
    });

    if (lastEnd < textContent.length) {
      elements.push(<span key="text-end">{textContent.slice(lastEnd)}</span>);
    }

    return elements;
  };

  const handleSaveDraft = () => {
    saveMutation.mutate(undefined);
  };

  const handleSubmitForReview = () => {
    saveMutation.mutate("in_review");
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

  if (!taskId) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Task ID Required</h2>
            <p className="text-muted-foreground mb-4">
              No task ID was provided in the URL.
            </p>
            <Button onClick={() => setLocation("/nest-annotate")} data-testid="button-back">
              Back to Projects
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-96" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Task Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The task you're looking for doesn't exist or you don't have access.
            </p>
            <Button onClick={() => setLocation("/nest-annotate")} data-testid="button-back">
              Back to Projects
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation(`/projects/${task.projectId}`)}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Text Labeling</h1>
          <p className="text-muted-foreground">
            {task.projectName} - Task {task.id.slice(0, 8)}...
          </p>
        </div>
        <Badge variant={task.status === "completed" ? "default" : "secondary"}>
          {task.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Text Content
              </CardTitle>
            </CardHeader>
            <CardContent>
              {textContent ? (
                <div
                  className="p-4 rounded-lg border border-border bg-muted/30 min-h-[200px] leading-relaxed cursor-text select-text whitespace-pre-wrap"
                  onMouseUp={handleTextSelect}
                  data-testid="annotated-content"
                >
                  {getHighlightedText()}
                </div>
              ) : (
                <div className="p-4 rounded-lg border border-dashed border-border text-center text-muted-foreground min-h-[200px] flex items-center justify-center">
                  <div>
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No text content available for this task.</p>
                    <p className="text-sm mt-2">You can add content below.</p>
                  </div>
                </div>
              )}
              {selectedText && (
                <div className="mt-4 p-3 rounded-lg border border-primary bg-primary/5">
                  <p className="text-sm mb-2">
                    Selected: <strong>"{selectedText}"</strong>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {entityTypes.map((entity) => (
                      <Button
                        key={entity.id}
                        size="sm"
                        variant="outline"
                        onClick={() => addLabel(entity.id)}
                        data-testid={`button-label-${entity.id}`}
                      >
                        <div className={`h-2 w-2 rounded-full ${entity.color} mr-2`} />
                        {entity.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Edit Text Content</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                className="min-h-[150px]"
                placeholder="Enter or edit the text content for annotation..."
                data-testid="input-text-content"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[100px]"
                placeholder="Add any notes about this annotation..."
                data-testid="input-notes"
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Extracted Entities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {labels.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No entities labeled yet. Select text and choose an entity type.
                  </p>
                ) : (
                  labels.map((label, index) => {
                    const entityType = entityTypes.find((e) => e.id === label.type);
                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 rounded-lg border border-border"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`h-3 w-3 rounded-full ${entityType?.color}`} />
                          <div>
                            <p className="text-sm font-medium">{label.text}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {label.type}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLabel(index)}
                          data-testid={`button-remove-label-${index}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Confidence Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Slider
                  value={confidence}
                  onValueChange={setConfidence}
                  max={100}
                  step={1}
                  data-testid="slider-confidence"
                />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Score</span>
                  <span className="text-lg font-semibold">{confidence}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            <Button
              className="w-full"
              variant="outline"
              onClick={handleSaveDraft}
              disabled={saveMutation.isPending}
              data-testid="button-save-draft"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Draft
            </Button>
            <Button
              variant="default"
              className="w-full"
              onClick={handleSubmitForReview}
              disabled={saveMutation.isPending}
              data-testid="button-submit-review"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Submit for Review
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
