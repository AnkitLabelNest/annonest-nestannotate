import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Search, Plus, Building2, Globe, MapPin, DollarSign, Loader2 } from "lucide-react";

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

const currencyOptions = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "CNY"];
const firmTypeOptions = ["Private Equity", "Venture Capital", "Hedge Fund", "Real Estate", "Infrastructure", "Credit", "Multi-Strategy", "Other"];
const assetClassOptions = ["Buyout", "Growth Equity", "Venture", "Real Estate", "Infrastructure", "Credit", "Distressed", "Secondaries"];
const investorTypeOptions = ["Pension Fund", "Endowment", "Foundation", "Family Office", "Sovereign Wealth Fund", "Insurance Company", "Fund of Funds", "Bank", "Corporate", "HNWI", "Other"];
const providerTypeOptions = ["Law Firm", "Accounting", "Fund Administration", "Consulting", "Placement Agent", "Recruiting", "Technology", "Data Provider", "Other"];
const industryOptions = ["Technology", "Healthcare", "Financial Services", "Consumer", "Industrial", "Energy", "Real Estate", "Multi-Sector"];

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
  const [viewItem, setViewItem] = useState<CrmGp | null>(null);
  const [editItem, setEditItem] = useState<CrmGp | null>(null);
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
          <span className="font-medium">{gp.gp_name || "-"}</span>
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
      key: "website",
      header: "Website",
      render: (gp: CrmGp) =>
        gp.website ? (
          <a href={gp.website.startsWith("http") ? gp.website : `https://${gp.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-primary hover:underline">
            <Globe className="h-3 w-3" />
            {gp.website.replace(/^https?:\/\//, "").split("/")[0]}
          </a>
        ) : "-",
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
        onView={(gp) => setViewItem(gp)}
        onEdit={(gp) => setEditItem(gp)}
        emptyMessage="No GP firms found"
      />

      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>GP Firm Details</DialogTitle>
          </DialogHeader>
          {viewItem && <GpFirmView gp={viewItem} onClose={() => setViewItem(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit GP Firm</DialogTitle>
          </DialogHeader>
          {editItem && (
            <GpFirmForm
              defaultValues={editItem}
              onSubmit={(data) => {
                toast({ title: "Edit not implemented yet" });
                setEditItem(null);
              }}
              isPending={false}
              onCancel={() => setEditItem(null)}
              isEdit
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

function GpFirmView({ gp, onClose }: { gp: CrmGp; onClose: () => void }) {
  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">GP Name</p>
            <p className="font-medium">{gp.gp_name || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Legal Name</p>
            <p className="font-medium">{gp.gp_legal_name || "-"}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Firm Type</p>
            <p className="font-medium">{gp.firm_type || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Primary Asset Classes</p>
            <p className="font-medium">{gp.primary_asset_classes || "-"}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Country</p>
            <p className="font-medium">{gp.headquarters_country || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">City</p>
            <p className="font-medium">{gp.headquarters_city || "-"}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Total AUM</p>
            <p className="font-medium">{gp.total_aum ? `${gp.total_aum} ${gp.aum_currency || "USD"}` : "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Website</p>
            {gp.website ? (
              <a href={gp.website.startsWith("http") ? gp.website : `https://${gp.website}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                {gp.website}
              </a>
            ) : (
              <p className="font-medium">-</p>
            )}
          </div>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Status</p>
          <Badge className={statusColors[gp.status || "active"]}>{gp.status || "active"}</Badge>
        </div>
        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </ScrollArea>
  );
}

