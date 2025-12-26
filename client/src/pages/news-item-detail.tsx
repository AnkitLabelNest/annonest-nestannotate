import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  AlertCircle,
  Newspaper,
  ExternalLink,
  Calendar,
  User,
  CheckCircle,
  XCircle,
  Save,
} from "lucide-react";
import {
  fetchNewsItemById,
  updateNewsItemTags,
  updateNewsItemStatus,
  type NewsItemDetail,
} from "@/lib/nest-annotate-service";
import type {
  UserRole,
  AnnotationTaskStatus,
  RelevanceStatus,
  NewsFirmType,
  NewsEventType,
  NewsAssetClass,
  NewsActionType,
  NewsItemMetadata,
} from "@shared/schema";
import {
  newsFirmTypes,
  newsEventTypes,
  newsAssetClasses,
  newsActionTypes,
} from "@shared/schema";

const firmTypeLabels: Record<NewsFirmType, string> = {
  gp_pe: "GP (PE)",
  gp_vc: "GP (VC)",
  lp: "LP",
  fund: "Fund",
  portfolio_company: "Portfolio Company",
  service_provider: "Service Provider",
  bank_trustee: "Bank/Trustee",
  regulator: "Regulator",
  startup: "Startup",
  corporate: "Corporate",
};

const eventTypeLabels: Record<NewsEventType, string> = {
  fundraise: "Fundraise",
  investment: "Investment",
  exit: "Exit",
  mna: "M&A",
  leadership_change: "Leadership Change",
  regulatory_update: "Regulatory Update",
  product_launch: "Product Launch",
  partnership: "Partnership",
  financial_results: "Financial Results",
  litigation: "Litigation",
};

const assetClassLabels: Record<NewsAssetClass, string> = {
  private_equity: "Private Equity",
  venture_capital: "Venture Capital",
  private_debt: "Private Debt",
  infrastructure: "Infrastructure",
  real_assets: "Real Assets",
  hedge_funds: "Hedge Funds",
  public_markets: "Public Markets",
  esg: "ESG",
};

const actionTypeLabels: Record<NewsActionType, string> = {
  add_new_profile: "Add New Profile",
  update_existing_profile: "Update Existing Profile",
  no_new_information: "No New Information",
};

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
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

interface MultiSelectProps {
  options: readonly string[];
  labels: Record<string, string>;
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
}

function MultiSelectTags({ options, labels, selected, onChange, disabled }: MultiSelectProps) {
  const toggleOption = (option: string) => {
    if (disabled) return;
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = selected.includes(option);
        return (
          <Badge
            key={option}
            data-testid={`tag-option-${option}`}
            className={`cursor-pointer transition-colors ${
              isSelected
                ? "bg-primary text-primary-foreground"
                : disabled
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-secondary text-secondary-foreground"
            }`}
            onClick={() => toggleOption(option)}
          >
            {labels[option] || option}
          </Badge>
        );
      })}
    </div>
  );
}

