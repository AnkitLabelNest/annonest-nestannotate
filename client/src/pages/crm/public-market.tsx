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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Search, TrendingUp, MapPin, Globe, DollarSign, BarChart3 } from "lucide-react";

interface PublicMarketCompany {
  id: string;
  company_name: string;
  ticker: string | null;
  exchange: string | null;
  isin: string | null;
  cusip: string | null;
  sector: string | null;
  industry: string | null;
  market_cap: number | null;
  enterprise_value: number | null;
  revenue_ttm: number | null;
  ebitda_ttm: number | null;
  pe_ratio: number | null;
  headquarters_country: string | null;
  headquarters_city: string | null;
  website: string | null;
  description: string | null;
  notes: string | null;
}

export default function PublicMarketPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newRecord, setNewRecord] = useState({
    company_name: "",
    ticker: "",
    exchange: "",
    isin: "",
    cusip: "",
    sector: "",
    industry: "",
    market_cap: "",
    enterprise_value: "",
    revenue_ttm: "",
    ebitda_ttm: "",
    pe_ratio: "",
    headquarters_country: "",
    headquarters_city: "",
    website: "",
    description: "",
    notes: "",
  });

  const { data: companies, isLoading } = useQuery<PublicMarketCompany[]>({
    queryKey: ["/api/crm/public-market"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newRecord) => {
      return apiRequest("POST", "/api/crm/public-market", {
        ...data,
        market_cap: data.market_cap ? parseFloat(data.market_cap) : null,
        enterprise_value: data.enterprise_value ? parseFloat(data.enterprise_value) : null,
        revenue_ttm: data.revenue_ttm ? parseFloat(data.revenue_ttm) : null,
        ebitda_ttm: data.ebitda_ttm ? parseFloat(data.ebitda_ttm) : null,
        pe_ratio: data.pe_ratio ? parseFloat(data.pe_ratio) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/public-market"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/counts"] });
      setIsAddDialogOpen(false);
      setNewRecord({
        company_name: "",
        ticker: "",
        exchange: "",
        isin: "",
        cusip: "",
        sector: "",
        industry: "",
        market_cap: "",
        enterprise_value: "",
        revenue_ttm: "",
        ebitda_ttm: "",
        pe_ratio: "",
        headquarters_country: "",
        headquarters_city: "",
        website: "",
        description: "",
        notes: "",
      });
      toast({ title: "Public market company created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error creating record", description: error.message, variant: "destructive" });
    },
  });

  const filteredCompanies = companies?.filter(c => 
    c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.ticker?.toLowerCase().includes(search.toLowerCase()) ||
    c.sector?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const formatCurrency = (value: number | null) => {
    if (!value) return "-";
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value.toLocaleString()}`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-public-market-title">Public Market</h1>
          <p className="text-muted-foreground">Publicly traded companies and market benchmarks</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-public-market">
              <Plus className="h-4 w-4 mr-2" />
              Add Company
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Public Market Company</DialogTitle>
              <DialogDescription>Enter details for a publicly traded company</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name *</Label>
                  <Input
                    id="company_name"
                    value={newRecord.company_name}
                    onChange={(e) => setNewRecord({ ...newRecord, company_name: e.target.value })}
                    placeholder="Apple Inc."
                    data-testid="input-company-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ticker">Ticker Symbol</Label>
                  <Input
                    id="ticker"
                    value={newRecord.ticker}
                    onChange={(e) => setNewRecord({ ...newRecord, ticker: e.target.value.toUpperCase() })}
                    placeholder="AAPL"
                    data-testid="input-ticker"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="exchange">Exchange</Label>
                  <Select value={newRecord.exchange} onValueChange={(v) => setNewRecord({ ...newRecord, exchange: v })}>
                    <SelectTrigger data-testid="select-exchange">
                      <SelectValue placeholder="Select exchange" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NYSE">NYSE</SelectItem>
                      <SelectItem value="NASDAQ">NASDAQ</SelectItem>
                      <SelectItem value="LSE">LSE</SelectItem>
                      <SelectItem value="TSE">TSE</SelectItem>
                      <SelectItem value="HKEX">HKEX</SelectItem>
                      <SelectItem value="Euronext">Euronext</SelectItem>
                      <SelectItem value="Deutsche Borse">Deutsche Borse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sector">Sector</Label>
                  <Select value={newRecord.sector} onValueChange={(v) => setNewRecord({ ...newRecord, sector: v })}>
                    <SelectTrigger data-testid="select-sector">
                      <SelectValue placeholder="Select sector" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Technology">Technology</SelectItem>
                      <SelectItem value="Healthcare">Healthcare</SelectItem>
                      <SelectItem value="Financials">Financials</SelectItem>
                      <SelectItem value="Consumer Discretionary">Consumer Discretionary</SelectItem>
                      <SelectItem value="Industrials">Industrials</SelectItem>
                      <SelectItem value="Energy">Energy</SelectItem>
                      <SelectItem value="Materials">Materials</SelectItem>
                      <SelectItem value="Utilities">Utilities</SelectItem>
                      <SelectItem value="Real Estate">Real Estate</SelectItem>
                      <SelectItem value="Communication Services">Communication Services</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Input
                    id="industry"
                    value={newRecord.industry}
                    onChange={(e) => setNewRecord({ ...newRecord, industry: e.target.value })}
                    placeholder="Consumer Electronics"
                    data-testid="input-industry"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="market_cap">Market Cap (USD)</Label>
                  <Input
                    id="market_cap"
                    type="number"
                    value={newRecord.market_cap}
                    onChange={(e) => setNewRecord({ ...newRecord, market_cap: e.target.value })}
                    placeholder="2800000000000"
                    data-testid="input-market-cap"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="revenue_ttm">Revenue TTM (USD)</Label>
                  <Input
                    id="revenue_ttm"
                    type="number"
                    value={newRecord.revenue_ttm}
                    onChange={(e) => setNewRecord({ ...newRecord, revenue_ttm: e.target.value })}
                    placeholder="400000000000"
                    data-testid="input-revenue"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ebitda_ttm">EBITDA TTM (USD)</Label>
                  <Input
                    id="ebitda_ttm"
                    type="number"
                    value={newRecord.ebitda_ttm}
                    onChange={(e) => setNewRecord({ ...newRecord, ebitda_ttm: e.target.value })}
                    placeholder="120000000000"
                    data-testid="input-ebitda"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pe_ratio">P/E Ratio</Label>
                  <Input
                    id="pe_ratio"
                    type="number"
                    step="0.01"
                    value={newRecord.pe_ratio}
                    onChange={(e) => setNewRecord({ ...newRecord, pe_ratio: e.target.value })}
                    placeholder="28.5"
                    data-testid="input-pe-ratio"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="headquarters_country">Country</Label>
                  <Input
                    id="headquarters_country"
                    value={newRecord.headquarters_country}
                    onChange={(e) => setNewRecord({ ...newRecord, headquarters_country: e.target.value })}
                    placeholder="United States"
                    data-testid="input-country"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="headquarters_city">City</Label>
                  <Input
                    id="headquarters_city"
                    value={newRecord.headquarters_city}
                    onChange={(e) => setNewRecord({ ...newRecord, headquarters_city: e.target.value })}
                    placeholder="Cupertino"
                    data-testid="input-city"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={newRecord.website}
                  onChange={(e) => setNewRecord({ ...newRecord, website: e.target.value })}
                  placeholder="https://www.apple.com"
                  data-testid="input-website"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newRecord.description}
                  onChange={(e) => setNewRecord({ ...newRecord, description: e.target.value })}
                  placeholder="Company description..."
                  data-testid="input-description"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => createMutation.mutate(newRecord)}
                disabled={!newRecord.company_name || createMutation.isPending}
                data-testid="button-submit-public-market"
              >
                {createMutation.isPending ? "Creating..." : "Create Company"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by company, ticker, or sector..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
          data-testid="input-search-public-market"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Ticker</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>Market Cap</TableHead>
                <TableHead>Revenue TTM</TableHead>
                <TableHead>P/E Ratio</TableHead>
                <TableHead>HQ</TableHead>
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
                    No public market companies found. Add your first company to get started.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCompanies.map((company) => (
                  <TableRow key={company.id} className="cursor-pointer hover-elevate" data-testid={`row-public-market-${company.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                        <div>
                          <p className="font-medium">{company.company_name}</p>
                          {company.website && (
                            <a 
                              href={company.website} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Globe className="h-3 w-3" />
                              {new URL(company.website).hostname}
                            </a>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {company.ticker ? (
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="font-mono font-bold">{company.ticker}</Badge>
                          {company.exchange && (
                            <span className="text-xs text-muted-foreground">{company.exchange}</span>
                          )}
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <div>
                        {company.sector && <Badge variant="secondary">{company.sector}</Badge>}
                        {company.industry && (
                          <p className="text-xs text-muted-foreground mt-1">{company.industry}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 font-medium">
                        <DollarSign className="h-3 w-3 text-green-600" />
                        {formatCurrency(company.market_cap)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatCurrency(company.revenue_ttm)}
                    </TableCell>
                    <TableCell>
                      {company.pe_ratio ? (
                        <div className="flex items-center gap-1">
                          <BarChart3 className="h-3 w-3 text-muted-foreground" />
                          {company.pe_ratio.toFixed(2)}x
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {company.headquarters_city || company.headquarters_country ? (
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {[company.headquarters_city, company.headquarters_country].filter(Boolean).join(", ")}
                        </div>
                      ) : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
