import { useState, useEffect, useCallback } from "react";
import { useParams, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useEntityLock } from "@/hooks/use-entity-lock";
import { 
  Eye, Pencil, Save, X, AlertTriangle, Lock, Loader2, ArrowLeft,
  Building2, User, Briefcase, Users, HandshakeIcon, Landmark
} from "lucide-react";
import { EntityUrlsSection } from "@/components/entity-urls-section";
import { SourceTrackingSection } from "@/components/source-tracking-section";
import type { EntityType } from "@shared/schema";

const entityTypeLabels: Record<EntityType, string> = {
  gp: "GP Firm",
  lp: "LP Firm",
  fund: "Fund",
  service_provider: "Service Provider",
  portfolio_company: "Portfolio Company",
  deal: "Deal",
  contact: "Contact",
};

const entityTypeIcons: Record<EntityType, typeof Building2> = {
  gp: Building2,
  lp: Landmark,
  fund: Briefcase,
  service_provider: HandshakeIcon,
  portfolio_company: Building2,
  deal: Briefcase,
  contact: User,
};

function FieldDisplay({ label, value, isLink = false }: { label: string; value?: string | number | null; isLink?: boolean }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      {isLink && value ? (
        <a 
          href={String(value).startsWith("http") ? String(value) : `https://${value}`} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="font-medium text-primary hover:underline"
        >
          {value}
        </a>
      ) : (
        <p className="font-medium">{value || "-"}</p>
      )}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 pt-4 pb-2">
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</h4>
      <Separator className="flex-1" />
    </div>
  );
}

function GpView({ entity, isEditing, onFieldChange }: { entity: any; isEditing: boolean; onFieldChange?: (field: string, value: any) => void }) {
  return (
    <div className="space-y-2">
      <SectionHeader title="Basic Information" />
      <div className="grid grid-cols-3 gap-4">
        <FieldDisplay label="GP Name" value={entity.gp_name} />
        <FieldDisplay label="Legal Name" value={entity.gp_legal_name} />
        <FieldDisplay label="Short Name" value={entity.gp_short_name} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <FieldDisplay label="Firm Type" value={entity.firm_type} />
        <FieldDisplay label="Year Founded" value={entity.year_founded} />
        <FieldDisplay label="Status" value={entity.status} />
      </div>

      <SectionHeader title="Location" />
      <div className="grid grid-cols-3 gap-4">
        <FieldDisplay label="HQ Country" value={entity.headquarters_country} />
        <FieldDisplay label="HQ City" value={entity.headquarters_city} />
        <FieldDisplay label="Website" value={entity.website} isLink />
      </div>

      <SectionHeader title="AUM & Strategy" />
      <div className="grid grid-cols-3 gap-4">
        <FieldDisplay label="Total AUM" value={entity.total_aum ? `${entity.total_aum} ${entity.aum_currency || "USD"}` : null} />
        <FieldDisplay label="Primary Asset Classes" value={entity.primary_asset_classes} />
        <FieldDisplay label="Industry Focus" value={entity.industry_focus} />
      </div>
    </div>
  );
}

function LpView({ entity, isEditing, onFieldChange }: { entity: any; isEditing: boolean; onFieldChange?: (field: string, value: any) => void }) {
  return (
    <div className="space-y-2">
      <SectionHeader title="Basic Information" />
      <div className="grid grid-cols-3 gap-4">
        <FieldDisplay label="LP Name" value={entity.lp_name} />
        <FieldDisplay label="Legal Name" value={entity.lp_legal_name} />
        <FieldDisplay label="Investor Type" value={entity.investor_type} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <FieldDisplay label="Firm Type" value={entity.firm_type} />
        <FieldDisplay label="Status" value={entity.status} />
        <FieldDisplay label="Year Founded" value={entity.year_founded} />
      </div>

      <SectionHeader title="Location" />
      <div className="grid grid-cols-3 gap-4">
        <FieldDisplay label="HQ Country" value={entity.headquarters_country} />
        <FieldDisplay label="HQ City" value={entity.headquarters_city} />
        <FieldDisplay label="Website" value={entity.website} isLink />
      </div>

      <SectionHeader title="Investment Profile" />
      <div className="grid grid-cols-3 gap-4">
        <FieldDisplay label="Total AUM" value={entity.total_aum ? `${entity.total_aum} ${entity.aum_currency || "USD"}` : null} />
        <FieldDisplay label="Target Allocation" value={entity.target_allocation_to_pe} />
        <FieldDisplay label="Current Allocation" value={entity.current_allocation_to_pe} />
      </div>
    </div>
  );
}

