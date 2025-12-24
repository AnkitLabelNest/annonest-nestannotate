import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useForm } from "react-hook-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, Plus, Building2, Globe, MapPin, DollarSign, Loader2, 
  Eye, Pencil, Users, UserPlus, Link2, CheckCircle, AlertCircle, Clock,
  Briefcase, Mail, Phone, Linkedin
} from "lucide-react";
import { EntityUrlsSection } from "@/components/entity-urls-section";

interface CrmGp {
  id: string;
  org_id: string;
  gp_name: string;
  gp_legal_name?: string;
  firm_type?: string;
  headquarters_country?: string;
  headquarters_city?: string;
  total_aum?: string;
  aum_currency?: string;
  website?: string;
  primary_asset_classes?: string;
  status?: string;
}

interface CrmLp {
  id: string;
  org_id: string;
  lp_name: string;
  lp_legal_name?: string;
  firm_type?: string;
  investor_type?: string;
  headquarters_country?: string;
  headquarters_city?: string;
  total_aum?: string;
  aum_currency?: string;
  website?: string;
  status?: string;
}

interface CrmServiceProvider {
  id: string;
  org_id: string;
  provider_name: string;
  provider_type?: string;
  headquarters_country?: string;
  headquarters_city?: string;
  website?: string;
  services_offered?: string;
  sector_expertise?: string;
  geographic_coverage?: string;
  founded_year?: number;
  status?: string;
}

interface CrmPortfolioCompany {
  id: string;
  org_id: string;
  company_name: string;
  company_type?: string;
  headquarters_country?: string;
  headquarters_city?: string;
  primary_industry?: string;
  business_model?: string;
  website?: string;
  business_description?: string;
  founded_year?: number;
  employee_count?: number;
  status?: string;
}

interface CrmContact {
  id: string;
  org_id: string;
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
  title?: string;
  seniority_level?: string;
  department?: string;
  linked_entity_type?: string;
  linked_entity_id?: string;
  relationship_type?: string;
  linkedin_url?: string;
  notes?: string;
  status?: string;
  verification_status?: string;
}

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  Active: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  inactive: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  Inactive: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  prospect: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  Prospect: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  Pending: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
};

const verificationColors: Record<string, string> = {
  verified: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  Verified: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  unverified: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  Unverified: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  Pending: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
};

const currencyOptions = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "CNY"];
const firmTypeOptions = ["Private Equity", "Venture Capital", "Hedge Fund", "Real Estate", "Infrastructure", "Credit", "Multi-Strategy", "Other"];
const assetClassOptions = ["Buyout", "Growth Equity", "Venture", "Real Estate", "Infrastructure", "Credit", "Distressed", "Secondaries"];
const investorTypeOptions = ["Pension Fund", "Endowment", "Foundation", "Family Office", "Sovereign Wealth Fund", "Insurance Company", "Fund of Funds", "Bank", "Corporate", "HNWI", "Other"];
const providerTypeOptions = ["Law Firm", "Accounting", "Fund Administration", "Consulting", "Placement Agent", "Recruiting", "Technology", "Data Provider", "Other"];
const industryOptions = ["Technology", "Healthcare", "Financial Services", "Consumer", "Industrial", "Energy", "Real Estate", "Multi-Sector"];
const seniorityOptions = ["C-Suite", "VP", "Director", "Manager", "Senior", "Junior", "Associate", "Intern"];
const relationshipOptions = ["Primary Contact", "Secondary Contact", "Board Member", "Advisor", "Investor Relations", "Portfolio Manager", "Deal Team", "Other"];

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

interface FirmsPageProps {
  defaultTab?: "gp" | "lp" | "service-provider" | "portfolio-company";
}

