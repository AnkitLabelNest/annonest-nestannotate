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
import { Search, TrendingUp, DollarSign, Calendar, Building2 } from "lucide-react";

interface Fund {
  id: string;
  fund_name: string;
  fund_type: string | null;
  vintage_year: number | null;
  fund_size: number | null;
  fund_currency: string | null;
  geography_focus: string | null;
  sector_focus: string | null;
  fund_status: string | null;
  data_confidence_score: number | null;
}

export default function FundsPage() {
  const [search, setSearch] = useState("");

  const { data: funds, isLoading } = useQuery<Fund[]>({
    queryKey: ["/api/crm/funds"],
  });

  const filteredFunds = funds?.filter(f => 
    f.fund_name.toLowerCase().includes(search.toLowerCase()) ||
    f.fund_type?.toLowerCase().includes(search.toLowerCase()) ||
    f.geography_focus?.toLowerCase().includes(search.toLowerCase())
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-funds-title">Funds</h1>
          <p className="text-muted-foreground">Investment vehicles and vintages</p>
        </div>
        <Button data-testid="button-add-fund">
          Add Fund
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search funds by name, type, or geography..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
          data-testid="input-search-funds"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fund Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Vintage</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Geography</TableHead>
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
              ) : filteredFunds.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No funds found. Funds will appear here once added.
                  </TableCell>
                </TableRow>
              ) : (
                filteredFunds.map((fund) => (
                  <TableRow key={fund.id} className="cursor-pointer hover-elevate" data-testid={`row-fund-${fund.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{fund.fund_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {fund.fund_type && <Badge variant="secondary">{fund.fund_type}</Badge>}
                    </TableCell>
                    <TableCell>
                      {fund.vintage_year ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {fund.vintage_year}
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        {formatSize(fund.fund_size, fund.fund_currency)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {fund.geography_focus || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={fund.fund_status === "Active" ? "default" : "secondary"}>
                        {fund.fund_status || "Active"}
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
