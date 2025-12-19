import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { WorkflowProgress } from "@/components/workflow-progress";
import {
  Link as LinkIcon,
  Upload,
  Globe,
  Square,
  Circle,
  MousePointer,
  Trash2,
  Save,
  CheckCircle2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Image as ImageIcon,
} from "lucide-react";

const labelCategories = [
  { id: "product", label: "Product", color: "bg-blue-500" },
  { id: "logo", label: "Logo", color: "bg-purple-500" },
  { id: "text", label: "Text", color: "bg-emerald-500" },
  { id: "face", label: "Face", color: "bg-amber-500" },
  { id: "background", label: "Background", color: "bg-gray-500" },
];

export default function ImageLabelPage() {
  const [inputType, setInputType] = useState<"url" | "upload">("url");
  const [imageUrl, setImageUrl] = useState("/api/placeholder/800/600");
  const [selectedTool, setSelectedTool] = useState<"select" | "rectangle" | "polygon">("rectangle");
  const [confidence, setConfidence] = useState([88]);
  const [currentStep, setCurrentStep] = useState("action");
  const [annotations, setAnnotations] = useState([
    { id: 1, type: "rectangle", label: "product", x: 10, y: 10, width: 30, height: 40 },
    { id: 2, type: "rectangle", label: "logo", x: 60, y: 5, width: 15, height: 15 },
  ]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Image Labeling</h1>
          <p className="text-muted-foreground">
            Bounding box and polygon annotation for images
          </p>
        </div>
        <WorkflowProgress currentStep={currentStep} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle>Image Canvas</CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon">
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-2">100%</span>
                <Button variant="ghost" size="icon">
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon">
                  <RotateCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative rounded-lg border border-border bg-muted/30 aspect-video flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <ImageIcon className="h-16 w-16 mx-auto text-muted-foreground/50" />
                    <p className="mt-2 text-muted-foreground">
                      Image canvas - annotations would appear here
                    </p>
                  </div>
                </div>
                {annotations.map((ann) => (
                  <div
                    key={ann.id}
                    className={`absolute border-2 ${
                      labelCategories.find((c) => c.id === ann.label)?.color.replace("bg-", "border-") || "border-blue-500"
                    } rounded`}
                    style={{
                      left: `${ann.x}%`,
                      top: `${ann.y}%`,
                      width: `${ann.width}%`,
                      height: `${ann.height}%`,
                    }}
                    data-testid={`annotation-${ann.id}`}
                  >
                    <Badge
                      className={`absolute -top-6 left-0 text-xs ${
                        labelCategories.find((c) => c.id === ann.label)?.color
                      } text-white`}
                    >
                      {ann.label}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Image Source</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={inputType} onValueChange={(v) => setInputType(v as typeof inputType)}>
                <TabsList className="mb-4">
                  <TabsTrigger value="url">
                    <LinkIcon className="h-4 w-4 mr-2" />
                    URL
                  </TabsTrigger>
                  <TabsTrigger value="upload">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="url">
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://example.com/image.jpg"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      data-testid="input-image-url"
                    />
                    <Button variant="outline">Load</Button>
                  </div>
                </TabsContent>
                <TabsContent value="upload">
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Drag & drop or click to upload
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tools</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={selectedTool === "select" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedTool("select")}
                  data-testid="tool-select"
                >
                  <MousePointer className="h-4 w-4" />
                </Button>
                <Button
                  variant={selectedTool === "rectangle" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedTool("rectangle")}
                  data-testid="tool-rectangle"
                >
                  <Square className="h-4 w-4" />
                </Button>
                <Button
                  variant={selectedTool === "polygon" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedTool("polygon")}
                  data-testid="tool-polygon"
                >
                  <Circle className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Label Categories</Label>
                <div className="space-y-1">
                  {labelCategories.map((cat) => (
                    <Button
                      key={cat.id}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      data-testid={`category-${cat.id}`}
                    >
                      <div className={`h-3 w-3 rounded-full ${cat.color} mr-2`} />
                      {cat.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Annotations ({annotations.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {annotations.map((ann) => {
                  const category = labelCategories.find((c) => c.id === ann.label);
                  return (
                    <div
                      key={ann.id}
                      className="flex items-center justify-between p-2 rounded-lg border border-border"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`h-3 w-3 rounded ${category?.color}`} />
                        <span className="text-sm capitalize">{ann.label}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
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
            <Button className="w-full" variant="outline" data-testid="button-save-draft">
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
            <Button className="w-full" data-testid="button-submit">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Submit for Review
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
