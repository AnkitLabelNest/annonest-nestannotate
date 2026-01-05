import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Wallet, Calendar, TrendingUp, DollarSign, Search, Plus } from "lucide-react";
import type { EntityFund } from "@shared/schema";

const statusColors: Record<string, string> = {
  fundraising: "bg-blue-100 text-blue-700",
  investing: "bg-emerald-100 text-emerald-700",
  harvesting: "bg-amber-100 text-amber-700",
  closed: "bg-gray-100 text-gray-700",
  active: "bg-green-100 text-green-700",
};

export default function FundsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: funds = [], isLoading, error } = useQuery<EntityFund[]>({
    queryKey: ["/api/entities/funds"],
  });

  const filteredFunds = funds.filter((f) =>
    f.fund_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns = [
    {
      key: "fund_name",
      header: "Fund Name",
      sortable: true,
      render: (fund: EntityFund) => (
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
      render: (fund: EntityFund) => (
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          <span>{fund.vintage_year || "-"}</span>
        </div>
      ),
    },
    {
      key: "fund_type",
      header: "Type",
      render: (fund: EntityFund) => (
        <Badge variant="secondary">{fund.fund_type || "-"}</Badge>
      ),
    },
    {
      key: "target_size",
      header: "Target Size",
      render: (fund: EntityFund) => (
        <div className="flex items-center gap-1">
          <DollarSign className="h-3 w-3 text-muted-foreground" />
          {fund.target_size
            ? `${fund.target_size} ${fund.target_size_currency || "USD"}`
            : "-"}
        </div>
      ),
    },
    {
      key: "fund_status",
      header: "Status",
      render: (fund: EntityFund) => (
        <Badge className={statusColors[fund.fund_status || "active"]}>
          {fund.fund_status || "active"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Funds</h1>
          <p className="text-muted-foreground">
            Track fund vehicles and vintages
          </p>
        </div>
       <Button
  onClick={() => {
    alert("Add Fund button clicked");
  }}
>
  <Plus className="h-4 w-4 mr-2" />
  Add Fund
</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Funds", value: funds.length, icon: Wallet },
          {
            label: "Fundraising",
            value: funds.filter(f => f.fund_status === "fundraising").length,
            icon: TrendingUp,
          },
          {
            label: "Investing",
            value: funds.filter(f => f.fund_status === "investing").length,
            icon: TrendingUp,
          },
          {
            label: "Closed",
            value: funds.filter(f => f.fund_status === "closed").length,
            icon: Wallet,
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-primary/10">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {isLoading ? "-" : stat.value}
                </p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>All Funds</CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search funds..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              Failed to load funds
            </div>
          ) : (
            <DataTable
              data={filteredFunds}
              columns={columns}
              entityType="fund"
              openInNewTab
              emptyMessage="No funds found"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
