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
  Search,
  Plus,
  X,
  Building2,
  Tag,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchNewsItemById,
  updateNewsItemTags,
  updateNewsItemStatus,
  searchEntities,
  fetchNewsEntityLinks,
  addNewsEntityLink,
  removeNewsEntityLink,
  fetchEntityDetails,
  type NewsItemDetail,
  type EntitySearchResult,
  type NewsEntityLinkRecord,
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
  TaggedEntity,
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
  const [taggedEntities, setTaggedEntities] = useState<TaggedEntity[]>([]);
  const [entityLinks, setEntityLinks] = useState<NewsEntityLinkRecord[]>([]);
  const [createdEntities, setCreatedEntities] = useState<TaggedEntity[]>([]);
  const [entitySearchTerm, setEntitySearchTerm] = useState("");
  const [entitySearchResults, setEntitySearchResults] = useState<EntitySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [newEntityName, setNewEntityName] = useState("");
  const [newEntityType, setNewEntityType] = useState<string>("");
  const userId = user?.id || "";

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
      setCreatedEntities(meta.created_entities || []);
    }
  }, [newsItem]);

  // Load entity links from news_entity_links table
  useEffect(() => {
    async function loadEntityLinks() {
      if (!taskId || !orgId) return;
      
      try {
        const links = await fetchNewsEntityLinks(taskId);
        setEntityLinks(links);
        
        // Resolve entity details in parallel using Promise.all
        const entityPromises = links.map((link) => 
          fetchEntityDetails(orgId, link.entityType, link.entityId)
        );
        const entityResults = await Promise.all(entityPromises);
        
        const entities: TaggedEntity[] = entityResults
          .filter((details): details is NonNullable<typeof details> => details !== null)
          .map((details) => ({
            entity_id: details.id,
            entity_name: details.name,
            entity_type: details.type,
          }));
        
        setTaggedEntities(entities);
      } catch (error) {
        console.error("Error loading entity links:", error);
      }
    }
    
    loadEntityLinks();
  }, [taskId, orgId]);

  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (entitySearchTerm.length >= 2 && orgId) {
        setIsSearching(true);
        try {
          const results = await searchEntities(orgId, entitySearchTerm);
          const filteredResults = results.filter(
            (r) => !taggedEntities.some((t) => t.entity_id === r.id)
          );
          setEntitySearchResults(filteredResults);
        } catch (error) {
          console.error("Entity search error:", error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setEntitySearchResults([]);
      }
    }, 300);
    return () => clearTimeout(searchTimeout);
  }, [entitySearchTerm, orgId, taggedEntities]);

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
    // Note: tagged_entities are now persisted to news_entity_links table separately
    const tags: Partial<NewsItemMetadata> = {
      relevance_status: relevanceStatus,
      relevance_notes: relevanceNotes || undefined,
      firm_type: isRelevant ? firmTypes : undefined,
      event_type: isRelevant ? eventTypes : undefined,
      asset_class: isRelevant ? assetClasses : undefined,
      action_type: isRelevant ? actionTypes : undefined,
      created_entities: isRelevant ? createdEntities : undefined,
    };
    saveTagsMutation.mutate(tags);
  };

  const handleMarkCompleted = () => {
    handleSaveTags();
    updateStatusMutation.mutate("completed");
  };

  const handleAddTaggedEntity = async (entity: EntitySearchResult) => {
    if (!taskId || !userId || !orgId) return;
    
    setIsAddingLink(true);
    try {
      // Persist to news_entity_links table with org_id verification
      const newLink = await addNewsEntityLink(taskId, entity.type, entity.id, userId, orgId);
      setEntityLinks([...entityLinks, newLink]);
      
      const newEntity: TaggedEntity = {
        entity_id: entity.id,
        entity_name: entity.name,
        entity_type: entity.type,
      };
      setTaggedEntities([...taggedEntities, newEntity]);
      setEntitySearchTerm("");
      setEntitySearchResults([]);
      
      toast({
        title: "Entity linked",
        description: `${entity.name} has been linked to this news item.`,
      });
    } catch (error) {
      console.error("Error adding entity link:", error);
      toast({
        title: "Error",
        description: "Failed to link entity. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAddingLink(false);
    }
  };

  const handleRemoveTaggedEntity = async (entityId: string) => {
    // Find the link record for this entity
    const linkToRemove = entityLinks.find((link) => link.entityId === entityId);
    
    if (linkToRemove) {
      try {
        await removeNewsEntityLink(linkToRemove.id);
        setEntityLinks(entityLinks.filter((link) => link.id !== linkToRemove.id));
        
        toast({
          title: "Entity unlinked",
          description: "Entity has been removed from this news item.",
        });
      } catch (error) {
        console.error("Error removing entity link:", error);
        toast({
          title: "Error",
          description: "Failed to remove entity link. Please try again.",
          variant: "destructive",
        });
        return;
      }
    }
    
    setTaggedEntities(taggedEntities.filter((e) => e.entity_id !== entityId));
  };

  const handleCreateEntity = () => {
    if (!newEntityName.trim() || !newEntityType) return;
    const newEntity: TaggedEntity = {
      entity_id: `new_${Date.now()}`,
      entity_name: newEntityName.trim(),
      entity_type: newEntityType,
    };
    setCreatedEntities([...createdEntities, newEntity]);
    setNewEntityName("");
    setNewEntityType("");
  };

  const handleRemoveCreatedEntity = (entityId: string) => {
    setCreatedEntities(createdEntities.filter((e) => e.entity_id !== entityId));
  };

  const isRelevant = relevanceStatus === "relevant";
  const isNotRelevant = relevanceStatus === "not_relevant";
  const canAddNewProfile = actionTypes.includes("add_new_profile");
  const hasNoNewInfo = actionTypes.includes("no_new_information") && actionTypes.length === 1;
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

      <Card className={!isRelevant || hasNoNewInfo ? "opacity-50 pointer-events-none" : ""}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Tag className="h-4 w-4" />
            4. Entity Tagging
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Tag existing entities mentioned in the article.
            {hasNoNewInfo && " (Disabled when 'No New Information' is selected)"}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Search Entities</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search firms, funds..."
                value={entitySearchTerm}
                onChange={(e) => setEntitySearchTerm(e.target.value)}
                className="pl-9"
                disabled={!isRelevant || hasNoNewInfo}
                data-testid="input-entity-search"
              />
            </div>
            {isSearching && (
              <p className="text-sm text-muted-foreground">Searching...</p>
            )}
            {entitySearchResults.length > 0 && (
              <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                {entitySearchResults.map((result) => (
                  <button
                    key={result.id}
                    className="w-full px-3 py-2 text-left hover:bg-muted flex items-center justify-between"
                    onClick={() => handleAddTaggedEntity(result)}
                    data-testid={`entity-result-${result.id}`}
                  >
                    <div>
                      <span className="font-medium">{result.name}</span>
                      <Badge className="ml-2" variant="secondary">
                        {result.type}
                      </Badge>
                    </div>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {taggedEntities.length > 0 && (
            <div className="space-y-2">
              <Label>Tagged Entities</Label>
              <div className="flex flex-wrap gap-2">
                {taggedEntities.map((entity) => (
                  <Badge
                    key={entity.entity_id}
                    className="flex items-center gap-1 pr-1"
                    data-testid={`tagged-entity-${entity.entity_id}`}
                  >
                    <Building2 className="h-3 w-3" />
                    {entity.entity_name}
                    <span className="text-xs opacity-70">({entity.entity_type})</span>
                    <button
                      onClick={() => handleRemoveTaggedEntity(entity.entity_id)}
                      className="ml-1 p-0.5 rounded hover:bg-primary-foreground/20"
                      data-testid={`remove-tagged-${entity.entity_id}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {canAddNewProfile && canManage && (
        <Card className={!isRelevant ? "opacity-50 pointer-events-none" : ""}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4" />
              5. Create New Entity
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Create a new entity if not found in existing records.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-entity-name">Entity Name</Label>
                <Input
                  id="new-entity-name"
                  placeholder="Enter entity name"
                  value={newEntityName}
                  onChange={(e) => setNewEntityName(e.target.value)}
                  disabled={!isRelevant}
                  data-testid="input-new-entity-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Entity Type</Label>
                <Select
                  value={newEntityType}
                  onValueChange={setNewEntityType}
                  disabled={!isRelevant}
                >
                  <SelectTrigger data-testid="select-new-entity-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {newsFirmTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {firmTypeLabels[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              variant="secondary"
              onClick={handleCreateEntity}
              disabled={!newEntityName.trim() || !newEntityType || !isRelevant}
              data-testid="button-create-entity"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Entity
            </Button>

            {createdEntities.length > 0 && (
              <div className="space-y-2">
                <Label>Created Entities</Label>
                <div className="flex flex-wrap gap-2">
                  {createdEntities.map((entity) => (
                    <Badge
                      key={entity.entity_id}
                      className="flex items-center gap-1 pr-1 bg-green-500/10 text-green-700 dark:text-green-400"
                      data-testid={`created-entity-${entity.entity_id}`}
                    >
                      <Plus className="h-3 w-3" />
                      {entity.entity_name}
                      <span className="text-xs opacity-70">({entity.entity_type})</span>
                      <button
                        onClick={() => handleRemoveCreatedEntity(entity.entity_id)}
                        className="ml-1 p-0.5 rounded hover:bg-green-500/20"
                        data-testid={`remove-created-${entity.entity_id}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
