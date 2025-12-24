import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Sparkles, Network, TrendingUp, Lock, Bell } from "lucide-react";

export default function IntelligencePage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contact Intelligence</h1>
          <p className="text-muted-foreground">
            Advanced contact analysis and relationship mapping
          </p>
        </div>
        <Badge variant="secondary" className="w-fit">
          <Sparkles className="h-3 w-3 mr-1" />
          In Development
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          {
            title: "Relationship Mapping",
            description: "Visualize connections between contacts, firms, and deals with interactive network graphs.",
            icon: Network,
            status: "In Development",
          },
          {
            title: "Contact Scoring",
            description: "AI-powered scoring to identify high-value contacts and prioritize outreach efforts.",
            icon: TrendingUp,
            status: "Planned",
          },
          {
            title: "Job Change Alerts",
            description: "Real-time notifications when tracked contacts change roles or companies.",
            icon: Bell,
            status: "Planned",
          },
          {
            title: "Network Analysis",
            description: "Discover hidden connections and identify warm introduction paths.",
            icon: Users,
            status: "In Development",
          },
          {
            title: "Engagement Tracking",
            description: "Track email opens, meeting attendance, and interaction history.",
            icon: TrendingUp,
            status: "Planned",
          },
          {
            title: "Data Enrichment",
            description: "Automatically enrich contact profiles with verified data from multiple sources.",
            icon: Sparkles,
            status: "Planned",
          },
        ].map((feature, i) => (
          <Card key={i} className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-transparent opacity-50" />
            <CardHeader className="relative">
              <div className="flex items-center justify-between mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <Badge variant="outline" className="text-xs">
                  {feature.status}
                </Badge>
              </div>
              <CardTitle className="text-lg">{feature.title}</CardTitle>
            </CardHeader>
            <CardContent className="relative">
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardContent className="p-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <h3 className="text-lg font-semibold mb-2">Module Under Development</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            Contact Intelligence features are currently being developed. Subscribe to be notified when new features become available.
          </p>
          <Button data-testid="button-notify">
            <Bell className="h-4 w-4 mr-2" />
            Notify Me
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
