import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Search, Plus, Eye, Pencil, Globe, TrendingUp, DollarSign, Calendar } from "lucide-react";

interface PublicCompany {
  id: string;
  ticker: string;
  company_name: string;
  exchange: string | null;
  primary_industry: string | null;
  market_cap: number | null;
  market_cap_currency: string | null;
  snapshot_date: string | null;
  enterprise_value: number | null;
  revenue_ttm: number | null;
  ebitda_ttm: number | null;
  headquarters_country?: string | null;
  headquarters_city?: string | null;
  website?: string | null;
  notes?: string | null;
}

function FieldDisplay({ label, value, isLink = false }: { label: string; value?: string | number | null; isLink?: boolean }) {
  if (value === null || value === undefined || value === "") {
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">-</p>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      {isLink ? (
        <a href={String(value)} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
          {String(value)}
        </a>
      ) : (
        <p className="text-sm">{String(value)}</p>
      )}
    </div>
  );
}

export default function PublicCompaniesPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<PublicCompany | null>(null);
  const [dialogMode, setDialogMode] = useState<"view" | "edit">("view");

  const { data: companies = [], isLoading } = useQuery<PublicCompany[]>({
    queryKey: ["/api/crm/public-companies"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/crm/public-companies", {
      ...data,
      market_cap: data.market_cap ? parseFloat(data.market_cap) : null,
      enterprise_value: data.enterprise_value ? parseFloat(data.enterprise_value) : null,
      revenue_ttm: data.revenue_ttm ? parseFloat(data.revenue_ttm) : null,
      ebitda_ttm: data.ebitda_ttm ? parseFloat(data.ebitda_ttm) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/public-companies"] });
      setIsAddDialogOpen(false);
      toast({ title: "Public company created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filteredCompanies = companies.filter(c => 
    c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.ticker?.toLowerCase().includes(search.toLowerCase()) ||
    c.primary_industry?.toLowerCase().includes(search.toLowerCase())
  );

  const formatValue = (value: number | null, currency: string | null) => {
    if (!value) return "-";
    const formatted = value >= 1e12
      ? `${(value / 1e12).toFixed(1)}T`
      : value >= 1e9 
        ? `${(value / 1e9).toFixed(1)}B` 
        : value >= 1e6 
          ? `${(value / 1e6).toFixed(0)}M` 
          : value.toLocaleString();
    return `${currency || "$"}${formatted}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString();
  };

  const openDialog = (company: PublicCompany, mode: "view" | "edit") => {
    setSelectedCompany(company);
    setDialogMode(mode);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-public-companies-title">Public Companies</h1>
          <p className="text-muted-foreground">Market benchmarks and comparable companies</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-public-company">
              <Plus className="h-4 w-4 mr-2" />
              Add Company
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Public Company</DialogTitle>
              <DialogDescription>Create a new public company record</DialogDescription>
            </DialogHeader>
            <PublicCompanyForm onSubmit={(data) => createMutation.mutate(data)} isPending={createMutation.isPending} onCancel={() => setIsAddDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by company name, ticker, or industry..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
          data-testid="input-search-public-companies"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticker</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Exchange</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Market Cap</TableHead>
                <TableHead>Snapshot</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredCompanies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No public companies found
                  </TableCell>
                </TableRow>
              ) : (
                filteredCompanies.map((company) => (
                  <TableRow key={company.id} data-testid={`row-public-company-${company.id}`}>
                    <TableCell>
                      <Badge variant="outline">{company.ticker}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{company.company_name}</TableCell>
                    <TableCell>{company.exchange || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{company.primary_industry || "-"}</Badge>
                    </TableCell>
                    <TableCell>{formatValue(company.market_cap, company.market_cap_currency)}</TableCell>
                    <TableCell>{formatDate(company.snapshot_date)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openDialog(company, "view")} data-testid={`button-view-public-company-${company.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => openDialog(company, "edit")} data-testid={`button-edit-public-company-${company.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedCompany} onOpenChange={(open) => !open && setSelectedCompany(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <DialogTitle>{dialogMode === "view" ? "Company Details" : "Edit Company"}</DialogTitle>
              {dialogMode === "view" && (
                <Button variant="outline" size="sm" onClick={() => setDialogMode("edit")}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          </DialogHeader>
          {selectedCompany && dialogMode === "view" && (
            <PublicCompanyFullView company={selectedCompany} onClose={() => setSelectedCompany(null)} />
          )}
          {selectedCompany && dialogMode === "edit" && (
            <PublicCompanyEditForm company={selectedCompany} onClose={() => setSelectedCompany(null)} onSwitchToView={() => setDialogMode("view")} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PublicCompanyForm({ onSubmit, isPending, onCancel }: { onSubmit: (data: any) => void; isPending: boolean; onCancel: () => void }) {
  const [formData, setFormData] = useState({
    ticker: "",
    company_name: "",
    exchange: "",
    primary_industry: "",
    market_cap: "",
    market_cap_currency: "USD",
    enterprise_value: "",
    revenue_ttm: "",
    ebitda_ttm: "",
    headquarters_country: "",
    headquarters_city: "",
    website: "",
    notes: "",
  });

  return (
    <ScrollArea className="h-[60vh]">
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Ticker *</Label>
            <Input value={formData.ticker} onChange={(e) => setFormData({ ...formData, ticker: e.target.value })} placeholder="e.g., AAPL" />
          </div>
          <div className="space-y-2">
            <Label>Company Name *</Label>
            <Input value={formData.company_name} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} placeholder="Company name" />
          </div>
          <div className="space-y-2">
            <Label>Exchange</Label>
            <Select value={formData.exchange} onValueChange={(v) => setFormData({ ...formData, exchange: v })}>
              <SelectTrigger><SelectValue placeholder="Select exchange" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NYSE">NYSE</SelectItem>
                <SelectItem value="NASDAQ">NASDAQ</SelectItem>
                <SelectItem value="LSE">LSE</SelectItem>
                <SelectItem value="TSE">TSE</SelectItem>
                <SelectItem value="HKEX">HKEX</SelectItem>
                <SelectItem value="Euronext">Euronext</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Primary Industry</Label>
            <Input value={formData.primary_industry} onChange={(e) => setFormData({ ...formData, primary_industry: e.target.value })} placeholder="e.g., Technology" />
          </div>
          <div className="space-y-2">
            <Label>Market Cap</Label>
            <Input type="number" value={formData.market_cap} onChange={(e) => setFormData({ ...formData, market_cap: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Currency</Label>
            <Select value={formData.market_cap_currency} onValueChange={(v) => setFormData({ ...formData, market_cap_currency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
                <SelectItem value="JPY">JPY</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Enterprise Value</Label>
            <Input type="number" value={formData.enterprise_value} onChange={(e) => setFormData({ ...formData, enterprise_value: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Revenue TTM</Label>
            <Input type="number" value={formData.revenue_ttm} onChange={(e) => setFormData({ ...formData, revenue_ttm: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>EBITDA TTM</Label>
            <Input type="number" value={formData.ebitda_ttm} onChange={(e) => setFormData({ ...formData, ebitda_ttm: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Headquarters Country</Label>
            <Input value={formData.headquarters_country} onChange={(e) => setFormData({ ...formData, headquarters_country: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Headquarters City</Label>
            <Input value={formData.headquarters_city} onChange={(e) => setFormData({ ...formData, headquarters_city: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Website</Label>
            <Input value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} placeholder="https://" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => onSubmit(formData)} disabled={isPending || !formData.ticker || !formData.company_name}>
            {isPending ? "Creating..." : "Create"}
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}

function PublicCompanyFullView({ company, onClose }: { company: PublicCompany; onClose: () => void }) {
  const formatValue = (value: number | null, currency: string | null = "USD") => {
    if (!value) return "-";
    const formatted = value >= 1e12
      ? `${(value / 1e12).toFixed(1)}T`
      : value >= 1e9 
        ? `${(value / 1e9).toFixed(1)}B` 
        : value >= 1e6 
          ? `${(value / 1e6).toFixed(0)}M` 
          : value.toLocaleString();
    return `${currency || "$"}${formatted}`;
  };

  return (
    <ScrollArea className="h-[60vh]">
      <div className="space-y-6 p-4">
        <div>
          <h3 className="font-semibold mb-3">Company Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <FieldDisplay label="Ticker" value={company.ticker} />
            <FieldDisplay label="Company Name" value={company.company_name} />
            <FieldDisplay label="Exchange" value={company.exchange} />
            <FieldDisplay label="Primary Industry" value={company.primary_industry} />
            <FieldDisplay label="Headquarters Country" value={company.headquarters_country} />
            <FieldDisplay label="Headquarters City" value={company.headquarters_city} />
            <FieldDisplay label="Website" value={company.website} isLink />
            <FieldDisplay label="Snapshot Date" value={company.snapshot_date ? new Date(company.snapshot_date).toLocaleDateString() : null} />
          </div>
        </div>
        <Separator />
        <div>
          <h3 className="font-semibold mb-3">Financial Metrics</h3>
          <div className="grid grid-cols-2 gap-4">
            <FieldDisplay label="Market Cap" value={formatValue(company.market_cap, company.market_cap_currency)} />
            <FieldDisplay label="Enterprise Value" value={formatValue(company.enterprise_value, company.market_cap_currency)} />
            <FieldDisplay label="Revenue TTM" value={formatValue(company.revenue_ttm, company.market_cap_currency)} />
            <FieldDisplay label="EBITDA TTM" value={formatValue(company.ebitda_ttm, company.market_cap_currency)} />
          </div>
        </div>
        <Separator />
        <div>
          <h3 className="font-semibold mb-3">Notes</h3>
          <FieldDisplay label="Notes" value={company.notes} />
        </div>
      </div>
    </ScrollArea>
  );
}

function PublicCompanyEditForm({ company, onClose, onSwitchToView }: { company: PublicCompany; onClose: () => void; onSwitchToView: () => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    ticker: company.ticker || "",
    company_name: company.company_name || "",
    exchange: company.exchange || "",
    primary_industry: company.primary_industry || "",
    market_cap: company.market_cap?.toString() || "",
    market_cap_currency: company.market_cap_currency || "USD",
    enterprise_value: company.enterprise_value?.toString() || "",
    revenue_ttm: company.revenue_ttm?.toString() || "",
    ebitda_ttm: company.ebitda_ttm?.toString() || "",
    headquarters_country: company.headquarters_country || "",
    headquarters_city: company.headquarters_city || "",
    website: company.website || "",
    notes: company.notes || "",
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("PATCH", `/api/crm/public-companies/${company.id}`, {
      ...data,
      market_cap: data.market_cap ? parseFloat(data.market_cap) : null,
      enterprise_value: data.enterprise_value ? parseFloat(data.enterprise_value) : null,
      revenue_ttm: data.revenue_ttm ? parseFloat(data.revenue_ttm) : null,
      ebitda_ttm: data.ebitda_ttm ? parseFloat(data.ebitda_ttm) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/public-companies"] });
      toast({ title: "Company updated" });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <ScrollArea className="h-[60vh]">
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Ticker *</Label>
            <Input value={formData.ticker} onChange={(e) => setFormData({ ...formData, ticker: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Company Name *</Label>
            <Input value={formData.company_name} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Exchange</Label>
            <Select value={formData.exchange} onValueChange={(v) => setFormData({ ...formData, exchange: v })}>
              <SelectTrigger><SelectValue placeholder="Select exchange" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NYSE">NYSE</SelectItem>
                <SelectItem value="NASDAQ">NASDAQ</SelectItem>
                <SelectItem value="LSE">LSE</SelectItem>
                <SelectItem value="TSE">TSE</SelectItem>
                <SelectItem value="HKEX">HKEX</SelectItem>
                <SelectItem value="Euronext">Euronext</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Primary Industry</Label>
            <Input value={formData.primary_industry} onChange={(e) => setFormData({ ...formData, primary_industry: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Market Cap</Label>
            <Input type="number" value={formData.market_cap} onChange={(e) => setFormData({ ...formData, market_cap: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Currency</Label>
            <Select value={formData.market_cap_currency} onValueChange={(v) => setFormData({ ...formData, market_cap_currency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
                <SelectItem value="JPY">JPY</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Enterprise Value</Label>
            <Input type="number" value={formData.enterprise_value} onChange={(e) => setFormData({ ...formData, enterprise_value: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Revenue TTM</Label>
            <Input type="number" value={formData.revenue_ttm} onChange={(e) => setFormData({ ...formData, revenue_ttm: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>EBITDA TTM</Label>
            <Input type="number" value={formData.ebitda_ttm} onChange={(e) => setFormData({ ...formData, ebitda_ttm: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Headquarters Country</Label>
            <Input value={formData.headquarters_country} onChange={(e) => setFormData({ ...formData, headquarters_country: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Headquarters City</Label>
            <Input value={formData.headquarters_city} onChange={(e) => setFormData({ ...formData, headquarters_city: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Website</Label>
            <Input value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onSwitchToView}>Cancel</Button>
          <Button onClick={() => updateMutation.mutate(formData)} disabled={updateMutation.isPending || !formData.ticker || !formData.company_name}>
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}
