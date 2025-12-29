import { useState, useEffect, useCallback } from "react";
import { useParams, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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

interface ValidationError {
  field: string;
  message: string;
}

function FieldDisplay({ 
  label, 
  value, 
  isLink = false,
  isEditing = false,
  fieldName,
  onChange,
  type = "text",
  isBoolean = false,
  error,
  required = false,
}: { 
  label: string; 
  value?: string | number | boolean | null; 
  isLink?: boolean;
  isEditing?: boolean;
  fieldName?: string;
  onChange?: (field: string, value: any) => void;
  type?: string;
  isBoolean?: boolean;
  error?: string;
  required?: boolean;
}) {
  if (isEditing && fieldName && onChange) {
    if (isBoolean) {
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Checkbox 
              id={fieldName}
              checked={value === true}
              onCheckedChange={(checked) => onChange(fieldName, checked)}
              data-testid={`checkbox-${fieldName}`}
            />
            <Label htmlFor={fieldName} className="text-sm">{label}</Label>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-1">
        <Label htmlFor={fieldName} className="text-sm text-muted-foreground">
          {label}{required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Input
          id={fieldName}
          type={type}
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) => onChange(fieldName, type === "number" ? (e.target.value ? Number(e.target.value) : null) : e.target.value)}
          className={error ? "border-destructive" : ""}
          data-testid={`input-${fieldName}`}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

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
      ) : isBoolean ? (
        <p className="font-medium">{value === true ? "Yes" : value === false ? "No" : "-"}</p>
      ) : (
        <p className="font-medium">{value !== null && value !== undefined && value !== "" ? String(value) : "-"}</p>
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

function GpView({ entity, isEditing, onFieldChange, errors }: { entity: any; isEditing: boolean; onFieldChange?: (field: string, value: any) => void; errors: Record<string, string> }) {
  const f = (fieldName: string, label: string, opts: any = {}) => (
    <FieldDisplay 
      label={label} 
      value={entity[fieldName]} 
      isEditing={isEditing} 
      fieldName={fieldName} 
      onChange={onFieldChange}
      error={errors[fieldName]}
      {...opts}
    />
  );

  return (
    <div className="space-y-2">
      <SectionHeader title="Basic Information" />
      <div className="grid grid-cols-3 gap-4">
        {f("gp_name", "GP Name", { required: true })}
        {f("gp_legal_name", "Legal Name")}
        {f("gp_short_name", "Short Name")}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("firm_type", "Firm Type")}
        {f("year_founded", "Year Founded", { type: "number" })}
        {f("regulatory_status", "Regulatory Status")}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("primary_regulator", "Primary Regulator")}
        {f("registration_number", "Registration Number")}
        {f("registration_jurisdiction", "Registration Jurisdiction")}
      </div>

      <SectionHeader title="Location & Contact" />
      <div className="grid grid-cols-3 gap-4">
        {f("headquarters_country", "HQ Country", { required: true })}
        {f("headquarters_city", "HQ City", { required: true })}
        {f("website", "Website", { isLink: !isEditing })}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("operating_regions", "Operating Regions")}
        {f("office_locations", "Office Locations")}
        {f("email", "Email")}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("phone", "Phone")}
        {f("linkedin_url", "LinkedIn URL", { isLink: !isEditing })}
      </div>

      <SectionHeader title="AUM & Size" />
      <div className="grid grid-cols-3 gap-4">
        {f("total_aum", "Total AUM", { type: "number" })}
        {f("aum_currency", "AUM Currency")}
        {f("number_of_funds", "Number of Funds", { type: "number" })}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("active_funds_count", "Active Funds Count", { type: "number" })}
        {f("total_capital_raised", "Total Capital Raised", { type: "number" })}
        {f("estimated_deal_count", "Estimated Deal Count", { type: "number" })}
      </div>

      <SectionHeader title="Investment Strategy" />
      <div className="grid grid-cols-3 gap-4">
        {f("primary_asset_classes", "Primary Asset Classes")}
        {f("investment_stages", "Investment Stages")}
        {f("industry_focus", "Industry Focus")}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("geographic_focus", "Geographic Focus")}
        {f("first_fund_vintage", "First Fund Vintage", { type: "number" })}
        {f("latest_fund_vintage", "Latest Fund Vintage", { type: "number" })}
      </div>

      <SectionHeader title="Organization" />
      <div className="grid grid-cols-3 gap-4">
        {f("ownership_type", "Ownership Type")}
        {f("parent_company", "Parent Company")}
        {f("advisory_arms", "Advisory Arms")}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("employee_count_band", "Employee Count Band")}
        {f("investment_professionals_count", "Investment Professionals", { type: "number" })}
        {f("senior_investment_professionals_count", "Senior Investment Professionals", { type: "number" })}
      </div>

      <SectionHeader title="Performance & Track Record" />
      <div className="grid grid-cols-3 gap-4">
        {f("top_quartile_flag", "Top Quartile Flag")}
        {f("track_record_years", "Track Record Years", { type: "number" })}
        {f("performance_data_available", "Performance Data Available", { isBoolean: true })}
      </div>

      <SectionHeader title="ESG & Sustainability" />
      <div className="grid grid-cols-3 gap-4">
        {f("esg_policy_available", "ESG Policy Available", { isBoolean: true })}
        {f("pri_signatory", "PRI Signatory", { isBoolean: true })}
        {f("dei_policy_available", "DEI Policy Available", { isBoolean: true })}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("sustainability_report_url", "Sustainability Report URL", { isLink: !isEditing })}
      </div>

      <SectionHeader title="Data Quality" />
      <div className="grid grid-cols-3 gap-4">
        {f("data_confidence_score", "Data Confidence Score", { type: "number" })}
        {f("verification_method", "Verification Method")}
        {f("last_verified_date", "Last Verified Date", { type: "date" })}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("source_coverage", "Source Coverage")}
      </div>

      <SectionHeader title="Linked Entities" />
      <div className="grid grid-cols-4 gap-4">
        {f("linked_funds_count", "Linked Funds", { type: "number" })}
        {f("linked_lps_count", "Linked LPs", { type: "number" })}
        {f("linked_portfolio_companies_count", "Linked Portfolio Companies", { type: "number" })}
        {f("linked_service_providers_count", "Linked Service Providers", { type: "number" })}
      </div>

      <SectionHeader title="Assignment" />
      <div className="grid grid-cols-3 gap-4">
        {f("assigned_to", "Assigned To")}
      </div>
    </div>
  );
}