function FundView({ entity, isEditing, onFieldChange }: { entity: any; isEditing: boolean; onFieldChange?: (field: string, value: any) => void }) {
  return (
    <div className="space-y-2">
      <SectionHeader title="Basic Information" />
      <div className="grid grid-cols-3 gap-4">
        <FieldDisplay label="Fund Name" value={entity.fund_name} />
        <FieldDisplay label="Fund Type" value={entity.fund_type} />
        <FieldDisplay label="Vintage Year" value={entity.vintage_year} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <FieldDisplay label="Status" value={entity.fund_status} />
        <FieldDisplay label="Target Size" value={entity.target_size} />
        <FieldDisplay label="Final Close Size" value={entity.final_close_size} />
      </div>

      <SectionHeader title="Investment Strategy" />
      <div className="grid grid-cols-3 gap-4">
        <FieldDisplay label="Primary Strategy" value={entity.primary_strategy} />
        <FieldDisplay label="Geographic Focus" value={entity.geographic_focus} />
        <FieldDisplay label="Industry Focus" value={entity.industry_focus} />
      </div>
    </div>
  );
}

function ServiceProviderView({ entity, isEditing, onFieldChange }: { entity: any; isEditing: boolean; onFieldChange?: (field: string, value: any) => void }) {
  return (
    <div className="space-y-2">
      <SectionHeader title="Basic Information" />
      <div className="grid grid-cols-3 gap-4">
        <FieldDisplay label="Provider Name" value={entity.provider_name} />
        <FieldDisplay label="Provider Type" value={entity.provider_type} />
        <FieldDisplay label="Status" value={entity.status} />
      </div>

      <SectionHeader title="Location" />
      <div className="grid grid-cols-3 gap-4">
        <FieldDisplay label="HQ Country" value={entity.headquarters_country} />
        <FieldDisplay label="HQ City" value={entity.headquarters_city} />
        <FieldDisplay label="Website" value={entity.website} isLink />
      </div>

      <SectionHeader title="Services" />
      <div className="grid grid-cols-2 gap-4">
        <FieldDisplay label="Services Offered" value={entity.services_offered} />
        <FieldDisplay label="Sector Expertise" value={entity.sector_expertise} />
      </div>
    </div>
  );
}

function PortfolioCompanyView({ entity, isEditing, onFieldChange }: { entity: any; isEditing: boolean; onFieldChange?: (field: string, value: any) => void }) {
  return (
    <div className="space-y-2">
      <SectionHeader title="Basic Information" />
      <div className="grid grid-cols-3 gap-4">
        <FieldDisplay label="Company Name" value={entity.company_name} />
        <FieldDisplay label="Company Type" value={entity.company_type} />
        <FieldDisplay label="Status" value={entity.status} />
      </div>

      <SectionHeader title="Location" />
      <div className="grid grid-cols-3 gap-4">
        <FieldDisplay label="HQ Country" value={entity.headquarters_country} />
        <FieldDisplay label="HQ City" value={entity.headquarters_city} />
        <FieldDisplay label="Website" value={entity.website} isLink />
      </div>

      <SectionHeader title="Business" />
      <div className="grid grid-cols-2 gap-4">
        <FieldDisplay label="Primary Industry" value={entity.primary_industry} />
        <FieldDisplay label="Business Model" value={entity.business_model} />
      </div>
      <FieldDisplay label="Business Description" value={entity.business_description} />
    </div>
  );
}

