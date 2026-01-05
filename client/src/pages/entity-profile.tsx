import { useState, useEffect, useCallback } from "react";
import { useParams } from "wouter";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useEntityLock } from "@/hooks/use-entity-lock";
import {
  Pencil,
  Save,
  X,
  AlertTriangle,
  Lock,
  Loader2,
  Building2,
  User,
  Briefcase,
  HandshakeIcon,
  Landmark,
} from "lucide-react";
import { EntityUrlsSection } from "@/components/entity-urls-section";
import { SourceTrackingSection } from "@/components/source-tracking-section";
import type { EntityType } from "@shared/schema";

/* -------------------------------------------------- */
/* ENTITY METADATA */
/* -------------------------------------------------- */

const entityTypeLabels: Record<EntityType, string> = {
  gp: "GP Firm",
  lp: "LP Firm",
  fund: "Fund",
  service_provider: "Service Provider",
  portfolio_company: "Portfolio Company",
  deal: "Deal",
  contact: "Contact",
};

const entityTypeIcons: Record<EntityType, any> = {
  gp: Building2,
  lp: Landmark,
  fund: Briefcase,
  service_provider: HandshakeIcon,
  portfolio_company: Building2,
  deal: Briefcase,
  contact: User,
};

/* -------------------------------------------------- */
/* API ENDPOINTS — FIXED */
/* -------------------------------------------------- */

const entityApiEndpoints: Record<EntityType, string> = {
  gp: "/api/entities/gps",
  lp: "/api/entities/lps",
  fund: "/api/entities/funds",
  service_provider: "/api/entities/service-providers",
  portfolio_company: "/api/entities/portfolio-companies",
  deal: "/api/entities/deals",
  contact: "/api/entities/contacts",
};

/* -------------------------------------------------- */
/* REQUIRED FIELDS */
/* -------------------------------------------------- */

const mandatoryFields: Record<EntityType, string[]> = {
  gp: ["gp_name", "headquarters_country", "headquarters_city"],
  lp: ["lp_name", "headquarters_country", "headquarters_city"],
  fund: ["fund_name"],
  service_provider: ["service_provider_name", "headquarters_country", "headquarters_city"],
  portfolio_company: ["company_name", "headquarters_country", "headquarters_city"],
  deal: ["deal_name", "deal_country"],
  contact: ["first_name", "last_name", "job_title"],
};

/* -------------------------------------------------- */
/* FIELD DISPLAY */
/* -------------------------------------------------- */