function LpView({ entity, isEditing, onFieldChange, errors }: { entity: any; isEditing: boolean; onFieldChange?: (field: string, value: any) => void; errors: Record<string, string> }) {
  const f = (fieldName: string, label: string, opts: any = {}) => (
    <FieldDisplay 
      label={label} 
      value={entity[fieldName]} 
      isEditing={isEditing} 
      fieldName={fieldName} 
      onChange={onFieldChange}
      error={errors[fieldName]}
      {...opts}
    />
  );

  return (
    <div className="space-y-2">
      <SectionHeader title="Basic Information" />
      <div className="grid grid-cols-3 gap-4">
        {f("lp_name", "LP Name", { required: true })}
        {f("lp_legal_name", "Legal Name")}
        {f("lp_short_name", "Short Name")}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("lp_type", "LP Type")}
        {f("year_established", "Year Established", { type: "number" })}
        {f("ownership_type", "Ownership Type")}
      </div>

      <SectionHeader title="Location & Contact" />
      <div className="grid grid-cols-3 gap-4">
        {f("headquarters_country", "HQ Country", { required: true })}
        {f("headquarters_city", "HQ City", { required: true })}
        {f("website", "Website", { isLink: !isEditing })}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("operating_regions", "Operating Regions")}
        {f("email", "Email")}
        {f("phone", "Phone")}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("linkedin_url", "LinkedIn URL", { isLink: !isEditing })}
      </div>

      <SectionHeader title="AUM & Allocation" />
      <div className="grid grid-cols-3 gap-4">
        {f("total_aum", "Total AUM", { type: "number" })}
        {f("aum_currency", "AUM Currency")}
        {f("private_markets_allocation_percent", "Private Markets Allocation %", { type: "number" })}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("target_allocation_percent", "Target Allocation %", { type: "number" })}
        {f("average_commitment_size", "Avg Commitment Size", { type: "number" })}
        {f("commitment_size_currency", "Commitment Currency")}
      </div>

      <SectionHeader title="Investment Preferences" />
      <div className="grid grid-cols-3 gap-4">
        {f("asset_class_preferences", "Asset Class Preferences")}
        {f("geographic_preferences", "Geographic Preferences")}
        {f("industry_preferences", "Industry Preferences")}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("fund_stage_preference", "Fund Stage Preference")}
        {f("fund_size_preference", "Fund Size Preference")}
        {f("ticket_size_band", "Ticket Size Band")}
      </div>

      <SectionHeader title="Investment Activity" />
      <div className="grid grid-cols-3 gap-4">
        {f("active_fund_commitments_count", "Active Fund Commitments", { type: "number" })}
        {f("total_fund_commitments_lifetime", "Total Lifetime Commitments", { type: "number" })}
        {f("direct_investment_flag", "Direct Investment", { isBoolean: true })}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("co_investment_flag", "Co-Investment", { isBoolean: true })}
      </div>

      <SectionHeader title="Organization" />
      <div className="grid grid-cols-3 gap-4">
        {f("employee_count_band", "Employee Count Band")}
        {f("investment_team_size", "Investment Team Size", { type: "number" })}
        {f("internal_management_flag", "Internal Management", { isBoolean: true })}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("outsourcing_flag", "Outsourcing", { isBoolean: true })}
      </div>

      <SectionHeader title="ESG & Sustainability" />
      <div className="grid grid-cols-3 gap-4">
        {f("esg_policy_available", "ESG Policy Available", { isBoolean: true })}
        {f("pri_signatory", "PRI Signatory", { isBoolean: true })}
        {f("impact_investing_flag", "Impact Investing", { isBoolean: true })}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("exclusions_policy", "Exclusions Policy")}
        {f("sustainability_report_url", "Sustainability Report URL", { isLink: !isEditing })}
      </div>

      <SectionHeader title="Data Quality" />
      <div className="grid grid-cols-3 gap-4">
        {f("data_confidence_score", "Data Confidence Score", { type: "number" })}
        {f("verification_method", "Verification Method")}
        {f("last_verified_date", "Last Verified Date", { type: "date" })}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("source_coverage", "Source Coverage")}
      </div>

      <SectionHeader title="Linked Entities" />
      <div className="grid grid-cols-3 gap-4">
        {f("linked_gps_count", "Linked GPs", { type: "number" })}
        {f("linked_funds_count", "Linked Funds", { type: "number" })}
        {f("linked_service_providers_count", "Linked Service Providers", { type: "number" })}
      </div>

      <SectionHeader title="Assignment" />
      <div className="grid grid-cols-3 gap-4">
        {f("assigned_to", "Assigned To")}
      </div>
    </div>
  );
}