export default function NewsItemDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const orgId = user?.orgId || "";
  const userRole = (user?.role || "annotator") as UserRole;
  const canManage = userRole === "admin" || userRole === "manager";

  const [relevanceStatus, setRelevanceStatus] = useState<RelevanceStatus | undefined>();
  const [relevanceNotes, setRelevanceNotes] = useState<string>("");
  const [firmTypes, setFirmTypes] = useState<NewsFirmType[]>([]);
  const [eventTypes, setEventTypes] = useState<NewsEventType[]>([]);
  const [assetClasses, setAssetClasses] = useState<NewsAssetClass[]>([]);
  const [actionTypes, setActionTypes] = useState<NewsActionType[]>([]);

  const isAuthReady = !!user && !!orgId;

  const {
    data: newsItem,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["news-item", taskId, orgId],
    queryFn: () => fetchNewsItemById(taskId!, orgId),
    enabled: !!taskId && isAuthReady,
  });

  useEffect(() => {
    if (newsItem?.metadata) {
      const meta = newsItem.metadata;
      setRelevanceStatus(meta.relevance_status);
      setRelevanceNotes(meta.relevance_notes || "");
      setFirmTypes(meta.firm_type || []);
      setEventTypes(meta.event_type || []);
      setAssetClasses(meta.asset_class || []);
      setActionTypes(meta.action_type || []);
    }
  }, [newsItem]);

  const saveTagsMutation = useMutation({
    mutationFn: (tags: Partial<NewsItemMetadata>) => updateNewsItemTags(taskId!, tags),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news-item", taskId] });
      queryClient.invalidateQueries({ queryKey: ["news-intelligence"] });
      toast({
        title: "Tags saved",
        description: "Your tagging changes have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save tags. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: AnnotationTaskStatus) => updateNewsItemStatus(taskId!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news-item", taskId] });
      queryClient.invalidateQueries({ queryKey: ["news-intelligence"] });
      toast({
        title: "Status updated",
        description: "The item status has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update status. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSaveTags = () => {
    const tags: Partial<NewsItemMetadata> = {
      relevance_status: relevanceStatus,
      relevance_notes: relevanceNotes || undefined,
      firm_type: isRelevant ? firmTypes : undefined,
      event_type: isRelevant ? eventTypes : undefined,
      asset_class: isRelevant ? assetClasses : undefined,
      action_type: isRelevant ? actionTypes : undefined,
    };
    saveTagsMutation.mutate(tags);
  };

  const handleMarkCompleted = () => {
    handleSaveTags();
    updateStatusMutation.mutate("completed");
  };

  const isRelevant = relevanceStatus === "relevant";
  const isNotRelevant = relevanceStatus === "not_relevant";
  const canComplete = 
    (isNotRelevant) || 
    (isRelevant && actionTypes.length > 0);

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

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !newsItem) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">News Item Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The news item you're looking for doesn't exist or you don't have access.
            </p>
            <Button onClick={() => setLocation("/news-intelligence")} data-testid="button-back-to-list">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to News Intelligence
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
          onClick={() => setLocation("/news-intelligence")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold" data-testid="text-headline">
            {newsItem.headline}
          </h1>
          <p className="text-sm text-muted-foreground">{newsItem.projectName}</p>
        </div>
        <StatusBadge status={newsItem.status} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Newspaper className="h-4 w-4" />
            Article Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Source</span>
              <p className="font-medium" data-testid="text-source">
                {newsItem.sourceName || "-"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Publish Date</span>
              <p className="font-medium flex items-center gap-1" data-testid="text-publish-date">
                <Calendar className="h-3 w-3" />
                {formatDate(newsItem.publishDate)}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Assigned To</span>
              <p className="font-medium flex items-center gap-1" data-testid="text-assigned">
                <User className="h-3 w-3" />
                {newsItem.assignedToName || "Unassigned"}
              </p>
            </div>
            {newsItem.url && (
              <div>
                <span className="text-muted-foreground">URL</span>
                <a
                  href={newsItem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary flex items-center gap-1 hover:underline"
                  data-testid="link-article"
                >
                  <ExternalLink className="h-3 w-3" />
                  View Article
                </a>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">1. Relevance Status</CardTitle>
          <p className="text-sm text-muted-foreground">
            Is this article relevant to your organization's intelligence needs?
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button
              variant={isRelevant ? "default" : "outline"}
              onClick={() => setRelevanceStatus("relevant")}
              data-testid="button-relevant"
              className="flex-1"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Relevant
            </Button>
            <Button
              variant={isNotRelevant ? "default" : "outline"}
              onClick={() => setRelevanceStatus("not_relevant")}
              data-testid="button-not-relevant"
              className="flex-1"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Not Relevant
            </Button>
          </div>
          
          {isNotRelevant && (
            <div className="space-y-2">
              <Label htmlFor="relevance-notes">Notes (optional)</Label>
              <Textarea
                id="relevance-notes"
                placeholder="Why is this article not relevant?"
                value={relevanceNotes}
                onChange={(e) => setRelevanceNotes(e.target.value)}
                data-testid="input-relevance-notes"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={!isRelevant ? "opacity-50 pointer-events-none" : ""}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">2. Core Classification</CardTitle>
          <p className="text-sm text-muted-foreground">
            Classify the article by firm type, event type, and asset class.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Firm Type</Label>
            <MultiSelectTags
              options={newsFirmTypes}
              labels={firmTypeLabels}
              selected={firmTypes}
              onChange={(selected) => setFirmTypes(selected as NewsFirmType[])}
              disabled={!isRelevant}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Event Type</Label>
            <MultiSelectTags
              options={newsEventTypes}
              labels={eventTypeLabels}
              selected={eventTypes}
              onChange={(selected) => setEventTypes(selected as NewsEventType[])}
              disabled={!isRelevant}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Asset Class</Label>
            <MultiSelectTags
              options={newsAssetClasses}
              labels={assetClassLabels}
              selected={assetClasses}
              onChange={(selected) => setAssetClasses(selected as NewsAssetClass[])}
              disabled={!isRelevant}
            />
          </div>
        </CardContent>
      </Card>

      <Card className={!isRelevant ? "opacity-50 pointer-events-none" : ""}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">3. Action Intelligence</CardTitle>
          <p className="text-sm text-muted-foreground">
            What action should be taken based on this article? (Required)
          </p>
        </CardHeader>
        <CardContent>
          <MultiSelectTags
            options={newsActionTypes}
            labels={actionTypeLabels}
            selected={actionTypes}
            onChange={(selected) => setActionTypes(selected as NewsActionType[])}
            disabled={!isRelevant}
          />
          {isRelevant && actionTypes.length === 0 && (
            <p className="text-sm text-destructive mt-2">
              Please select at least one action type.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4 pt-4">
        <Button
          variant="outline"
          onClick={() => setLocation("/news-intelligence")}
          data-testid="button-cancel"
        >
          Cancel
        </Button>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={handleSaveTags}
            disabled={saveTagsMutation.isPending || !relevanceStatus}
            data-testid="button-save"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Progress
          </Button>
          <Button
            onClick={handleMarkCompleted}
            disabled={!canComplete || updateStatusMutation.isPending}
            data-testid="button-complete"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Mark Completed
          </Button>
        </div>
      </div>
    </div>
  );
}
