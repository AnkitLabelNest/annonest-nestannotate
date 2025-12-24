import { useState } from "react";
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
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-fund">
              <Plus className="h-4 w-4 mr-2" />
              Add Fund
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Add New Fund</DialogTitle>
            </DialogHeader>
            <FundForm
              onSubmit={(data) => createMutation.mutate(data)}
              isPending={createMutation.isPending}
              onCancel={() => setIsAddDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
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
              onView={(fund) => setViewItem(fund)}
              onEdit={(fund) => setEditItem(fund)}
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

function FundForm({
  defaultValues,
  onSubmit,
  isPending,
  onCancel,
  isEdit = false,
}: {
  defaultValues?: Partial<EntityFund>;
  onSubmit: (data: Partial<EntityFund>) => void;
  isPending: boolean;
  onCancel: () => void;
  isEdit?: boolean;
}) {
  const dv = defaultValues as any;
  const form = useForm({
    defaultValues: {
      fundName: dv?.fund_name || "",
      fundType: dv?.fund_type || "",
      vintageYear: dv?.vintage_year?.toString() || "",
      fundSize: "",
      fundCurrency: dv?.target_size_currency || "USD",
      targetSize: dv?.target_size || "",
      primarySector: "",
      geographicFocus: "",
      fundStatus: dv?.fund_status || "fundraising",
    },
  });

  const handleSubmit = (data: any) => {
    onSubmit({
      fund_name: data.fundName || null,
      fund_type: data.fundType || null,
      vintage_year: data.vintageYear ? parseInt(data.vintageYear) : null,
      target_size: data.targetSize || null,
      target_size_currency: data.fundCurrency || "USD",
      fund_status: data.fundStatus || "fundraising",
      status: "active",
    });
  };

  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
          <FormField
            control={form.control}
            name="fundName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fund Name *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Fund name" data-testid="input-fund-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="fundType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fund Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-fund-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {fundTypeOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="vintageYear"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vintage Year</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., 2024" type="number" data-testid="input-vintage" />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="fundSize"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fund Size</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., 500M" data-testid="input-fund-size" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="fundCurrency"
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
            name="targetSize"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Target Size</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g., 750M" data-testid="input-target-size" />
                </FormControl>
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="primarySector"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Sector</FormLabel>
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
            <FormField
              control={form.control}
              name="geographicFocus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Geographic Focus</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-geography">
                        <SelectValue placeholder="Select geography" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {geographyOptions.map((opt) => (
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
            name="fundStatus"
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
                    <SelectItem value="fundraising">Fundraising</SelectItem>
                    <SelectItem value="investing">Investing</SelectItem>
                    <SelectItem value="harvesting">Harvesting</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
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
      <div className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Fund Name</p>
          <p className="font-medium">{fund.fund_name || "-"}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Fund Type</p>
            <p className="font-medium">{fund.fund_type || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Vintage Year</p>
            <p className="font-medium">{fund.vintage_year || "-"}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Target Size</p>
            <p className="font-medium">{fund.target_size ? `${fund.target_size} ${fund.target_size_currency || "USD"}` : "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Fund Status</p>
            <p className="font-medium">{fund.fund_status || "-"}</p>
          </div>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Status</p>
          <Badge className={statusColors[fund.status || "active"]}>
            {fund.status || "active"}
          </Badge>
        </div>
        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </ScrollArea>
  );
}