function FundView({ entity, isEditing, onFieldChange, errors }: { entity: any; isEditing: boolean; onFieldChange?: (field: string, value: any) => void; errors: Record<string, string> }) {
  const f = (fieldName: string, label: string, opts: any = {}) => (
    <FieldDisplay 
      label={label} 
      value={entity[fieldName]} 
      isEditing={isEditing} 
      fieldName={fieldName} 
      onChange={onFieldChange}
      error={errors[fieldName]}
      {...opts}
    />
  );

  return (
    <div className="space-y-2">
      <SectionHeader title="Basic Information" />
      <div className="grid grid-cols-3 gap-4">
        {f("fund_name", "Fund Name", { required: true })}
        {f("fund_legal_name", "Legal Name")}
        {f("fund_short_name", "Short Name")}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("fund_type", "Fund Type")}
        {f("strategy", "Strategy")}
        {f("vintage_year", "Vintage Year", { type: "number" })}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("fund_currency", "Fund Currency")}
        {f("fund_status", "Fund Status")}
      </div>

      <SectionHeader title="GP Relationship" />
      <div className="grid grid-cols-3 gap-4">
        {f("gp_id", "GP ID")}
        {f("gp_name_snapshot", "GP Name")}
      </div>

      <SectionHeader title="Fund Size" />
      <div className="grid grid-cols-3 gap-4">
        {f("target_fund_size", "Target Fund Size", { type: "number" })}
        {f("hard_cap", "Hard Cap", { type: "number" })}
        {f("fund_size_final", "Final Fund Size", { type: "number" })}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("capital_called", "Capital Called", { type: "number" })}
        {f("capital_distributed", "Capital Distributed", { type: "number" })}
        {f("remaining_value", "Remaining Value", { type: "number" })}
      </div>

      <SectionHeader title="Fundraising" />
      <div className="grid grid-cols-3 gap-4">
        {f("first_close_date", "First Close Date", { type: "date" })}
        {f("final_close_date", "Final Close Date", { type: "date" })}
        {f("fundraising_status", "Fundraising Status")}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("number_of_lps", "Number of LPs", { type: "number" })}
        {f("cornerstone_investor_flag", "Cornerstone Investor", { isBoolean: true })}
      </div>

      <SectionHeader title="Investment Strategy" />
      <div className="grid grid-cols-3 gap-4">
        {f("primary_asset_class", "Primary Asset Class")}
        {f("investment_stage", "Investment Stage")}
        {f("industry_focus", "Industry Focus")}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("geographic_focus", "Geographic Focus")}
      </div>

      <SectionHeader title="Performance" />
      <div className="grid grid-cols-3 gap-4">
        {f("net_irr", "Net IRR", { type: "number" })}
        {f("gross_irr", "Gross IRR", { type: "number" })}
        {f("tvpi", "TVPI", { type: "number" })}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("dpi", "DPI", { type: "number" })}
        {f("rvpi", "RVPI", { type: "number" })}
        {f("performance_data_available", "Performance Data Available", { isBoolean: true })}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("performance_as_of_date", "Performance As Of Date", { type: "date" })}
      </div>

      <SectionHeader title="Portfolio" />
      <div className="grid grid-cols-3 gap-4">
        {f("deal_count", "Deal Count", { type: "number" })}
        {f("active_portfolio_companies_count", "Active Portfolio Companies", { type: "number" })}
        {f("realized_portfolio_companies_count", "Realized Portfolio Companies", { type: "number" })}
      </div>

      <SectionHeader title="ESG & Sustainability" />
      <div className="grid grid-cols-3 gap-4">
        {f("esg_integration_flag", "ESG Integration", { isBoolean: true })}
        {f("impact_fund_flag", "Impact Fund", { isBoolean: true })}
        {f("sustainability_objective", "Sustainability Objective")}
      </div>

      <SectionHeader title="Data Quality" />
      <div className="grid grid-cols-3 gap-4">
        {f("data_confidence_score", "Data Confidence Score", { type: "number" })}
        {f("verification_method", "Verification Method")}
        {f("last_verified_date", "Last Verified Date", { type: "date" })}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("source_coverage", "Source Coverage")}
      </div>

      <SectionHeader title="Assignment" />
      <div className="grid grid-cols-3 gap-4">
        {f("assigned_to", "Assigned To")}
      </div>
    </div>
  );
}

