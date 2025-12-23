import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Search, Building2, Globe, MapPin, DollarSign, Users } from "lucide-react";

interface GP {
  id: string;
  gp_name: string;
  gp_legal_name: string | null;
  firm_type: string | null;
  headquarters_country: string | null;
  headquarters_city: string | null;
  total_aum: number | null;
  aum_currency: string | null;
  number_of_funds: number | null;
  employee_count_band: string | null;
  website: string | null;
  primary_asset_classes: string | null;
  data_confidence_score: number | null;
  created_at: string;
}

export default function GPsPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newGP, setNewGP] = useState({
    gp_name: "",
    gp_legal_name: "",
    firm_type: "",
    headquarters_country: "",
    headquarters_city: "",
    total_aum: "",
    aum_currency: "USD",
    website: "",
    primary_asset_classes: "",
  });

  const { data: gps, isLoading } = useQuery<GP[]>({
    queryKey: ["/api/crm/gps"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newGP) => {
      return apiRequest("POST", "/api/crm/gps", {
        ...data,
        total_aum: data.total_aum ? parseFloat(data.total_aum) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/gps"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/counts"] });
      setIsAddDialogOpen(false);
      setNewGP({
        gp_name: "",
        gp_legal_name: "",
        firm_type: "",
        headquarters_country: "",
        headquarters_city: "",
        total_aum: "",
        aum_currency: "USD",
        website: "",
        primary_asset_classes: "",
      });
      toast({ title: "GP created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error creating GP", description: error.message, variant: "destructive" });
    },
  });

  const filteredGPs = gps?.filter(gp => 
    gp.gp_name.toLowerCase().includes(search.toLowerCase()) ||
    gp.headquarters_country?.toLowerCase().includes(search.toLowerCase()) ||
    gp.firm_type?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const formatAUM = (aum: number | null, currency: string | null) => {
    if (!aum) return "-";
    const formatted = aum >= 1e9 
      ? `${(aum / 1e9).toFixed(1)}B` 
      : aum >= 1e6 
        ? `${(aum / 1e6).toFixed(0)}M` 
        : aum.toLocaleString();
    return `${currency || "$"}${formatted}`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-gps-title">General Partners</h1>
          <p className="text-muted-foreground">Fund managers and investment firms</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-gp">
              <Plus className="h-4 w-4 mr-2" />
              Add GP
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New General Partner</DialogTitle>
              <DialogDescription>Enter the GP details below</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gp_name">GP Name *</Label>
                  <Input
                    id="gp_name"
                    value={newGP.gp_name}
                    onChange={(e) => setNewGP({ ...newGP, gp_name: e.target.value })}
                    placeholder="Blackstone"
                    data-testid="input-gp-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gp_legal_name">Legal Name</Label>
                  <Input
                    id="gp_legal_name"
                    value={newGP.gp_legal_name}
                    onChange={(e) => setNewGP({ ...newGP, gp_legal_name: e.target.value })}
                    placeholder="Blackstone Inc."
                    data-testid="input-gp-legal-name"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firm_type">Firm Type</Label>
                  <Select value={newGP.firm_type} onValueChange={(v) => setNewGP({ ...newGP, firm_type: v })}>
                    <SelectTrigger data-testid="select-firm-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PE">Private Equity</SelectItem>
                      <SelectItem value="VC">Venture Capital</SelectItem>
                      <SelectItem value="Hedge">Hedge Fund</SelectItem>
                      <SelectItem value="Credit">Credit</SelectItem>
                      <SelectItem value="Infra">Infrastructure</SelectItem>
                      <SelectItem value="Multi-strategy">Multi-strategy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="primary_asset_classes">Asset Classes</Label>
                  <Input
                    id="primary_asset_classes"
                    value={newGP.primary_asset_classes}
                    onChange={(e) => setNewGP({ ...newGP, primary_asset_classes: e.target.value })}
                    placeholder="PE, VC, Credit"
                    data-testid="input-asset-classes"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="headquarters_country">Country</Label>
                  <Input
                    id="headquarters_country"
                    value={newGP.headquarters_country}
                    onChange={(e) => setNewGP({ ...newGP, headquarters_country: e.target.value })}
                    placeholder="United States"
                    data-testid="input-country"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="headquarters_city">City</Label>
                  <Input
                    id="headquarters_city"
                    value={newGP.headquarters_city}
                    onChange={(e) => setNewGP({ ...newGP, headquarters_city: e.target.value })}
                    placeholder="New York"
                    data-testid="input-city"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="total_aum">Total AUM</Label>
                  <Input
                    id="total_aum"
                    type="number"
                    value={newGP.total_aum}
                    onChange={(e) => setNewGP({ ...newGP, total_aum: e.target.value })}
                    placeholder="1000000000"
                    data-testid="input-aum"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aum_currency">Currency</Label>
                  <Select value={newGP.aum_currency} onValueChange={(v) => setNewGP({ ...newGP, aum_currency: v })}>
                    <SelectTrigger data-testid="select-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="INR">INR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={newGP.website}
                  onChange={(e) => setNewGP({ ...newGP, website: e.target.value })}
                  placeholder="https://www.blackstone.com"
                  data-testid="input-website"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => createMutation.mutate(newGP)}
                disabled={!newGP.gp_name || createMutation.isPending}
                data-testid="button-submit-gp"
              >
                {createMutation.isPending ? "Creating..." : "Create GP"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search GPs by name, country, or type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
          data-testid="input-search-gps"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>GP Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>HQ</TableHead>
                <TableHead>AUM</TableHead>
                <TableHead>Funds</TableHead>
                <TableHead>Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredGPs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No GPs found. Add your first GP to get started.
                  </TableCell>
                </TableRow>
              ) : (
                filteredGPs.map((gp) => (
                  <TableRow key={gp.id} className="cursor-pointer hover-elevate" data-testid={`row-gp-${gp.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{gp.gp_name}</p>
                          {gp.website && (
                            <a 
                              href={gp.website} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Globe className="h-3 w-3" />
                              {new URL(gp.website).hostname}
                            </a>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {gp.firm_type && <Badge variant="secondary">{gp.firm_type}</Badge>}
                    </TableCell>
                    <TableCell>
                      {gp.headquarters_city || gp.headquarters_country ? (
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {[gp.headquarters_city, gp.headquarters_country].filter(Boolean).join(", ")}
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        {formatAUM(gp.total_aum, gp.aum_currency)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {gp.number_of_funds ?? "-"}
                    </TableCell>
                    <TableCell>
                      {gp.data_confidence_score !== null ? (
                        <Badge 
                          variant={gp.data_confidence_score >= 80 ? "default" : gp.data_confidence_score >= 50 ? "secondary" : "outline"}
                        >
                          {gp.data_confidence_score}%
                        </Badge>
                      ) : "-"}
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
