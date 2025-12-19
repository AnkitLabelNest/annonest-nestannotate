import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Users,
  Wallet,
  Briefcase,
  Search,
  Plus,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";

const dataViews = [
  { id: "gp", title: "GP Firms", icon: Building2, count: 145, path: "/data/firms?type=gp", color: "bg-blue-500" },
  { id: "lp", title: "LP Firms", icon: Building2, count: 89, path: "/data/firms?type=lp", color: "bg-purple-500" },
  { id: "sp", title: "Service Providers", icon: Building2, count: 67, path: "/data/firms?type=service_provider", color: "bg-emerald-500" },
  { id: "company", title: "Companies", icon: Building2, count: 234, path: "/data/firms?type=company", color: "bg-amber-500" },
  { id: "contacts", title: "Contacts", icon: Users, count: 1245, path: "/data/contacts", color: "bg-pink-500" },
  { id: "funds", title: "Funds", icon: Wallet, count: 312, path: "/data/funds", color: "bg-indigo-500" },
  { id: "deals", title: "Deals", icon: Briefcase, count: 567, path: "/data/deals", color: "bg-cyan-500" },
];

const recentUpdates = [
  { entity: "Blackstone Group", type: "GP", action: "Updated", user: "Morgan M.", time: "5 min ago" },
  { entity: "John Smith", type: "Contact", action: "Added", user: "Anna A.", time: "15 min ago" },
  { entity: "Growth Fund III", type: "Fund", action: "Edited", user: "Quinn Q.", time: "1 hour ago" },
  { entity: "Tech Corp Acquisition", type: "Deal", action: "Reviewed", user: "Alex A.", time: "2 hours ago" },
];

export default function DataNestPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">DataNest</h1>
          <p className="text-muted-foreground">
            Structured data hub for firms, contacts, funds, and deals
          </p>
        </div>
        <Button data-testid="button-add-record">
          <Plus className="h-4 w-4 mr-2" />
          Add Record
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search across all firms, contacts, funds, and deals..."
              className="pl-10 h-12 text-lg"
              data-testid="input-global-search"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {dataViews.map((view) => (
          <Link key={view.id} href={view.path}>
            <Card className="cursor-pointer hover:border-primary/30 hover:shadow-md transition-all h-full">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${view.color} text-white`}>
                    <view.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{view.title}</p>
                    <p className="text-2xl font-bold">{view.count.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-base font-medium">Recent Updates</CardTitle>
            <Button variant="ghost" size="sm">View All</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentUpdates.map((update, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <div className={`h-2 w-2 rounded-full ${
                    update.action === "Added" ? "bg-emerald-500" :
                    update.action === "Updated" ? "bg-blue-500" :
                    update.action === "Edited" ? "bg-amber-500" : "bg-purple-500"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{update.entity}</p>
                    <p className="text-xs text-muted-foreground">
                      {update.action} by {update.user} · {update.time}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs">{update.type}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-base font-medium">Data Quality</CardTitle>
            <Badge variant="secondary">
              <TrendingUp className="h-3 w-3 mr-1" />
              94%
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { label: "Complete Records", value: 89, total: 100 },
                { label: "Verified Contacts", value: 76, total: 100 },
                { label: "Linked Entities", value: 92, total: 100 },
                { label: "QA Reviewed", value: 84, total: 100 },
              ].map((metric) => (
                <div key={metric.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm">{metric.label}</span>
                    <span className="text-sm font-medium">{metric.value}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${metric.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-base font-medium">Potential Duplicates</CardTitle>
          </div>
          <Badge variant="secondary">3 found</Badge>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { name1: "Blackstone Group LP", name2: "The Blackstone Group", type: "GP", confidence: 92 },
              { name1: "John Smith (Carlyle)", name2: "John A. Smith", type: "Contact", confidence: 78 },
              { name1: "Apollo Global Management", name2: "Apollo Management", type: "GP", confidence: 85 },
            ].map((dup, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
                <div className="flex-1">
                  <p className="text-sm font-medium">{dup.name1}</p>
                  <p className="text-xs text-muted-foreground">might be duplicate of</p>
                  <p className="text-sm font-medium">{dup.name2}</p>
                </div>
                <Badge variant="secondary">{dup.type}</Badge>
                <Badge className="bg-amber-500 text-white">{dup.confidence}% match</Badge>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline">Merge</Button>
                  <Button size="sm" variant="ghost">Dismiss</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