function ServiceProviderView({ entity, isEditing, onFieldChange, errors }: { entity: any; isEditing: boolean; onFieldChange?: (field: string, value: any) => void; errors: Record<string, string> }) {
  const f = (fieldName: string, label: string, opts: any = {}) => (
    <FieldDisplay 
      label={label} 
      value={entity[fieldName]} 
      isEditing={isEditing} 
      fieldName={fieldName} 
      onChange={onFieldChange}
      error={errors[fieldName]}
      {...opts}
    />
  );

  return (
    <div className="space-y-2">
      <SectionHeader title="Basic Information" />
      <div className="grid grid-cols-3 gap-4">
        {f("service_provider_name", "Service Provider Name", { required: true })}
        {f("service_provider_legal_name", "Legal Name")}
        {f("service_provider_short_name", "Short Name")}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("service_provider_type", "Provider Type")}
        {f("specialization", "Specialization")}
        {f("year_founded", "Year Founded", { type: "number" })}
      </div>

      <SectionHeader title="Location & Contact" />
      <div className="grid grid-cols-3 gap-4">
        {f("headquarters_country", "HQ Country", { required: true })}
        {f("headquarters_city", "HQ City", { required: true })}
        {f("website", "Website", { isLink: !isEditing })}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("operating_regions", "Operating Regions")}
        {f("office_locations", "Office Locations")}
        {f("email", "Email")}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("phone", "Phone")}
        {f("linkedin_url", "LinkedIn URL", { isLink: !isEditing })}
      </div>

      <SectionHeader title="Services" />
      <div className="grid grid-cols-3 gap-4">
        {f("primary_services", "Primary Services")}
        {f("secondary_services", "Secondary Services")}
        {f("asset_class_coverage", "Asset Class Coverage")}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("fund_stage_coverage", "Fund Stage Coverage")}
        {f("typical_client_type", "Typical Client Type")}
        {f("client_size_focus", "Client Size Focus")}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("geographic_client_focus", "Geographic Client Focus")}
      </div>

      <SectionHeader title="Organization" />
      <div className="grid grid-cols-3 gap-4">
        {f("ownership_type", "Ownership Type")}
        {f("employee_count_band", "Employee Count Band")}
        {f("years_active_in_private_markets", "Years Active in PE", { type: "number" })}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("marquee_clients", "Marquee Clients")}
        {f("cross_border_capability_flag", "Cross-Border Capability", { isBoolean: true })}
      </div>

      <SectionHeader title="Regulatory" />
      <div className="grid grid-cols-3 gap-4">
        {f("regulated_flag", "Regulated", { isBoolean: true })}
        {f("primary_regulator", "Primary Regulator")}
        {f("data_privacy_compliance", "Data Privacy Compliance")}
      </div>

      <SectionHeader title="ESG & Sustainability" />
      <div className="grid grid-cols-3 gap-4">
        {f("esg_policy_available", "ESG Policy Available", { isBoolean: true })}
        {f("sustainability_report_url", "Sustainability Report URL", { isLink: !isEditing })}
      </div>

      <SectionHeader title="Data Quality" />
      <div className="grid grid-cols-3 gap-4">
        {f("data_confidence_score", "Data Confidence Score", { type: "number" })}
        {f("verification_method", "Verification Method")}
        {f("last_verified_date", "Last Verified Date", { type: "date" })}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("source_coverage", "Source Coverage")}
      </div>

      <SectionHeader title="Linked Entities" />
      <div className="grid grid-cols-4 gap-4">
        {f("linked_gps_count", "Linked GPs", { type: "number" })}
        {f("linked_funds_count", "Linked Funds", { type: "number" })}
        {f("linked_lps_count", "Linked LPs", { type: "number" })}
        {f("linked_portfolio_companies_count", "Linked Portfolio Companies", { type: "number" })}
      </div>

      <SectionHeader title="Assignment" />
      <div className="grid grid-cols-3 gap-4">
        {f("assigned_to", "Assigned To")}
      </div>
    </div>
  );
}

