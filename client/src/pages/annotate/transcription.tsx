import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WorkflowProgress } from "@/components/workflow-progress";
import {
  Play,
  Pause,
  Upload,
  Link as LinkIcon,
  User,
  Clock,
  Edit,
  Save,
  CheckCircle2,
  Mic,
  Volume2,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const mockTranscript = [
  { id: 1, speaker: "Speaker 1", start: 0, end: 8, text: "Good morning everyone. Welcome to our Q3 earnings call. I'm John Smith, CEO of Acme Corporation." },
  { id: 2, speaker: "Speaker 1", start: 8, end: 18, text: "Today we'll be discussing our financial results and strategic initiatives for the upcoming quarter." },
  { id: 3, speaker: "Speaker 2", start: 18, end: 30, text: "Thank you John. I'm Jane Doe, CFO. Let me start by highlighting our key financial metrics." },
  { id: 4, speaker: "Speaker 2", start: 30, end: 42, text: "Revenue for Q3 came in at $2.3 billion, representing a 15% year-over-year increase." },
  { id: 5, speaker: "Speaker 1", start: 42, end: 55, text: "These results demonstrate the strength of our core business and the success of our expansion strategy." },
];

export default function TranscriptionPage() {
  const [inputType, setInputType] = useState<"url" | "upload">("url");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState([0]);
  const [confidence, setConfidence] = useState([90]);
  const [currentStep, setCurrentStep] = useState("action");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [transcript, setTranscript] = useState(mockTranscript);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getCurrentSegment = () => {
    return transcript.find(
      (seg) => currentTime[0] >= seg.start && currentTime[0] < seg.end
    );
  };

  const currentSegment = getCurrentSegment();

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transcription</h1>
          <p className="text-muted-foreground">
            Audio transcription with speaker identification
          </p>
        </div>
        <WorkflowProgress currentStep={currentStep} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Audio Source</CardTitle>
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
                      placeholder="https://example.com/audio.mp3"
                      data-testid="input-audio-url"
                    />
                    <Button variant="outline">Load</Button>
                  </div>
                </TabsContent>
                <TabsContent value="upload">
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                    <Mic className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Drag & drop audio file or click to upload
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Supports MP3, WAV, M4A
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle>Audio Player</CardTitle>
              <Badge variant="secondary">
                <Volume2 className="h-3 w-3 mr-1" />
                Audio Ready
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Button
                    size="icon"
                    onClick={() => setIsPlaying(!isPlaying)}
                    data-testid="button-play-pause"
                  >
                    {isPlaying ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <div className="flex-1">
                    <Slider
                      value={currentTime}
                      onValueChange={setCurrentTime}
                      max={60}
                      step={1}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground min-w-[60px]">
                    {formatTime(currentTime[0])} / 1:00
                  </span>
                </div>
                {currentSegment && (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">{currentSegment.speaker}</span>
                    </div>
                    <p className="text-sm">{currentSegment.text}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle>Transcript</CardTitle>
              <Badge>{transcript.length} segments</Badge>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {transcript.map((seg) => (
                    <div
                      key={seg.id}
                      className={`p-3 rounded-lg border transition-colors ${
                        currentSegment?.id === seg.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                      data-testid={`transcript-segment-${seg.id}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            <User className="h-3 w-3 mr-1" />
                            {seg.speaker}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            <Clock className="h-3 w-3 inline mr-1" />
                            {formatTime(seg.start)} - {formatTime(seg.end)}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setEditingId(editingId === seg.id ? null : seg.id)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                      {editingId === seg.id ? (
                        <Textarea
                          defaultValue={seg.text}
                          className="min-h-[60px]"
                          data-testid={`textarea-edit-${seg.id}`}
                        />
                      ) : (
                        <p className="text-sm">{seg.text}</p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Speakers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {["Speaker 1", "Speaker 2"].map((speaker, i) => (
                  <div
                    key={speaker}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border"
                  >
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                      i === 0 ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"
                    }`}>
                      <User className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <Input
                        defaultValue={speaker}
                        className="h-8 text-sm"
                        data-testid={`input-speaker-${i + 1}`}
                      />
                    </div>
                  </div>
                ))}
                <Button variant="outline" className="w-full" size="sm">
                  Add Speaker
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
