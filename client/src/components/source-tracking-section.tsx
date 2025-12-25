import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, ExternalLink, X, Clock, User, FileText, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { sourceTypes, type SourceType } from "@shared/schema";
import { format } from "date-fns";

const SOURCE_TYPE_OPTIONS = sourceTypes.map(type => ({
  value: type,
  label: type,
}));

interface SourceTrackingData {
  sourcesUsed?: string[];
  sourceUrls?: string[];
  lastUpdatedBy?: string | null;
  lastUpdatedOn?: string | Date | null;
}

interface SourceTrackingSectionProps {
  data: SourceTrackingData;
  onChange: (field: string, value: any) => void;
  isEditing: boolean;
  lastUpdatedByName?: string;
}

export function SourceTrackingSection({ 
  data, 
  onChange, 
  isEditing,
  lastUpdatedByName 
}: SourceTrackingSectionProps) {
  const { toast } = useToast();
  const [newSource, setNewSource] = useState<string>("");
  const [newUrl, setNewUrl] = useState<string>("");

  const sourcesUsed = data.sourcesUsed || [];
  const sourceUrls = data.sourceUrls || [];

  const handleAddSource = () => {
    if (!newSource) return;
    if (sourcesUsed.length >= 5) {
      toast({ title: "Maximum 5 sources allowed", variant: "destructive" });
      return;
    }
    if (sourcesUsed.includes(newSource)) {
      toast({ title: "Source already added", variant: "destructive" });
      return;
    }
    onChange("sourcesUsed", [...sourcesUsed, newSource]);
    setNewSource("");
  };

  const handleRemoveSource = (index: number) => {
    const updated = sourcesUsed.filter((_, i) => i !== index);
    onChange("sourcesUsed", updated);
  };

  const handleAddUrl = () => {
    if (!newUrl) return;
    
    try {
      new URL(newUrl);
    } catch {
      toast({ title: "Please enter a valid URL", variant: "destructive" });
      return;
    }
    
    if (sourceUrls.length >= 5) {
      toast({ title: "Maximum 5 URLs allowed", variant: "destructive" });
      return;
    }
    if (sourceUrls.includes(newUrl)) {
      toast({ title: "URL already added", variant: "destructive" });
      return;
    }
    onChange("sourceUrls", [...sourceUrls, newUrl]);
    setNewUrl("");
  };

  const handleRemoveUrl = (index: number) => {
    const updated = sourceUrls.filter((_, i) => i !== index);
    onChange("sourceUrls", updated);
  };

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return "Never";
    try {
      return format(new Date(date), "MMM d, yyyy 'at' h:mm a");
    } catch {
      return "Unknown";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Source Tracking
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground pb-3 border-b">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>Last updated by: {lastUpdatedByName || data.lastUpdatedBy || "Unknown"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>Last updated: {formatDate(data.lastUpdatedOn)}</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Sources Used ({sourcesUsed.length}/5)</Label>
          <div className="flex flex-wrap gap-2">
            {sourcesUsed.map((source, index) => (
              <Badge 
                key={index} 
                variant="secondary" 
                className="flex items-center gap-1"
                data-testid={`badge-source-${index}`}
              >
                {source}
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => handleRemoveSource(index)}
                    className="ml-1 hover:text-destructive"
                    data-testid={`button-remove-source-${index}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
            {sourcesUsed.length === 0 && !isEditing && (
              <span className="text-sm text-muted-foreground">No sources recorded</span>
            )}
          </div>
          {isEditing && sourcesUsed.length < 5 && (
            <div className="flex gap-2 items-center">
              <Select value={newSource} onValueChange={setNewSource}>
                <SelectTrigger className="flex-1" data-testid="select-source-type">
                  <SelectValue placeholder="Select source type" />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPE_OPTIONS.filter(opt => !sourcesUsed.includes(opt.value)).map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                type="button" 
                size="sm" 
                onClick={handleAddSource}
                disabled={!newSource}
                data-testid="button-add-source"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-1">
            <LinkIcon className="h-3 w-3" />
            Source URLs ({sourceUrls.length}/5)
          </Label>
          <div className="space-y-2">
            {sourceUrls.map((url, index) => (
              <div 
                key={index} 
                className="flex items-center gap-2 text-sm bg-muted/50 rounded-md px-3 py-2"
                data-testid={`source-url-${index}`}
              >
                <a 
                  href={url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex-1 truncate flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{url}</span>
                </a>
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => handleRemoveUrl(index)}
                    className="text-muted-foreground hover:text-destructive flex-shrink-0"
                    data-testid={`button-remove-url-${index}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            {sourceUrls.length === 0 && !isEditing && (
              <span className="text-sm text-muted-foreground">No source URLs recorded</span>
            )}
          </div>
          {isEditing && sourceUrls.length < 5 && (
            <div className="flex gap-2 items-center">
              <Input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://example.com/source"
                className="flex-1"
                data-testid="input-source-url"
              />
              <Button 
                type="button" 
                size="sm" 
                onClick={handleAddUrl}
                disabled={!newUrl}
                data-testid="button-add-url"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
