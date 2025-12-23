import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Search, Globe, TrendingUp, DollarSign, Calendar } from "lucide-react";

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
}

export default function PublicCompaniesPage() {
  const [search, setSearch] = useState("");

  const { data: companies, isLoading } = useQuery<PublicCompany[]>({
    queryKey: ["/api/crm/public-companies"],
  });

  const filteredCompanies = companies?.filter(c => 
    c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.ticker?.toLowerCase().includes(search.toLowerCase()) ||
    c.primary_industry?.toLowerCase().includes(search.toLowerCase())
  ) || [];

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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-public-companies-title">Public Companies</h1>
          <p className="text-muted-foreground">Market benchmarks and comparable companies</p>
        </div>
        <Button data-testid="button-add-public-company" disabled>
          Add Company (Coming Soon)
        </Button>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredCompanies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No public companies found. Companies will appear here once added.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCompanies.map((company) => (
                  <TableRow key={company.id} className="cursor-pointer hover-elevate" data-testid={`row-public-company-${company.id}`}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {company.ticker}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{company.company_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {company.exchange || "-"}
                    </TableCell>
                    <TableCell>
                      {company.primary_industry && <Badge variant="secondary">{company.primary_industry}</Badge>}
                    </TableCell>
                    <TableCell>
                      {company.market_cap ? (
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          {formatValue(company.market_cap, company.market_cap_currency)}
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {company.snapshot_date ? (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(company.snapshot_date)}
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