export default function FirmsPage({ defaultTab = "gp" }: FirmsPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Firms</h1>
          <p className="text-muted-foreground">Manage GP, LP, Service Provider, and Portfolio Company records</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
          <CardTitle>All Firms</CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search firms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
              data-testid="input-search-firms"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as "gp" | "lp" | "service-provider" | "portfolio-company")}>
            <TabsList className="mb-4 flex flex-wrap gap-1">
              <TabsTrigger value="gp">GP Firms</TabsTrigger>
              <TabsTrigger value="lp">LP Firms</TabsTrigger>
              <TabsTrigger value="service-provider">Service Providers</TabsTrigger>
              <TabsTrigger value="portfolio-company">Portfolio Companies</TabsTrigger>
            </TabsList>

            <TabsContent value="gp">
              <GpFirmsTab searchQuery={searchQuery} />
            </TabsContent>

            <TabsContent value="lp">
              <LpFirmsTab searchQuery={searchQuery} />
            </TabsContent>

            <TabsContent value="service-provider">
              <ServiceProvidersTab searchQuery={searchQuery} />
            </TabsContent>

            <TabsContent value="portfolio-company">
              <PortfolioCompaniesTab searchQuery={searchQuery} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function GpFirmsTab({ searchQuery }: { searchQuery: string }) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedFirm, setSelectedFirm] = useState<CrmGp | null>(null);
  const [dialogMode, setDialogMode] = useState<"view" | "edit" | "contacts">("view");
  const { toast } = useToast();

  const { data: gps = [], isLoading, error } = useQuery<CrmGp[]>({
    queryKey: ["/api/crm/gps"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("POST", "/api/crm/gps", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/gps"] });
      setIsAddDialogOpen(false);
      toast({ title: "GP Firm created", description: "The GP firm has been added successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error creating GP", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      const res = await apiRequest("PATCH", `/api/crm/gps/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/gps"] });
      setDialogMode("view");
      toast({ title: "GP Firm updated", description: "Changes have been saved successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating GP", description: error.message, variant: "destructive" });
    },
  });

  const filteredData = gps.filter((gp) =>
    gp.gp_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    gp.gp_legal_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns = [
    {
      key: "gp_name",
      header: "Firm Name",
      sortable: true,
      render: (gp: CrmGp) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <div>
            <span className="font-medium">{gp.gp_name || "-"}</span>
            <p className="text-xs text-muted-foreground">Click to view full profile</p>
          </div>
        </div>
      ),
    },
    {
      key: "firm_type",
      header: "Type",
      render: (gp: CrmGp) => <Badge variant="secondary">{gp.firm_type || "-"}</Badge>,
    },
    {
      key: "headquarters",
      header: "Location",
      render: (gp: CrmGp) => (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {gp.headquarters_city && gp.headquarters_country
            ? `${gp.headquarters_city}, ${gp.headquarters_country}`
            : gp.headquarters_country || gp.headquarters_city || "-"}
        </div>
      ),
    },
    {
      key: "total_aum",
      header: "AUM",
      render: (gp: CrmGp) => (
        <div className="flex items-center gap-1">
          <DollarSign className="h-3 w-3 text-muted-foreground" />
          {gp.total_aum ? `${gp.total_aum} ${gp.aum_currency || "USD"}` : "-"}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (gp: CrmGp) => (
        <Badge className={statusColors[gp.status || "active"] || statusColors.active}>
          {gp.status || "active"}
        </Badge>
      ),
    },
  ];

  const openFirmDialog = (firm: CrmGp, mode: "view" | "edit" | "contacts") => {
    setSelectedFirm(firm);
    setDialogMode(mode);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-8 text-destructive">Failed to load GP firms.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-gp">
              <Plus className="h-4 w-4 mr-2" />
              Add GP Firm
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Add New GP Firm</DialogTitle>
            </DialogHeader>
            <GpFirmForm onSubmit={(data) => createMutation.mutate(data)} isPending={createMutation.isPending} onCancel={() => setIsAddDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        data={filteredData}
        columns={columns}
        onView={(gp) => openFirmDialog(gp, "view")}
        onEdit={(gp) => openFirmDialog(gp, "edit")}
        emptyMessage="No GP firms found"
      />

      <Dialog open={!!selectedFirm} onOpenChange={() => setSelectedFirm(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader className="pb-0">
            <div className="flex items-center justify-between gap-4">
              <div>
                <DialogTitle className="text-xl">{selectedFirm?.gp_name}</DialogTitle>
                <DialogDescription>
                  {selectedFirm?.gp_legal_name && <span className="text-sm">{selectedFirm.gp_legal_name}</span>}
                </DialogDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={dialogMode === "view" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDialogMode("view")}
                  data-testid="button-view-profile"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
                <Button
                  variant={dialogMode === "edit" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDialogMode("edit")}
                  data-testid="button-edit-profile"
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant={dialogMode === "contacts" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDialogMode("contacts")}
                  data-testid="button-contacts"
                >
                  <Users className="h-4 w-4 mr-1" />
                  Contacts
                </Button>
              </div>
            </div>
          </DialogHeader>
          
          {selectedFirm && dialogMode === "view" && (
            <GpFirmFullView gp={selectedFirm} onClose={() => setSelectedFirm(null)} />
          )}
          {selectedFirm && dialogMode === "edit" && (
            <GpFirmForm
              defaultValues={selectedFirm}
              onSubmit={(data) => {
                updateMutation.mutate({ id: selectedFirm.id, data });
              }}
              isPending={updateMutation.isPending}
              onCancel={() => setDialogMode("view")}
              isEdit
            />
          )}
          {selectedFirm && dialogMode === "contacts" && (
            <FirmContactsSection 
              entityType="gp" 
              entityId={selectedFirm.id} 
              entityName={selectedFirm.gp_name}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GpFirmForm({
  defaultValues,
  onSubmit,
  isPending,
  onCancel,
  isEdit = false,
}: {
  defaultValues?: any;
  onSubmit: (data: Record<string, any>) => void;
  isPending: boolean;
  onCancel: () => void;
  isEdit?: boolean;
}) {
  const dv = defaultValues || {};
  const form = useForm({
    defaultValues: {
      gp_name: dv.gp_name || "",
      gp_legal_name: dv.gp_legal_name || "",
      gp_short_name: dv.gp_short_name || "",
      firm_type: dv.firm_type || "",
      year_founded: dv.year_founded?.toString() || "",
      headquarters_country: dv.headquarters_country || "",
      headquarters_city: dv.headquarters_city || "",
      operating_regions: dv.operating_regions || "",
      office_locations: dv.office_locations || "",
      website: dv.website || "",
      email: dv.email || "",
      phone: dv.phone || "",
      linkedin_url: dv.linkedin_url || "",
      regulatory_status: dv.regulatory_status || "",
      primary_regulator: dv.primary_regulator || "",
      registration_number: dv.registration_number || "",
      registration_jurisdiction: dv.registration_jurisdiction || "",
      total_aum: dv.total_aum?.toString() || "",
      aum_currency: dv.aum_currency || "USD",
      primary_asset_classes: dv.primary_asset_classes || "",
      investment_stages: dv.investment_stages || "",
      industry_focus: dv.industry_focus || "",
      geographic_focus: dv.geographic_focus || "",
      number_of_funds: dv.number_of_funds?.toString() || "",
      active_funds_count: dv.active_funds_count?.toString() || "",
      total_capital_raised: dv.total_capital_raised?.toString() || "",
      first_fund_vintage: dv.first_fund_vintage?.toString() || "",
      latest_fund_vintage: dv.latest_fund_vintage?.toString() || "",
      estimated_deal_count: dv.estimated_deal_count?.toString() || "",
      ownership_type: dv.ownership_type || "",
      parent_company: dv.parent_company || "",
      advisory_arms: dv.advisory_arms || "",
      employee_count_band: dv.employee_count_band || "",
      investment_professionals_count: dv.investment_professionals_count?.toString() || "",
      senior_investment_professionals_count: dv.senior_investment_professionals_count?.toString() || "",
      top_quartile_flag: dv.top_quartile_flag || "",
      track_record_years: dv.track_record_years?.toString() || "",
      performance_data_available: dv.performance_data_available ? "true" : "false",
      esg_policy_available: dv.esg_policy_available ? "true" : "false",
      pri_signatory: dv.pri_signatory ? "true" : "false",
      dei_policy_available: dv.dei_policy_available ? "true" : "false",
      sustainability_report_url: dv.sustainability_report_url || "",
      status: dv.status || "Active",
    },
  });

  const handleSubmit = (data: any) => {
    onSubmit({
      gp_name: data.gp_name || null,
      gp_legal_name: data.gp_legal_name || null,
      gp_short_name: data.gp_short_name || null,
      firm_type: data.firm_type || null,
      year_founded: data.year_founded ? parseInt(data.year_founded) : null,
      headquarters_country: data.headquarters_country || null,
      headquarters_city: data.headquarters_city || null,
      operating_regions: data.operating_regions || null,
      office_locations: data.office_locations || null,
      website: data.website || null,
      email: data.email || null,
      phone: data.phone || null,
      linkedin_url: data.linkedin_url || null,
      regulatory_status: data.regulatory_status || null,
      primary_regulator: data.primary_regulator || null,
      registration_number: data.registration_number || null,
      registration_jurisdiction: data.registration_jurisdiction || null,
      total_aum: data.total_aum ? parseFloat(data.total_aum) : null,
      aum_currency: data.aum_currency || null,
      primary_asset_classes: data.primary_asset_classes || null,
      investment_stages: data.investment_stages || null,
      industry_focus: data.industry_focus || null,
      geographic_focus: data.geographic_focus || null,
      number_of_funds: data.number_of_funds ? parseInt(data.number_of_funds) : null,
      active_funds_count: data.active_funds_count ? parseInt(data.active_funds_count) : null,
      total_capital_raised: data.total_capital_raised ? parseFloat(data.total_capital_raised) : null,
      first_fund_vintage: data.first_fund_vintage ? parseInt(data.first_fund_vintage) : null,
      latest_fund_vintage: data.latest_fund_vintage ? parseInt(data.latest_fund_vintage) : null,
      estimated_deal_count: data.estimated_deal_count ? parseInt(data.estimated_deal_count) : null,
      ownership_type: data.ownership_type || null,
      parent_company: data.parent_company || null,
      advisory_arms: data.advisory_arms || null,
      employee_count_band: data.employee_count_band || null,
      investment_professionals_count: data.investment_professionals_count ? parseInt(data.investment_professionals_count) : null,
      senior_investment_professionals_count: data.senior_investment_professionals_count ? parseInt(data.senior_investment_professionals_count) : null,
      top_quartile_flag: data.top_quartile_flag || null,
      track_record_years: data.track_record_years ? parseInt(data.track_record_years) : null,
      performance_data_available: data.performance_data_available === "true",
      esg_policy_available: data.esg_policy_available === "true",
      pri_signatory: data.pri_signatory === "true",
      dei_policy_available: data.dei_policy_available === "true",
      sustainability_report_url: data.sustainability_report_url || null,
      status: data.status || "Active",
    });
  };

  const employeeCountOptions = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5000+"];
  const ownershipOptions = ["Independent", "Public", "Private Equity Owned", "Bank/Financial Institution", "Family Office", "Other"];
  const regulatoryStatusOptions = ["Registered", "Exempt", "Not Registered", "Pending", "Unknown"];
  const investmentStageOptions = ["Seed", "Early Stage", "Growth", "Late Stage", "Buyout", "Turnaround", "All Stages"];
  const geographyOptions = ["North America", "Europe", "Asia Pacific", "Global", "Latin America", "Middle East", "Africa", "Emerging Markets"];

  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
          <SectionHeader title="Basic Information" />
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="gp_name" render={({ field }) => (
              <FormItem><FormLabel>GP Name *</FormLabel><FormControl><Input {...field} placeholder="Firm display name" data-testid="input-gp-name" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="gp_legal_name" render={({ field }) => (
              <FormItem><FormLabel>Legal Name</FormLabel><FormControl><Input {...field} placeholder="Legal entity name" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="gp_short_name" render={({ field }) => (
              <FormItem><FormLabel>Short Name</FormLabel><FormControl><Input {...field} placeholder="Abbreviation" /></FormControl></FormItem>
            )} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="firm_type" render={({ field }) => (
              <FormItem><FormLabel>Firm Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                  <SelectContent>{firmTypeOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="year_founded" render={({ field }) => (
              <FormItem><FormLabel>Year Founded</FormLabel><FormControl><Input {...field} type="number" placeholder="e.g., 2005" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="ownership_type" render={({ field }) => (
              <FormItem><FormLabel>Ownership Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                  <SelectContent>{ownershipOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
          </div>

          <SectionHeader title="Location" />
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="headquarters_country" render={({ field }) => (
              <FormItem><FormLabel>HQ Country</FormLabel><FormControl><Input {...field} placeholder="Country" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="headquarters_city" render={({ field }) => (
              <FormItem><FormLabel>HQ City</FormLabel><FormControl><Input {...field} placeholder="City" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="operating_regions" render={({ field }) => (
              <FormItem><FormLabel>Operating Regions</FormLabel><FormControl><Input {...field} placeholder="e.g., North America, Europe" /></FormControl></FormItem>
            )} />
          </div>
          <FormField control={form.control} name="office_locations" render={({ field }) => (
            <FormItem><FormLabel>Office Locations</FormLabel><FormControl><Input {...field} placeholder="e.g., New York, London, Hong Kong" /></FormControl></FormItem>
          )} />

          <SectionHeader title="Contact Information" />
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} type="email" placeholder="contact@firm.com" data-testid="input-gp-email" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} placeholder="+1 (555) 000-0000" data-testid="input-gp-phone" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="linkedin_url" render={({ field }) => (
              <FormItem><FormLabel>LinkedIn URL</FormLabel><FormControl><Input {...field} placeholder="https://linkedin.com/company/..." data-testid="input-gp-linkedin" /></FormControl></FormItem>
            )} />
          </div>

          <SectionHeader title="Regulatory" />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="regulatory_status" render={({ field }) => (
              <FormItem><FormLabel>Regulatory Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                  <SelectContent>{regulatoryStatusOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="primary_regulator" render={({ field }) => (
              <FormItem><FormLabel>Primary Regulator</FormLabel><FormControl><Input {...field} placeholder="e.g., SEC, FCA" /></FormControl></FormItem>
            )} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="registration_number" render={({ field }) => (
              <FormItem><FormLabel>Registration Number</FormLabel><FormControl><Input {...field} placeholder="Registration #" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="registration_jurisdiction" render={({ field }) => (
              <FormItem><FormLabel>Registration Jurisdiction</FormLabel><FormControl><Input {...field} placeholder="e.g., Delaware, Cayman Islands" /></FormControl></FormItem>
            )} />
          </div>

          <SectionHeader title="AUM & Strategy" />
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="total_aum" render={({ field }) => (
              <FormItem><FormLabel>Total AUM</FormLabel><FormControl><Input {...field} type="number" placeholder="e.g., 5000000000" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="aum_currency" render={({ field }) => (
              <FormItem><FormLabel>Currency</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{currencyOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="primary_asset_classes" render={({ field }) => (
              <FormItem><FormLabel>Primary Asset Classes</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                  <SelectContent>{assetClassOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="investment_stages" render={({ field }) => (
              <FormItem><FormLabel>Investment Stages</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                  <SelectContent>{investmentStageOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="industry_focus" render={({ field }) => (
              <FormItem><FormLabel>Industry Focus</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                  <SelectContent>{industryOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="geographic_focus" render={({ field }) => (
              <FormItem><FormLabel>Geographic Focus</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                  <SelectContent>{geographyOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
          </div>

          <SectionHeader title="Fund Activity" />
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="number_of_funds" render={({ field }) => (
              <FormItem><FormLabel>Number of Funds</FormLabel><FormControl><Input {...field} type="number" placeholder="0" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="active_funds_count" render={({ field }) => (
              <FormItem><FormLabel>Active Funds</FormLabel><FormControl><Input {...field} type="number" placeholder="0" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="total_capital_raised" render={({ field }) => (
              <FormItem><FormLabel>Total Capital Raised</FormLabel><FormControl><Input {...field} type="number" placeholder="0" /></FormControl></FormItem>
            )} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="first_fund_vintage" render={({ field }) => (
              <FormItem><FormLabel>First Fund Vintage</FormLabel><FormControl><Input {...field} type="number" placeholder="e.g., 2005" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="latest_fund_vintage" render={({ field }) => (
              <FormItem><FormLabel>Latest Fund Vintage</FormLabel><FormControl><Input {...field} type="number" placeholder="e.g., 2024" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="estimated_deal_count" render={({ field }) => (
              <FormItem><FormLabel>Est. Deal Count</FormLabel><FormControl><Input {...field} type="number" placeholder="0" /></FormControl></FormItem>
            )} />
          </div>

          <SectionHeader title="Organization" />
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="parent_company" render={({ field }) => (
              <FormItem><FormLabel>Parent Company</FormLabel><FormControl><Input {...field} placeholder="Parent company name" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="advisory_arms" render={({ field }) => (
              <FormItem><FormLabel>Advisory Arms</FormLabel><FormControl><Input {...field} placeholder="Advisory businesses" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="employee_count_band" render={({ field }) => (
              <FormItem><FormLabel>Employee Count</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                  <SelectContent>{employeeCountOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="investment_professionals_count" render={({ field }) => (
              <FormItem><FormLabel>Investment Professionals</FormLabel><FormControl><Input {...field} type="number" placeholder="0" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="senior_investment_professionals_count" render={({ field }) => (
              <FormItem><FormLabel>Senior Investment Professionals</FormLabel><FormControl><Input {...field} type="number" placeholder="0" /></FormControl></FormItem>
            )} />
          </div>

          <SectionHeader title="Performance" />
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="top_quartile_flag" render={({ field }) => (
              <FormItem><FormLabel>Top Quartile</FormLabel><FormControl><Input {...field} placeholder="e.g., Yes, No, Mixed" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="track_record_years" render={({ field }) => (
              <FormItem><FormLabel>Track Record (Years)</FormLabel><FormControl><Input {...field} type="number" placeholder="0" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="performance_data_available" render={({ field }) => (
              <FormItem><FormLabel>Performance Data Available</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent><SelectItem value="true">Yes</SelectItem><SelectItem value="false">No</SelectItem></SelectContent>
                </Select></FormItem>
            )} />
          </div>

          <SectionHeader title="ESG & Sustainability" />
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="esg_policy_available" render={({ field }) => (
              <FormItem><FormLabel>ESG Policy</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent><SelectItem value="true">Available</SelectItem><SelectItem value="false">Not Available</SelectItem></SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="pri_signatory" render={({ field }) => (
              <FormItem><FormLabel>PRI Signatory</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent><SelectItem value="true">Yes</SelectItem><SelectItem value="false">No</SelectItem></SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="dei_policy_available" render={({ field }) => (
              <FormItem><FormLabel>DEI Policy</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent><SelectItem value="true">Available</SelectItem><SelectItem value="false">Not Available</SelectItem></SelectContent>
                </Select></FormItem>
            )} />
          </div>
          <FormField control={form.control} name="sustainability_report_url" render={({ field }) => (
            <FormItem><FormLabel>Sustainability Report URL</FormLabel><FormControl><Input {...field} placeholder="https://" /></FormControl></FormItem>
          )} />

          <SectionHeader title="Contact & Status" />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="website" render={({ field }) => (
              <FormItem><FormLabel>Website</FormLabel><FormControl><Input {...field} placeholder="https://example.com" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem><FormLabel>Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem><SelectItem value="Prospect">Prospect</SelectItem></SelectContent>
                </Select></FormItem>
            )} />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} data-testid="button-submit-gp">
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? "Save Changes" : "Add GP Firm"}
            </Button>
          </div>
        </form>
      </Form>
    </ScrollArea>
  );
}

function GpFirmFullView({ gp, onClose }: { gp: any; onClose: () => void }) {
  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <div className="space-y-2">
        <SectionHeader title="Basic Information" />
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="GP Name" value={gp.gp_name} />
          <FieldDisplay label="Legal Name" value={gp.gp_legal_name} />
          <FieldDisplay label="Short Name" value={gp.gp_short_name} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="Firm Type" value={gp.firm_type} />
          <FieldDisplay label="Year Founded" value={gp.year_founded} />
          <FieldDisplay label="Ownership Type" value={gp.ownership_type} />
        </div>

        <SectionHeader title="Location" />
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="HQ Country" value={gp.headquarters_country} />
          <FieldDisplay label="HQ City" value={gp.headquarters_city} />
          <FieldDisplay label="Operating Regions" value={gp.operating_regions} />
        </div>
        <FieldDisplay label="Office Locations" value={gp.office_locations} />

        <SectionHeader title="Contact Information" />
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="Email" value={gp.email} />
          <FieldDisplay label="Phone" value={gp.phone} />
          <FieldDisplay label="LinkedIn" value={gp.linkedin_url} isLink />
        </div>

        <SectionHeader title="Regulatory" />
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Regulatory Status" value={gp.regulatory_status} />
          <FieldDisplay label="Primary Regulator" value={gp.primary_regulator} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Registration Number" value={gp.registration_number} />
          <FieldDisplay label="Registration Jurisdiction" value={gp.registration_jurisdiction} />
        </div>

        <SectionHeader title="AUM & Strategy" />
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="Total AUM" value={gp.total_aum ? `${gp.total_aum} ${gp.aum_currency || "USD"}` : null} />
          <FieldDisplay label="Currency" value={gp.aum_currency} />
          <FieldDisplay label="Primary Asset Classes" value={gp.primary_asset_classes} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="Investment Stages" value={gp.investment_stages} />
          <FieldDisplay label="Industry Focus" value={gp.industry_focus} />
          <FieldDisplay label="Geographic Focus" value={gp.geographic_focus} />
        </div>

        <SectionHeader title="Fund Activity" />
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="Number of Funds" value={gp.number_of_funds} />
          <FieldDisplay label="Active Funds" value={gp.active_funds_count} />
          <FieldDisplay label="Total Capital Raised" value={gp.total_capital_raised} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="First Fund Vintage" value={gp.first_fund_vintage} />
          <FieldDisplay label="Latest Fund Vintage" value={gp.latest_fund_vintage} />
          <FieldDisplay label="Est. Deal Count" value={gp.estimated_deal_count} />
        </div>

        <SectionHeader title="Organization" />
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="Parent Company" value={gp.parent_company} />
          <FieldDisplay label="Advisory Arms" value={gp.advisory_arms} />
          <FieldDisplay label="Employee Count" value={gp.employee_count_band} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Investment Professionals" value={gp.investment_professionals_count} />
          <FieldDisplay label="Senior Investment Professionals" value={gp.senior_investment_professionals_count} />
        </div>

        <SectionHeader title="Performance" />
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="Top Quartile" value={gp.top_quartile_flag} />
          <FieldDisplay label="Track Record (Years)" value={gp.track_record_years} />
          <div>
            <p className="text-sm text-muted-foreground">Performance Data Available</p>
            <Badge variant={gp.performance_data_available ? "default" : "secondary"}>
              {gp.performance_data_available ? "Yes" : "No"}
            </Badge>
          </div>
        </div>

        <SectionHeader title="ESG & Sustainability" />
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">ESG Policy</p>
            <Badge variant={gp.esg_policy_available ? "default" : "secondary"}>
              {gp.esg_policy_available ? "Available" : "Not Available"}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">PRI Signatory</p>
            <Badge variant={gp.pri_signatory ? "default" : "secondary"}>
              {gp.pri_signatory ? "Yes" : "No"}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">DEI Policy</p>
            <Badge variant={gp.dei_policy_available ? "default" : "secondary"}>
              {gp.dei_policy_available ? "Available" : "Not Available"}
            </Badge>
          </div>
        </div>
        <FieldDisplay label="Sustainability Report" value={gp.sustainability_report_url} isLink />

        <SectionHeader title="Data Quality" />
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="Confidence Score" value={gp.data_confidence_score} />
          <FieldDisplay label="Verification Method" value={gp.verification_method} />
          <FieldDisplay label="Last Verified" value={gp.last_verified_date} />
        </div>
        <FieldDisplay label="Source Coverage" value={gp.source_coverage} />

        <SectionHeader title="Linked Entities" />
        <div className="grid grid-cols-4 gap-4">
          <FieldDisplay label="Funds" value={gp.linked_funds_count} />
          <FieldDisplay label="LPs" value={gp.linked_lps_count} />
          <FieldDisplay label="Portfolio Cos" value={gp.linked_portfolio_companies_count} />
          <FieldDisplay label="Service Providers" value={gp.linked_service_providers_count} />
        </div>

        <SectionHeader title="Contact & Status" />
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Website" value={gp.website} isLink />
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge className={statusColors[gp.status || "active"]}>{gp.status || "active"}</Badge>
          </div>
        </div>

        <SectionHeader title="URLs" />
        <EntityUrlsSection entityType="gp" entityId={gp.id} />

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </ScrollArea>
  );
}

function FirmContactsSection({ 
  entityType, 
  entityId, 
  entityName 
}: { 
  entityType: string; 
  entityId: string; 
  entityName: string;
}) {
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [isLinkContactOpen, setIsLinkContactOpen] = useState(false);
  const { toast } = useToast();

  const { data: linkedContacts = [], isLoading } = useQuery<CrmContact[]>({
    queryKey: ["/api/crm/contacts", { linked_entity_type: entityType, linked_entity_id: entityId }],
    queryFn: async () => {
      const res = await fetch(`/api/crm/contacts?linked_entity_type=${entityType}&linked_entity_id=${entityId}`);
      if (!res.ok) throw new Error("Failed to fetch contacts");
      return res.json();
    },
  });

  const { data: availableContacts = [] } = useQuery<CrmContact[]>({
    queryKey: ["/api/crm/contacts", "unlinked"],
    queryFn: async () => {
      const res = await fetch(`/api/crm/contacts?unlinked=true`);
      if (!res.ok) throw new Error("Failed to fetch contacts");
      return res.json();
    },
    enabled: isLinkContactOpen,
  });

  const createContactMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("POST", "/api/crm/contacts", {
        ...data,
        linked_entity_type: entityType,
        linked_entity_id: entityId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      setIsAddContactOpen(false);
      toast({ title: "Contact created", description: `Contact added to ${entityName}` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const linkContactMutation = useMutation({
    mutationFn: async ({ contactId, relationshipType }: { contactId: string; relationshipType: string }) => {
      const res = await apiRequest("PATCH", `/api/crm/contacts/${contactId}/link`, {
        linked_entity_type: entityType,
        linked_entity_id: entityId,
        relationship_type: relationshipType,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      setIsLinkContactOpen(false);
      toast({ title: "Contact linked", description: `Contact linked to ${entityName}` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getVerificationIcon = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "verified":
        return <CheckCircle className="h-3 w-3 text-green-600" />;
      case "pending":
        return <Clock className="h-3 w-3 text-amber-600" />;
      default:
        return <AlertCircle className="h-3 w-3 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Contacts linked to this firm ({linkedContacts.length})
        </p>
        <div className="flex gap-2">
          <Dialog open={isLinkContactOpen} onOpenChange={setIsLinkContactOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-link-contact">
                <Link2 className="h-4 w-4 mr-1" />
                Link Existing
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Link Existing Contact</DialogTitle>
                <DialogDescription>Select a contact to link to {entityName}</DialogDescription>
              </DialogHeader>
              <LinkContactForm 
                contacts={availableContacts} 
                onLink={(contactId, relationshipType) => linkContactMutation.mutate({ contactId, relationshipType })}
                isPending={linkContactMutation.isPending}
                onCancel={() => setIsLinkContactOpen(false)}
              />
            </DialogContent>
          </Dialog>

          <Dialog open={isAddContactOpen} onOpenChange={setIsAddContactOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-contact">
                <UserPlus className="h-4 w-4 mr-1" />
                Add New Contact
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Contact</DialogTitle>
                <DialogDescription>Create a new contact for {entityName}</DialogDescription>
              </DialogHeader>
              <ContactForm 
                onSubmit={(data) => createContactMutation.mutate(data)}
                isPending={createContactMutation.isPending}
                onCancel={() => setIsAddContactOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <ScrollArea className="max-h-[50vh]">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : linkedContacts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No contacts linked to this firm yet.</p>
            <p className="text-sm">Add a new contact or link an existing one.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {linkedContacts.map((contact) => (
              <Card key={contact.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {contact.first_name} {contact.last_name}
                      </span>
                      {getVerificationIcon(contact.verification_status)}
                    </div>
                    {contact.title && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Briefcase className="h-3 w-3" />
                        {contact.title}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-1">
                      {contact.email && (
                        <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                          <Mail className="h-3 w-3" />
                          {contact.email}
                        </a>
                      )}
                      {contact.phone && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {contact.phone}
                        </span>
                      )}
                      {contact.linkedin_url && (
                        <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                          <Linkedin className="h-3 w-3" />
                          LinkedIn
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {contact.seniority_level && (
                      <Badge variant="outline" className="text-xs">{contact.seniority_level}</Badge>
                    )}
                    {contact.relationship_type && (
                      <Badge variant="secondary" className="text-xs">{contact.relationship_type}</Badge>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function ContactForm({
  onSubmit,
  isPending,
  onCancel,
}: {
  onSubmit: (data: Record<string, any>) => void;
  isPending: boolean;
  onCancel: () => void;
}) {
  const form = useForm({
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      title: "",
      seniority_level: "",
      department: "",
      relationship_type: "",
      linkedin_url: "",
      notes: "",
    },
  });

  const handleSubmit = (data: any) => {
    onSubmit({
      first_name: data.first_name,
      last_name: data.last_name || null,
      email: data.email || null,
      phone: data.phone || null,
      title: data.title || null,
      seniority_level: data.seniority_level || null,
      department: data.department || null,
      relationship_type: data.relationship_type || null,
      linkedin_url: data.linkedin_url || null,
      notes: data.notes || null,
    });
  };

  return (
    <ScrollArea className="max-h-[60vh] pr-4">
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="first_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="First name" data-testid="input-contact-first-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="last_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Last name" data-testid="input-contact-last-name" />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" placeholder="email@example.com" data-testid="input-contact-email" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="+1 (555) 000-0000" data-testid="input-contact-phone" />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title / Role</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g., Partner, Managing Director" data-testid="input-contact-title" />
                </FormControl>
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="seniority_level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Seniority Level</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-seniority">
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {seniorityOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="relationship_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Relationship Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-relationship">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {relationshipOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="linkedin_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>LinkedIn URL</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="https://linkedin.com/in/..." data-testid="input-contact-linkedin" />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea {...field} placeholder="Additional notes..." data-testid="input-contact-notes" />
                </FormControl>
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} data-testid="button-submit-contact">
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Contact
            </Button>
          </div>
        </form>
      </Form>
    </ScrollArea>
  );
}

function LinkContactForm({
  contacts,
  onLink,
  isPending,
  onCancel,
}: {
  contacts: CrmContact[];
  onLink: (contactId: string, relationshipType: string) => void;
  isPending: boolean;
  onCancel: () => void;
}) {
  const [selectedContactId, setSelectedContactId] = useState("");
  const [relationshipType, setRelationshipType] = useState("");

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Select Contact</label>
        <Select value={selectedContactId} onValueChange={setSelectedContactId}>
          <SelectTrigger className="mt-1" data-testid="select-link-contact">
            <SelectValue placeholder="Choose a contact to link" />
          </SelectTrigger>
          <SelectContent>
            {contacts.length === 0 ? (
              <SelectItem value="none" disabled>No unlinked contacts available</SelectItem>
            ) : (
              contacts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.first_name} {c.last_name} {c.title ? `- ${c.title}` : ""}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium">Relationship Type</label>
        <Select value={relationshipType} onValueChange={setRelationshipType}>
          <SelectTrigger className="mt-1" data-testid="select-link-relationship">
            <SelectValue placeholder="Select relationship type" />
          </SelectTrigger>
          <SelectContent>
            {relationshipOptions.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          disabled={isPending || !selectedContactId} 
          onClick={() => onLink(selectedContactId, relationshipType)}
          data-testid="button-confirm-link"
        >
          {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Link Contact
        </Button>
      </div>
    </div>
  );
}

function LpFirmsTab({ searchQuery }: { searchQuery: string }) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedFirm, setSelectedFirm] = useState<CrmLp | null>(null);
  const [dialogMode, setDialogMode] = useState<"view" | "edit" | "contacts">("view");
  const { toast } = useToast();

  const { data: lps = [], isLoading, error } = useQuery<CrmLp[]>({
    queryKey: ["/api/crm/lps"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("POST", "/api/crm/lps", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/lps"] });
      setIsAddDialogOpen(false);
      toast({ title: "LP Firm created", description: "The LP firm has been added successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error creating LP", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      const res = await apiRequest("PATCH", `/api/crm/lps/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/lps"] });
      setDialogMode("view");
      toast({ title: "LP Firm updated", description: "Changes have been saved successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating LP", description: error.message, variant: "destructive" });
    },
  });

  const filteredData = lps.filter((lp) =>
    lp.lp_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lp.lp_legal_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns = [
    {
      key: "lp_name",
      header: "Firm Name",
      sortable: true,
      render: (lp: CrmLp) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <div>
            <span className="font-medium">{lp.lp_name || "-"}</span>
            <p className="text-xs text-muted-foreground">Click to view full profile</p>
          </div>
        </div>
      ),
    },
    {
      key: "investor_type",
      header: "Investor Type",
      render: (lp: CrmLp) => <Badge variant="secondary">{lp.investor_type || "-"}</Badge>,
    },
    {
      key: "headquarters",
      header: "Location",
      render: (lp: CrmLp) => (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {lp.headquarters_city && lp.headquarters_country
            ? `${lp.headquarters_city}, ${lp.headquarters_country}`
            : lp.headquarters_country || lp.headquarters_city || "-"}
        </div>
      ),
    },
    {
      key: "total_aum",
      header: "AUM",
      render: (lp: CrmLp) => (
        <div className="flex items-center gap-1">
          <DollarSign className="h-3 w-3 text-muted-foreground" />
          {lp.total_aum ? `${lp.total_aum} ${lp.aum_currency || "USD"}` : "-"}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (lp: CrmLp) => (
        <Badge className={statusColors[lp.status || "active"] || statusColors.active}>
          {lp.status || "active"}
        </Badge>
      ),
    },
  ];

  const openFirmDialog = (firm: CrmLp, mode: "view" | "edit" | "contacts") => {
    setSelectedFirm(firm);
    setDialogMode(mode);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-8 text-destructive">Failed to load LP firms.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-lp">
              <Plus className="h-4 w-4 mr-2" />
              Add LP
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Add New Limited Partner</DialogTitle>
            </DialogHeader>
            <LpFirmForm onSubmit={(data) => createMutation.mutate(data)} isPending={createMutation.isPending} onCancel={() => setIsAddDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        data={filteredData}
        columns={columns}
        onView={(lp) => openFirmDialog(lp, "view")}
        onEdit={(lp) => openFirmDialog(lp, "edit")}
        emptyMessage="No LP firms found"
      />

      <Dialog open={!!selectedFirm} onOpenChange={() => setSelectedFirm(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader className="pb-0">
            <div className="flex items-center justify-between gap-4">
              <div>
                <DialogTitle className="text-xl">{selectedFirm?.lp_name}</DialogTitle>
                <DialogDescription>
                  {selectedFirm?.lp_legal_name && <span className="text-sm">{selectedFirm.lp_legal_name}</span>}
                </DialogDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={dialogMode === "view" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDialogMode("view")}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
                <Button
                  variant={dialogMode === "edit" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDialogMode("edit")}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant={dialogMode === "contacts" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDialogMode("contacts")}
                >
                  <Users className="h-4 w-4 mr-1" />
                  Contacts
                </Button>
              </div>
            </div>
          </DialogHeader>
          
          {selectedFirm && dialogMode === "view" && (
            <LpFirmFullView lp={selectedFirm} onClose={() => setSelectedFirm(null)} />
          )}
          {selectedFirm && dialogMode === "edit" && (
            <LpFirmForm
              defaultValues={selectedFirm}
              onSubmit={(data) => {
                updateMutation.mutate({ id: selectedFirm.id, data });
              }}
              isPending={updateMutation.isPending}
              onCancel={() => setDialogMode("view")}
              isEdit
            />
          )}
          {selectedFirm && dialogMode === "contacts" && (
            <FirmContactsSection 
              entityType="lp" 
              entityId={selectedFirm.id} 
              entityName={selectedFirm.lp_name}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LpFirmForm({
  defaultValues,
  onSubmit,
  isPending,
  onCancel,
  isEdit = false,
}: {
  defaultValues?: any;
  onSubmit: (data: Record<string, any>) => void;
  isPending: boolean;
  onCancel: () => void;
  isEdit?: boolean;
}) {
  const dv = defaultValues || {};
  const form = useForm({
    defaultValues: {
      lp_name: dv.lp_name || "",
      lp_legal_name: dv.lp_legal_name || "",
      lp_short_name: dv.lp_short_name || "",
      firm_type: dv.firm_type || "",
      investor_type: dv.investor_type || "",
      year_founded: dv.year_founded?.toString() || "",
      headquarters_country: dv.headquarters_country || "",
      headquarters_city: dv.headquarters_city || "",
      operating_regions: dv.operating_regions || "",
      office_locations: dv.office_locations || "",
      website: dv.website || "",
      email: dv.email || "",
      phone: dv.phone || "",
      linkedin_url: dv.linkedin_url || "",
      regulatory_status: dv.regulatory_status || "",
      primary_regulator: dv.primary_regulator || "",
      registration_number: dv.registration_number || "",
      registration_jurisdiction: dv.registration_jurisdiction || "",
      total_aum: dv.total_aum?.toString() || "",
      aum_currency: dv.aum_currency || "USD",
      pe_allocation_percentage: dv.pe_allocation_percentage?.toString() || "",
      pe_allocation_amount: dv.pe_allocation_amount?.toString() || "",
      primary_asset_classes: dv.primary_asset_classes || "",
      investment_stages: dv.investment_stages || "",
      industry_focus: dv.industry_focus || "",
      geographic_focus: dv.geographic_focus || "",
      min_fund_size: dv.min_fund_size?.toString() || "",
      max_fund_size: dv.max_fund_size?.toString() || "",
      min_commitment_size: dv.min_commitment_size?.toString() || "",
      max_commitment_size: dv.max_commitment_size?.toString() || "",
      number_of_gp_relationships: dv.number_of_gp_relationships?.toString() || "",
      active_commitments_count: dv.active_commitments_count?.toString() || "",
      total_commitments: dv.total_commitments?.toString() || "",
      ownership_type: dv.ownership_type || "",
      parent_organization: dv.parent_organization || "",
      decision_makers_count: dv.decision_makers_count?.toString() || "",
      investment_professionals_count: dv.investment_professionals_count?.toString() || "",
      esg_policy_available: dv.esg_policy_available ? "true" : "false",
      pri_signatory: dv.pri_signatory ? "true" : "false",
      dei_policy_available: dv.dei_policy_available ? "true" : "false",
      sustainability_report_url: dv.sustainability_report_url || "",
      status: dv.status || "Active",
    },
  });

  const handleSubmit = (data: any) => {
    onSubmit({
      lp_name: data.lp_name || null,
      lp_legal_name: data.lp_legal_name || null,
      lp_short_name: data.lp_short_name || null,
      firm_type: data.firm_type || null,
      investor_type: data.investor_type || null,
      year_founded: data.year_founded ? parseInt(data.year_founded) : null,
      headquarters_country: data.headquarters_country || null,
      headquarters_city: data.headquarters_city || null,
      operating_regions: data.operating_regions || null,
      office_locations: data.office_locations || null,
      website: data.website || null,
      email: data.email || null,
      phone: data.phone || null,
      linkedin_url: data.linkedin_url || null,
      regulatory_status: data.regulatory_status || null,
      primary_regulator: data.primary_regulator || null,
      registration_number: data.registration_number || null,
      registration_jurisdiction: data.registration_jurisdiction || null,
      total_aum: data.total_aum ? parseFloat(data.total_aum) : null,
      aum_currency: data.aum_currency || null,
      pe_allocation_percentage: data.pe_allocation_percentage ? parseFloat(data.pe_allocation_percentage) : null,
      pe_allocation_amount: data.pe_allocation_amount ? parseFloat(data.pe_allocation_amount) : null,
      primary_asset_classes: data.primary_asset_classes || null,
      investment_stages: data.investment_stages || null,
      industry_focus: data.industry_focus || null,
      geographic_focus: data.geographic_focus || null,
      min_fund_size: data.min_fund_size ? parseFloat(data.min_fund_size) : null,
      max_fund_size: data.max_fund_size ? parseFloat(data.max_fund_size) : null,
      min_commitment_size: data.min_commitment_size ? parseFloat(data.min_commitment_size) : null,
      max_commitment_size: data.max_commitment_size ? parseFloat(data.max_commitment_size) : null,
      number_of_gp_relationships: data.number_of_gp_relationships ? parseInt(data.number_of_gp_relationships) : null,
      active_commitments_count: data.active_commitments_count ? parseInt(data.active_commitments_count) : null,
      total_commitments: data.total_commitments ? parseFloat(data.total_commitments) : null,
      ownership_type: data.ownership_type || null,
      parent_organization: data.parent_organization || null,
      decision_makers_count: data.decision_makers_count ? parseInt(data.decision_makers_count) : null,
      investment_professionals_count: data.investment_professionals_count ? parseInt(data.investment_professionals_count) : null,
      esg_policy_available: data.esg_policy_available === "true",
      pri_signatory: data.pri_signatory === "true",
      dei_policy_available: data.dei_policy_available === "true",
      sustainability_report_url: data.sustainability_report_url || null,
      status: data.status || "Active",
    });
  };

  const ownershipOptions = ["Public", "Private", "Government", "Non-Profit", "Family Office", "Other"];
  const regulatoryStatusOptions = ["Registered", "Exempt", "Not Registered", "Pending", "Unknown"];
  const investmentStageOptions = ["Seed", "Early Stage", "Growth", "Late Stage", "Buyout", "Secondaries", "All Stages"];
  const geographyOptions = ["North America", "Europe", "Asia Pacific", "Global", "Latin America", "Middle East", "Africa", "Emerging Markets"];

  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
          <SectionHeader title="Basic Information" />
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="lp_name" render={({ field }) => (
              <FormItem><FormLabel>LP Name *</FormLabel><FormControl><Input {...field} placeholder="LP display name" data-testid="input-lp-name" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="lp_legal_name" render={({ field }) => (
              <FormItem><FormLabel>Legal Name</FormLabel><FormControl><Input {...field} placeholder="Legal entity name" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="lp_short_name" render={({ field }) => (
              <FormItem><FormLabel>Short Name</FormLabel><FormControl><Input {...field} placeholder="Abbreviation" /></FormControl></FormItem>
            )} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="firm_type" render={({ field }) => (
              <FormItem><FormLabel>Firm Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                  <SelectContent>{firmTypeOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="investor_type" render={({ field }) => (
              <FormItem><FormLabel>Investor Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                  <SelectContent>{investorTypeOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="year_founded" render={({ field }) => (
              <FormItem><FormLabel>Year Founded</FormLabel><FormControl><Input {...field} type="number" placeholder="e.g., 1990" /></FormControl></FormItem>
            )} />
          </div>

          <SectionHeader title="Location" />
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="headquarters_country" render={({ field }) => (
              <FormItem><FormLabel>HQ Country</FormLabel><FormControl><Input {...field} placeholder="Country" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="headquarters_city" render={({ field }) => (
              <FormItem><FormLabel>HQ City</FormLabel><FormControl><Input {...field} placeholder="City" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="operating_regions" render={({ field }) => (
              <FormItem><FormLabel>Operating Regions</FormLabel><FormControl><Input {...field} placeholder="e.g., North America, Europe" /></FormControl></FormItem>
            )} />
          </div>
          <FormField control={form.control} name="office_locations" render={({ field }) => (
            <FormItem><FormLabel>Office Locations</FormLabel><FormControl><Input {...field} placeholder="e.g., New York, London" /></FormControl></FormItem>
          )} />

          <SectionHeader title="Contact Information" />
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} type="email" placeholder="contact@firm.com" data-testid="input-lp-email" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} placeholder="+1 (555) 000-0000" data-testid="input-lp-phone" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="linkedin_url" render={({ field }) => (
              <FormItem><FormLabel>LinkedIn URL</FormLabel><FormControl><Input {...field} placeholder="https://linkedin.com/company/..." data-testid="input-lp-linkedin" /></FormControl></FormItem>
            )} />
          </div>

          <SectionHeader title="Regulatory" />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="regulatory_status" render={({ field }) => (
              <FormItem><FormLabel>Regulatory Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                  <SelectContent>{regulatoryStatusOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="primary_regulator" render={({ field }) => (
              <FormItem><FormLabel>Primary Regulator</FormLabel><FormControl><Input {...field} placeholder="e.g., SEC" /></FormControl></FormItem>
            )} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="registration_number" render={({ field }) => (
              <FormItem><FormLabel>Registration Number</FormLabel><FormControl><Input {...field} placeholder="Registration #" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="registration_jurisdiction" render={({ field }) => (
              <FormItem><FormLabel>Registration Jurisdiction</FormLabel><FormControl><Input {...field} placeholder="e.g., Delaware" /></FormControl></FormItem>
            )} />
          </div>

          <SectionHeader title="AUM & Allocation" />
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="total_aum" render={({ field }) => (
              <FormItem><FormLabel>Total AUM</FormLabel><FormControl><Input {...field} type="number" placeholder="0" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="aum_currency" render={({ field }) => (
              <FormItem><FormLabel>Currency</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{currencyOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="pe_allocation_percentage" render={({ field }) => (
              <FormItem><FormLabel>PE Allocation %</FormLabel><FormControl><Input {...field} type="number" placeholder="0" /></FormControl></FormItem>
            )} />
          </div>
          <FormField control={form.control} name="pe_allocation_amount" render={({ field }) => (
            <FormItem><FormLabel>PE Allocation Amount</FormLabel><FormControl><Input {...field} type="number" placeholder="0" /></FormControl></FormItem>
          )} />

          <SectionHeader title="Investment Preferences" />
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="primary_asset_classes" render={({ field }) => (
              <FormItem><FormLabel>Primary Asset Classes</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                  <SelectContent>{assetClassOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="investment_stages" render={({ field }) => (
              <FormItem><FormLabel>Investment Stages</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                  <SelectContent>{investmentStageOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="industry_focus" render={({ field }) => (
              <FormItem><FormLabel>Industry Focus</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                  <SelectContent>{industryOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="geographic_focus" render={({ field }) => (
              <FormItem><FormLabel>Geographic Focus</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                  <SelectContent>{geographyOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
          </div>
          <div className="grid grid-cols-4 gap-4">
            <FormField control={form.control} name="min_fund_size" render={({ field }) => (
              <FormItem><FormLabel>Min Fund Size</FormLabel><FormControl><Input {...field} type="number" placeholder="0" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="max_fund_size" render={({ field }) => (
              <FormItem><FormLabel>Max Fund Size</FormLabel><FormControl><Input {...field} type="number" placeholder="0" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="min_commitment_size" render={({ field }) => (
              <FormItem><FormLabel>Min Commitment</FormLabel><FormControl><Input {...field} type="number" placeholder="0" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="max_commitment_size" render={({ field }) => (
              <FormItem><FormLabel>Max Commitment</FormLabel><FormControl><Input {...field} type="number" placeholder="0" /></FormControl></FormItem>
            )} />
          </div>

          <SectionHeader title="Relationships" />
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="number_of_gp_relationships" render={({ field }) => (
              <FormItem><FormLabel>GP Relationships</FormLabel><FormControl><Input {...field} type="number" placeholder="0" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="active_commitments_count" render={({ field }) => (
              <FormItem><FormLabel>Active Commitments</FormLabel><FormControl><Input {...field} type="number" placeholder="0" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="total_commitments" render={({ field }) => (
              <FormItem><FormLabel>Total Commitments</FormLabel><FormControl><Input {...field} type="number" placeholder="0" /></FormControl></FormItem>
            )} />
          </div>

          <SectionHeader title="Organization" />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="ownership_type" render={({ field }) => (
              <FormItem><FormLabel>Ownership Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                  <SelectContent>{ownershipOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="parent_organization" render={({ field }) => (
              <FormItem><FormLabel>Parent Organization</FormLabel><FormControl><Input {...field} placeholder="Parent org name" /></FormControl></FormItem>
            )} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="decision_makers_count" render={({ field }) => (
              <FormItem><FormLabel>Decision Makers</FormLabel><FormControl><Input {...field} type="number" placeholder="0" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="investment_professionals_count" render={({ field }) => (
              <FormItem><FormLabel>Investment Professionals</FormLabel><FormControl><Input {...field} type="number" placeholder="0" /></FormControl></FormItem>
            )} />
          </div>

          <SectionHeader title="ESG & Sustainability" />
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="esg_policy_available" render={({ field }) => (
              <FormItem><FormLabel>ESG Policy</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent><SelectItem value="true">Available</SelectItem><SelectItem value="false">Not Available</SelectItem></SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="pri_signatory" render={({ field }) => (
              <FormItem><FormLabel>PRI Signatory</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent><SelectItem value="true">Yes</SelectItem><SelectItem value="false">No</SelectItem></SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="dei_policy_available" render={({ field }) => (
              <FormItem><FormLabel>DEI Policy</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent><SelectItem value="true">Available</SelectItem><SelectItem value="false">Not Available</SelectItem></SelectContent>
                </Select></FormItem>
            )} />
          </div>
          <FormField control={form.control} name="sustainability_report_url" render={({ field }) => (
            <FormItem><FormLabel>Sustainability Report URL</FormLabel><FormControl><Input {...field} placeholder="https://" /></FormControl></FormItem>
          )} />

          <SectionHeader title="Contact & Status" />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="website" render={({ field }) => (
              <FormItem><FormLabel>Website</FormLabel><FormControl><Input {...field} placeholder="https://example.com" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem><FormLabel>Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem><SelectItem value="Prospect">Prospect</SelectItem></SelectContent>
                </Select></FormItem>
            )} />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit" disabled={isPending} data-testid="button-submit-lp">
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? "Save Changes" : "Create LP"}
            </Button>
          </div>
        </form>
      </Form>
    </ScrollArea>
  );
}

function LpFirmFullView({ lp, onClose }: { lp: any; onClose: () => void }) {
  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <div className="space-y-2">
        <SectionHeader title="Basic Information" />
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="LP Name" value={lp.lp_name} />
          <FieldDisplay label="Legal Name" value={lp.lp_legal_name} />
          <FieldDisplay label="Short Name" value={lp.lp_short_name} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="Firm Type" value={lp.firm_type} />
          <FieldDisplay label="Investor Type" value={lp.investor_type} />
          <FieldDisplay label="Year Founded" value={lp.year_founded} />
        </div>

        <SectionHeader title="Location" />
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="HQ Country" value={lp.headquarters_country} />
          <FieldDisplay label="HQ City" value={lp.headquarters_city} />
          <FieldDisplay label="Operating Regions" value={lp.operating_regions} />
        </div>
        <FieldDisplay label="Office Locations" value={lp.office_locations} />

        <SectionHeader title="Contact Information" />
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="Email" value={lp.email} />
          <FieldDisplay label="Phone" value={lp.phone} />
          <FieldDisplay label="LinkedIn" value={lp.linkedin_url} isLink />
        </div>

        <SectionHeader title="Regulatory" />
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Regulatory Status" value={lp.regulatory_status} />
          <FieldDisplay label="Primary Regulator" value={lp.primary_regulator} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Registration Number" value={lp.registration_number} />
          <FieldDisplay label="Registration Jurisdiction" value={lp.registration_jurisdiction} />
        </div>

        <SectionHeader title="AUM & Allocation" />
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="Total AUM" value={lp.total_aum ? `${lp.total_aum} ${lp.aum_currency || "USD"}` : null} />
          <FieldDisplay label="PE Allocation %" value={lp.pe_allocation_percentage} />
          <FieldDisplay label="PE Allocation Amount" value={lp.pe_allocation_amount} />
        </div>

        <SectionHeader title="Investment Preferences" />
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="Primary Asset Classes" value={lp.primary_asset_classes} />
          <FieldDisplay label="Investment Stages" value={lp.investment_stages} />
          <FieldDisplay label="Industry Focus" value={lp.industry_focus} />
        </div>
        <div className="grid grid-cols-4 gap-4">
          <FieldDisplay label="Min Fund Size" value={lp.min_fund_size} />
          <FieldDisplay label="Max Fund Size" value={lp.max_fund_size} />
          <FieldDisplay label="Min Commitment" value={lp.min_commitment_size} />
          <FieldDisplay label="Max Commitment" value={lp.max_commitment_size} />
        </div>
        <FieldDisplay label="Geographic Focus" value={lp.geographic_focus} />

        <SectionHeader title="Relationships" />
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="GP Relationships" value={lp.number_of_gp_relationships} />
          <FieldDisplay label="Active Commitments" value={lp.active_commitments_count} />
          <FieldDisplay label="Total Commitments" value={lp.total_commitments} />
        </div>

        <SectionHeader title="Organization" />
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Ownership Type" value={lp.ownership_type} />
          <FieldDisplay label="Parent Organization" value={lp.parent_organization} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Decision Makers" value={lp.decision_makers_count} />
          <FieldDisplay label="Investment Professionals" value={lp.investment_professionals_count} />
        </div>

        <SectionHeader title="ESG & Sustainability" />
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">ESG Policy</p>
            <Badge variant={lp.esg_policy_available ? "default" : "secondary"}>
              {lp.esg_policy_available ? "Available" : "Not Available"}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">PRI Signatory</p>
            <Badge variant={lp.pri_signatory ? "default" : "secondary"}>
              {lp.pri_signatory ? "Yes" : "No"}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">DEI Policy</p>
            <Badge variant={lp.dei_policy_available ? "default" : "secondary"}>
              {lp.dei_policy_available ? "Available" : "Not Available"}
            </Badge>
          </div>
        </div>
        <FieldDisplay label="Sustainability Report" value={lp.sustainability_report_url} isLink />

        <SectionHeader title="Data Quality" />
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="Confidence Score" value={lp.data_confidence_score} />
          <FieldDisplay label="Verification Method" value={lp.verification_method} />
          <FieldDisplay label="Last Verified" value={lp.last_verified_date} />
        </div>

        <SectionHeader title="Linked Entities" />
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="Funds" value={lp.linked_funds_count} />
          <FieldDisplay label="GPs" value={lp.linked_gps_count} />
          <FieldDisplay label="Service Providers" value={lp.linked_service_providers_count} />
        </div>

        <SectionHeader title="Contact & Status" />
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Website" value={lp.website} isLink />
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge className={statusColors[lp.status || "active"]}>{lp.status || "active"}</Badge>
          </div>
        </div>

        <SectionHeader title="URLs" />
        <EntityUrlsSection entityType="lp" entityId={lp.id} />

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </ScrollArea>
  );
}

function ServiceProvidersTab({ searchQuery }: { searchQuery: string }) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedFirm, setSelectedFirm] = useState<CrmServiceProvider | null>(null);
  const [dialogMode, setDialogMode] = useState<"view" | "edit" | "contacts">("view");
  const { toast } = useToast();

  const { data: sps = [], isLoading, error } = useQuery<CrmServiceProvider[]>({
    queryKey: ["/api/crm/service-providers"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("POST", "/api/crm/service-providers", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/service-providers"] });
      setIsAddDialogOpen(false);
      toast({ title: "Service Provider created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      const res = await apiRequest("PATCH", `/api/crm/service-providers/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/service-providers"] });
      setDialogMode("view");
      toast({ title: "Service Provider updated", description: "Changes have been saved successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating Service Provider", description: error.message, variant: "destructive" });
    },
  });

  const filteredData = sps.filter((sp) =>
    sp.provider_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns = [
    {
      key: "provider_name",
      header: "Provider Name",
      sortable: true,
      render: (sp: CrmServiceProvider) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <div>
            <span className="font-medium">{sp.provider_name || "-"}</span>
            <p className="text-xs text-muted-foreground">Click to view full profile</p>
          </div>
        </div>
      ),
    },
    {
      key: "provider_type",
      header: "Provider Type",
      render: (sp: CrmServiceProvider) => <Badge variant="secondary">{sp.provider_type || "-"}</Badge>,
    },
    {
      key: "headquarters",
      header: "Location",
      render: (sp: CrmServiceProvider) => (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {sp.headquarters_city && sp.headquarters_country
            ? `${sp.headquarters_city}, ${sp.headquarters_country}`
            : sp.headquarters_country || sp.headquarters_city || "-"}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (sp: CrmServiceProvider) => (
        <Badge className={statusColors[sp.status || "active"]}>
          {sp.status || "active"}
        </Badge>
      ),
    },
  ];

  const openFirmDialog = (firm: CrmServiceProvider, mode: "view" | "edit" | "contacts") => {
    setSelectedFirm(firm);
    setDialogMode(mode);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-8 text-destructive">Failed to load service providers.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-sp">
              <Plus className="h-4 w-4 mr-2" />
              Add Service Provider
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Add New Service Provider</DialogTitle>
            </DialogHeader>
            <ServiceProviderForm onSubmit={(data) => createMutation.mutate(data)} isPending={createMutation.isPending} onCancel={() => setIsAddDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        data={filteredData}
        columns={columns}
        onView={(sp) => openFirmDialog(sp, "view")}
        onEdit={(sp) => openFirmDialog(sp, "edit")}
        emptyMessage="No service providers found"
      />

      <Dialog open={!!selectedFirm} onOpenChange={() => setSelectedFirm(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader className="pb-0">
            <div className="flex items-center justify-between gap-4">
              <div>
                <DialogTitle className="text-xl">{selectedFirm?.provider_name}</DialogTitle>
                <DialogDescription>
                  {selectedFirm?.provider_type && <Badge variant="secondary">{selectedFirm.provider_type}</Badge>}
                </DialogDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={dialogMode === "view" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDialogMode("view")}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
                <Button
                  variant={dialogMode === "edit" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDialogMode("edit")}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant={dialogMode === "contacts" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDialogMode("contacts")}
                >
                  <Users className="h-4 w-4 mr-1" />
                  Contacts
                </Button>
              </div>
            </div>
          </DialogHeader>
          
          {selectedFirm && dialogMode === "view" && (
            <ServiceProviderFullView sp={selectedFirm} onClose={() => setSelectedFirm(null)} />
          )}
          {selectedFirm && dialogMode === "edit" && (
            <ServiceProviderForm
              defaultValues={selectedFirm}
              onSubmit={(data) => {
                updateMutation.mutate({ id: selectedFirm.id, data });
              }}
              isPending={updateMutation.isPending}
              onCancel={() => setDialogMode("view")}
              isEdit
            />
          )}
          {selectedFirm && dialogMode === "contacts" && (
            <FirmContactsSection 
              entityType="service_provider" 
              entityId={selectedFirm.id} 
              entityName={selectedFirm.provider_name}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ServiceProviderForm({
  defaultValues,
  onSubmit,
  isPending,
  onCancel,
  isEdit = false,
}: {
  defaultValues?: any;
  onSubmit: (data: Record<string, any>) => void;
  isPending: boolean;
  onCancel: () => void;
  isEdit?: boolean;
}) {
  const dv = defaultValues || {};
  const form = useForm({
    defaultValues: {
      provider_name: dv.provider_name || "",
      provider_legal_name: dv.provider_legal_name || "",
      provider_short_name: dv.provider_short_name || "",
      provider_type: dv.provider_type || "",
      year_founded: dv.year_founded?.toString() || "",
      headquarters_country: dv.headquarters_country || "",
      headquarters_city: dv.headquarters_city || "",
      operating_regions: dv.operating_regions || "",
      office_locations: dv.office_locations || "",
      website: dv.website || "",
      phone: dv.phone || "",
      email: dv.email || "",
      linkedin_url: dv.linkedin_url || "",
      services_offered: dv.services_offered || "",
      sector_expertise: dv.sector_expertise || "",
      geographic_coverage: dv.geographic_coverage || "",
      client_types: dv.client_types || "",
      service_model: dv.service_model || "",
      pricing_model: dv.pricing_model || "",
      min_engagement_size: dv.min_engagement_size?.toString() || "",
      avg_engagement_size: dv.avg_engagement_size?.toString() || "",
      regulatory_status: dv.regulatory_status || "",
      primary_regulator: dv.primary_regulator || "",
      certifications: dv.certifications || "",
      insurance_coverage: dv.insurance_coverage || "",
      professional_liability_coverage: dv.professional_liability_coverage?.toString() || "",
      employee_count: dv.employee_count?.toString() || "",
      employee_count_band: dv.employee_count_band || "",
      senior_professionals_count: dv.senior_professionals_count?.toString() || "",
      key_personnel: dv.key_personnel || "",
      notable_clients: dv.notable_clients || "",
      years_in_business: dv.years_in_business?.toString() || "",
      client_retention_rate: dv.client_retention_rate?.toString() || "",
      esg_policy_available: dv.esg_policy_available ? "true" : "false",
      dei_policy_available: dv.dei_policy_available ? "true" : "false",
      sustainability_report_url: dv.sustainability_report_url || "",
      data_confidence_score: dv.data_confidence_score?.toString() || "",
      verification_method: dv.verification_method || "",
      last_verified_date: dv.last_verified_date || "",
      notes: dv.notes || "",
      status: dv.status || "Active",
    },
  });

  const handleSubmit = (data: any) => {
    onSubmit({
      provider_name: data.provider_name || null,
      provider_legal_name: data.provider_legal_name || null,
      provider_short_name: data.provider_short_name || null,
      provider_type: data.provider_type || null,
      year_founded: data.year_founded ? parseInt(data.year_founded) : null,
      headquarters_country: data.headquarters_country || null,
      headquarters_city: data.headquarters_city || null,
      operating_regions: data.operating_regions || null,
      office_locations: data.office_locations || null,
      website: data.website || null,
      phone: data.phone || null,
      email: data.email || null,
      linkedin_url: data.linkedin_url || null,
      services_offered: data.services_offered || null,
      sector_expertise: data.sector_expertise || null,
      geographic_coverage: data.geographic_coverage || null,
      client_types: data.client_types || null,
      service_model: data.service_model || null,
      pricing_model: data.pricing_model || null,
      min_engagement_size: data.min_engagement_size ? parseFloat(data.min_engagement_size) : null,
      avg_engagement_size: data.avg_engagement_size ? parseFloat(data.avg_engagement_size) : null,
      regulatory_status: data.regulatory_status || null,
      primary_regulator: data.primary_regulator || null,
      certifications: data.certifications || null,
      insurance_coverage: data.insurance_coverage || null,
      professional_liability_coverage: data.professional_liability_coverage ? parseFloat(data.professional_liability_coverage) : null,
      employee_count: data.employee_count ? parseInt(data.employee_count) : null,
      employee_count_band: data.employee_count_band || null,
      senior_professionals_count: data.senior_professionals_count ? parseInt(data.senior_professionals_count) : null,
      key_personnel: data.key_personnel || null,
      notable_clients: data.notable_clients || null,
      years_in_business: data.years_in_business ? parseInt(data.years_in_business) : null,
      client_retention_rate: data.client_retention_rate ? parseFloat(data.client_retention_rate) : null,
      esg_policy_available: data.esg_policy_available === "true",
      dei_policy_available: data.dei_policy_available === "true",
      sustainability_report_url: data.sustainability_report_url || null,
      data_confidence_score: data.data_confidence_score ? parseFloat(data.data_confidence_score) : null,
      verification_method: data.verification_method || null,
      last_verified_date: data.last_verified_date || null,
      notes: data.notes || null,
      status: data.status || "Active",
    });
  };

  const employeeCountBandOptions = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001+"];
  const regulatoryStatusOptions = ["Registered", "Exempt", "Not Registered", "Pending", "Unknown"];
  const clientTypeOptions = ["GPs", "LPs", "Portfolio Companies", "Family Offices", "Corporates", "All"];
  const serviceModelOptions = ["Retainer", "Project-Based", "Hourly", "Success Fee", "Hybrid"];

  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
          <SectionHeader title="Basic Information" />
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="provider_name" render={({ field }) => (
              <FormItem><FormLabel>Provider Name *</FormLabel><FormControl><Input {...field} placeholder="Provider display name" data-testid="input-sp-name" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="provider_legal_name" render={({ field }) => (
              <FormItem><FormLabel>Legal Name</FormLabel><FormControl><Input {...field} placeholder="Legal entity name" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="provider_short_name" render={({ field }) => (
              <FormItem><FormLabel>Short Name</FormLabel><FormControl><Input {...field} placeholder="Abbreviation" /></FormControl></FormItem>
            )} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="provider_type" render={({ field }) => (
              <FormItem><FormLabel>Provider Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger data-testid="select-provider-type"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                  <SelectContent>{providerTypeOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="year_founded" render={({ field }) => (
              <FormItem><FormLabel>Year Founded</FormLabel><FormControl><Input {...field} placeholder="e.g., 2015" type="number" data-testid="input-founded-year" /></FormControl></FormItem>
            )} />
          </div>

          <SectionHeader title="Location" />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="headquarters_country" render={({ field }) => (
              <FormItem><FormLabel>HQ Country</FormLabel><FormControl><Input {...field} placeholder="Country" data-testid="input-sp-country" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="headquarters_city" render={({ field }) => (
              <FormItem><FormLabel>HQ City</FormLabel><FormControl><Input {...field} placeholder="City" data-testid="input-sp-city" /></FormControl></FormItem>
            )} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="operating_regions" render={({ field }) => (
              <FormItem><FormLabel>Operating Regions</FormLabel><FormControl><Input {...field} placeholder="e.g., North America, Europe" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="office_locations" render={({ field }) => (
              <FormItem><FormLabel>Office Locations</FormLabel><FormControl><Input {...field} placeholder="e.g., NYC, London, Singapore" /></FormControl></FormItem>
            )} />
          </div>

          <SectionHeader title="Contact Information" />
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} type="email" placeholder="contact@provider.com" data-testid="input-sp-email" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} placeholder="+1 (555) 000-0000" data-testid="input-sp-phone" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="linkedin_url" render={({ field }) => (
              <FormItem><FormLabel>LinkedIn URL</FormLabel><FormControl><Input {...field} placeholder="https://linkedin.com/company/..." data-testid="input-sp-linkedin" /></FormControl></FormItem>
            )} />
          </div>

          <SectionHeader title="Services & Expertise" />
          <FormField control={form.control} name="services_offered" render={({ field }) => (
            <FormItem><FormLabel>Services Offered</FormLabel><FormControl><Textarea {...field} placeholder="Describe services offered..." data-testid="input-services-offered" /></FormControl></FormItem>
          )} />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="sector_expertise" render={({ field }) => (
              <FormItem><FormLabel>Sector Expertise</FormLabel><FormControl><Input {...field} placeholder="e.g., Technology, Healthcare" data-testid="input-sector-expertise" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="geographic_coverage" render={({ field }) => (
              <FormItem><FormLabel>Geographic Coverage</FormLabel><FormControl><Input {...field} placeholder="e.g., North America, Europe" data-testid="input-geo-coverage" /></FormControl></FormItem>
            )} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="client_types" render={({ field }) => (
              <FormItem><FormLabel>Client Types</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select client types" /></SelectTrigger></FormControl>
                  <SelectContent>{clientTypeOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="service_model" render={({ field }) => (
              <FormItem><FormLabel>Service Model</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger></FormControl>
                  <SelectContent>{serviceModelOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="pricing_model" render={({ field }) => (
              <FormItem><FormLabel>Pricing Model</FormLabel><FormControl><Input {...field} placeholder="e.g., Fixed Fee, AUM-Based" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="min_engagement_size" render={({ field }) => (
              <FormItem><FormLabel>Min Engagement Size ($)</FormLabel><FormControl><Input {...field} placeholder="e.g., 50000" type="number" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="avg_engagement_size" render={({ field }) => (
              <FormItem><FormLabel>Avg Engagement Size ($)</FormLabel><FormControl><Input {...field} placeholder="e.g., 200000" type="number" /></FormControl></FormItem>
            )} />
          </div>

          <SectionHeader title="Compliance & Regulatory" />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="regulatory_status" render={({ field }) => (
              <FormItem><FormLabel>Regulatory Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                  <SelectContent>{regulatoryStatusOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="primary_regulator" render={({ field }) => (
              <FormItem><FormLabel>Primary Regulator</FormLabel><FormControl><Input {...field} placeholder="e.g., SEC, FCA, FINRA" /></FormControl></FormItem>
            )} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="certifications" render={({ field }) => (
              <FormItem><FormLabel>Certifications</FormLabel><FormControl><Input {...field} placeholder="e.g., SOC 2, ISO 27001" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="insurance_coverage" render={({ field }) => (
              <FormItem><FormLabel>Insurance Coverage</FormLabel><FormControl><Input {...field} placeholder="e.g., E&O, Professional Liability" /></FormControl></FormItem>
            )} />
          </div>
          <FormField control={form.control} name="professional_liability_coverage" render={({ field }) => (
            <FormItem><FormLabel>Professional Liability Amount ($M)</FormLabel><FormControl><Input {...field} placeholder="e.g., 10" type="number" /></FormControl></FormItem>
          )} />

          <SectionHeader title="Team & Organization" />
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="employee_count" render={({ field }) => (
              <FormItem><FormLabel>Employee Count</FormLabel><FormControl><Input {...field} placeholder="e.g., 150" type="number" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="employee_count_band" render={({ field }) => (
              <FormItem><FormLabel>Employee Band</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select band" /></SelectTrigger></FormControl>
                  <SelectContent>{employeeCountBandOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="senior_professionals_count" render={({ field }) => (
              <FormItem><FormLabel>Senior Professionals</FormLabel><FormControl><Input {...field} placeholder="e.g., 25" type="number" /></FormControl></FormItem>
            )} />
          </div>
          <FormField control={form.control} name="key_personnel" render={({ field }) => (
            <FormItem><FormLabel>Key Personnel</FormLabel><FormControl><Textarea {...field} placeholder="List key team members..." /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="notable_clients" render={({ field }) => (
            <FormItem><FormLabel>Notable Clients</FormLabel><FormControl><Textarea {...field} placeholder="List notable clients (if public)..." /></FormControl></FormItem>
          )} />

          <SectionHeader title="Track Record" />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="years_in_business" render={({ field }) => (
              <FormItem><FormLabel>Years in Business</FormLabel><FormControl><Input {...field} placeholder="e.g., 15" type="number" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="client_retention_rate" render={({ field }) => (
              <FormItem><FormLabel>Client Retention Rate (%)</FormLabel><FormControl><Input {...field} placeholder="e.g., 95" type="number" /></FormControl></FormItem>
            )} />
          </div>

          <SectionHeader title="ESG & Sustainability" />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="esg_policy_available" render={({ field }) => (
              <FormItem><FormLabel>ESG Policy</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent><SelectItem value="true">Available</SelectItem><SelectItem value="false">Not Available</SelectItem></SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="dei_policy_available" render={({ field }) => (
              <FormItem><FormLabel>DEI Policy</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent><SelectItem value="true">Available</SelectItem><SelectItem value="false">Not Available</SelectItem></SelectContent>
                </Select></FormItem>
            )} />
          </div>
          <FormField control={form.control} name="sustainability_report_url" render={({ field }) => (
            <FormItem><FormLabel>Sustainability Report URL</FormLabel><FormControl><Input {...field} placeholder="https://" /></FormControl></FormItem>
          )} />

          <SectionHeader title="Data Quality" />
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="data_confidence_score" render={({ field }) => (
              <FormItem><FormLabel>Confidence Score</FormLabel><FormControl><Input {...field} placeholder="0-100" type="number" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="verification_method" render={({ field }) => (
              <FormItem><FormLabel>Verification Method</FormLabel><FormControl><Input {...field} placeholder="e.g., Direct, Web Scrape" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="last_verified_date" render={({ field }) => (
              <FormItem><FormLabel>Last Verified Date</FormLabel><FormControl><Input {...field} type="date" /></FormControl></FormItem>
            )} />
          </div>

          <SectionHeader title="Contact & Status" />
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="website" render={({ field }) => (
              <FormItem><FormLabel>Website</FormLabel><FormControl><Input {...field} placeholder="https://example.com" data-testid="input-sp-website" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} placeholder="+1 555-123-4567" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} placeholder="contact@example.com" type="email" /></FormControl></FormItem>
            )} />
          </div>
          <FormField control={form.control} name="notes" render={({ field }) => (
            <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} placeholder="Additional notes..." /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="status" render={({ field }) => (
            <FormItem><FormLabel>Status</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger data-testid="select-sp-status"><SelectValue /></SelectTrigger></FormControl>
                <SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem><SelectItem value="Prospect">Prospect</SelectItem></SelectContent>
              </Select></FormItem>
          )} />

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit" disabled={isPending} data-testid="button-submit-sp">
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? "Save Changes" : "Add Service Provider"}
            </Button>
          </div>
        </form>
      </Form>
    </ScrollArea>
  );
}

function ServiceProviderFullView({ sp, onClose }: { sp: any; onClose: () => void }) {
  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <div className="space-y-2">
        <SectionHeader title="Basic Information" />
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="Provider Name" value={sp.provider_name} />
          <FieldDisplay label="Legal Name" value={sp.provider_legal_name} />
          <FieldDisplay label="Short Name" value={sp.provider_short_name} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Provider Type" value={sp.provider_type} />
          <FieldDisplay label="Year Founded" value={sp.year_founded} />
        </div>

        <SectionHeader title="Location" />
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="HQ Country" value={sp.headquarters_country} />
          <FieldDisplay label="HQ City" value={sp.headquarters_city} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Operating Regions" value={sp.operating_regions} />
          <FieldDisplay label="Office Locations" value={sp.office_locations} />
        </div>

        <SectionHeader title="Contact Information" />
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="Email" value={sp.email} />
          <FieldDisplay label="Phone" value={sp.phone} />
          <FieldDisplay label="LinkedIn" value={sp.linkedin_url} isLink />
        </div>

        <SectionHeader title="Services & Expertise" />
        <FieldDisplay label="Services Offered" value={sp.services_offered} />
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Sector Expertise" value={sp.sector_expertise} />
          <FieldDisplay label="Geographic Coverage" value={sp.geographic_coverage} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Client Types" value={sp.client_types} />
          <FieldDisplay label="Service Model" value={sp.service_model} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="Pricing Model" value={sp.pricing_model} />
          <FieldDisplay label="Min Engagement ($)" value={sp.min_engagement_size} />
          <FieldDisplay label="Avg Engagement ($)" value={sp.avg_engagement_size} />
        </div>

        <SectionHeader title="Compliance & Regulatory" />
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Regulatory Status" value={sp.regulatory_status} />
          <FieldDisplay label="Primary Regulator" value={sp.primary_regulator} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Certifications" value={sp.certifications} />
          <FieldDisplay label="Insurance Coverage" value={sp.insurance_coverage} />
        </div>
        <FieldDisplay label="Professional Liability ($M)" value={sp.professional_liability_coverage} />

        <SectionHeader title="Team & Organization" />
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="Employee Count" value={sp.employee_count} />
          <FieldDisplay label="Employee Band" value={sp.employee_count_band} />
          <FieldDisplay label="Senior Professionals" value={sp.senior_professionals_count} />
        </div>
        <FieldDisplay label="Key Personnel" value={sp.key_personnel} />
        <FieldDisplay label="Notable Clients" value={sp.notable_clients} />

        <SectionHeader title="Track Record" />
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Years in Business" value={sp.years_in_business} />
          <FieldDisplay label="Client Retention Rate (%)" value={sp.client_retention_rate} />
        </div>

        <SectionHeader title="ESG & Sustainability" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">ESG Policy</p>
            <Badge variant={sp.esg_policy_available ? "default" : "secondary"}>
              {sp.esg_policy_available ? "Available" : "Not Available"}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">DEI Policy</p>
            <Badge variant={sp.dei_policy_available ? "default" : "secondary"}>
              {sp.dei_policy_available ? "Available" : "Not Available"}
            </Badge>
          </div>
        </div>
        <FieldDisplay label="Sustainability Report" value={sp.sustainability_report_url} isLink />

        <SectionHeader title="Data Quality" />
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="Confidence Score" value={sp.data_confidence_score} />
          <FieldDisplay label="Verification Method" value={sp.verification_method} />
          <FieldDisplay label="Last Verified" value={sp.last_verified_date} />
        </div>

        <SectionHeader title="Contact & Status" />
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="Website" value={sp.website} isLink />
          <FieldDisplay label="Phone" value={sp.phone} />
          <FieldDisplay label="Email" value={sp.email} />
        </div>
        <FieldDisplay label="Notes" value={sp.notes} />
        <div>
          <p className="text-sm text-muted-foreground">Status</p>
          <Badge className={statusColors[sp.status || "active"]}>{sp.status || "active"}</Badge>
        </div>

        <SectionHeader title="URLs" />
        <EntityUrlsSection entityType="service_provider" entityId={sp.id} />

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </ScrollArea>
  );
}

function PortfolioCompaniesTab({ searchQuery }: { searchQuery: string }) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedFirm, setSelectedFirm] = useState<CrmPortfolioCompany | null>(null);
  const [dialogMode, setDialogMode] = useState<"view" | "edit" | "contacts">("view");
  const { toast } = useToast();

  const { data: pcs = [], isLoading, error } = useQuery<CrmPortfolioCompany[]>({
    queryKey: ["/api/crm/portfolio-companies"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("POST", "/api/crm/portfolio-companies", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/portfolio-companies"] });
      setIsAddDialogOpen(false);
      toast({ title: "Portfolio Company created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      const res = await apiRequest("PATCH", `/api/crm/portfolio-companies/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/portfolio-companies"] });
      setDialogMode("view");
      toast({ title: "Portfolio Company updated", description: "Changes have been saved successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating Portfolio Company", description: error.message, variant: "destructive" });
    },
  });

  const filteredData = pcs.filter((pc) =>
    pc.company_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns = [
    {
      key: "company_name",
      header: "Company Name",
      sortable: true,
      render: (pc: CrmPortfolioCompany) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <div>
            <span className="font-medium">{pc.company_name || "-"}</span>
            <p className="text-xs text-muted-foreground">Click to view full profile</p>
          </div>
        </div>
      ),
    },
    {
      key: "primary_industry",
      header: "Industry",
      render: (pc: CrmPortfolioCompany) => <Badge variant="secondary">{pc.primary_industry || "-"}</Badge>,
    },
    {
      key: "headquarters",
      header: "Location",
      render: (pc: CrmPortfolioCompany) => (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {pc.headquarters_city && pc.headquarters_country
            ? `${pc.headquarters_city}, ${pc.headquarters_country}`
            : pc.headquarters_country || pc.headquarters_city || "-"}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (pc: CrmPortfolioCompany) => (
        <Badge className={statusColors[pc.status || "active"]}>
          {pc.status || "active"}
        </Badge>
      ),
    },
  ];

  const openFirmDialog = (firm: CrmPortfolioCompany, mode: "view" | "edit" | "contacts") => {
    setSelectedFirm(firm);
    setDialogMode(mode);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-8 text-destructive">Failed to load portfolio companies.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-pc">
              <Plus className="h-4 w-4 mr-2" />
              Add Portfolio Company
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Add New Portfolio Company</DialogTitle>
            </DialogHeader>
            <PortfolioCompanyForm onSubmit={(data) => createMutation.mutate(data)} isPending={createMutation.isPending} onCancel={() => setIsAddDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        data={filteredData}
        columns={columns}
        onView={(pc) => openFirmDialog(pc, "view")}
        onEdit={(pc) => openFirmDialog(pc, "edit")}
        emptyMessage="No portfolio companies found"
      />

      <Dialog open={!!selectedFirm} onOpenChange={() => setSelectedFirm(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader className="pb-0">
            <div className="flex items-center justify-between gap-4">
              <div>
                <DialogTitle className="text-xl">{selectedFirm?.company_name}</DialogTitle>
                <DialogDescription>
                  {selectedFirm?.primary_industry && <Badge variant="secondary">{selectedFirm.primary_industry}</Badge>}
                </DialogDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={dialogMode === "view" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDialogMode("view")}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
                <Button
                  variant={dialogMode === "edit" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDialogMode("edit")}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant={dialogMode === "contacts" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDialogMode("contacts")}
                >
                  <Users className="h-4 w-4 mr-1" />
                  Contacts
                </Button>
              </div>
            </div>
          </DialogHeader>
          
          {selectedFirm && dialogMode === "view" && (
            <PortfolioCompanyFullView pc={selectedFirm} onClose={() => setSelectedFirm(null)} />
          )}
          {selectedFirm && dialogMode === "edit" && (
            <PortfolioCompanyForm
              defaultValues={selectedFirm}
              onSubmit={(data) => {
                updateMutation.mutate({ id: selectedFirm.id, data });
              }}
              isPending={updateMutation.isPending}
              onCancel={() => setDialogMode("view")}
              isEdit
            />
          )}
          {selectedFirm && dialogMode === "contacts" && (
            <FirmContactsSection 
              entityType="portfolio_company" 
              entityId={selectedFirm.id} 
              entityName={selectedFirm.company_name}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PortfolioCompanyForm({
  defaultValues,
  onSubmit,
  isPending,
  onCancel,
  isEdit = false,
}: {
  defaultValues?: any;
  onSubmit: (data: Record<string, any>) => void;
  isPending: boolean;
  onCancel: () => void;
  isEdit?: boolean;
}) {
  const dv = defaultValues || {};
  const form = useForm({
    defaultValues: {
      company_name: dv.company_name || "",
      company_legal_name: dv.company_legal_name || "",
      company_short_name: dv.company_short_name || "",
      company_type: dv.company_type || "",
      year_founded: dv.year_founded?.toString() || "",
      headquarters_country: dv.headquarters_country || "",
      headquarters_city: dv.headquarters_city || "",
      operating_regions: dv.operating_regions || "",
      primary_industry: dv.primary_industry || "",
      secondary_industry: dv.secondary_industry || "",
      business_model: dv.business_model || "",
      business_description: dv.business_description || "",
      revenue: dv.revenue?.toString() || "",
      revenue_currency: dv.revenue_currency || "USD",
      revenue_date: dv.revenue_date || "",
      ebitda: dv.ebitda?.toString() || "",
      ebitda_margin: dv.ebitda_margin?.toString() || "",
      valuation: dv.valuation?.toString() || "",
      valuation_date: dv.valuation_date || "",
      employee_count: dv.employee_count?.toString() || "",
      employee_count_band: dv.employee_count_band || "",
      growth_stage: dv.growth_stage || "",
      ownership_percentage: dv.ownership_percentage?.toString() || "",
      investment_date: dv.investment_date || "",
      investment_amount: dv.investment_amount?.toString() || "",
      investment_currency: dv.investment_currency || "USD",
      investment_round: dv.investment_round || "",
      board_seat: dv.board_seat ? "true" : "false",
      board_representative: dv.board_representative || "",
      exit_date: dv.exit_date || "",
      exit_type: dv.exit_type || "",
      exit_valuation: dv.exit_valuation?.toString() || "",
      exit_multiple: dv.exit_multiple?.toString() || "",
      realized_value: dv.realized_value?.toString() || "",
      esg_policy_available: dv.esg_policy_available ? "true" : "false",
      carbon_footprint_measured: dv.carbon_footprint_measured ? "true" : "false",
      dei_metrics_tracked: dv.dei_metrics_tracked ? "true" : "false",
      sustainability_report_url: dv.sustainability_report_url || "",
      website: dv.website || "",
      phone: dv.phone || "",
      email: dv.email || "",
      linkedin_url: dv.linkedin_url || "",
      data_confidence_score: dv.data_confidence_score?.toString() || "",
      verification_method: dv.verification_method || "",
      last_verified_date: dv.last_verified_date || "",
      notes: dv.notes || "",
      status: dv.status || "Active",
    },
  });

  const handleSubmit = (data: any) => {
    onSubmit({
      company_name: data.company_name || null,
      company_legal_name: data.company_legal_name || null,
      company_short_name: data.company_short_name || null,
      company_type: data.company_type || null,
      year_founded: data.year_founded ? parseInt(data.year_founded) : null,
      headquarters_country: data.headquarters_country || null,
      headquarters_city: data.headquarters_city || null,
      operating_regions: data.operating_regions || null,
      primary_industry: data.primary_industry || null,
      secondary_industry: data.secondary_industry || null,
      business_model: data.business_model || null,
      business_description: data.business_description || null,
      revenue: data.revenue ? parseFloat(data.revenue) : null,
      revenue_currency: data.revenue_currency || "USD",
      revenue_date: data.revenue_date || null,
      ebitda: data.ebitda ? parseFloat(data.ebitda) : null,
      ebitda_margin: data.ebitda_margin ? parseFloat(data.ebitda_margin) : null,
      valuation: data.valuation ? parseFloat(data.valuation) : null,
      valuation_date: data.valuation_date || null,
      employee_count: data.employee_count ? parseInt(data.employee_count) : null,
      employee_count_band: data.employee_count_band || null,
      growth_stage: data.growth_stage || null,
      ownership_percentage: data.ownership_percentage ? parseFloat(data.ownership_percentage) : null,
      investment_date: data.investment_date || null,
      investment_amount: data.investment_amount ? parseFloat(data.investment_amount) : null,
      investment_currency: data.investment_currency || "USD",
      investment_round: data.investment_round || null,
      board_seat: data.board_seat === "true",
      board_representative: data.board_representative || null,
      exit_date: data.exit_date || null,
      exit_type: data.exit_type || null,
      exit_valuation: data.exit_valuation ? parseFloat(data.exit_valuation) : null,
      exit_multiple: data.exit_multiple ? parseFloat(data.exit_multiple) : null,
      realized_value: data.realized_value ? parseFloat(data.realized_value) : null,
      esg_policy_available: data.esg_policy_available === "true",
      carbon_footprint_measured: data.carbon_footprint_measured === "true",
      dei_metrics_tracked: data.dei_metrics_tracked === "true",
      sustainability_report_url: data.sustainability_report_url || null,
      website: data.website || null,
      phone: data.phone || null,
      email: data.email || null,
      linkedin_url: data.linkedin_url || null,
      data_confidence_score: data.data_confidence_score ? parseFloat(data.data_confidence_score) : null,
      verification_method: data.verification_method || null,
      last_verified_date: data.last_verified_date || null,
      notes: data.notes || null,
      status: data.status || "Active",
    });
  };

  const employeeCountBandOptions = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5001+"];
  const growthStageOptions = ["Seed", "Series A", "Series B", "Series C", "Growth", "Mature", "Turnaround"];
  const investmentRoundOptions = ["Seed", "Series A", "Series B", "Series C", "Series D+", "Growth", "Buyout", "Secondary"];
  const exitTypeOptions = ["IPO", "M&A", "Secondary Sale", "Recapitalization", "Write-off", "Partial Exit"];

  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
          <SectionHeader title="Basic Information" />
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="company_name" render={({ field }) => (
              <FormItem><FormLabel>Company Name *</FormLabel><FormControl><Input {...field} placeholder="Company display name" data-testid="input-pc-name" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="company_legal_name" render={({ field }) => (
              <FormItem><FormLabel>Legal Name</FormLabel><FormControl><Input {...field} placeholder="Legal entity name" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="company_short_name" render={({ field }) => (
              <FormItem><FormLabel>Short Name</FormLabel><FormControl><Input {...field} placeholder="Abbreviation" /></FormControl></FormItem>
            )} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="company_type" render={({ field }) => (
              <FormItem><FormLabel>Company Type</FormLabel><FormControl><Input {...field} placeholder="e.g., B2B SaaS, Consumer" data-testid="input-company-type" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="year_founded" render={({ field }) => (
              <FormItem><FormLabel>Year Founded</FormLabel><FormControl><Input {...field} placeholder="e.g., 2015" type="number" data-testid="input-pc-founded" /></FormControl></FormItem>
            )} />
          </div>

          <SectionHeader title="Location" />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="headquarters_country" render={({ field }) => (
              <FormItem><FormLabel>HQ Country</FormLabel><FormControl><Input {...field} placeholder="Country" data-testid="input-pc-country" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="headquarters_city" render={({ field }) => (
              <FormItem><FormLabel>HQ City</FormLabel><FormControl><Input {...field} placeholder="City" data-testid="input-pc-city" /></FormControl></FormItem>
            )} />
          </div>
          <FormField control={form.control} name="operating_regions" render={({ field }) => (
            <FormItem><FormLabel>Operating Regions</FormLabel><FormControl><Input {...field} placeholder="e.g., North America, Europe, Asia" /></FormControl></FormItem>
          )} />

          <SectionHeader title="Industry & Business" />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="primary_industry" render={({ field }) => (
              <FormItem><FormLabel>Primary Industry</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger data-testid="select-industry"><SelectValue placeholder="Select industry" /></SelectTrigger></FormControl>
                  <SelectContent>{industryOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="secondary_industry" render={({ field }) => (
              <FormItem><FormLabel>Secondary Industry</FormLabel><FormControl><Input {...field} placeholder="e.g., FinTech, EdTech" /></FormControl></FormItem>
            )} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="business_model" render={({ field }) => (
              <FormItem><FormLabel>Business Model</FormLabel><FormControl><Input {...field} placeholder="e.g., Subscription, Marketplace" data-testid="input-business-model" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="growth_stage" render={({ field }) => (
              <FormItem><FormLabel>Growth Stage</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger></FormControl>
                  <SelectContent>{growthStageOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
          </div>
          <FormField control={form.control} name="business_description" render={({ field }) => (
            <FormItem><FormLabel>Business Description</FormLabel><FormControl><Textarea {...field} placeholder="Describe the business..." data-testid="input-business-desc" /></FormControl></FormItem>
          )} />

          <SectionHeader title="Financials" />
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="revenue" render={({ field }) => (
              <FormItem><FormLabel>Revenue ($M)</FormLabel><FormControl><Input {...field} placeholder="e.g., 25" type="number" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="revenue_currency" render={({ field }) => (
              <FormItem><FormLabel>Currency</FormLabel><FormControl><Input {...field} placeholder="USD" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="revenue_date" render={({ field }) => (
              <FormItem><FormLabel>Revenue Date</FormLabel><FormControl><Input {...field} type="date" /></FormControl></FormItem>
            )} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="ebitda" render={({ field }) => (
              <FormItem><FormLabel>EBITDA ($M)</FormLabel><FormControl><Input {...field} placeholder="e.g., 5" type="number" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="ebitda_margin" render={({ field }) => (
              <FormItem><FormLabel>EBITDA Margin (%)</FormLabel><FormControl><Input {...field} placeholder="e.g., 20" type="number" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="valuation" render={({ field }) => (
              <FormItem><FormLabel>Valuation ($M)</FormLabel><FormControl><Input {...field} placeholder="e.g., 100" type="number" /></FormControl></FormItem>
            )} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="valuation_date" render={({ field }) => (
              <FormItem><FormLabel>Valuation Date</FormLabel><FormControl><Input {...field} type="date" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="employee_count" render={({ field }) => (
              <FormItem><FormLabel>Employee Count</FormLabel><FormControl><Input {...field} placeholder="e.g., 150" type="number" data-testid="input-employee-count" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="employee_count_band" render={({ field }) => (
              <FormItem><FormLabel>Employee Band</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select band" /></SelectTrigger></FormControl>
                  <SelectContent>{employeeCountBandOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
          </div>

          <SectionHeader title="Investment Details" />
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="ownership_percentage" render={({ field }) => (
              <FormItem><FormLabel>Ownership (%)</FormLabel><FormControl><Input {...field} placeholder="e.g., 25" type="number" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="investment_date" render={({ field }) => (
              <FormItem><FormLabel>Investment Date</FormLabel><FormControl><Input {...field} type="date" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="investment_round" render={({ field }) => (
              <FormItem><FormLabel>Investment Round</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select round" /></SelectTrigger></FormControl>
                  <SelectContent>{investmentRoundOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="investment_amount" render={({ field }) => (
              <FormItem><FormLabel>Investment Amount ($M)</FormLabel><FormControl><Input {...field} placeholder="e.g., 10" type="number" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="investment_currency" render={({ field }) => (
              <FormItem><FormLabel>Investment Currency</FormLabel><FormControl><Input {...field} placeholder="USD" /></FormControl></FormItem>
            )} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="board_seat" render={({ field }) => (
              <FormItem><FormLabel>Board Seat</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent><SelectItem value="true">Yes</SelectItem><SelectItem value="false">No</SelectItem></SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="board_representative" render={({ field }) => (
              <FormItem><FormLabel>Board Representative</FormLabel><FormControl><Input {...field} placeholder="Name of board member" /></FormControl></FormItem>
            )} />
          </div>

          <SectionHeader title="Exit Details" />
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="exit_date" render={({ field }) => (
              <FormItem><FormLabel>Exit Date</FormLabel><FormControl><Input {...field} type="date" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="exit_type" render={({ field }) => (
              <FormItem><FormLabel>Exit Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                  <SelectContent>{exitTypeOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="exit_valuation" render={({ field }) => (
              <FormItem><FormLabel>Exit Valuation ($M)</FormLabel><FormControl><Input {...field} placeholder="e.g., 250" type="number" /></FormControl></FormItem>
            )} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="exit_multiple" render={({ field }) => (
              <FormItem><FormLabel>Exit Multiple</FormLabel><FormControl><Input {...field} placeholder="e.g., 3.5" type="number" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="realized_value" render={({ field }) => (
              <FormItem><FormLabel>Realized Value ($M)</FormLabel><FormControl><Input {...field} placeholder="e.g., 35" type="number" /></FormControl></FormItem>
            )} />
          </div>

          <SectionHeader title="ESG & Sustainability" />
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="esg_policy_available" render={({ field }) => (
              <FormItem><FormLabel>ESG Policy</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent><SelectItem value="true">Available</SelectItem><SelectItem value="false">Not Available</SelectItem></SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="carbon_footprint_measured" render={({ field }) => (
              <FormItem><FormLabel>Carbon Footprint</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent><SelectItem value="true">Measured</SelectItem><SelectItem value="false">Not Measured</SelectItem></SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="dei_metrics_tracked" render={({ field }) => (
              <FormItem><FormLabel>DEI Metrics</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent><SelectItem value="true">Tracked</SelectItem><SelectItem value="false">Not Tracked</SelectItem></SelectContent>
                </Select></FormItem>
            )} />
          </div>
          <FormField control={form.control} name="sustainability_report_url" render={({ field }) => (
            <FormItem><FormLabel>Sustainability Report URL</FormLabel><FormControl><Input {...field} placeholder="https://" /></FormControl></FormItem>
          )} />

          <SectionHeader title="Data Quality" />
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="data_confidence_score" render={({ field }) => (
              <FormItem><FormLabel>Confidence Score</FormLabel><FormControl><Input {...field} placeholder="0-100" type="number" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="verification_method" render={({ field }) => (
              <FormItem><FormLabel>Verification Method</FormLabel><FormControl><Input {...field} placeholder="e.g., Direct, Web Scrape" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="last_verified_date" render={({ field }) => (
              <FormItem><FormLabel>Last Verified Date</FormLabel><FormControl><Input {...field} type="date" /></FormControl></FormItem>
            )} />
          </div>

          <SectionHeader title="Contact & Status" />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="website" render={({ field }) => (
              <FormItem><FormLabel>Website</FormLabel><FormControl><Input {...field} placeholder="https://example.com" data-testid="input-pc-website" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="linkedin_url" render={({ field }) => (
              <FormItem><FormLabel>LinkedIn URL</FormLabel><FormControl><Input {...field} placeholder="https://linkedin.com/company/..." /></FormControl></FormItem>
            )} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} placeholder="+1 555-123-4567" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} placeholder="contact@example.com" type="email" /></FormControl></FormItem>
            )} />
          </div>
          <FormField control={form.control} name="notes" render={({ field }) => (
            <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} placeholder="Additional notes..." /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="status" render={({ field }) => (
            <FormItem><FormLabel>Status</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger data-testid="select-pc-status"><SelectValue /></SelectTrigger></FormControl>
                <SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Exited">Exited</SelectItem><SelectItem value="Inactive">Inactive</SelectItem><SelectItem value="Prospect">Prospect</SelectItem></SelectContent>
              </Select></FormItem>
          )} />

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit" disabled={isPending} data-testid="button-submit-pc">
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? "Save Changes" : "Add Portfolio Company"}
            </Button>
          </div>
        </form>
      </Form>
    </ScrollArea>
  );
}

function PortfolioCompanyFullView({ pc, onClose }: { pc: any; onClose: () => void }) {
  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <div className="space-y-2">
        <SectionHeader title="Basic Information" />
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="Company Name" value={pc.company_name} />
          <FieldDisplay label="Legal Name" value={pc.company_legal_name} />
          <FieldDisplay label="Short Name" value={pc.company_short_name} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Company Type" value={pc.company_type} />
          <FieldDisplay label="Year Founded" value={pc.year_founded} />
        </div>

        <SectionHeader title="Location" />
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="HQ Country" value={pc.headquarters_country} />
          <FieldDisplay label="HQ City" value={pc.headquarters_city} />
        </div>
        <FieldDisplay label="Operating Regions" value={pc.operating_regions} />

        <SectionHeader title="Industry & Business" />
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Primary Industry" value={pc.primary_industry} />
          <FieldDisplay label="Secondary Industry" value={pc.secondary_industry} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Business Model" value={pc.business_model} />
          <FieldDisplay label="Growth Stage" value={pc.growth_stage} />
        </div>
        <FieldDisplay label="Business Description" value={pc.business_description} />

        <SectionHeader title="Financials" />
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="Revenue ($M)" value={pc.revenue} />
          <FieldDisplay label="Currency" value={pc.revenue_currency} />
          <FieldDisplay label="Revenue Date" value={pc.revenue_date} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="EBITDA ($M)" value={pc.ebitda} />
          <FieldDisplay label="EBITDA Margin (%)" value={pc.ebitda_margin} />
          <FieldDisplay label="Valuation ($M)" value={pc.valuation} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="Valuation Date" value={pc.valuation_date} />
          <FieldDisplay label="Employee Count" value={pc.employee_count} />
          <FieldDisplay label="Employee Band" value={pc.employee_count_band} />
        </div>

        <SectionHeader title="Investment Details" />
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="Ownership (%)" value={pc.ownership_percentage} />
          <FieldDisplay label="Investment Date" value={pc.investment_date} />
          <FieldDisplay label="Investment Round" value={pc.investment_round} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Investment Amount ($M)" value={pc.investment_amount} />
          <FieldDisplay label="Investment Currency" value={pc.investment_currency} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Board Seat</p>
            <Badge variant={pc.board_seat ? "default" : "secondary"}>{pc.board_seat ? "Yes" : "No"}</Badge>
          </div>
          <FieldDisplay label="Board Representative" value={pc.board_representative} />
        </div>

        <SectionHeader title="Exit Details" />
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="Exit Date" value={pc.exit_date} />
          <FieldDisplay label="Exit Type" value={pc.exit_type} />
          <FieldDisplay label="Exit Valuation ($M)" value={pc.exit_valuation} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Exit Multiple" value={pc.exit_multiple} />
          <FieldDisplay label="Realized Value ($M)" value={pc.realized_value} />
        </div>

        <SectionHeader title="ESG & Sustainability" />
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">ESG Policy</p>
            <Badge variant={pc.esg_policy_available ? "default" : "secondary"}>{pc.esg_policy_available ? "Available" : "Not Available"}</Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Carbon Footprint</p>
            <Badge variant={pc.carbon_footprint_measured ? "default" : "secondary"}>{pc.carbon_footprint_measured ? "Measured" : "Not Measured"}</Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">DEI Metrics</p>
            <Badge variant={pc.dei_metrics_tracked ? "default" : "secondary"}>{pc.dei_metrics_tracked ? "Tracked" : "Not Tracked"}</Badge>
          </div>
        </div>
        <FieldDisplay label="Sustainability Report" value={pc.sustainability_report_url} isLink />

        <SectionHeader title="Data Quality" />
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="Confidence Score" value={pc.data_confidence_score} />
          <FieldDisplay label="Verification Method" value={pc.verification_method} />
          <FieldDisplay label="Last Verified" value={pc.last_verified_date} />
        </div>

        <SectionHeader title="Contact & Status" />
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Website" value={pc.website} isLink />
          <FieldDisplay label="LinkedIn" value={pc.linkedin_url} isLink />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Phone" value={pc.phone} />
          <FieldDisplay label="Email" value={pc.email} />
        </div>
        <FieldDisplay label="Notes" value={pc.notes} />
        <div>
          <p className="text-sm text-muted-foreground">Status</p>
          <Badge className={statusColors[pc.status || "active"]}>{pc.status || "active"}</Badge>
        </div>

        <SectionHeader title="URLs" />
        <EntityUrlsSection entityType="portfolio_company" entityId={pc.id} />

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </ScrollArea>
  );
}
