import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import { StatusIndicator } from "@/components/status-indicator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Filter, Radar, Link as LinkIcon, Building2, Users, FileText, RefreshCw, ExternalLink } from "lucide-react";
import type { MonitoredUrl, MonitoringStatus } from "@shared/schema";

const mockUrls: MonitoredUrl[] = [
  { id: "1", url: "https://blackstone.com/about", entityType: "firm", entityId: "1", status: "running", lastRunDate: new Date("2024-01-15T10:30:00"), lastChangeDate: null, changeDetails: null, createdBy: "user-1" },
  { id: "2", url: "https://sequoiacap.com/companies", entityType: "firm", entityId: "2", status: "changed", lastRunDate: new Date("2024-01-15T09:00:00"), lastChangeDate: new Date("2024-01-15T09:00:00"), changeDetails: { added: 3, removed: 0 }, createdBy: "user-1" },
  { id: "3", url: "https://linkedin.com/in/johnsmith", entityType: "contact", entityId: "1", status: "no_change", lastRunDate: new Date("2024-01-14T14:00:00"), lastChangeDate: null, changeDetails: null, createdBy: "user-2" },
  { id: "4", url: "https://sec.gov/filings/blackstone", entityType: "filing", entityId: "1", status: "changed", lastRunDate: new Date("2024-01-15T08:00:00"), lastChangeDate: new Date("2024-01-15T08:00:00"), changeDetails: { newFilings: 2 }, createdBy: "user-1" },
  { id: "5", url: "https://reuters.com/companies/blackstone", entityType: "news", entityId: "1", status: "running", lastRunDate: new Date("2024-01-15T11:00:00"), lastChangeDate: null, changeDetails: null, createdBy: "user-2" },
  { id: "6", url: "https://calpers.ca.gov/investments", entityType: "firm", entityId: "3", status: "error", lastRunDate: new Date("2024-01-14T12:00:00"), lastChangeDate: null, changeDetails: { error: "Connection timeout" }, createdBy: "user-1" },
];

const entityTypeIcons: Record<string, typeof Building2> = {
  firm: Building2,
  contact: Users,
  filing: FileText,
  news: FileText,
};

const entityTypeLabels: Record<string, string> = {
  firm: "Firm",
  contact: "Contact",
  filing: "SEC Filing",
  news: "News",
};

export default function ExtractionPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("all");

  const formatDate = (date: Date | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const columns = [
    {
      key: "url",
      header: "URL",
      render: (item: MonitoredUrl) => (
        <div className="max-w-[300px]">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-primary hover:underline truncate"
          >
            <LinkIcon className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{item.url}</span>
            <ExternalLink className="h-3 w-3 flex-shrink-0" />
          </a>
        </div>
      ),
    },
    {
      key: "entityType",
      header: "Entity Type",
      render: (item: MonitoredUrl) => {
        const Icon = entityTypeIcons[item.entityType] || Building2;
        return (
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span>{entityTypeLabels[item.entityType] || item.entityType}</span>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (item: MonitoredUrl) => (
        <StatusIndicator status={item.status} />
      ),
    },
    {
      key: "lastRunDate",
      header: "Last Run",
      render: (item: MonitoredUrl) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(item.lastRunDate)}
        </span>
      ),
    },
    {
      key: "lastChangeDate",
      header: "Last Change",
      render: (item: MonitoredUrl) => (
        <span className="text-sm">
          {item.lastChangeDate ? (
            <span className="text-emerald-600 dark:text-emerald-400">
              {formatDate(item.lastChangeDate)}
            </span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </span>
      ),
    },
    {
      key: "changeDetails",
      header: "Changes",
      render: (item: MonitoredUrl) => {
        if (!item.changeDetails) return <span className="text-muted-foreground">-</span>;
        const details = item.changeDetails as Record<string, unknown>;
        if (details.error) {
          return <Badge variant="destructive">Error</Badge>;
        }
        if (details.added !== undefined) {
          return <Badge variant="secondary">+{String(details.added)} items</Badge>;
        }
        if (details.newFilings !== undefined) {
          return <Badge variant="secondary">{String(details.newFilings)} new filings</Badge>;
        }
        return <span className="text-muted-foreground">-</span>;
      },
    },
  ];

  const filteredUrls = mockUrls.filter((url) => {
    const matchesSearch = url.url.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = selectedTab === "all" || url.entityType === selectedTab;
    return matchesSearch && matchesTab;
  });

  const statusCounts = {
    running: mockUrls.filter((u) => u.status === "running").length,
    changed: mockUrls.filter((u) => u.status === "changed").length,
    no_change: mockUrls.filter((u) => u.status === "no_change").length,
    error: mockUrls.filter((u) => u.status === "error").length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Extraction & Monitoring Engine</h1>
          <p className="text-muted-foreground">
            URL tracking, change detection, and data extraction
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="button-run-all">
            <RefreshCw className="h-4 w-4 mr-2" />
            Run All
          </Button>
          <Button data-testid="button-add-url">
            <Plus className="h-4 w-4 mr-2" />
            Add URL
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Running", count: statusCounts.running, status: "running" as MonitoringStatus },
          { label: "Changed", count: statusCounts.changed, status: "changed" as MonitoringStatus },
          { label: "No Change", count: statusCounts.no_change, status: "no_change" as MonitoringStatus },
          { label: "Errors", count: statusCounts.error, status: "error" as MonitoringStatus },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{item.count}</p>
                <p className="text-sm text-muted-foreground">{item.label}</p>
              </div>
              <StatusIndicator status={item.status} showLabel={false} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Radar className="h-5 w-5" />
            Monitored URLs
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search URLs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
                data-testid="input-search-urls"
              />
            </div>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All ({mockUrls.length})</TabsTrigger>
              <TabsTrigger value="firm">Firms</TabsTrigger>
              <TabsTrigger value="contact">Contacts</TabsTrigger>
              <TabsTrigger value="news">News</TabsTrigger>
              <TabsTrigger value="filing">Filings</TabsTrigger>
            </TabsList>
            <DataTable
              data={filteredUrls}
              columns={columns}
              onView={(url) => console.log("View", url)}
              onEdit={(url) => console.log("Edit", url)}
              emptyMessage="No monitored URLs found"
            />
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
