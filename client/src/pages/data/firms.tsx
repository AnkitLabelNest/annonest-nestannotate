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
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useForm } from "react-hook-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Building2, Globe, MapPin, DollarSign, Loader2, Eye, Pencil, Trash2, X } from "lucide-react";
import type { EntityGp, EntityLp, EntityServiceProvider, EntityPortfolioCompany } from "@shared/schema";

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  inactive: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  prospect: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
};

const currencyOptions = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "CNY"];
const firmTypeOptions = ["Private Equity", "Venture Capital", "Hedge Fund", "Real Estate", "Infrastructure", "Credit", "Multi-Strategy", "Other"];
const assetClassOptions = ["Buyout", "Growth Equity", "Venture", "Real Estate", "Infrastructure", "Credit", "Distressed", "Secondaries"];
const investorTypeOptions = ["Pension Fund", "Endowment", "Foundation", "Family Office", "Sovereign Wealth Fund", "Insurance Company", "Fund of Funds", "Bank", "Corporate", "HNWI", "Other"];
const serviceTypeOptions = ["Law Firm", "Accounting", "Fund Administration", "Consulting", "Placement Agent", "Recruiting", "Technology", "Data Provider", "Other"];

export default function FirmsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("gp");
  const { toast } = useToast();

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
  const [viewItem, setViewItem] = useState<EntityGp | null>(null);
  const [editItem, setEditItem] = useState<EntityGp | null>(null);
  const { toast } = useToast();

  const { data: gps = [], isLoading, error } = useQuery<EntityGp[]>({
    queryKey: ["/api/entities/gp"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<EntityGp>) => {
      const res = await apiRequest("POST", "/api/entities/gp", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entities/gp"] });
      setIsAddDialogOpen(false);
      toast({ title: "GP Firm created", description: "The GP firm has been added successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EntityGp> }) => {
      const res = await apiRequest("PUT", `/api/entities/gp/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entities/gp"] });
      setEditItem(null);
      toast({ title: "GP Firm updated", description: "The GP firm has been updated successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/entities/gp/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entities/gp"] });
      toast({ title: "GP Firm deleted", description: "The GP firm has been deleted." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filteredData = gps.filter((gp) =>
    gp.gpName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    gp.gpLegalName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns = [
    {
      key: "gpName",
      header: "Firm Name",
      sortable: true,
      render: (gp: EntityGp) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{gp.gpName || "-"}</span>
        </div>
      ),
    },
    {
      key: "firmType",
      header: "Type",
      render: (gp: EntityGp) => <Badge variant="secondary">{gp.firmType || "-"}</Badge>,
    },
    {
      key: "headquarters",
      header: "Location",
      render: (gp: EntityGp) => (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {gp.headquartersCity && gp.headquartersCountry
            ? `${gp.headquartersCity}, ${gp.headquartersCountry}`
            : gp.headquartersCountry || gp.headquartersCity || "-"}
        </div>
      ),
    },
    {
      key: "totalAum",
      header: "AUM",
      render: (gp: EntityGp) => (
        <div className="flex items-center gap-1">
          <DollarSign className="h-3 w-3 text-muted-foreground" />
          {gp.totalAum ? `${gp.totalAum} ${gp.aumCurrency || "USD"}` : "-"}
        </div>
      ),
    },
    {
      key: "website",
      header: "Website",
      render: (gp: EntityGp) =>
        gp.website ? (
          <a href={gp.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-primary hover:underline">
            <Globe className="h-3 w-3" />
            {gp.website.replace(/^https?:\/\//, "").split("/")[0]}
          </a>
        ) : "-",
    },
    {
      key: "status",
      header: "Status",
      render: (gp: EntityGp) => (
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
              onSubmit={(data) => updateMutation.mutate({ id: editItem.id, data })}
              isPending={updateMutation.isPending}
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
  defaultValues?: Partial<EntityGp>;
  onSubmit: (data: Partial<EntityGp>) => void;
  isPending: boolean;
  onCancel: () => void;
  isEdit?: boolean;
}) {
  const form = useForm({
    defaultValues: {
      gpName: defaultValues?.gpName || "",
      gpLegalName: defaultValues?.gpLegalName || "",
      firmType: defaultValues?.firmType || "",
      headquartersCountry: defaultValues?.headquartersCountry || "",
      headquartersCity: defaultValues?.headquartersCity || "",
      totalAum: defaultValues?.totalAum || "",
      aumCurrency: defaultValues?.aumCurrency || "USD",
      website: defaultValues?.website || "",
      primaryAssetClasses: defaultValues?.primaryAssetClasses || "",
      status: defaultValues?.status || "active",
    },
  });

  const handleSubmit = (data: any) => {
    onSubmit({
      gpName: data.gpName || null,
      gpLegalName: data.gpLegalName || null,
      firmType: data.firmType || null,
      headquartersCountry: data.headquartersCountry || null,
      headquartersCity: data.headquartersCity || null,
      totalAum: data.totalAum || null,
      aumCurrency: data.aumCurrency || null,
      website: data.website || null,
      primaryAssetClasses: data.primaryAssetClasses || null,
      status: data.status || "active",
    });
  };

  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="gpName"
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
              name="gpLegalName"
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
              name="firmType"
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
              name="primaryAssetClasses"
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
              name="headquartersCountry"
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
              name="headquartersCity"
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
              name="totalAum"
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
              name="aumCurrency"
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
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="prospect">Prospect</SelectItem>
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

function GpFirmView({ gp, onClose }: { gp: EntityGp; onClose: () => void }) {
  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">GP Name</p>
            <p className="font-medium">{gp.gpName || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Legal Name</p>
            <p className="font-medium">{gp.gpLegalName || "-"}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Firm Type</p>
            <p className="font-medium">{gp.firmType || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Primary Asset Classes</p>
            <p className="font-medium">{gp.primaryAssetClasses || "-"}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Country</p>
            <p className="font-medium">{gp.headquartersCountry || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">City</p>
            <p className="font-medium">{gp.headquartersCity || "-"}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Total AUM</p>
            <p className="font-medium">{gp.totalAum ? `${gp.totalAum} ${gp.aumCurrency || "USD"}` : "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Website</p>
            {gp.website ? (
              <a href={gp.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
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
  const [viewItem, setViewItem] = useState<EntityLp | null>(null);
  const [editItem, setEditItem] = useState<EntityLp | null>(null);
  const { toast } = useToast();

  const { data: lps = [], isLoading, error } = useQuery<EntityLp[]>({
    queryKey: ["/api/entities/lp"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<EntityLp>) => {
      const res = await apiRequest("POST", "/api/entities/lp", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entities/lp"] });
      setIsAddDialogOpen(false);
      toast({ title: "LP Firm created", description: "The LP firm has been added successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EntityLp> }) => {
      const res = await apiRequest("PUT", `/api/entities/lp/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entities/lp"] });
      setEditItem(null);
      toast({ title: "LP Firm updated", description: "The LP firm has been updated successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filteredData = lps.filter((lp) =>
    lp.lpName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lp.lpLegalName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns = [
    {
      key: "lpName",
      header: "Firm Name",
      sortable: true,
      render: (lp: EntityLp) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{lp.lpName || "-"}</span>
        </div>
      ),
    },
    {
      key: "investorType",
      header: "Investor Type",
      render: (lp: EntityLp) => <Badge variant="secondary">{lp.investorType || "-"}</Badge>,
    },
    {
      key: "headquarters",
      header: "Location",
      render: (lp: EntityLp) => (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {lp.headquartersCity && lp.headquartersCountry
            ? `${lp.headquartersCity}, ${lp.headquartersCountry}`
            : lp.headquartersCountry || lp.headquartersCity || "-"}
        </div>
      ),
    },
    {
      key: "totalAum",
      header: "AUM",
      render: (lp: EntityLp) => (
        <div className="flex items-center gap-1">
          <DollarSign className="h-3 w-3 text-muted-foreground" />
          {lp.totalAum ? `${lp.totalAum} ${lp.aumCurrency || "USD"}` : "-"}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (lp: EntityLp) => (
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
              Add LP Firm
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Add New LP Firm</DialogTitle>
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
              onSubmit={(data) => updateMutation.mutate({ id: editItem.id, data })}
              isPending={updateMutation.isPending}
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
  defaultValues?: Partial<EntityLp>;
  onSubmit: (data: Partial<EntityLp>) => void;
  isPending: boolean;
  onCancel: () => void;
  isEdit?: boolean;
}) {
  const form = useForm({
    defaultValues: {
      lpName: defaultValues?.lpName || "",
      lpLegalName: defaultValues?.lpLegalName || "",
      investorType: defaultValues?.investorType || "",
      headquartersCountry: defaultValues?.headquartersCountry || "",
      headquartersCity: defaultValues?.headquartersCity || "",
      totalAum: defaultValues?.totalAum || "",
      aumCurrency: defaultValues?.aumCurrency || "USD",
      website: defaultValues?.website || "",
      status: defaultValues?.status || "active",
    },
  });

  const handleSubmit = (data: any) => {
    onSubmit({
      lpName: data.lpName || null,
      lpLegalName: data.lpLegalName || null,
      investorType: data.investorType || null,
      headquartersCountry: data.headquartersCountry || null,
      headquartersCity: data.headquartersCity || null,
      totalAum: data.totalAum || null,
      aumCurrency: data.aumCurrency || null,
      website: data.website || null,
      status: data.status || "active",
    });
  };

  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="lpName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>LP Name *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Firm display name" data-testid="input-lp-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lpLegalName"
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

          <FormField
            control={form.control}
            name="investorType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Investor Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger data-testid="select-investor-type">
                      <SelectValue placeholder="Select type" />
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

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="headquartersCountry"
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
              name="headquartersCity"
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
              name="totalAum"
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
              name="aumCurrency"
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
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="prospect">Prospect</SelectItem>
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
              {isEdit ? "Save Changes" : "Add LP Firm"}
            </Button>
          </div>
        </form>
      </Form>
    </ScrollArea>
  );
}

function LpFirmView({ lp, onClose }: { lp: EntityLp; onClose: () => void }) {
  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">LP Name</p>
            <p className="font-medium">{lp.lpName || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Legal Name</p>
            <p className="font-medium">{lp.lpLegalName || "-"}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Investor Type</p>
            <p className="font-medium">{lp.investorType || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total AUM</p>
            <p className="font-medium">{lp.totalAum ? `${lp.totalAum} ${lp.aumCurrency || "USD"}` : "-"}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Country</p>
            <p className="font-medium">{lp.headquartersCountry || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">City</p>
            <p className="font-medium">{lp.headquartersCity || "-"}</p>
          </div>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Website</p>
          {lp.website ? (
            <a href={lp.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {lp.website}
            </a>
          ) : (
            <p className="font-medium">-</p>
          )}
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
  const [viewItem, setViewItem] = useState<EntityServiceProvider | null>(null);
  const [editItem, setEditItem] = useState<EntityServiceProvider | null>(null);
  const { toast } = useToast();

  const { data: sps = [], isLoading, error } = useQuery<EntityServiceProvider[]>({
    queryKey: ["/api/entities/service-providers"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<EntityServiceProvider>) => {
      const res = await apiRequest("POST", "/api/entities/service-providers", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entities/service-providers"] });
      setIsAddDialogOpen(false);
      toast({ title: "Service Provider created", description: "The service provider has been added." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EntityServiceProvider> }) => {
      const res = await apiRequest("PUT", `/api/entities/service-providers/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entities/service-providers"] });
      setEditItem(null);
      toast({ title: "Service Provider updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filteredData = sps.filter((sp) =>
    sp.providerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sp.providerLegalName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns = [
    {
      key: "providerName",
      header: "Provider Name",
      sortable: true,
      render: (sp: EntityServiceProvider) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{sp.providerName || "-"}</span>
        </div>
      ),
    },
    {
      key: "serviceType",
      header: "Service Type",
      render: (sp: EntityServiceProvider) => <Badge variant="secondary">{sp.serviceType || "-"}</Badge>,
    },
    {
      key: "headquarters",
      header: "Location",
      render: (sp: EntityServiceProvider) => (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {sp.headquartersCity && sp.headquartersCountry
            ? `${sp.headquartersCity}, ${sp.headquartersCountry}`
            : sp.headquartersCountry || sp.headquartersCity || "-"}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (sp: EntityServiceProvider) => (
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Service Provider Details</DialogTitle>
          </DialogHeader>
          {viewItem && <ServiceProviderView sp={viewItem} onClose={() => setViewItem(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Service Provider</DialogTitle>
          </DialogHeader>
          {editItem && (
            <ServiceProviderForm
              defaultValues={editItem}
              onSubmit={(data) => updateMutation.mutate({ id: editItem.id, data })}
              isPending={updateMutation.isPending}
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
  defaultValues?: Partial<EntityServiceProvider>;
  onSubmit: (data: Partial<EntityServiceProvider>) => void;
  isPending: boolean;
  onCancel: () => void;
  isEdit?: boolean;
}) {
  const form = useForm({
    defaultValues: {
      providerName: defaultValues?.providerName || "",
      providerLegalName: defaultValues?.providerLegalName || "",
      serviceType: defaultValues?.serviceType || "",
      headquartersCountry: defaultValues?.headquartersCountry || "",
      headquartersCity: defaultValues?.headquartersCity || "",
      website: defaultValues?.website || "",
      primaryServices: defaultValues?.primaryServices || "",
      status: defaultValues?.status || "active",
    },
  });

  const handleSubmit = (data: any) => {
    onSubmit({
      providerName: data.providerName || null,
      providerLegalName: data.providerLegalName || null,
      serviceType: data.serviceType || null,
      headquartersCountry: data.headquartersCountry || null,
      headquartersCity: data.headquartersCity || null,
      website: data.website || null,
      primaryServices: data.primaryServices || null,
      status: data.status || "active",
    });
  };

  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="providerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provider Name *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Provider name" data-testid="input-sp-name" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="providerLegalName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Legal Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Legal entity name" data-testid="input-sp-legal-name" />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="serviceType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Service Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger data-testid="select-service-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {serviceTypeOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="primaryServices"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Primary Services</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g., M&A Advisory, Fund Formation" data-testid="input-primary-services" />
                </FormControl>
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="headquartersCountry"
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
              name="headquartersCity"
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
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit" disabled={isPending} data-testid="button-submit-sp">
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? "Save Changes" : "Add Provider"}
            </Button>
          </div>
        </form>
      </Form>
    </ScrollArea>
  );
}

function ServiceProviderView({ sp, onClose }: { sp: EntityServiceProvider; onClose: () => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><p className="text-sm text-muted-foreground">Provider Name</p><p className="font-medium">{sp.providerName || "-"}</p></div>
        <div><p className="text-sm text-muted-foreground">Legal Name</p><p className="font-medium">{sp.providerLegalName || "-"}</p></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><p className="text-sm text-muted-foreground">Service Type</p><p className="font-medium">{sp.serviceType || "-"}</p></div>
        <div><p className="text-sm text-muted-foreground">Primary Services</p><p className="font-medium">{sp.primaryServices || "-"}</p></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><p className="text-sm text-muted-foreground">Country</p><p className="font-medium">{sp.headquartersCountry || "-"}</p></div>
        <div><p className="text-sm text-muted-foreground">City</p><p className="font-medium">{sp.headquartersCity || "-"}</p></div>
      </div>
      <div><p className="text-sm text-muted-foreground">Website</p>{sp.website ? <a href={sp.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{sp.website}</a> : <p>-</p>}</div>
      <div><p className="text-sm text-muted-foreground">Status</p><Badge className={statusColors[sp.status || "active"]}>{sp.status || "active"}</Badge></div>
      <div className="flex justify-end pt-4"><Button variant="outline" onClick={onClose}>Close</Button></div>
    </div>
  );
}

function PortfolioCompaniesTab({ searchQuery }: { searchQuery: string }) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewItem, setViewItem] = useState<EntityPortfolioCompany | null>(null);
  const [editItem, setEditItem] = useState<EntityPortfolioCompany | null>(null);
  const { toast } = useToast();

  const { data: pcs = [], isLoading, error } = useQuery<EntityPortfolioCompany[]>({
    queryKey: ["/api/entities/portfolio-companies"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<EntityPortfolioCompany>) => {
      const res = await apiRequest("POST", "/api/entities/portfolio-companies", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entities/portfolio-companies"] });
      setIsAddDialogOpen(false);
      toast({ title: "Portfolio Company created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EntityPortfolioCompany> }) => {
      const res = await apiRequest("PUT", `/api/entities/portfolio-companies/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entities/portfolio-companies"] });
      setEditItem(null);
      toast({ title: "Portfolio Company updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filteredData = pcs.filter((pc) =>
    pc.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pc.companyLegalName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns = [
    {
      key: "companyName",
      header: "Company Name",
      sortable: true,
      render: (pc: EntityPortfolioCompany) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{pc.companyName || "-"}</span>
        </div>
      ),
    },
    {
      key: "sector",
      header: "Sector",
      render: (pc: EntityPortfolioCompany) => <Badge variant="secondary">{pc.sector || "-"}</Badge>,
    },
    {
      key: "headquarters",
      header: "Location",
      render: (pc: EntityPortfolioCompany) => (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {pc.headquartersCity && pc.headquartersCountry
            ? `${pc.headquartersCity}, ${pc.headquartersCountry}`
            : pc.headquartersCountry || pc.headquartersCity || "-"}
        </div>
      ),
    },
    {
      key: "investmentStage",
      header: "Stage",
      render: (pc: EntityPortfolioCompany) => pc.investmentStage || "-",
    },
    {
      key: "status",
      header: "Status",
      render: (pc: EntityPortfolioCompany) => (
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Portfolio Company Details</DialogTitle>
          </DialogHeader>
          {viewItem && <PortfolioCompanyView pc={viewItem} onClose={() => setViewItem(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Portfolio Company</DialogTitle>
          </DialogHeader>
          {editItem && (
            <PortfolioCompanyForm
              defaultValues={editItem}
              onSubmit={(data) => updateMutation.mutate({ id: editItem.id, data })}
              isPending={updateMutation.isPending}
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
  defaultValues?: Partial<EntityPortfolioCompany>;
  onSubmit: (data: Partial<EntityPortfolioCompany>) => void;
  isPending: boolean;
  onCancel: () => void;
  isEdit?: boolean;
}) {
  const form = useForm({
    defaultValues: {
      companyName: defaultValues?.companyName || "",
      companyLegalName: defaultValues?.companyLegalName || "",
      sector: defaultValues?.sector || "",
      headquartersCountry: defaultValues?.headquartersCountry || "",
      headquartersCity: defaultValues?.headquartersCity || "",
      website: defaultValues?.website || "",
      investmentStage: defaultValues?.investmentStage || "",
      status: defaultValues?.status || "active",
    },
  });

  const handleSubmit = (data: any) => {
    onSubmit({
      companyName: data.companyName || null,
      companyLegalName: data.companyLegalName || null,
      sector: data.sector || null,
      headquartersCountry: data.headquartersCountry || null,
      headquartersCity: data.headquartersCity || null,
      website: data.website || null,
      investmentStage: data.investmentStage || null,
      status: data.status || "active",
    });
  };

  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Company name" data-testid="input-pc-name" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="companyLegalName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Legal Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Legal entity name" data-testid="input-pc-legal-name" />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="sector"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sector</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Technology, Healthcare" data-testid="input-pc-sector" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="investmentStage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Investment Stage</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Seed, Series A, Growth" data-testid="input-pc-stage" />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="headquartersCountry"
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
              name="headquartersCity"
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
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="exited">Exited</SelectItem>
                    <SelectItem value="written_off">Written Off</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit" disabled={isPending} data-testid="button-submit-pc">
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? "Save Changes" : "Add Company"}
            </Button>
          </div>
        </form>
      </Form>
    </ScrollArea>
  );
}

function PortfolioCompanyView({ pc, onClose }: { pc: EntityPortfolioCompany; onClose: () => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><p className="text-sm text-muted-foreground">Company Name</p><p className="font-medium">{pc.companyName || "-"}</p></div>
        <div><p className="text-sm text-muted-foreground">Legal Name</p><p className="font-medium">{pc.companyLegalName || "-"}</p></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><p className="text-sm text-muted-foreground">Sector</p><p className="font-medium">{pc.sector || "-"}</p></div>
        <div><p className="text-sm text-muted-foreground">Investment Stage</p><p className="font-medium">{pc.investmentStage || "-"}</p></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><p className="text-sm text-muted-foreground">Country</p><p className="font-medium">{pc.headquartersCountry || "-"}</p></div>
        <div><p className="text-sm text-muted-foreground">City</p><p className="font-medium">{pc.headquartersCity || "-"}</p></div>
      </div>
      <div><p className="text-sm text-muted-foreground">Website</p>{pc.website ? <a href={pc.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{pc.website}</a> : <p>-</p>}</div>
      <div><p className="text-sm text-muted-foreground">Status</p><Badge className={statusColors[pc.status || "active"]}>{pc.status || "active"}</Badge></div>
      <div className="flex justify-end pt-4"><Button variant="outline" onClick={onClose}>Close</Button></div>
    </div>
  );
}