function DealView({ entity, isEditing, onFieldChange }: { entity: any; isEditing: boolean; onFieldChange?: (field: string, value: any) => void }) {
  return (
    <div className="space-y-2">
      <SectionHeader title="Deal Information" />
      <div className="grid grid-cols-3 gap-4">
        <FieldDisplay label="Deal Name" value={entity.deal_name} />
        <FieldDisplay label="Deal Type" value={entity.deal_type} />
        <FieldDisplay label="Status" value={entity.deal_status} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <FieldDisplay label="Deal Value" value={entity.deal_value} />
        <FieldDisplay label="Currency" value={entity.currency} />
        <FieldDisplay label="Announcement Date" value={entity.announcement_date} />
      </div>
    </div>
  );
}

function ContactView({ entity, isEditing, onFieldChange }: { entity: any; isEditing: boolean; onFieldChange?: (field: string, value: any) => void }) {
  return (
    <div className="space-y-2">
      <SectionHeader title="Personal Information" />
      <div className="grid grid-cols-3 gap-4">
        <FieldDisplay label="First Name" value={entity.first_name} />
        <FieldDisplay label="Last Name" value={entity.last_name} />
        <FieldDisplay label="Title" value={entity.title} />
      </div>

      <SectionHeader title="Contact Details" />
      <div className="grid grid-cols-3 gap-4">
        <FieldDisplay label="Email" value={entity.email} />
        <FieldDisplay label="Phone" value={entity.phone} />
        <FieldDisplay label="LinkedIn" value={entity.linkedin_url} isLink />
      </div>

      <SectionHeader title="Organization" />
      <div className="grid grid-cols-3 gap-4">
        <FieldDisplay label="Department" value={entity.department} />
        <FieldDisplay label="Seniority Level" value={entity.seniority_level} />
        <FieldDisplay label="Relationship Type" value={entity.relationship_type} />
      </div>
    </div>
  );
}

const entityApiEndpoints: Record<EntityType, string> = {
  gp: "/api/entities/gp",
  lp: "/api/entities/lp",
  fund: "/api/entities/fund",
  service_provider: "/api/entities/service-provider",
  portfolio_company: "/api/entities/portfolio-company",
  deal: "/api/entities/deal",
  contact: "/api/entities/contact",
};

