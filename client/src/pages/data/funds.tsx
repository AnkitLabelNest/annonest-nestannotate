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
import { useForm } from "react-hook-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Wallet, Calendar, TrendingUp, DollarSign, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { EntityFund } from "@shared/schema";

const statusColors: Record<string, string> = {
  fundraising: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  investing: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  harvesting: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  closed: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  active: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

const currencyOptions = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "CNY"];
const fundTypeOptions = ["Buyout", "Venture Capital", "Growth Equity", "Real Estate", "Infrastructure", "Credit", "Secondaries", "Fund of Funds", "Co-Investment", "Other"];
const sectorOptions = ["Technology", "Healthcare", "Financial Services", "Consumer", "Industrial", "Energy", "Real Estate", "Multi-Sector"];
const geographyOptions = ["North America", "Europe", "Asia Pacific", "Global", "Latin America", "Middle East", "Africa", "Emerging Markets"];

export default function FundsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewItem, setViewItem] = useState<EntityFund | null>(null);
  const [editItem, setEditItem] = useState<EntityFund | null>(null);
  const { toast } = useToast();

  const { data: funds = [], isLoading, error } = useQuery<EntityFund[]>({
    queryKey: ["/api/crm/funds"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("POST", "/api/crm/funds", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/funds"] });
      setIsAddDialogOpen(false);
      toast({ title: "Fund created", description: "The fund has been added successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      const res = await apiRequest("PATCH", `/api/crm/funds/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/funds"] });
      setEditItem(null);
      toast({ title: "Fund updated", description: "The fund has been updated successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filteredFunds = funds.filter((f: any) =>
    f.fund_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns = [
    {
      key: "fund_name",
      header: "Fund Name",
      sortable: true,
      render: (fund: any) => (
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{fund.fund_name || "-"}</span>
        </div>
      ),
    },
    {
      key: "vintage_year",
      header: "Vintage",
      sortable: true,
      render: (fund: any) => (
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          <span>{fund.vintage_year || "-"}</span>
        </div>
      ),
    },
    {
      key: "fund_type",
      header: "Type",
      render: (fund: any) => <Badge variant="secondary">{fund.fund_type || "-"}</Badge>,
    },
    {
      key: "target_size",
      header: "Target Size",
      render: (fund: any) => (
        <div className="flex items-center gap-1">
          <DollarSign className="h-3 w-3 text-muted-foreground" />
          {fund.target_size ? `${fund.target_size} ${fund.target_size_currency || "USD"}` : "-"}
        </div>
      ),
    },
    {
      key: "fund_status",
      header: "Status",
      render: (fund: any) => (
        <Badge className={statusColors[fund.fund_status || "active"] || statusColors.active}>
          {fund.fund_status || "active"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Funds</h1>
          <p className="text-muted-foreground">Track fund vehicles and their status</p>
        </div>
        <Button 
          data-testid="button-add-fund"
          onClick={() => window.open("/entity/fund/new", "_blank")}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Fund
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Funds", value: isLoading ? "-" : funds.length, icon: Wallet },
          { label: "Fundraising", value: isLoading ? "-" : funds.filter((f) => f.fundStatus === "fundraising").length, icon: TrendingUp },
          { label: "Investing", value: isLoading ? "-" : funds.filter((f) => f.fundStatus === "investing").length, icon: TrendingUp },
          { label: "Closed", value: isLoading ? "-" : funds.filter((f) => f.fundStatus === "closed").length, icon: Wallet },
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
          <CardTitle>All Funds</CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search funds..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
              data-testid="input-search-funds"
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
              Failed to load funds. Please try again.
            </div>
          ) : (
            <DataTable
              data={filteredFunds}
              columns={columns}
              entityType="fund"
              openInNewTab={true}
              emptyMessage="No funds found"
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Fund Details</DialogTitle>
          </DialogHeader>
          {viewItem && <FundView fund={viewItem} onClose={() => setViewItem(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit Fund</DialogTitle>
          </DialogHeader>
          {editItem && (
            <FundForm
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

function SectionHeader({ title }: { title: string }) {
  return <h3 className="text-sm font-semibold text-muted-foreground pt-4 pb-2 border-b">{title}</h3>;
}

function FieldDisplay({ label, value, isLink = false }: { label: string; value: any; isLink?: boolean }) {
  const displayValue = value === null || value === undefined || value === "" ? "-" : String(value);
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      {isLink && displayValue !== "-" ? (
        <a href={displayValue} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">{displayValue}</a>
      ) : (
        <p className="font-medium">{displayValue}</p>
      )}
    </div>
  );
}

const investmentStageOptions = ["Seed", "Early Stage", "Growth", "Late Stage", "Buyout", "Secondaries", "All Stages"];

function FundForm({
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
  const [sourceTracking, setSourceTracking] = useState({
    sourcesUsed: dv.sources_used || [],
    sourceUrls: dv.source_urls || [],
    lastUpdatedBy: dv.last_updated_by,
    lastUpdatedOn: dv.last_updated_on,
  });
  const form = useForm({
    defaultValues: {
      fund_name: dv.fund_name || "",
      fund_legal_name: dv.fund_legal_name || "",
      fund_short_name: dv.fund_short_name || "",
      fund_type: dv.fund_type || "",
      vintage_year: dv.vintage_year?.toString() || "",
      target_size: dv.target_size?.toString() || "",
      target_size_currency: dv.target_size_currency || "USD",
      final_close_size: dv.final_close_size?.toString() || "",
      final_close_date: dv.final_close_date || "",
      first_close_date: dv.first_close_date || "",
      investment_period_end: dv.investment_period_end || "",
      fund_term_years: dv.fund_term_years?.toString() || "",
      extension_years: dv.extension_years?.toString() || "",
      strategy_focus: dv.strategy_focus || "",
      primary_asset_class: dv.primary_asset_class || "",
      geographic_focus: dv.geographic_focus || "",
      industry_focus: dv.industry_focus || "",
      investment_stages: dv.investment_stages || "",
      target_investment_size_min: dv.target_investment_size_min?.toString() || "",
      target_investment_size_max: dv.target_investment_size_max?.toString() || "",
      target_irr: dv.target_irr?.toString() || "",
      target_multiple: dv.target_multiple?.toString() || "",
      realized_irr: dv.realized_irr?.toString() || "",
      realized_multiple: dv.realized_multiple?.toString() || "",
      dpi: dv.dpi?.toString() || "",
      rvpi: dv.rvpi?.toString() || "",
      tvpi: dv.tvpi?.toString() || "",
      management_fee_rate: dv.management_fee_rate?.toString() || "",
      carried_interest_rate: dv.carried_interest_rate?.toString() || "",
      hurdle_rate: dv.hurdle_rate?.toString() || "",
      gp_commitment_percentage: dv.gp_commitment_percentage?.toString() || "",
      esg_policy_available: dv.esg_policy_available ? "true" : "false",
      pri_signatory: dv.pri_signatory ? "true" : "false",
      impact_fund: dv.impact_fund ? "true" : "false",
      dei_policy_available: dv.dei_policy_available ? "true" : "false",
      sustainability_report_url: dv.sustainability_report_url || "",
      data_confidence_score: dv.data_confidence_score?.toString() || "",
      verification_method: dv.verification_method || "",
      last_verified_date: dv.last_verified_date || "",
      website: dv.website || "",
      notes: dv.notes || "",
      fund_status: dv.fund_status || "fundraising",
      status: dv.status || "Active",
    },
  });

  const handleSubmit = (data: any) => {
    onSubmit({
      fund_name: data.fund_name || null,
      fund_legal_name: data.fund_legal_name || null,
      fund_short_name: data.fund_short_name || null,
      fund_type: data.fund_type || null,
      vintage_year: data.vintage_year ? parseInt(data.vintage_year) : null,
      target_size: data.target_size ? parseFloat(data.target_size) : null,
      target_size_currency: data.target_size_currency || "USD",
      final_close_size: data.final_close_size ? parseFloat(data.final_close_size) : null,
      final_close_date: data.final_close_date || null,
      first_close_date: data.first_close_date || null,
      investment_period_end: data.investment_period_end || null,
      fund_term_years: data.fund_term_years ? parseInt(data.fund_term_years) : null,
      extension_years: data.extension_years ? parseInt(data.extension_years) : null,
      strategy_focus: data.strategy_focus || null,
      primary_asset_class: data.primary_asset_class || null,
      geographic_focus: data.geographic_focus || null,
      industry_focus: data.industry_focus || null,
      investment_stages: data.investment_stages || null,
      target_investment_size_min: data.target_investment_size_min ? parseFloat(data.target_investment_size_min) : null,
      target_investment_size_max: data.target_investment_size_max ? parseFloat(data.target_investment_size_max) : null,
      target_irr: data.target_irr ? parseFloat(data.target_irr) : null,
      target_multiple: data.target_multiple ? parseFloat(data.target_multiple) : null,
      realized_irr: data.realized_irr ? parseFloat(data.realized_irr) : null,
      realized_multiple: data.realized_multiple ? parseFloat(data.realized_multiple) : null,
      dpi: data.dpi ? parseFloat(data.dpi) : null,
      rvpi: data.rvpi ? parseFloat(data.rvpi) : null,
      tvpi: data.tvpi ? parseFloat(data.tvpi) : null,
      management_fee_rate: data.management_fee_rate ? parseFloat(data.management_fee_rate) : null,
      carried_interest_rate: data.carried_interest_rate ? parseFloat(data.carried_interest_rate) : null,
      hurdle_rate: data.hurdle_rate ? parseFloat(data.hurdle_rate) : null,
      gp_commitment_percentage: data.gp_commitment_percentage ? parseFloat(data.gp_commitment_percentage) : null,
      esg_policy_available: data.esg_policy_available === "true",
      pri_signatory: data.pri_signatory === "true",
      impact_fund: data.impact_fund === "true",
      dei_policy_available: data.dei_policy_available === "true",
      sustainability_report_url: data.sustainability_report_url || null,
      data_confidence_score: data.data_confidence_score ? parseFloat(data.data_confidence_score) : null,
      verification_method: data.verification_method || null,
      last_verified_date: data.last_verified_date || null,
      website: data.website || null,
      notes: data.notes || null,
      fund_status: data.fund_status || "fundraising",
      status: data.status || "Active",
      sources_used: sourceTracking.sourcesUsed,
      source_urls: sourceTracking.sourceUrls,
    });
  };

  const handleSourceTrackingChange = (field: string, value: any) => {
    setSourceTracking(prev => ({ ...prev, [field]: value }));
  };

  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
          <SectionHeader title="Basic Information" />
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="fund_name" render={({ field }) => (
              <FormItem><FormLabel>Fund Name *</FormLabel><FormControl><Input {...field} placeholder="Fund name" data-testid="input-fund-name" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="fund_legal_name" render={({ field }) => (
              <FormItem><FormLabel>Legal Name</FormLabel><FormControl><Input {...field} placeholder="Legal entity name" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="fund_short_name" render={({ field }) => (
              <FormItem><FormLabel>Short Name</FormLabel><FormControl><Input {...field} placeholder="Abbreviation" /></FormControl></FormItem>
            )} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="fund_type" render={({ field }) => (
              <FormItem><FormLabel>Fund Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                  <SelectContent>{fundTypeOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="vintage_year" render={({ field }) => (
              <FormItem><FormLabel>Vintage Year</FormLabel><FormControl><Input {...field} type="number" placeholder="e.g., 2024" /></FormControl></FormItem>
            )} />
          </div>

          <SectionHeader title="Size & Timeline" />
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="target_size" render={({ field }) => (
              <FormItem><FormLabel>Target Size</FormLabel><FormControl><Input {...field} type="number" placeholder="0" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="target_size_currency" render={({ field }) => (
              <FormItem><FormLabel>Currency</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{currencyOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="final_close_size" render={({ field }) => (
              <FormItem><FormLabel>Final Close Size</FormLabel><FormControl><Input {...field} type="number" placeholder="0" /></FormControl></FormItem>
            )} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="first_close_date" render={({ field }) => (
              <FormItem><FormLabel>First Close Date</FormLabel><FormControl><Input {...field} type="date" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="final_close_date" render={({ field }) => (
              <FormItem><FormLabel>Final Close Date</FormLabel><FormControl><Input {...field} type="date" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="investment_period_end" render={({ field }) => (
              <FormItem><FormLabel>Investment Period End</FormLabel><FormControl><Input {...field} type="date" /></FormControl></FormItem>
            )} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="fund_term_years" render={({ field }) => (
              <FormItem><FormLabel>Fund Term (Years)</FormLabel><FormControl><Input {...field} type="number" placeholder="10" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="extension_years" render={({ field }) => (
              <FormItem><FormLabel>Extension Years</FormLabel><FormControl><Input {...field} type="number" placeholder="2" /></FormControl></FormItem>
            )} />
          </div>

          <SectionHeader title="Strategy" />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="strategy_focus" render={({ field }) => (
              <FormItem><FormLabel>Strategy Focus</FormLabel><FormControl><Input {...field} placeholder="e.g., Growth Equity" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="primary_asset_class" render={({ field }) => (
              <FormItem><FormLabel>Primary Asset Class</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                  <SelectContent>{sectorOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="geographic_focus" render={({ field }) => (
              <FormItem><FormLabel>Geographic Focus</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                  <SelectContent>{geographyOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="industry_focus" render={({ field }) => (
              <FormItem><FormLabel>Industry Focus</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                  <SelectContent>{sectorOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="investment_stages" render={({ field }) => (
              <FormItem><FormLabel>Investment Stages</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                  <SelectContent>{investmentStageOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select></FormItem>
            )} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="target_investment_size_min" render={({ field }) => (
              <FormItem><FormLabel>Min Investment Size</FormLabel><FormControl><Input {...field} type="number" placeholder="0" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="target_investment_size_max" render={({ field }) => (
              <FormItem><FormLabel>Max Investment Size</FormLabel><FormControl><Input {...field} type="number" placeholder="0" /></FormControl></FormItem>
            )} />
          </div>

          <SectionHeader title="Performance Targets" />
          <div className="grid grid-cols-4 gap-4">
            <FormField control={form.control} name="target_irr" render={({ field }) => (
              <FormItem><FormLabel>Target IRR %</FormLabel><FormControl><Input {...field} type="number" step="0.1" placeholder="20" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="target_multiple" render={({ field }) => (
              <FormItem><FormLabel>Target Multiple</FormLabel><FormControl><Input {...field} type="number" step="0.1" placeholder="2.5" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="realized_irr" render={({ field }) => (
              <FormItem><FormLabel>Realized IRR %</FormLabel><FormControl><Input {...field} type="number" step="0.1" placeholder="0" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="realized_multiple" render={({ field }) => (
              <FormItem><FormLabel>Realized Multiple</FormLabel><FormControl><Input {...field} type="number" step="0.1" placeholder="0" /></FormControl></FormItem>
            )} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="dpi" render={({ field }) => (
              <FormItem><FormLabel>DPI</FormLabel><FormControl><Input {...field} type="number" step="0.01" placeholder="0" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="rvpi" render={({ field }) => (
              <FormItem><FormLabel>RVPI</FormLabel><FormControl><Input {...field} type="number" step="0.01" placeholder="0" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="tvpi" render={({ field }) => (
              <FormItem><FormLabel>TVPI</FormLabel><FormControl><Input {...field} type="number" step="0.01" placeholder="0" /></FormControl></FormItem>
            )} />
          </div>

          <SectionHeader title="Fee Structure" />
          <div className="grid grid-cols-4 gap-4">
            <FormField control={form.control} name="management_fee_rate" render={({ field }) => (
              <FormItem><FormLabel>Mgmt Fee %</FormLabel><FormControl><Input {...field} type="number" step="0.1" placeholder="2" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="carried_interest_rate" render={({ field }) => (
              <FormItem><FormLabel>Carry %</FormLabel><FormControl><Input {...field} type="number" step="0.1" placeholder="20" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="hurdle_rate" render={({ field }) => (
              <FormItem><FormLabel>Hurdle %</FormLabel><FormControl><Input {...field} type="number" step="0.1" placeholder="8" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="gp_commitment_percentage" render={({ field }) => (
              <FormItem><FormLabel>GP Commit %</FormLabel><FormControl><Input {...field} type="number" step="0.1" placeholder="1" /></FormControl></FormItem>
            )} />
          </div>

          <SectionHeader title="ESG & Sustainability" />
          <div className="grid grid-cols-4 gap-4">
            <FormField control={form.control} name="esg_policy_available" render={({ field }) => (
              <FormItem><FormLabel>ESG Policy</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent><SelectItem value="true">Yes</SelectItem><SelectItem value="false">No</SelectItem></SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="pri_signatory" render={({ field }) => (
              <FormItem><FormLabel>PRI Signatory</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent><SelectItem value="true">Yes</SelectItem><SelectItem value="false">No</SelectItem></SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="impact_fund" render={({ field }) => (
              <FormItem><FormLabel>Impact Fund</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent><SelectItem value="true">Yes</SelectItem><SelectItem value="false">No</SelectItem></SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="dei_policy_available" render={({ field }) => (
              <FormItem><FormLabel>DEI Policy</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent><SelectItem value="true">Yes</SelectItem><SelectItem value="false">No</SelectItem></SelectContent>
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
            <FormField control={form.control} name="fund_status" render={({ field }) => (
              <FormItem><FormLabel>Fund Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="fundraising">Fundraising</SelectItem>
                    <SelectItem value="investing">Investing</SelectItem>
                    <SelectItem value="harvesting">Harvesting</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select></FormItem>
            )} />
          </div>
          <FormField control={form.control} name="status" render={({ field }) => (
            <FormItem><FormLabel>Record Status</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem></SelectContent>
              </Select></FormItem>
          )} />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Source Tracking</h3>
            <SourceTrackingSection
              data={sourceTracking}
              onChange={handleSourceTrackingChange}
              isEditing={true}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit" disabled={isPending} data-testid="button-submit-fund">
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? "Save Changes" : "Add Fund"}
            </Button>
          </div>
        </form>
      </Form>
    </ScrollArea>
  );
}

function FundView({ fund, onClose }: { fund: any; onClose: () => void }) {
  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <div className="space-y-2">
        <SectionHeader title="Basic Information" />
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="Fund Name" value={fund.fund_name} />
          <FieldDisplay label="Legal Name" value={fund.fund_legal_name} />
          <FieldDisplay label="Short Name" value={fund.fund_short_name} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Fund Type" value={fund.fund_type} />
          <FieldDisplay label="Vintage Year" value={fund.vintage_year} />
        </div>

        <SectionHeader title="Size & Timeline" />
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="Target Size" value={fund.target_size ? `${fund.target_size} ${fund.target_size_currency || "USD"}` : null} />
          <FieldDisplay label="Final Close Size" value={fund.final_close_size} />
          <FieldDisplay label="Currency" value={fund.target_size_currency} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="First Close Date" value={fund.first_close_date} />
          <FieldDisplay label="Final Close Date" value={fund.final_close_date} />
          <FieldDisplay label="Investment Period End" value={fund.investment_period_end} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Fund Term (Years)" value={fund.fund_term_years} />
          <FieldDisplay label="Extension Years" value={fund.extension_years} />
        </div>

        <SectionHeader title="Strategy" />
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Strategy Focus" value={fund.strategy_focus} />
          <FieldDisplay label="Primary Asset Class" value={fund.primary_asset_class} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="Geographic Focus" value={fund.geographic_focus} />
          <FieldDisplay label="Industry Focus" value={fund.industry_focus} />
          <FieldDisplay label="Investment Stages" value={fund.investment_stages} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Min Investment Size" value={fund.target_investment_size_min} />
          <FieldDisplay label="Max Investment Size" value={fund.target_investment_size_max} />
        </div>

        <SectionHeader title="Performance" />
        <div className="grid grid-cols-4 gap-4">
          <FieldDisplay label="Target IRR %" value={fund.target_irr} />
          <FieldDisplay label="Target Multiple" value={fund.target_multiple} />
          <FieldDisplay label="Realized IRR %" value={fund.realized_irr} />
          <FieldDisplay label="Realized Multiple" value={fund.realized_multiple} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="DPI" value={fund.dpi} />
          <FieldDisplay label="RVPI" value={fund.rvpi} />
          <FieldDisplay label="TVPI" value={fund.tvpi} />
        </div>

        <SectionHeader title="Fee Structure" />
        <div className="grid grid-cols-4 gap-4">
          <FieldDisplay label="Mgmt Fee %" value={fund.management_fee_rate} />
          <FieldDisplay label="Carry %" value={fund.carried_interest_rate} />
          <FieldDisplay label="Hurdle %" value={fund.hurdle_rate} />
          <FieldDisplay label="GP Commit %" value={fund.gp_commitment_percentage} />
        </div>

        <SectionHeader title="ESG & Sustainability" />
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">ESG Policy</p>
            <Badge variant={fund.esg_policy_available ? "default" : "secondary"}>{fund.esg_policy_available ? "Yes" : "No"}</Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">PRI Signatory</p>
            <Badge variant={fund.pri_signatory ? "default" : "secondary"}>{fund.pri_signatory ? "Yes" : "No"}</Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Impact Fund</p>
            <Badge variant={fund.impact_fund ? "default" : "secondary"}>{fund.impact_fund ? "Yes" : "No"}</Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">DEI Policy</p>
            <Badge variant={fund.dei_policy_available ? "default" : "secondary"}>{fund.dei_policy_available ? "Yes" : "No"}</Badge>
          </div>
        </div>
        <FieldDisplay label="Sustainability Report" value={fund.sustainability_report_url} isLink />

        <SectionHeader title="Data Quality" />
        <div className="grid grid-cols-3 gap-4">
          <FieldDisplay label="Confidence Score" value={fund.data_confidence_score} />
          <FieldDisplay label="Verification Method" value={fund.verification_method} />
          <FieldDisplay label="Last Verified" value={fund.last_verified_date} />
        </div>

        <SectionHeader title="Contact & Status" />
        <div className="grid grid-cols-2 gap-4">
          <FieldDisplay label="Website" value={fund.website} isLink />
          <div>
            <p className="text-sm text-muted-foreground">Fund Status</p>
            <Badge className={statusColors[fund.fund_status || "active"]}>{fund.fund_status || "-"}</Badge>
          </div>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Record Status</p>
          <Badge className={statusColors[fund.status || "active"]}>{fund.status || "active"}</Badge>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Source Tracking</h3>
          <SourceTrackingSection
            data={{
              sourcesUsed: fund.sources_used || [],
              sourceUrls: fund.source_urls || [],
              lastUpdatedBy: fund.last_updated_by,
              lastUpdatedOn: fund.last_updated_on,
            }}
            onChange={() => {}}
            isEditing={false}
          />
        </div>

        <SectionHeader title="URLs" />
        <EntityUrlsSection entityType="fund" entityId={fund.id} />

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </ScrollArea>
  );
}