function LpFirmsTab({ searchQuery }: { searchQuery: string }) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewItem, setViewItem] = useState<CrmLp | null>(null);
  const [editItem, setEditItem] = useState<CrmLp | null>(null);
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
          <span className="font-medium">{lp.lp_name || "-"}</span>
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
        onView={(lp) => setViewItem(lp)}
        onEdit={(lp) => setEditItem(lp)}
        emptyMessage="No LP firms found"
      />

      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>LP Firm Details</DialogTitle>
          </DialogHeader>
          {viewItem && <LpFirmView lp={viewItem} onClose={() => setViewItem(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit LP Firm</DialogTitle>
          </DialogHeader>
          {editItem && (
            <LpFirmForm
              defaultValues={editItem}
              onSubmit={(data) => {
                toast({ title: "Edit not implemented yet" });
                setEditItem(null);
              }}
              isPending={false}
              onCancel={() => setEditItem(null)}
              isEdit
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

function LpFirmView({ lp, onClose }: { lp: CrmLp; onClose: () => void }) {
  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">LP Name</p>
            <p className="font-medium">{lp.lp_name || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Legal Name</p>
            <p className="font-medium">{lp.lp_legal_name || "-"}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Firm Type</p>
            <p className="font-medium">{lp.firm_type || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Investor Type</p>
            <p className="font-medium">{lp.investor_type || "-"}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Country</p>
            <p className="font-medium">{lp.headquarters_country || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">City</p>
            <p className="font-medium">{lp.headquarters_city || "-"}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Total AUM</p>
            <p className="font-medium">{lp.total_aum ? `${lp.total_aum} ${lp.aum_currency || "USD"}` : "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Website</p>
            {lp.website ? (
              <a href={lp.website.startsWith("http") ? lp.website : `https://${lp.website}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                {lp.website}
              </a>
            ) : (
              <p className="font-medium">-</p>
            )}
          </div>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Status</p>
          <Badge className={statusColors[lp.status || "active"]}>{lp.status || "active"}</Badge>
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
  const [viewItem, setViewItem] = useState<CrmServiceProvider | null>(null);
  const [editItem, setEditItem] = useState<CrmServiceProvider | null>(null);
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
          <span className="font-medium">{sp.provider_name || "-"}</span>
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
        onView={(sp) => setViewItem(sp)}
        onEdit={(sp) => setEditItem(sp)}
        emptyMessage="No service providers found"
      />

      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Service Provider Details</DialogTitle>
          </DialogHeader>
          {viewItem && <ServiceProviderView sp={viewItem} onClose={() => setViewItem(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit Service Provider</DialogTitle>
          </DialogHeader>
          {editItem && (
            <ServiceProviderForm
              defaultValues={editItem}
              onSubmit={(data) => {
                toast({ title: "Edit not implemented yet" });
                setEditItem(null);
              }}
              isPending={false}
              onCancel={() => setEditItem(null)}
              isEdit
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

function ServiceProviderView({ sp, onClose }: { sp: CrmServiceProvider; onClose: () => void }) {
  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Provider Name</p>
            <p className="font-medium">{sp.provider_name || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Provider Type</p>
            <p className="font-medium">{sp.provider_type || "-"}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Country</p>
            <p className="font-medium">{sp.headquarters_country || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">City</p>
            <p className="font-medium">{sp.headquarters_city || "-"}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Website</p>
            {sp.website ? (
              <a href={sp.website.startsWith("http") ? sp.website : `https://${sp.website}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                {sp.website}
              </a>
            ) : (
              <p className="font-medium">-</p>
            )}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Founded Year</p>
            <p className="font-medium">{sp.founded_year || "-"}</p>
          </div>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Services Offered</p>
          <p className="font-medium">{sp.services_offered || "-"}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Sector Expertise</p>
            <p className="font-medium">{sp.sector_expertise || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Geographic Coverage</p>
            <p className="font-medium">{sp.geographic_coverage || "-"}</p>
          </div>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Status</p>
          <Badge className={statusColors[sp.status || "active"]}>{sp.status || "active"}</Badge>
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
  const [viewItem, setViewItem] = useState<CrmPortfolioCompany | null>(null);
  const [editItem, setEditItem] = useState<CrmPortfolioCompany | null>(null);
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
          <span className="font-medium">{pc.company_name || "-"}</span>
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
        onView={(pc) => setViewItem(pc)}
        onEdit={(pc) => setEditItem(pc)}
        emptyMessage="No portfolio companies found"
      />

      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Portfolio Company Details</DialogTitle>
          </DialogHeader>
          {viewItem && <PortfolioCompanyView pc={viewItem} onClose={() => setViewItem(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit Portfolio Company</DialogTitle>
          </DialogHeader>
          {editItem && (
            <PortfolioCompanyForm
              defaultValues={editItem}
              onSubmit={(data) => {
                toast({ title: "Edit not implemented yet" });
                setEditItem(null);
              }}
              isPending={false}
              onCancel={() => setEditItem(null)}
              isEdit
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

function PortfolioCompanyView({ pc, onClose }: { pc: CrmPortfolioCompany; onClose: () => void }) {
  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Company Name</p>
            <p className="font-medium">{pc.company_name || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Company Type</p>
            <p className="font-medium">{pc.company_type || "-"}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Primary Industry</p>
            <p className="font-medium">{pc.primary_industry || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Business Model</p>
            <p className="font-medium">{pc.business_model || "-"}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Country</p>
            <p className="font-medium">{pc.headquarters_country || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">City</p>
            <p className="font-medium">{pc.headquarters_city || "-"}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Founded Year</p>
            <p className="font-medium">{pc.founded_year || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Employee Count</p>
            <p className="font-medium">{pc.employee_count || "-"}</p>
          </div>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Website</p>
          {pc.website ? (
            <a href={pc.website.startsWith("http") ? pc.website : `https://${pc.website}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {pc.website}
            </a>
          ) : (
            <p className="font-medium">-</p>
          )}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Business Description</p>
          <p className="font-medium">{pc.business_description || "-"}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Status</p>
          <Badge className={statusColors[pc.status || "active"]}>{pc.status || "active"}</Badge>
        </div>
        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </ScrollArea>
  );
}