function FieldDisplay({
  label,
  value,
  isEditing,
  fieldName,
  onChange,
  type = "text",
  isBoolean = false,
  required = false,
  error,
}: any) {
  if (isEditing && fieldName && onChange) {
    if (isBoolean) {
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={value === true}
              onCheckedChange={(v) => onChange(fieldName, v)}
            />
            <Label>{label}</Label>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <Label>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Input
          type={type}
          value={value ?? ""}
          onChange={(e) =>
            onChange(
              fieldName,
              type === "number" ? Number(e.target.value) : e.target.value
            )
          }
          className={error ? "border-destructive" : ""}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">
        {value === null || value === undefined || value === "" ? "-" : String(value)}
      </p>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 pt-4 pb-2">
      <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      <Separator className="flex-1" />
    </div>
  );
}

/* -------------------------------------------------- */
/* FUND VIEW — FIXED FIELD NAMES */
/* -------------------------------------------------- */

function FundView({ entity, isEditing, onFieldChange, errors }: any) {
  const f = (k: string, l: string, o: any = {}) => (
    <FieldDisplay
      label={l}
      value={entity[k]}
      fieldName={k}
      isEditing={isEditing}
      onChange={onFieldChange}
      error={errors[k]}
      {...o}
    />
  );

  return (
    <div className="space-y-2">
      <SectionHeader title="Basic Information" />
      <div className="grid grid-cols-3 gap-4">
        {f("fund_name", "Fund Name", { required: true })}
        {f("fund_type", "Fund Type")}
        {f("vintage_year", "Vintage Year", { type: "number" })}
      </div>

      <SectionHeader title="Fund Size" />
      <div className="grid grid-cols-3 gap-4">
        {f("target_size", "Target Fund Size", { type: "number" })}
        {f("fund_currency", "Currency")}
        {f("fund_status", "Fund Status")}
      </div>

      <SectionHeader title="Strategy" />
      <div className="grid grid-cols-3 gap-4">
        {f("primary_asset_class", "Primary Asset Class")}
        {f("geographic_focus", "Geographic Focus")}
      </div>

      <SectionHeader title="Assignment" />
      <div className="grid grid-cols-2 gap-4">
        {f("assigned_to", "Assigned To")}
      </div>
    </div>
  );
}

/* -------------------------------------------------- */
/* ENTITY PROFILE PAGE */
/* -------------------------------------------------- */

export default function EntityProfilePage() {
  const { entityType, entityId } = useParams() as {
    entityType: EntityType;
    entityId: string;
  };

  const apiBase = entityApiEndpoints[entityType];
  const fullApiUrl = apiBase ? `${apiBase}/${entityId}` : null;

  const { toast } = useToast();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [editData, setEditData] = useState<any>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const {
    isLocked,
    isOwnLock,
    lockOwner,
    acquireLock,
    releaseLock,
  } = useEntityLock({ entityType, entityId });

  const { data: entity, isLoading } = useQuery({
    queryKey: ["entity", entityType, entityId],
    enabled: !!fullApiUrl,
    queryFn: async () => {
      const res = await apiRequest("GET", fullApiUrl!);
      return res.json();
    },
  });

  useEffect(() => {
    if (entity) setEditData(entity);
  }, [entity]);

  const validate = useCallback(() => {
    const e: Record<string, string> = {};
    for (const f of mandatoryFields[entityType] || []) {
      if (!editData?.[f]) e[f] = "Required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [editData, entityType]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PUT", fullApiUrl!, data);
      return res.json();
    },
    onSuccess: async () => {
      await releaseLock();
      queryClient.invalidateQueries();
      toast({ title: "Saved successfully" });
      setMode("view");
    },
  });

  if (isLoading || !entity) {
    return (
      <div className="p-6">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const Icon = entityTypeIcons[entityType];

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between">
          <div className="flex gap-3 items-center">
            <Icon className="h-6 w-6" />
            <h1 className="text-xl font-bold">
              {entity.fund_name || "Entity"}
            </h1>
            <Badge>{entityTypeLabels[entityType]}</Badge>
          </div>

          <div className="flex gap-2">
            {mode === "view" && !isLocked && (
              <Button
                onClick={async () => {
                  if (await acquireLock()) setMode("edit");
                }}
              >
                <Pencil className="h-4 w-4 mr-2" /> Edit
              </Button>
            )}
            {mode === "edit" && (
              <>
                <Button variant="outline" onClick={releaseLock}>
                  <X className="h-4 w-4 mr-2" /> Cancel
                </Button>
                <Button
                  onClick={() => validate() && updateMutation.mutate(editData)}
                >
                  <Save className="h-4 w-4 mr-2" /> Save
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        <Card>
          <CardContent className="pt-6">
            <ScrollArea className="max-h-[70vh]">
              <FundView
                entity={editData}
                isEditing={mode === "edit"}
                onFieldChange={(k: string, v: any) =>
                  setEditData((p: any) => ({ ...p, [k]: v }))
                }
                errors={errors}
              />

              <SectionHeader title="Source Tracking" />
              <SourceTrackingSection
                data={{
                  sourcesUsed: editData.sources_used || [],
                  sourceUrls: editData.source_urls || [],
                }}
                onChange={() => {}}
                isEditing={mode === "edit"}
              />

              <SectionHeader title="URL Monitoring" />
              <EntityUrlsSection
                entityType={entityType}
                entityId={entityId}
              />
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
