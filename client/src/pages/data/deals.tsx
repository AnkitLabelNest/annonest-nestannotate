import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, Filter, Briefcase, Building2, Calendar, DollarSign } from "lucide-react";
import type { Deal, Firm } from "@shared/schema";

const statusColors: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  Closed: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  Exited: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  "Under Review": "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
};

const dealTypeColors: Record<string, string> = {
  Buyout: "bg-purple-100 text-purple-700",
  "Real Estate": "bg-emerald-100 text-emerald-700",
  Venture: "bg-blue-100 text-blue-700",
  Growth: "bg-amber-100 text-amber-700",
  Infrastructure: "bg-cyan-100 text-cyan-700",
};

export default function DealsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: deals = [], isLoading, error } = useQuery<Deal[]>({
    queryKey: ["/api/deals"],
  });

  const { data: firms = [] } = useQuery<Firm[]>({
    queryKey: ["/api/firms"],
  });

  const firmNames = firms.reduce((acc, firm) => {
    acc[firm.id] = firm.name;
    return acc;
  }, {} as Record<string, string>);

  const columns = [
    {
      key: "companyName",
      header: "Company",
      sortable: true,
      render: (deal: Deal) => (
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{deal.companyName}</span>
        </div>
      ),
    },
    {
      key: "firm",
      header: "Investor",
      render: (deal: Deal) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span>{firmNames[deal.firmId || ""] || "-"}</span>
        </div>
      ),
    },
    {
      key: "dealType",
      header: "Type",
      render: (deal: Deal) => (
        <Badge className={dealTypeColors[deal.dealType || ""] || ""}>{deal.dealType}</Badge>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      render: (deal: Deal) => (
        <div className="flex items-center gap-1 font-medium">
          <DollarSign className="h-3 w-3 text-muted-foreground" />
          {deal.amount?.replace("$", "") || "-"}
        </div>
      ),
    },
    {
      key: "date",
      header: "Date",
      sortable: true,
      render: (deal: Deal) => (
        <div className="flex items-center gap-1 text-sm">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          {deal.date || "-"}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (deal: Deal) => (
        <Badge className={statusColors[deal.status || ""] || ""}>{deal.status}</Badge>
      ),
    },
  ];

  const filteredDeals = deals.filter((d) =>
    d.companyName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalValue = deals.reduce((sum, d) => {
    const amount = parseFloat(d.amount?.replace(/[$B M]/g, "") || "0");
    const multiplier = d.amount?.includes("B") ? 1000 : 1;
    return sum + amount * multiplier;
  }, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Deals</h1>
          <p className="text-muted-foreground">Track investment transactions and exits</p>
        </div>
        <Button data-testid="button-add-deal">
          <Plus className="h-4 w-4 mr-2" />
          Add Deal
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Deals", value: isLoading ? "-" : deals.length },
          { label: "Active Deals", value: isLoading ? "-" : deals.filter((d) => d.status === "Active").length },
          { label: "Closed Deals", value: isLoading ? "-" : deals.filter((d) => d.status === "Closed").length },
          { label: "Total Value", value: isLoading ? "-" : `$${(totalValue / 1000).toFixed(1)}B+` },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
          <CardTitle>All Deals</CardTitle>
          <div className="flex items-center gap-2">
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
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
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
              onView={(deal) => console.log("View", deal)}
              onEdit={(deal) => console.log("Edit", deal)}
              emptyMessage="No deals found"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