function PortfolioCompanyView({ entity, isEditing, onFieldChange, errors }: { entity: any; isEditing: boolean; onFieldChange?: (field: string, value: any) => void; errors: Record<string, string> }) {
  const f = (fieldName: string, label: string, opts: any = {}) => (
    <FieldDisplay 
      label={label} 
      value={entity[fieldName]} 
      isEditing={isEditing} 
      fieldName={fieldName} 
      onChange={onFieldChange}
      error={errors[fieldName]}
      {...opts}
    />
  );

  return (
    <div className="space-y-2">
      <SectionHeader title="Basic Information" />
      <div className="grid grid-cols-3 gap-4">
        {f("company_name", "Company Name", { required: true })}
        {f("legal_name", "Legal Name")}
        {f("short_name", "Short Name")}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("company_type", "Company Type")}
        {f("year_founded", "Year Founded", { type: "number" })}
      </div>

      <SectionHeader title="Location" />
      <div className="grid grid-cols-3 gap-4">
        {f("headquarters_country", "HQ Country", { required: true })}
        {f("headquarters_city", "HQ City", { required: true })}
        {f("website", "Website", { isLink: !isEditing })}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("operating_regions", "Operating Regions")}
        {f("primary_markets", "Primary Markets")}
      </div>

      <SectionHeader title="Business" />
      <div className="grid grid-cols-3 gap-4">
        {f("primary_industry", "Primary Industry")}
        {f("sub_industry", "Sub Industry")}
        {f("business_model", "Business Model")}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("revenue_model", "Revenue Model")}
        {f("business_description", "Business Description")}
      </div>

      <SectionHeader title="Financials" />
      <div className="grid grid-cols-3 gap-4">
        {f("employee_count_band", "Employee Count Band")}
        {f("revenue_band", "Revenue Band")}
        {f("latest_revenue", "Latest Revenue", { type: "number" })}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("revenue_currency", "Revenue Currency")}
        {f("revenue_year", "Revenue Year", { type: "number" })}
        {f("profitability_status", "Profitability Status")}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("ebitda_margin", "EBITDA Margin", { type: "number" })}
        {f("valuation_band", "Valuation Band")}
      </div>

      <SectionHeader title="Ownership" />
      <div className="grid grid-cols-3 gap-4">
        {f("current_owner_type", "Current Owner Type")}
        {f("controlling_gp_id", "Controlling GP ID")}
        {f("controlling_fund_id", "Controlling Fund ID")}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("first_investment_year", "First Investment Year", { type: "number" })}
        {f("total_funding_raised", "Total Funding Raised", { type: "number" })}
        {f("funding_currency", "Funding Currency")}
      </div>

      <SectionHeader title="Operations" />
      <div className="grid grid-cols-3 gap-4">
        {f("manufacturing_presence_flag", "Manufacturing Presence", { isBoolean: true })}
        {f("r_and_d_presence_flag", "R&D Presence", { isBoolean: true })}
      </div>

      <SectionHeader title="ESG & Sustainability" />
      <div className="grid grid-cols-3 gap-4">
        {f("esg_policy_available", "ESG Policy Available", { isBoolean: true })}
        {f("environmental_focus", "Environmental Focus")}
        {f("social_focus", "Social Focus")}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("governance_focus", "Governance Focus")}
        {f("compliance_certifications", "Compliance Certifications")}
        {f("sustainability_report_url", "Sustainability Report URL", { isLink: !isEditing })}
      </div>

      <SectionHeader title="Exit Information" />
      <div className="grid grid-cols-3 gap-4">
        {f("exit_status", "Exit Status")}
        {f("exit_type", "Exit Type")}
        {f("exit_year", "Exit Year", { type: "number" })}
      </div>

      <SectionHeader title="Data Quality" />
      <div className="grid grid-cols-3 gap-4">
        {f("data_confidence_score", "Data Confidence Score", { type: "number" })}
        {f("confidence_score", "Confidence Score", { type: "number" })}
        {f("verification_method", "Verification Method")}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("last_verified_date", "Last Verified Date", { type: "date" })}
        {f("source_coverage", "Source Coverage")}
        {f("data_source", "Data Source")}
      </div>

      <SectionHeader title="Linked Entities" />
      <div className="grid grid-cols-4 gap-4">
        {f("linked_gps_count", "Linked GPs", { type: "number" })}
        {f("linked_funds_count", "Linked Funds", { type: "number" })}
        {f("linked_deals_count", "Linked Deals", { type: "number" })}
        {f("linked_service_providers_count", "Linked Service Providers", { type: "number" })}
      </div>

      <SectionHeader title="Assignment" />
      <div className="grid grid-cols-3 gap-4">
        {f("assigned_to", "Assigned To")}
      </div>
    </div>
  );
}

