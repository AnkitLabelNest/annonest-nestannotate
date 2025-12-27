import { useState } from "react";
import { SourceTrackingSection } from "@/components/source-tracking-section";
import { EntityUrlsSection } from "@/components/entity-urls-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { useForm } from "react-hook-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Briefcase, Building2, Calendar, DollarSign, TrendingUp, Loader2, Shield, Percent, Link2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import type { EntityDeal } from "@shared/schema";

const dealRoundOptions = ["Seed", "Series A", "Series B", "Series C", "Series D+", "Growth", "Late Stage", "Pre-IPO", "IPO", "Other"];
const assetClassOptions = ["Private Equity", "Venture Capital", "Real Estate", "Infrastructure", "Credit", "Hedge Fund", "Other"];
const verificationStatuses = ["verified", "partial", "unverified"];

const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  closed: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  exited: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const dealTypeColors: Record<string, string> = {
  Buyout: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  "Growth Equity": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  Venture: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  "Real Estate": "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  Infrastructure: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
  Credit: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
};

const currencyOptions = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "CNY"];
const dealTypeOptions = ["Buyout", "Growth Equity", "Venture", "Real Estate", "Infrastructure", "Credit", "Secondaries", "M&A", "IPO", "Other"];
const sectorOptions = ["Technology", "Healthcare", "Financial Services", "Consumer", "Industrial", "Energy", "Real Estate", "Multi-Sector"];

