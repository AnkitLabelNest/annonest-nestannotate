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
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Briefcase, Building2, Calendar, DollarSign, TrendingUp, Loader2 } from "lucide-react";
import type { EntityDeal } from "@shared/schema";

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
    mutationFn: async (data: Partial<EntityDeal>) => {
      const res = await apiRequest("POST", "/api/entities/deals", data);
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
      const res = await apiRequest("PUT", `/api/entities/deals/${id}`, data);
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
              onView={(deal) => setViewItem(deal)}
              onEdit={(deal) => setEditItem(deal)}
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
  const form = useForm({
    defaultValues: {
      dealName: defaultValues?.dealName || "",
      dealType: defaultValues?.dealType || "",
      dealStatus: defaultValues?.dealStatus || "active",
      dealAmount: defaultValues?.dealAmount || "",
      dealCurrency: defaultValues?.dealCurrency || "USD",
      dealDate: defaultValues?.dealDate || "",
      targetCompany: defaultValues?.targetCompany || "",
      acquirerCompany: defaultValues?.acquirerCompany || "",
      sector: defaultValues?.sector || "",
      notes: defaultValues?.notes || "",
    },
  });

  const handleSubmit = (data: any) => {
    onSubmit({
      dealName: data.dealName || null,
      dealType: data.dealType || null,
      dealStatus: data.dealStatus || "active",
      dealAmount: data.dealAmount || null,
      dealCurrency: data.dealCurrency || null,
      dealDate: data.dealDate || null,
      targetCompany: data.targetCompany || null,
      acquirerCompany: data.acquirerCompany || null,
      sector: data.sector || null,
      notes: data.notes || null,
    });
  };

  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
          <FormField
            control={form.control}
            name="dealName"
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
              name="dealType"
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
              name="dealDate"
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
              name="dealAmount"
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
              name="dealCurrency"
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

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="targetCompany"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Company</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Target company name" data-testid="input-target-company" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="acquirerCompany"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Acquirer / Investor</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Acquirer or investor name" data-testid="input-acquirer" />
                  </FormControl>
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
            name="dealStatus"
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
  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <div className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Deal Name</p>
          <p className="font-medium">{deal.dealName || "-"}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Deal Type</p>
            <Badge className={dealTypeColors[deal.dealType || ""] || "bg-secondary"}>
              {deal.dealType || "-"}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Deal Date</p>
            <p className="font-medium">{deal.dealDate || "-"}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Deal Amount</p>
            <p className="font-medium">{deal.dealAmount ? `${deal.dealAmount} ${deal.dealCurrency || "USD"}` : "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Sector</p>
            <p className="font-medium">{deal.sector || "-"}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Target Company</p>
            <p className="font-medium">{deal.targetCompany || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Acquirer / Investor</p>
            <p className="font-medium">{deal.acquirerCompany || "-"}</p>
          </div>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Notes</p>
          <p className="font-medium">{deal.notes || "-"}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Status</p>
          <Badge className={statusColors[deal.dealStatus || "active"]}>
            {deal.dealStatus || "active"}
          </Badge>
        </div>
        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </ScrollArea>
  );
}