export default function EntityProfilePage() {
  const params = useParams();
  const searchParams = new URLSearchParams(window.location.search);
  const entityType = params.entityType as EntityType;
  const entityId = params.entityId as string;
  const initialMode = searchParams.get("mode") as "view" | "edit" || "view";
  
  const [mode, setMode] = useState<"view" | "edit">(initialMode);
  const [editData, setEditData] = useState<any>(null);
  const [sourceTracking, setSourceTracking] = useState({
    sourcesUsed: [] as string[],
    sourceUrls: [] as string[],
  });
  
  const { toast } = useToast();
  
  const {
    isLocked,
    lockOwner,
    isOwnLock,
    isLoading: lockLoading,
    acquireLock,
    releaseLock,
  } = useEntityLock({
    entityType,
    entityId,
    autoAcquire: initialMode === "edit",
  });

  const apiEndpoint = entityApiEndpoints[entityType];
  
  const { data: entity, isLoading, error, refetch } = useQuery({
    queryKey: [apiEndpoint, entityId],
    queryFn: async () => {
      const res = await apiRequest("GET", `${apiEndpoint}/${entityId}`);
      return res.json();
    },
    enabled: !!entityType && !!entityId && !!apiEndpoint,
  });

  useEffect(() => {
    if (entity) {
      setEditData(entity);
      setSourceTracking({
        sourcesUsed: entity.sources_used || [],
        sourceUrls: entity.source_urls || [],
      });
    }
  }, [entity]);

  useEffect(() => {
    if (initialMode === "edit" && !isOwnLock && isLocked && !lockLoading) {
      setMode("view");
      toast({
        title: "View-only mode",
        description: `This profile is currently being edited by ${lockOwner || "another user"}.`,
        variant: "destructive",
      });
    }
  }, [initialMode, isOwnLock, isLocked, lockLoading, lockOwner, toast]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `${apiEndpoint}/${entityId}`, data);
      return res.json();
    },
    onSuccess: async () => {
      await releaseLock();
      queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
      toast({ title: "Changes saved successfully" });
      setMode("view");
      refetch();
    },
    onError: (error: Error) => {
      toast({ title: "Error saving changes", description: error.message, variant: "destructive" });
    },
  });

  const handleEnterEdit = async () => {
    const acquired = await acquireLock();
    if (acquired) {
      setMode("edit");
    } else {
      toast({
        title: "Cannot edit",
        description: `This profile is currently being edited by ${lockOwner || "another user"}.`,
        variant: "destructive",
      });
    }
  };

  const handleCancel = async () => {
    await releaseLock();
    setMode("view");
    setEditData(entity);
    setSourceTracking({
      sourcesUsed: entity?.sources_used || [],
      sourceUrls: entity?.source_urls || [],
    });
  };

  const handleSave = () => {
    updateMutation.mutate({
      ...editData,
      sources_used: sourceTracking.sourcesUsed,
      source_urls: sourceTracking.sourceUrls,
    });
  };

  const handleClose = () => {
    if (isOwnLock) {
      releaseLock();
    }
    window.close();
  };

  const handleSourceTrackingChange = (field: string, value: string[]) => {
    setSourceTracking(prev => ({ ...prev, [field]: value }));
  };

  const handleFieldChange = (field: string, value: any) => {
    setEditData((prev: any) => ({ ...prev, [field]: value }));
  };

  if (!entityType || !entityApiEndpoints[entityType]) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Invalid Entity Type</AlertTitle>
          <AlertDescription>The requested entity type is not valid.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading || lockLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !entity) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading Profile</AlertTitle>
          <AlertDescription>Failed to load the entity profile. Please try again.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const Icon = entityTypeIcons[entityType];
  const entityName = entity.gp_name || entity.lp_name || entity.fund_name || 
                     entity.provider_name || entity.company_name || entity.deal_name ||
                     `${entity.first_name} ${entity.last_name}`;
  
  const isEditMode = mode === "edit" && isOwnLock;
  const isViewOnlyDueToLock = isLocked && !isOwnLock;

  const renderEntityView = () => {
    const props = { entity: editData || entity, isEditing: isEditMode, onFieldChange: handleFieldChange };
    switch (entityType) {
      case "gp": return <GpView {...props} />;
      case "lp": return <LpView {...props} />;
      case "fund": return <FundView {...props} />;
      case "service_provider": return <ServiceProviderView {...props} />;
      case "portfolio_company": return <PortfolioCompanyView {...props} />;
      case "deal": return <DealView {...props} />;
      case "contact": return <ContactView {...props} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-md">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold" data-testid="text-entity-name">{entityName}</h1>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{entityTypeLabels[entityType]}</Badge>
                  {isEditMode && <Badge className="bg-amber-500">Editing</Badge>}
                  {isViewOnlyDueToLock && (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Locked
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isEditMode && !isViewOnlyDueToLock && (
                <Button onClick={handleEnterEdit} data-testid="button-edit-entity">
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
              {isEditMode && (
                <>
                  <Button variant="outline" onClick={handleCancel} data-testid="button-cancel-edit">
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save-entity">
                    {updateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save
                  </Button>
                </>
              )}
              <Button variant="ghost" onClick={handleClose} data-testid="button-close-profile">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {isViewOnlyDueToLock && (
        <div className="max-w-6xl mx-auto px-6 pt-4">
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertTitle>View-only Mode</AlertTitle>
            <AlertDescription>
              This profile is currently being edited by {lockOwner || "another user"}. 
              You can view the content but cannot make changes.
            </AlertDescription>
          </Alert>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-6">
        <Card>
          <CardContent className="pt-6">
            <ScrollArea className="max-h-[70vh]">
              {renderEntityView()}

              <SectionHeader title="Source Tracking" />
              <SourceTrackingSection
                data={sourceTracking}
                onChange={handleSourceTrackingChange}
                isEditing={isEditMode}
              />

              {["gp", "lp", "fund", "service_provider", "portfolio_company", "deal", "contact"].includes(entityType) && (
                <>
                  <SectionHeader title="URL Monitoring" />
                  <EntityUrlsSection
                    entityType={entityType}
                    entityId={entityId}
                  />
                </>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
