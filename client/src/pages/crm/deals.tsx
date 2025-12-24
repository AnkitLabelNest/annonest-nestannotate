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
import { Search, Briefcase, DollarSign, Calendar, Building2 } from "lucide-react";

interface Deal {
  id: string;
  deal_name: string;
  deal_type: string | null;
  deal_status: string | null;
  target_company_name_snapshot: string | null;
  deal_size: number | null;
  deal_currency: string | null;
  announced_date: string | null;
  closed_date: string | null;
  primary_industry: string | null;
  data_confidence_score: number | null;
}

export default function DealsPage() {
  const [search, setSearch] = useState("");

  const { data: deals, isLoading } = useQuery<Deal[]>({
    queryKey: ["/api/crm/deals"],
  });

  const filteredDeals = deals?.filter(d => 
    d.deal_name?.toLowerCase().includes(search.toLowerCase()) ||
    d.target_company_name_snapshot?.toLowerCase().includes(search.toLowerCase()) ||
    d.deal_type?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const formatSize = (size: number | null, currency: string | null) => {
    if (!size) return "-";
    const formatted = size >= 1e9 
      ? `${(size / 1e9).toFixed(1)}B` 
      : size >= 1e6 
        ? `${(size / 1e6).toFixed(0)}M` 
        : size.toLocaleString();
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
          <h1 className="text-2xl font-bold" data-testid="text-deals-title">Deals</h1>
          <p className="text-muted-foreground">Transactions and investments</p>
        </div>
        <Button data-testid="button-add-deal">
          Add Deal
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search deals by name, target, or type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
          data-testid="input-search-deals"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deal</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredDeals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No deals found. Deals will appear here once added.
                  </TableCell>
                </TableRow>
              ) : (
                filteredDeals.map((deal) => (
                  <TableRow key={deal.id} className="cursor-pointer hover-elevate" data-testid={`row-deal-${deal.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{deal.deal_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {deal.target_company_name_snapshot ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          {deal.target_company_name_snapshot}
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {deal.deal_type && <Badge variant="secondary">{deal.deal_type}</Badge>}
                    </TableCell>
                    <TableCell>
                      {deal.deal_size ? (
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          {formatSize(deal.deal_size, deal.deal_currency)}
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {deal.announced_date ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {formatDate(deal.announced_date)}
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={deal.deal_status === "Closed" ? "default" : deal.deal_status === "Active" ? "secondary" : "outline"}>
                        {deal.deal_status || "Unknown"}
                      </Badge>
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
