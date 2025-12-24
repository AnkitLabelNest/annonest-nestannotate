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

export default function FirmsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("gp");

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
          <Tabs value={activeTab} onValueChange={setActiveTab}>
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
  defaultValues?: Partial<CrmGp>;
  onSubmit: (data: Record<string, any>) => void;
  isPending: boolean;
  onCancel: () => void;
  isEdit?: boolean;
}) {
  const form = useForm({
    defaultValues: {
      gp_name: defaultValues?.gp_name || "",
      gp_legal_name: defaultValues?.gp_legal_name || "",
      firm_type: defaultValues?.firm_type || "",
      headquarters_country: defaultValues?.headquarters_country || "",
      headquarters_city: defaultValues?.headquarters_city || "",
      total_aum: defaultValues?.total_aum || "",
      aum_currency: defaultValues?.aum_currency || "USD",
      website: defaultValues?.website || "",
      primary_asset_classes: defaultValues?.primary_asset_classes || "",
      status: defaultValues?.status || "Active",
    },
  });

  const handleSubmit = (data: any) => {
    onSubmit({
      gp_name: data.gp_name || null,
      gp_legal_name: data.gp_legal_name || null,
      firm_type: data.firm_type || null,
      headquarters_country: data.headquarters_country || null,
      headquarters_city: data.headquarters_city || null,
      total_aum: data.total_aum || null,
      aum_currency: data.aum_currency || null,
      website: data.website || null,
      primary_asset_classes: data.primary_asset_classes || null,
      status: data.status || "Active",
    });
  };

  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
          <SectionHeader title="Basic Information" />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="gp_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>GP Name *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Firm display name" data-testid="input-gp-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="gp_legal_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Legal Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Legal entity name" data-testid="input-gp-legal-name" />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="firm_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Firm Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-firm-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {firmTypeOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="primary_asset_classes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Asset Classes</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-asset-classes">
                        <SelectValue placeholder="Select asset class" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {assetClassOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </div>

          <SectionHeader title="Location" />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="headquarters_country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Country" data-testid="input-country" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="headquarters_city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="City" data-testid="input-city" />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <SectionHeader title="Financial Information" />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="total_aum"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total AUM</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., 5B" data-testid="input-aum" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="aum_currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-currency">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {currencyOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </div>

          <SectionHeader title="Contact & Status" />
          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="https://example.com" data-testid="input-website" />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="Prospect">Prospect</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

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

function GpFirmFullView({ gp, onClose }: { gp: CrmGp; onClose: () => void }) {
  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <div className="space-y-2">
        <SectionHeader title="Basic Information" />
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="GP Name" value={gp.gp_name} />
          <FieldDisplay label="Legal Name" value={gp.gp_legal_name} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Firm Type" value={gp.firm_type} />
          <FieldDisplay label="Primary Asset Classes" value={gp.primary_asset_classes} />
        </div>

        <SectionHeader title="Location" />
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Country" value={gp.headquarters_country} />
          <FieldDisplay label="City" value={gp.headquarters_city} />
        </div>

        <SectionHeader title="Financial Information" />
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Total AUM" value={gp.total_aum ? `${gp.total_aum} ${gp.aum_currency || "USD"}` : null} />
          <FieldDisplay label="Currency" value={gp.aum_currency} />
        </div>

        <SectionHeader title="Contact & Status" />
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Website" value={gp.website} isLink />
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge className={statusColors[gp.status || "active"]}>{gp.status || "active"}</Badge>
          </div>
        </div>

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
  defaultValues?: Partial<CrmLp>;
  onSubmit: (data: Record<string, any>) => void;
  isPending: boolean;
  onCancel: () => void;
  isEdit?: boolean;
}) {
  const form = useForm({
    defaultValues: {
      lp_name: defaultValues?.lp_name || "",
      lp_legal_name: defaultValues?.lp_legal_name || "",
      firm_type: defaultValues?.firm_type || "",
      investor_type: defaultValues?.investor_type || "",
      headquarters_country: defaultValues?.headquarters_country || "",
      headquarters_city: defaultValues?.headquarters_city || "",
      total_aum: defaultValues?.total_aum || "",
      aum_currency: defaultValues?.aum_currency || "USD",
      website: defaultValues?.website || "",
      status: defaultValues?.status || "Active",
    },
  });

  const handleSubmit = (data: any) => {
    onSubmit({
      lp_name: data.lp_name || null,
      lp_legal_name: data.lp_legal_name || null,
      firm_type: data.firm_type || null,
      investor_type: data.investor_type || null,
      headquarters_country: data.headquarters_country || null,
      headquarters_city: data.headquarters_city || null,
      total_aum: data.total_aum || null,
      aum_currency: data.aum_currency || null,
      website: data.website || null,
      status: data.status || "Active",
    });
  };

  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
          <SectionHeader title="Basic Information" />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="lp_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>LP Name *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="LP display name" data-testid="input-lp-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lp_legal_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Legal Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Legal entity name" data-testid="input-lp-legal-name" />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="firm_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Firm Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-firm-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {firmTypeOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="investor_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Investor Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-investor-type">
                        <SelectValue placeholder="Select investor type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {investorTypeOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </div>

          <SectionHeader title="Location" />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="headquarters_country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Country" data-testid="input-lp-country" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="headquarters_city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="City" data-testid="input-lp-city" />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <SectionHeader title="Financial Information" />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="total_aum"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total AUM</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., 5B" data-testid="input-lp-aum" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="aum_currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-lp-currency">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {currencyOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </div>

          <SectionHeader title="Contact & Status" />
          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="https://example.com" data-testid="input-lp-website" />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger data-testid="select-lp-status">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="Prospect">Prospect</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
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

function LpFirmFullView({ lp, onClose }: { lp: CrmLp; onClose: () => void }) {
  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <div className="space-y-2">
        <SectionHeader title="Basic Information" />
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="LP Name" value={lp.lp_name} />
          <FieldDisplay label="Legal Name" value={lp.lp_legal_name} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Firm Type" value={lp.firm_type} />
          <FieldDisplay label="Investor Type" value={lp.investor_type} />
        </div>

        <SectionHeader title="Location" />
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Country" value={lp.headquarters_country} />
          <FieldDisplay label="City" value={lp.headquarters_city} />
        </div>

        <SectionHeader title="Financial Information" />
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Total AUM" value={lp.total_aum ? `${lp.total_aum} ${lp.aum_currency || "USD"}` : null} />
          <FieldDisplay label="Currency" value={lp.aum_currency} />
        </div>

        <SectionHeader title="Contact & Status" />
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Website" value={lp.website} isLink />
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge className={statusColors[lp.status || "active"]}>{lp.status || "active"}</Badge>
          </div>
        </div>

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
  defaultValues?: Partial<CrmServiceProvider>;
  onSubmit: (data: Record<string, any>) => void;
  isPending: boolean;
  onCancel: () => void;
  isEdit?: boolean;
}) {
  const form = useForm({
    defaultValues: {
      provider_name: defaultValues?.provider_name || "",
      provider_type: defaultValues?.provider_type || "",
      headquarters_country: defaultValues?.headquarters_country || "",
      headquarters_city: defaultValues?.headquarters_city || "",
      website: defaultValues?.website || "",
      services_offered: defaultValues?.services_offered || "",
      sector_expertise: defaultValues?.sector_expertise || "",
      geographic_coverage: defaultValues?.geographic_coverage || "",
      founded_year: defaultValues?.founded_year?.toString() || "",
      status: defaultValues?.status || "Active",
    },
  });

  const handleSubmit = (data: any) => {
    onSubmit({
      provider_name: data.provider_name || null,
      provider_type: data.provider_type || null,
      headquarters_country: data.headquarters_country || null,
      headquarters_city: data.headquarters_city || null,
      website: data.website || null,
      services_offered: data.services_offered || null,
      sector_expertise: data.sector_expertise || null,
      geographic_coverage: data.geographic_coverage || null,
      founded_year: data.founded_year ? parseInt(data.founded_year) : null,
      status: data.status || "Active",
    });
  };

  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
          <SectionHeader title="Basic Information" />
          <FormField
            control={form.control}
            name="provider_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Provider Name *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Provider name" data-testid="input-sp-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="provider_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provider Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-provider-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {providerTypeOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="founded_year"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Founded Year</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., 2015" type="number" data-testid="input-founded-year" />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <SectionHeader title="Location" />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="headquarters_country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Country" data-testid="input-sp-country" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="headquarters_city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="City" data-testid="input-sp-city" />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <SectionHeader title="Services & Expertise" />
          <FormField
            control={form.control}
            name="services_offered"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Services Offered</FormLabel>
                <FormControl>
                  <Textarea {...field} placeholder="Describe services offered..." data-testid="input-services-offered" />
                </FormControl>
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="sector_expertise"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sector Expertise</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Technology, Healthcare" data-testid="input-sector-expertise" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="geographic_coverage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Geographic Coverage</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., North America, Europe" data-testid="input-geo-coverage" />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <SectionHeader title="Contact & Status" />
          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="https://example.com" data-testid="input-sp-website" />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger data-testid="select-sp-status">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="Prospect">Prospect</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
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

function ServiceProviderFullView({ sp, onClose }: { sp: CrmServiceProvider; onClose: () => void }) {
  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <div className="space-y-2">
        <SectionHeader title="Basic Information" />
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Provider Name" value={sp.provider_name} />
          <FieldDisplay label="Provider Type" value={sp.provider_type} />
        </div>
        <FieldDisplay label="Founded Year" value={sp.founded_year} />

        <SectionHeader title="Location" />
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Country" value={sp.headquarters_country} />
          <FieldDisplay label="City" value={sp.headquarters_city} />
        </div>

        <SectionHeader title="Services & Expertise" />
        <FieldDisplay label="Services Offered" value={sp.services_offered} />
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Sector Expertise" value={sp.sector_expertise} />
          <FieldDisplay label="Geographic Coverage" value={sp.geographic_coverage} />
        </div>

        <SectionHeader title="Contact & Status" />
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Website" value={sp.website} isLink />
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge className={statusColors[sp.status || "active"]}>{sp.status || "active"}</Badge>
          </div>
        </div>

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
  defaultValues?: Partial<CrmPortfolioCompany>;
  onSubmit: (data: Record<string, any>) => void;
  isPending: boolean;
  onCancel: () => void;
  isEdit?: boolean;
}) {
  const form = useForm({
    defaultValues: {
      company_name: defaultValues?.company_name || "",
      company_type: defaultValues?.company_type || "",
      headquarters_country: defaultValues?.headquarters_country || "",
      headquarters_city: defaultValues?.headquarters_city || "",
      primary_industry: defaultValues?.primary_industry || "",
      business_model: defaultValues?.business_model || "",
      website: defaultValues?.website || "",
      business_description: defaultValues?.business_description || "",
      founded_year: defaultValues?.founded_year?.toString() || "",
      employee_count: defaultValues?.employee_count?.toString() || "",
      status: defaultValues?.status || "Active",
    },
  });

  const handleSubmit = (data: any) => {
    onSubmit({
      company_name: data.company_name || null,
      company_type: data.company_type || null,
      headquarters_country: data.headquarters_country || null,
      headquarters_city: data.headquarters_city || null,
      primary_industry: data.primary_industry || null,
      business_model: data.business_model || null,
      website: data.website || null,
      business_description: data.business_description || null,
      founded_year: data.founded_year ? parseInt(data.founded_year) : null,
      employee_count: data.employee_count ? parseInt(data.employee_count) : null,
      status: data.status || "Active",
    });
  };

  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
          <SectionHeader title="Basic Information" />
          <FormField
            control={form.control}
            name="company_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company Name *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Company name" data-testid="input-pc-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="company_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Type</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., B2B SaaS, Consumer" data-testid="input-company-type" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="primary_industry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Industry</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-industry">
                        <SelectValue placeholder="Select industry" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {industryOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </div>

          <SectionHeader title="Location" />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="headquarters_country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Country" data-testid="input-pc-country" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="headquarters_city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="City" data-testid="input-pc-city" />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <SectionHeader title="Company Details" />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="founded_year"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Founded Year</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., 2015" type="number" data-testid="input-pc-founded" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="employee_count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee Count</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., 150" type="number" data-testid="input-employee-count" />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="business_model"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Business Model</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g., Subscription, Marketplace" data-testid="input-business-model" />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="business_description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Business Description</FormLabel>
                <FormControl>
                  <Textarea {...field} placeholder="Describe the business..." data-testid="input-business-desc" />
                </FormControl>
              </FormItem>
            )}
          />

          <SectionHeader title="Contact & Status" />
          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="https://example.com" data-testid="input-pc-website" />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger data-testid="select-pc-status">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
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

function PortfolioCompanyFullView({ pc, onClose }: { pc: CrmPortfolioCompany; onClose: () => void }) {
  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <div className="space-y-2">
        <SectionHeader title="Basic Information" />
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Company Name" value={pc.company_name} />
          <FieldDisplay label="Company Type" value={pc.company_type} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Primary Industry" value={pc.primary_industry} />
          <FieldDisplay label="Business Model" value={pc.business_model} />
        </div>

        <SectionHeader title="Location" />
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Country" value={pc.headquarters_country} />
          <FieldDisplay label="City" value={pc.headquarters_city} />
        </div>

        <SectionHeader title="Company Details" />
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Founded Year" value={pc.founded_year} />
          <FieldDisplay label="Employee Count" value={pc.employee_count} />
        </div>
        <FieldDisplay label="Business Description" value={pc.business_description} />

        <SectionHeader title="Contact & Status" />
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Website" value={pc.website} isLink />
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge className={statusColors[pc.status || "active"]}>{pc.status || "active"}</Badge>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </ScrollArea>
  );
}