function DealView({ entity, isEditing, onFieldChange, errors }: { entity: any; isEditing: boolean; onFieldChange?: (field: string, value: any) => void; errors: Record<string, string> }) {
  const f = (fieldName: string, label: string, opts: any = {}) => (
    <FieldDisplay 
      label={label} 
      value={entity[fieldName]} 
      isEditing={isEditing} 
      fieldName={fieldName} 
      onChange={onFieldChange}
      error={errors[fieldName]}
      {...opts}
    />
  );

  return (
    <div className="space-y-2">
      <SectionHeader title="Deal Information" />
      <div className="grid grid-cols-3 gap-4">
        {f("deal_name", "Deal Name", { required: true })}
        {f("deal_type", "Deal Type")}
        {f("transaction_type", "Transaction Type")}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("announcement_date", "Announcement Date", { type: "date" })}
        {f("closing_date", "Closing Date", { type: "date" })}
        {f("deal_status", "Deal Status")}
      </div>

      <SectionHeader title="Deal Parties" />
      <div className="grid grid-cols-3 gap-4">
        {f("gp_id", "GP ID")}
        {f("gp_name_snapshot", "GP Name")}
        {f("fund_id", "Fund ID")}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("fund_name_snapshot", "Fund Name")}
        {f("portfolio_company_id", "Portfolio Company ID")}
        {f("portfolio_company_name_snapshot", "Portfolio Company Name")}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("target_company_id", "Target Company ID")}
        {f("acquirer_company_id", "Acquirer Company ID")}
      </div>

      <SectionHeader title="Deal Size & Investment" />
      <div className="grid grid-cols-3 gap-4">
        {f("deal_size", "Deal Size", { type: "number" })}
        {f("deal_currency", "Deal Currency")}
        {f("equity_invested", "Equity Invested", { type: "number" })}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("debt_invested", "Debt Invested", { type: "number" })}
        {f("ownership_percentage", "Ownership %", { type: "number" })}
        {f("valuation_pre", "Pre-Money Valuation", { type: "number" })}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("valuation_post", "Post-Money Valuation", { type: "number" })}
      </div>

      <SectionHeader title="Investment Details" />
      <div className="grid grid-cols-3 gap-4">
        {f("investment_round", "Investment Round")}
        {f("deal_round", "Deal Round")}
        {f("asset_class", "Asset Class")}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("security_type", "Security Type")}
        {f("syndication_flag", "Syndication", { isBoolean: true })}
        {f("lead_investor_flag", "Lead Investor Flag", { isBoolean: true })}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("lead_investor", "Lead Investor", { isBoolean: true })}
      </div>

      <SectionHeader title="Geography & Industry" />
      <div className="grid grid-cols-3 gap-4">
        {f("deal_country", "Deal Country", { required: true })}
        {f("deal_region", "Deal Region")}
        {f("primary_industry", "Primary Industry")}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("sub_industry", "Sub Industry")}
      </div>

      <SectionHeader title="Exit Information" />
      <div className="grid grid-cols-3 gap-4">
        {f("exit_type", "Exit Type")}
        {f("exit_date", "Exit Date", { type: "date" })}
        {f("gross_multiple", "Gross Multiple", { type: "number" })}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("net_multiple", "Net Multiple", { type: "number" })}
        {f("realized_flag", "Realized", { isBoolean: true })}
      </div>

      <SectionHeader title="ESG & Sustainability" />
      <div className="grid grid-cols-3 gap-4">
        {f("esg_consideration_flag", "ESG Consideration", { isBoolean: true })}
        {f("impact_deal_flag", "Impact Deal", { isBoolean: true })}
        {f("sustainability_theme", "Sustainability Theme")}
      </div>

      <SectionHeader title="Data Quality" />
      <div className="grid grid-cols-3 gap-4">
        {f("data_confidence_score", "Data Confidence Score", { type: "number" })}
        {f("confidence_score", "Confidence Score", { type: "number" })}
        {f("verification_method", "Verification Method")}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("verification_status", "Verification Status")}
        {f("last_verified_date", "Last Verified Date", { type: "date" })}
        {f("source_coverage", "Source Coverage")}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("source_urls", "Source URLs")}
      </div>

      <SectionHeader title="Assignment" />
      <div className="grid grid-cols-3 gap-4">
        {f("assigned_to", "Assigned To")}
      </div>
    </div>
  );
}

