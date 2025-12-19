import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { WorkflowProgress } from "@/components/workflow-progress";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Square,
  Tag,
  Trash2,
  Save,
  CheckCircle2,
  Video,
  Clock,
} from "lucide-react";

export default function VideoLabelPage() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState([0]);
  const [confidence, setConfidence] = useState([82]);
  const [currentStep, setCurrentStep] = useState("relevancy");
  const [segments, setSegments] = useState([
    { id: 1, start: 0, end: 15, label: "Introduction", color: "bg-blue-500" },
    { id: 2, start: 15, end: 45, label: "Product Demo", color: "bg-purple-500" },
    { id: 3, start: 45, end: 60, label: "Q&A", color: "bg-emerald-500" },
  ]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Video Labeling</h1>
          <p className="text-muted-foreground">
            Temporal segmentation and video annotation
          </p>
        </div>
        <WorkflowProgress currentStep={currentStep} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Video Player</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative rounded-lg bg-black aspect-video flex items-center justify-center">
                <Video className="h-16 w-16 text-white/30" />
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                  <div className="space-y-3">
                    <div className="relative h-2 rounded-full bg-white/20 overflow-hidden">
                      <div className="absolute inset-0">
                        {segments.map((seg) => (
                          <div
                            key={seg.id}
                            className={`absolute h-full ${seg.color} opacity-70`}
                            style={{
                              left: `${(seg.start / 120) * 100}%`,
                              width: `${((seg.end - seg.start) / 120) * 100}%`,
                            }}
                          />
                        ))}
                      </div>
                      <div
                        className="absolute h-full bg-white"
                        style={{ width: `${(currentTime[0] / 120) * 100}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-white">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-white hover:text-white hover:bg-white/20"
                        >
                          <SkipBack className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-white hover:text-white hover:bg-white/20"
                          onClick={() => setIsPlaying(!isPlaying)}
                          data-testid="button-play-pause"
                        >
                          {isPlaying ? (
                            <Pause className="h-5 w-5" />
                          ) : (
                            <Play className="h-5 w-5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-white hover:text-white hover:bg-white/20"
                        >
                          <SkipForward className="h-4 w-4" />
                        </Button>
                        <span className="text-sm ml-2">
                          {formatTime(currentTime[0])} / 2:00
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-white border-white/50 hover:bg-white/20"
                      >
                        <Tag className="h-3 w-3 mr-1" />
                        Mark Segment
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <Slider
                  value={currentTime}
                  onValueChange={setCurrentTime}
                  max={120}
                  step={1}
                  data-testid="slider-timeline"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline Segments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative h-16 rounded-lg border border-border bg-muted/30 overflow-hidden">
                {segments.map((seg) => (
                  <div
                    key={seg.id}
                    className={`absolute top-2 bottom-2 ${seg.color} rounded cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center`}
                    style={{
                      left: `${(seg.start / 120) * 100}%`,
                      width: `${((seg.end - seg.start) / 120) * 100}%`,
                    }}
                    data-testid={`segment-${seg.id}`}
                  >
                    <span className="text-xs text-white font-medium truncate px-2">
                      {seg.label}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0:00</span>
                <span>0:30</span>
                <span>1:00</span>
                <span>1:30</span>
                <span>2:00</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Segments ({segments.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {segments.map((seg) => (
                  <div
                    key={seg.id}
                    className="p-3 rounded-lg border border-border hover-elevate cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`h-3 w-3 rounded ${seg.color}`} />
                        <span className="font-medium text-sm">{seg.label}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>
                        {formatTime(seg.start)} - {formatTime(seg.end)}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {seg.end - seg.start}s
                      </Badge>
                    </div>
                  </div>
                ))}
                <Button variant="outline" className="w-full mt-4" data-testid="button-add-segment">
                  <Tag className="h-4 w-4 mr-2" />
                  Add Segment
                </Button>
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
                />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Score</span>
                  <span className="text-lg font-semibold">{confidence}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            <Button className="w-full" variant="outline">
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
            <Button className="w-full">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Submit for Review
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
