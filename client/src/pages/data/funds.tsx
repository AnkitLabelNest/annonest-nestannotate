import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, Filter, Wallet, Building2, Calendar, TrendingUp } from "lucide-react";
import type { Fund, Firm } from "@shared/schema";

const statusColors: Record<string, string> = {
  Fundraising: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  Investing: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  Harvesting: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  Closed: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export default function FundsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: funds = [], isLoading, error } = useQuery<Fund[]>({
    queryKey: ["/api/funds"],
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
      key: "name",
      header: "Fund Name",
      sortable: true,
      render: (fund: Fund) => (
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{fund.name}</span>
        </div>
      ),
    },
    {
      key: "firm",
      header: "Firm",
      render: (fund: Fund) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span>{firmNames[fund.firmId || ""] || "-"}</span>
        </div>
      ),
    },
    {
      key: "vintage",
      header: "Vintage",
      sortable: true,
      render: (fund: Fund) => (
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          <span>{fund.vintage || "-"}</span>
        </div>
      ),
    },
    {
      key: "size",
      header: "Size",
      render: (fund: Fund) => <span className="font-medium">{fund.size || "-"}</span>,
    },
    {
      key: "strategy",
      header: "Strategy",
      render: (fund: Fund) => (
        <Badge variant="secondary">{fund.strategy || "-"}</Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (fund: Fund) => (
        <Badge className={statusColors[fund.status || ""] || ""}>
          {fund.status || "-"}
        </Badge>
      ),
    },
  ];

  const filteredFunds = funds.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Funds</h1>
          <p className="text-muted-foreground">Track fund vehicles and their status</p>
        </div>
        <Button data-testid="button-add-fund">
          <Plus className="h-4 w-4 mr-2" />
          Add Fund
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Funds", value: isLoading ? "-" : funds.length, icon: Wallet },
          { label: "Fundraising", value: isLoading ? "-" : funds.filter((f) => f.status === "Fundraising").length, icon: TrendingUp },
          { label: "Investing", value: isLoading ? "-" : funds.filter((f) => f.status === "Investing").length, icon: TrendingUp },
          { label: "Total AUM", value: "$74B+", icon: Wallet },
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
          <div className="flex items-center gap-2">
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
              Failed to load funds. Please try again.
            </div>
          ) : (
            <DataTable
              data={filteredFunds}
              columns={columns}
              onView={(fund) => console.log("View", fund)}
              onEdit={(fund) => console.log("Edit", fund)}
              emptyMessage="No funds found"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
