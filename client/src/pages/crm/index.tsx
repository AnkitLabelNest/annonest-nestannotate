import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Building2, Users, Wallet, Briefcase, Factory, Handshake, TrendingUp, Globe } from "lucide-react";

interface EntityCount {
  entity: string;
  count: number;
}

export default function CRMDashboard() {
  const { data: counts, isLoading } = useQuery<EntityCount[]>({
    queryKey: ["/api/crm/counts"],
  });

  const getCount = (entity: string) => {
    return counts?.find(c => c.entity === entity)?.count || 0;
  };

  const entities = [
    {
      id: "gps",
      title: "General Partners",
      description: "Fund managers and investment firms",
      icon: Building2,
      path: "/data/gps",
      count: getCount("entities_gp"),
      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    {
      id: "lps",
      title: "Limited Partners",
      description: "Capital allocators and investors",
      icon: Wallet,
      path: "/data/lps",
      count: getCount("entities_lp"),
      color: "bg-green-500/10 text-green-600 dark:text-green-400",
    },
    {
      id: "funds",
      title: "Funds",
      description: "Investment vehicles and vintages",
      icon: TrendingUp,
      path: "/data/funds",
      count: getCount("entities_fund"),
      color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    },
    {
      id: "portfolio-companies",
      title: "Portfolio Companies",
      description: "Backed companies and investments",
      icon: Factory,
      path: "/data/portfolio-companies",
      count: getCount("entities_portfolio_company"),
      color: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    },
    {
      id: "service-providers",
      title: "Service Providers",
      description: "Legal, admin, audit, and advisors",
      icon: Handshake,
      path: "/data/service-providers",
      count: getCount("entities_service_provider"),
      color: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
    },
    {
      id: "contacts",
      title: "Contacts",
      description: "Professionals and decision makers",
      icon: Users,
      path: "/data/contacts",
      count: getCount("entities_contact"),
      color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    },
    {
      id: "deals",
      title: "Deals",
      description: "Transactions and investments",
      icon: Briefcase,
      path: "/data/deals",
      count: getCount("entities_deal"),
      color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    {
      id: "public-companies",
      title: "Public Companies",
      description: "Market benchmarks and comps",
      icon: Globe,
      path: "/data/public-companies",
      count: getCount("public_company_snapshot"),
      color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-datanest-title">DataNest</h1>
        <p className="text-muted-foreground">Manage your private markets data and relationships</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {entities.map((entity) => (
          <Card key={entity.id} className="hover-elevate cursor-pointer">
            <Link href={entity.path}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <div className={`p-2 rounded-lg ${entity.color}`}>
                  <entity.icon className="h-5 w-5" />
                </div>
                <span className="text-2xl font-bold" data-testid={`count-${entity.id}`}>
                  {isLoading ? "..." : entity.count}
                </span>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-base" data-testid={`title-${entity.id}`}>
                  {entity.title}
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  {entity.description}
                </CardDescription>
              </CardContent>
            </Link>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Relationships</CardTitle>
          <CardDescription>View and manage entity connections</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/data/relationships">
            <Button variant="outline" data-testid="button-view-relationships">
              View Relationship Map
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