export default function DealsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewItem, setViewItem] = useState<EntityDeal | null>(null);
  const [editItem, setEditItem] = useState<EntityDeal | null>(null);
  const { toast } = useToast();

  const { data: deals = [], isLoading, error } = useQuery<EntityDeal[]>({
    queryKey: ["/api/entities/deals"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/crm/deals", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entities/deals"] });
      setIsAddDialogOpen(false);
      toast({ title: "Deal created", description: "The deal has been added successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EntityDeal> }) => {
      const res = await apiRequest("PATCH", `/api/crm/deals/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entities/deals"] });
      setEditItem(null);
      toast({ title: "Deal updated", description: "The deal has been updated successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filteredDeals = deals.filter((d) =>
    d.dealName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.targetCompany?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns = [
    {
      key: "dealName",
      header: "Deal Name",
      sortable: true,
      render: (deal: EntityDeal) => (
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{deal.dealName || "-"}</span>
        </div>
      ),
    },
    {
      key: "targetCompany",
      header: "Target Company",
      render: (deal: EntityDeal) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span>{deal.targetCompany || "-"}</span>
        </div>
      ),
    },
    {
      key: "dealType",
      header: "Type",
      render: (deal: EntityDeal) => (
        <Badge className={dealTypeColors[deal.dealType || ""] || "bg-secondary"}>
          {deal.dealType || "-"}
        </Badge>
      ),
    },
    {
      key: "dealAmount",
      header: "Amount",
      sortable: true,
      render: (deal: EntityDeal) => (
        <div className="flex items-center gap-1 font-medium">
          <DollarSign className="h-3 w-3 text-muted-foreground" />
          {deal.dealAmount ? `${deal.dealAmount} ${deal.dealCurrency || "USD"}` : "-"}
        </div>
      ),
    },
    {
      key: "dealDate",
      header: "Date",
      sortable: true,
      render: (deal: EntityDeal) => (
        <div className="flex items-center gap-1 text-sm">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          {deal.dealDate || "-"}
        </div>
      ),
    },
    {
      key: "sector",
      header: "Sector",
      render: (deal: EntityDeal) => deal.sector || "-",
    },
    {
      key: "dealStatus",
      header: "Status",
      render: (deal: EntityDeal) => (
        <Badge className={statusColors[deal.dealStatus || "active"] || statusColors.active}>
          {deal.dealStatus || "active"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Deals</h1>
          <p className="text-muted-foreground">Track investment transactions and exits</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-deal">
              <Plus className="h-4 w-4 mr-2" />
              Add Deal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Add New Deal</DialogTitle>
            </DialogHeader>
            <DealForm
              onSubmit={(data) => createMutation.mutate(data)}
              isPending={createMutation.isPending}
              onCancel={() => setIsAddDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Deals", value: isLoading ? "-" : deals.length, icon: Briefcase },
          { label: "Active", value: isLoading ? "-" : deals.filter((d) => d.dealStatus === "active").length, icon: TrendingUp },
          { label: "Closed", value: isLoading ? "-" : deals.filter((d) => d.dealStatus === "closed").length, icon: Briefcase },
          { label: "Exited", value: isLoading ? "-" : deals.filter((d) => d.dealStatus === "exited").length, icon: TrendingUp },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
          <CardTitle>All Deals</CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search deals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
              data-testid="input-search-deals"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              Failed to load deals. Please try again.
            </div>
          ) : (
            <DataTable
              data={filteredDeals}
              columns={columns}
              entityType="deal"
              openInNewTab={true}
              emptyMessage="No deals found"
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Deal Details</DialogTitle>
          </DialogHeader>
          {viewItem && <DealView deal={viewItem} onClose={() => setViewItem(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit Deal</DialogTitle>
          </DialogHeader>
          {editItem && (
            <DealForm
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

function DealForm({
  defaultValues,
  onSubmit,
  isPending,
  onCancel,
  isEdit = false,
}: {
  defaultValues?: Partial<EntityDeal>;
  onSubmit: (data: Partial<EntityDeal>) => void;
  isPending: boolean;
  onCancel: () => void;
  isEdit?: boolean;
}) {
  const d = defaultValues as any;
  const [sourceTracking, setSourceTracking] = useState({
    sourcesUsed: d?.sources_used || [],
    sourceUrls: d?.source_urls || [],
    lastUpdatedBy: d?.last_updated_by,
    lastUpdatedOn: d?.last_updated_on,
  });
  const form = useForm({
    defaultValues: {
      deal_name: defaultValues?.dealName || d?.deal_name || "",
      deal_type: defaultValues?.dealType || d?.deal_type || "",
      deal_status: defaultValues?.dealStatus || d?.deal_status || "active",
      deal_amount: defaultValues?.dealAmount || d?.deal_amount || "",
      deal_currency: defaultValues?.dealCurrency || d?.deal_currency || "USD",
      deal_date: defaultValues?.dealDate || d?.deal_date || "",
      target_company: defaultValues?.targetCompany || d?.target_company || "",
      acquirer_company: defaultValues?.acquirerCompany || d?.acquirer_company || "",
      investor_ids: defaultValues?.investorIds || d?.investor_ids || "",
      sector: defaultValues?.sector || d?.sector || "",
      notes: defaultValues?.notes || d?.notes || "",
      deal_round: d?.dealRound || d?.deal_round || "",
      asset_class: d?.assetClass || d?.asset_class || "",
      target_company_id: d?.targetCompanyId || d?.target_company_id || "",
      acquirer_company_id: d?.acquirerCompanyId || d?.acquirer_company_id || "",
      lead_investor: d?.leadInvestor || d?.lead_investor || false,
      ownership_percentage: d?.ownershipPercentage || d?.ownership_percentage || "",
      verification_status: d?.verificationStatus || d?.verification_status || "",
      confidence_score: d?.confidenceScore || d?.confidence_score || "",
      source_urls: d?.sourceUrls || d?.source_urls || "",
    },
  });

  const handleSubmit = (data: any) => {
    onSubmit({
      deal_name: data.deal_name || null,
      deal_type: data.deal_type || null,
      deal_status: data.deal_status || "active",
      deal_amount: data.deal_amount || null,
      deal_currency: data.deal_currency || null,
      deal_date: data.deal_date || null,
      target_company: data.target_company || null,
      acquirer_company: data.acquirer_company || null,
      investor_ids: data.investor_ids || null,
      sector: data.sector || null,
      notes: data.notes || null,
      deal_round: data.deal_round || null,
      asset_class: data.asset_class || null,
      target_company_id: data.target_company_id || null,
      acquirer_company_id: data.acquirer_company_id || null,
      lead_investor: data.lead_investor || false,
      ownership_percentage: data.ownership_percentage || null,
      verification_status: data.verification_status || null,
      confidence_score: data.confidence_score ? parseInt(data.confidence_score) : null,
      sources_used: sourceTracking.sourcesUsed,
      source_urls: sourceTracking.sourceUrls,
    } as any);
  };

  const handleSourceTrackingChange = (field: string, value: any) => {
    setSourceTracking(prev => ({ ...prev, [field]: value }));
  };

  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <Form {...form}>
        <form className="space-y-6" onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Basic Information</h3>
            <FormField
              control={form.control}
              name="deal_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deal Name *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Deal name" data-testid="input-deal-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="deal_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deal Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-deal-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {dealTypeOptions.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="deal_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deal Date</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="YYYY-MM-DD" data-testid="input-deal-date" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="deal_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deal Amount</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., 100M" data-testid="input-deal-amount" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="deal_currency"
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
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Classification</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="deal_round"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deal Round</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-deal-round">
                          <SelectValue placeholder="Select round" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {dealRoundOptions.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="asset_class"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asset Class</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-asset-class">
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
            <FormField
              control={form.control}
              name="sector"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sector</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-sector">
                        <SelectValue placeholder="Select sector" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {sectorOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Parties</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="target_company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Company (Text)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Target company name" data-testid="input-target-company" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="acquirer_company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Acquirer / Investor (Text)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Acquirer or investor name" data-testid="input-acquirer" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="target_company_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Company ID</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Portfolio company ID" data-testid="input-target-company-id" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="acquirer_company_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Acquirer Company ID</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Organization ID" data-testid="input-acquirer-company-id" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="investor_ids"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Investor IDs</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Comma-separated investor IDs" data-testid="input-investor-ids" />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Investment Context</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="lead_investor"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-lead-investor"
                      />
                    </FormControl>
                    <FormLabel className="font-normal">Lead Investor</FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ownership_percentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ownership Percentage</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" min="0" max="100" placeholder="e.g., 25.5" data-testid="input-ownership" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Trust & Quality</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="verification_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verification Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-verification-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {verificationStatuses.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confidence_score"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confidence Score (0-100)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min="0" max="100" placeholder="0-100" data-testid="input-confidence" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="source_urls"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Source URLs</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Comma-separated URLs" data-testid="input-source-urls" />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Additional Info</h3>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Additional notes..." data-testid="input-notes" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="deal_status"
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
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="exited">Exited</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Source Tracking</h3>
            <SourceTrackingSection
              data={sourceTracking}
              onChange={handleSourceTrackingChange}
              isEditing={true}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} data-testid="button-submit-deal">
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? "Save Changes" : "Add Deal"}
            </Button>
          </div>
        </form>
      </Form>
    </ScrollArea>
  );
}

function DealView({ deal, onClose }: { deal: EntityDeal; onClose: () => void }) {
  const d = deal as any;
  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <div className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Basic Information</h3>
          <div>
            <p className="text-sm text-muted-foreground">Deal Name</p>
            <p className="font-medium">{deal.dealName || d.deal_name || "-"}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Deal Type</p>
              <Badge className={dealTypeColors[deal.dealType || d.deal_type || ""] || "bg-secondary"}>
                {deal.dealType || d.deal_type || "-"}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Deal Date</p>
              <p className="font-medium">{deal.dealDate || d.deal_date || "-"}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Deal Amount</p>
              <p className="font-medium">{(deal.dealAmount || d.deal_amount) ? `${deal.dealAmount || d.deal_amount} ${deal.dealCurrency || d.deal_currency || "USD"}` : "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sector</p>
              <p className="font-medium">{deal.sector || d.sector || "-"}</p>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Classification</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Deal Round</p>
              <p className="font-medium">{d.deal_round || d.dealRound || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Asset Class</p>
              <p className="font-medium">{d.asset_class || d.assetClass || "-"}</p>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Parties</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Target Company</p>
              <p className="font-medium">{deal.targetCompany || d.target_company || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Acquirer / Investor</p>
              <p className="font-medium">{deal.acquirerCompany || d.acquirer_company || "-"}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Target Company ID</p>
              <p className="font-medium">{d.target_company_id || d.targetCompanyId || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Acquirer Company ID</p>
              <p className="font-medium">{d.acquirer_company_id || d.acquirerCompanyId || "-"}</p>
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Investor IDs</p>
            <p className="font-medium">{deal.investorIds || d.investor_ids || "-"}</p>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Investment Context</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Lead Investor</p>
              <p className="font-medium">{(d.lead_investor || d.leadInvestor) ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ownership Percentage</p>
              <p className="font-medium">{d.ownership_percentage || d.ownershipPercentage ? `${d.ownership_percentage || d.ownershipPercentage}%` : "-"}</p>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Trust & Quality</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Verification Status</p>
              {(d.verification_status || d.verificationStatus) ? (
                <Badge variant={
                  (d.verification_status || d.verificationStatus) === "verified" ? "default" : 
                  (d.verification_status || d.verificationStatus) === "partial" ? "secondary" : "outline"
                }>
                  {d.verification_status || d.verificationStatus}
                </Badge>
              ) : <p className="font-medium">-</p>}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Confidence Score</p>
              <p className="font-medium">{d.confidence_score ?? d.confidenceScore ?? "-"}</p>
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Source URLs</p>
            <p className="font-medium break-all">{d.source_urls || d.sourceUrls || "-"}</p>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Additional Info</h3>
          <div>
            <p className="text-sm text-muted-foreground">Notes</p>
            <p className="font-medium">{deal.notes || d.notes || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge className={statusColors[deal.dealStatus || d.deal_status || "active"]}>
              {deal.dealStatus || d.deal_status || "active"}
            </Badge>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Source Tracking</h3>
          <SourceTrackingSection
            data={{
              sourcesUsed: d.sources_used || [],
              sourceUrls: d.source_urls || [],
              lastUpdatedBy: d.last_updated_by,
              lastUpdatedOn: d.last_updated_on,
            }}
            onChange={() => {}}
            isEditing={false}
          />
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">URLs</h3>
          <EntityUrlsSection entityType="deal" entityId={deal.id} />
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </ScrollArea>
  );
}
