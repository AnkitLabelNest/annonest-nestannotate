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
import { Search, Handshake, MapPin, Globe } from "lucide-react";

interface ServiceProvider {
  id: string;
  provider_name: string;
  provider_type: string | null;
  provider_subtype: string | null;
  headquarters_country: string | null;
  headquarters_city: string | null;
  website: string | null;
  number_of_gp_clients: number | null;
  data_confidence_score: number | null;
}

export default function ServiceProvidersPage() {
  const [search, setSearch] = useState("");

  const { data: providers, isLoading } = useQuery<ServiceProvider[]>({
    queryKey: ["/api/crm/service-providers"],
  });

  const filteredProviders = providers?.filter(p => 
    p.provider_name.toLowerCase().includes(search.toLowerCase()) ||
    p.provider_type?.toLowerCase().includes(search.toLowerCase()) ||
    p.headquarters_country?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-providers-title">Service Providers</h1>
          <p className="text-muted-foreground">Legal, admin, audit, and advisory firms</p>
        </div>
        <Button data-testid="button-add-provider">
          Add Provider
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search providers by name, type, or country..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
          data-testid="input-search-providers"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Subtype</TableHead>
                <TableHead>HQ</TableHead>
                <TableHead>GP Clients</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredProviders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No service providers found. Providers will appear here once added.
                  </TableCell>
                </TableRow>
              ) : (
                filteredProviders.map((provider) => (
                  <TableRow key={provider.id} className="cursor-pointer hover-elevate" data-testid={`row-provider-${provider.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Handshake className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{provider.provider_name}</p>
                          {provider.website && (
                            <a 
                              href={provider.website} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Globe className="h-3 w-3" />
                              {new URL(provider.website).hostname}
                            </a>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {provider.provider_type && <Badge variant="secondary">{provider.provider_type}</Badge>}
                    </TableCell>
                    <TableCell>
                      {provider.provider_subtype || "-"}
                    </TableCell>
                    <TableCell>
                      {provider.headquarters_city || provider.headquarters_country ? (
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {[provider.headquarters_city, provider.headquarters_country].filter(Boolean).join(", ")}
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {provider.number_of_gp_clients ?? "-"}
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