function ContactView({ entity, isEditing, onFieldChange, errors }: { entity: any; isEditing: boolean; onFieldChange?: (field: string, value: any) => void; errors: Record<string, string> }) {
  const f = (fieldName: string, label: string, opts: any = {}) => (
    <FieldDisplay 
      label={label} 
      value={entity[fieldName]} 
      isEditing={isEditing} 
      fieldName={fieldName} 
      onChange={onFieldChange}
      error={errors[fieldName]}
      {...opts}
    />
  );

  return (
    <div className="space-y-2">
      <SectionHeader title="Personal Information" />
      <div className="grid grid-cols-3 gap-4">
        {f("first_name", "First Name", { required: true })}
        {f("middle_name", "Middle Name")}
        {f("last_name", "Last Name", { required: true })}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("full_name", "Full Name")}
        {f("preferred_name", "Preferred Name")}
      </div>

      <SectionHeader title="Professional Role" />
      <div className="grid grid-cols-3 gap-4">
        {f("job_title", "Job Title", { required: true })}
        {f("seniority_level", "Seniority Level")}
        {f("department_category", "Department Category")}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("role_category", "Role Category")}
        {f("years_of_experience", "Years of Experience", { type: "number" })}
        {f("functional_expertise", "Functional Expertise")}
      </div>

      <SectionHeader title="Primary Organization" />
      <div className="grid grid-cols-3 gap-4">
        {f("primary_entity_type", "Primary Entity Type")}
        {f("primary_entity_id", "Primary Entity ID")}
        {f("primary_entity_name_snapshot", "Primary Entity Name")}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("asset_category_snapshot", "Asset Category")}
        {f("asset_source_entity_type", "Asset Source Entity Type")}
        {f("asset_source_entity_id", "Asset Source Entity ID")}
      </div>

      <SectionHeader title="Contact Details" />
      <div className="grid grid-cols-3 gap-4">
        {f("work_email", "Work Email")}
        {f("personal_email", "Personal Email")}
        {f("phone_number", "Phone Number")}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("linkedin_url", "LinkedIn URL", { isLink: !isEditing })}
      </div>

      <SectionHeader title="Location" />
      <div className="grid grid-cols-3 gap-4">
        {f("location_country", "Country")}
        {f("location_city", "City")}
        {f("time_zone", "Time Zone")}
      </div>

      <SectionHeader title="Employment" />
      <div className="grid grid-cols-3 gap-4">
        {f("employment_status", "Employment Status")}
        {f("role_start_year", "Role Start Year", { type: "number" })}
        {f("role_end_year", "Role End Year", { type: "number" })}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("previous_employers", "Previous Employers")}
      </div>

      <SectionHeader title="Roles & Responsibilities" />
      <div className="grid grid-cols-3 gap-4">
        {f("board_membership_flag", "Board Membership", { isBoolean: true })}
        {f("decision_maker_flag", "Decision Maker", { isBoolean: true })}
        {f("investment_committee_member_flag", "Investment Committee Member", { isBoolean: true })}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("deal_involvement_flag", "Deal Involvement", { isBoolean: true })}
        {f("board_roles", "Board Roles")}
        {f("associated_fund_ids", "Associated Fund IDs")}
      </div>

      <SectionHeader title="Focus Areas" />
      <div className="grid grid-cols-3 gap-4">
        {f("asset_class_focus", "Asset Class Focus")}
        {f("sector_focus", "Sector Focus")}
        {f("geography_focus", "Geography Focus")}
      </div>

      <SectionHeader title="Data Quality & Verification" />
      <div className="grid grid-cols-3 gap-4">
        {f("verification_status", "Verification Status")}
        {f("verification_method", "Verification Method")}
        {f("verification_source", "Verification Source")}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("last_verified_date", "Last Verified Date", { type: "date" })}
        {f("last_verified_at", "Last Verified At")}
        {f("email_validated_flag", "Email Validated", { isBoolean: true })}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("phone_validated_flag", "Phone Validated", { isBoolean: true })}
        {f("contact_confidence_score", "Contact Confidence Score", { type: "number" })}
        {f("confidence_score", "Confidence Score", { type: "number" })}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("importance_score", "Importance Score", { type: "number" })}
        {f("intent_signal", "Intent Signal")}
        {f("source_coverage", "Source Coverage")}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {f("data_confidence_score", "Data Confidence Score", { type: "number" })}
      </div>

      <SectionHeader title="Assignment" />
      <div className="grid grid-cols-3 gap-4">
        {f("assigned_to", "Assigned To")}
      </div>
    </div>
  );
}

