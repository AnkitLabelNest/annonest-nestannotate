import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { WorkflowProgress } from "@/components/workflow-progress";
import {
  Link as LinkIcon,
  FileText,
  Globe,
  Plus,
  Tag,
  Trash2,
  Save,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  Loader2,
} from "lucide-react";

interface SuggestionData {
  id: string;
  taskId: string;
  suggestedLabels: string[];
  suggestedEntities: Array<{ type: string; examples: string[] }>;
  confidence: number;
  reasoning: string;
  basedOnPatterns: string[];
  createdAt: string;
}

interface PatternData {
  patterns: Array<{ pattern: string; frequency: number; examples: string[] }>;
  totalAnnotations: number;
  uniqueLabels: number;
}

function AISuggestionsPanel({ taskId, onApplyLabel }: { taskId?: string; onApplyLabel: (type: string) => void }) {
  const { data: suggestionData, isLoading: suggestionLoading } = useQuery<SuggestionData>({
    queryKey: ['/api/suggestions', taskId],
    enabled: !!taskId,
  });

  const { data: patternData, isLoading: patternLoading } = useQuery<PatternData>({
    queryKey: ['/api/patterns'],
    enabled: !taskId,
  });

  const isLoading = taskId ? suggestionLoading : patternLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (taskId && suggestionData) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Confidence</span>
            <span className="font-medium">{suggestionData.confidence}%</span>
          </div>
          <Progress value={suggestionData.confidence} className="h-2" />
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Suggested Labels</p>
          <div className="flex flex-wrap gap-1">
            {suggestionData.suggestedLabels.length > 0 ? (
              suggestionData.suggestedLabels.map((label) => (
                <Badge
                  key={label}
                  variant="secondary"
                  className="cursor-pointer text-xs"
                  onClick={() => onApplyLabel(label)}
                  data-testid={`ai-suggestion-${label}`}
                >
                  {label}
                </Badge>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No label suggestions available</p>
            )}
          </div>
        </div>

        {suggestionData.suggestedEntities.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Entity Patterns</p>
            <div className="space-y-1">
              {suggestionData.suggestedEntities.slice(0, 3).map((entity) => (
                <div key={entity.type} className="text-xs p-2 rounded bg-muted/50">
                  <span className="font-medium capitalize">{entity.type}</span>
                  {entity.examples.length > 0 && (
                    <span className="text-muted-foreground ml-1">
                      (e.g., {entity.examples.slice(0, 2).join(", ")})
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground p-2 rounded bg-primary/5 border border-primary/10">
          {suggestionData.reasoning}
        </div>

        {suggestionData.basedOnPatterns.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Based on patterns:</p>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {suggestionData.basedOnPatterns.map((pattern, i) => (
                <li key={i} className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {pattern}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (!patternData || patternData.patterns.length === 0) {
    return (
      <div className="text-center py-4">
        <TrendingUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No patterns detected yet
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Complete more annotations to unlock AI suggestions
        </p>
      </div>
    );
  }

  const confidence = Math.min(95, Math.max(30, 30 + (patternData.totalAnnotations * 5)));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Confidence</span>
          <span className="font-medium">{confidence}%</span>
        </div>
        <Progress value={confidence} className="h-2" />
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Based on {patternData.totalAnnotations} historical annotations
        </p>
        <div className="flex flex-wrap gap-1">
          {patternData.patterns.slice(0, 6).map((pattern) => (
            <Badge
              key={pattern.pattern}
              variant="secondary"
              className="cursor-pointer text-xs"
              onClick={() => onApplyLabel(pattern.pattern)}
              data-testid={`ai-suggestion-${pattern.pattern}`}
            >
              {pattern.pattern}
              <span className="ml-1 opacity-60">({pattern.frequency})</span>
            </Badge>
          ))}
        </div>
      </div>

      {patternData.uniqueLabels > 0 && (
        <p className="text-xs text-muted-foreground">
          {patternData.uniqueLabels} unique label types detected
        </p>
      )}
    </div>
  );
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
  const [inputType, setInputType] = useState<"url" | "pdf" | "text">("text");
  const [textContent, setTextContent] = useState(
    "Acme Corporation announced today that its CEO, John Smith, will be stepping down effective January 15, 2025. The San Francisco-based company reported Q4 revenue of $2.3 billion, exceeding analyst expectations. The board has appointed Jane Doe as interim CEO while the search for a permanent replacement continues."
  );
  const [selectedText, setSelectedText] = useState("");
  const [labels, setLabels] = useState<{ text: string; type: string; start: number; end: number }[]>([
    { text: "Acme Corporation", type: "organization", start: 0, end: 16 },
    { text: "John Smith", type: "person", start: 51, end: 61 },
    { text: "January 15, 2025", type: "date", start: 88, end: 104 },
    { text: "San Francisco", type: "location", start: 110, end: 123 },
    { text: "$2.3 billion", type: "amount", start: 163, end: 175 },
  ]);
  const [confidence, setConfidence] = useState([85]);
  const [currentStep, setCurrentStep] = useState("entity_tagging");
  const currentTaskId = "demo-task-1";

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

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Text Labeling</h1>
          <p className="text-muted-foreground">
            Entity extraction and text annotation
          </p>
        </div>
        <WorkflowProgress currentStep={currentStep} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Input Source</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={inputType} onValueChange={(v) => setInputType(v as typeof inputType)}>
                <TabsList className="mb-4">
                  <TabsTrigger value="url">
                    <LinkIcon className="h-4 w-4 mr-2" />
                    URL
                  </TabsTrigger>
                  <TabsTrigger value="pdf">
                    <FileText className="h-4 w-4 mr-2" />
                    PDF
                  </TabsTrigger>
                  <TabsTrigger value="text">
                    <Globe className="h-4 w-4 mr-2" />
                    Direct Text
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="url">
                  <div className="space-y-2">
                    <Label>Document URL</Label>
                    <Input
                      placeholder="https://example.com/document.pdf"
                      data-testid="input-url"
                    />
                    <Button variant="outline" size="sm">
                      Fetch Content
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="pdf">
                  <div className="space-y-2">
                    <Label>Upload PDF</Label>
                    <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                      <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Drag & drop or click to upload
                      </p>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="text">
                  <div className="space-y-2">
                    <Label>Text Content</Label>
                    <Textarea
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      className="min-h-[120px]"
                      placeholder="Paste or type text content here..."
                      data-testid="input-text-content"
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Annotated Content</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="p-4 rounded-lg border border-border bg-muted/30 min-h-[200px] leading-relaxed cursor-text select-text"
                onMouseUp={handleTextSelect}
                data-testid="annotated-content"
              >
                {getHighlightedText()}
              </div>
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
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Extracted Entities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {labels.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No entities labeled yet
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
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                AI Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AISuggestionsPanel taskId={currentTaskId} onApplyLabel={addLabel} />
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
            <Button className="w-full" data-testid="button-save-draft">
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
            <Button variant="default" className="w-full" data-testid="button-submit-review">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Submit for Review
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