const entityApiEndpoints: Record<EntityType, string> = {
  gp: "/api/entities/gp",
  lp: "/api/entities/lp",
  fund: "/api/entities/funds",
  service_provider: "/api/entities/service-providers",
  portfolio_company: "/api/entities/portfolio-companies",
  deal: "/api/entities/deals",
  contact: "/api/entities/contacts",
};

const mandatoryFields: Record<EntityType, string[]> = {
  gp: ["gp_name", "headquarters_country", "headquarters_city"],
  lp: ["lp_name", "headquarters_country", "headquarters_city"],
  fund: ["fund_name"],
  service_provider: ["service_provider_name", "headquarters_country", "headquarters_city"],
  portfolio_company: ["company_name", "headquarters_country", "headquarters_city"],
  deal: ["deal_name", "deal_country"],
  contact: ["first_name", "last_name", "job_title"],
};

const mandatoryFieldLabels: Record<string, string> = {
  gp_name: "GP Name",
  lp_name: "LP Name",
  fund_name: "Fund Name",
  service_provider_name: "Service Provider Name",
  company_name: "Company Name",
  deal_name: "Deal Name",
  first_name: "First Name",
  last_name: "Last Name",
  job_title: "Job Title",
  headquarters_country: "Headquarters Country",
  headquarters_city: "Headquarters City",
  deal_country: "Deal Country",
};

export default function EntityProfilePage() {
  const params = useParams();
  const searchParams = new URLSearchParams(window.location.search);
  const entityType = params.entityType as EntityType;
  const entityId = params.entityId as string;
  const initialMode = searchParams.get("mode") as "view" | "edit" || "view";
  
  const [mode, setMode] = useState<"view" | "edit">(initialMode);
  const [editData, setEditData] = useState<any>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
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
  
  // Build full URL - ensure it starts with /api/entities
  const fullApiUrl = apiEndpoint ? `${apiEndpoint}/${entityId}` : null;
  
  const { data: entity, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/entities', entityType, entityId],
    queryFn: async () => {
      if (!fullApiUrl) {
        throw new Error(`Unknown entity type: ${entityType}`);
      }
      console.log(`[DEBUG] Fetching entity: ${fullApiUrl}`);
      const res = await apiRequest("GET", fullApiUrl);
      return res.json();
    },
    enabled: !!entityType && !!entityId && !!apiEndpoint && !!fullApiUrl,
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

  const validateMandatoryFields = useCallback(() => {
    const errors: Record<string, string> = {};
    const required = mandatoryFields[entityType] || [];
    
    for (const field of required) {
      const value = editData?.[field];
      if (value === null || value === undefined || value === "") {
        errors[field] = "This field is required";
      }
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [entityType, editData]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!fullApiUrl) {
        throw new Error(`Unknown entity type: ${entityType}`);
      }
      const res = await apiRequest("PUT", fullApiUrl, data);
      return res.json();
    },
    onSuccess: async () => {
      await releaseLock();
      queryClient.invalidateQueries({ queryKey: ['/api/entities', entityType] });
      toast({ title: "Changes saved successfully" });
      setMode("view");
      setValidationErrors({});
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
      setValidationErrors({});
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
    setValidationErrors({});
    setSourceTracking({
      sourcesUsed: entity?.sources_used || [],
      sourceUrls: entity?.source_urls || [],
    });
  };

  const handleSave = () => {
    if (!validateMandatoryFields()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    
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
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
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
                     entity.service_provider_name || entity.company_name || entity.deal_name ||
                     `${entity.first_name || ""} ${entity.last_name || ""}`.trim() || "Unnamed";
  
  const isEditMode = mode === "edit" && isOwnLock;
  const isViewOnlyDueToLock = isLocked && !isOwnLock;

  const renderEntityView = () => {
    const props = { 
      entity: editData || entity, 
      isEditing: isEditMode, 
      onFieldChange: handleFieldChange,
      errors: validationErrors,
    };
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
