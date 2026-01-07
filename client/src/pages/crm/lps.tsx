import { useLocation } from "wouter";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Search, Wallet, MapPin, DollarSign, TrendingUp } from "lucide-react";

interface LP {
  id: string;
  lp_name: string;
  lp_type: string | null;
  headquarters_country: string | null;
  headquarters_city: string | null;
  total_aum: number | null;
  aum_currency: string | null;
  private_markets_allocation_percent: number | null;
  active_fund_commitments_count: number | null;
  pri_signatory: boolean | null;
  data_confidence_score: number | null;
}

export default function LPsPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newLP, setNewLP] = useState({
    lp_name: "",
    lp_type: "",
    headquarters_country: "",
    headquarters_city: "",
    total_aum: "",
    aum_currency: "USD",
    private_markets_allocation_percent: "",
  });

  const { data: lps, isLoading } = useQuery<LP[]>({
    queryKey: ["/api/crm/lps"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newLP) => {
      return apiRequest("POST", "/api/crm/lps", {
        ...data,
        total_aum: data.total_aum ? parseFloat(data.total_aum) : null,
        private_markets_allocation_percent: data.private_markets_allocation_percent 
          ? parseFloat(data.private_markets_allocation_percent) 
          : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/lps"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/counts"] });
      setIsAddDialogOpen(false);
      setNewLP({
        lp_name: "",
        lp_type: "",
        headquarters_country: "",
        headquarters_city: "",
        total_aum: "",
        aum_currency: "USD",
        private_markets_allocation_percent: "",
      });
      toast({ title: "LP created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error creating LP", description: error.message, variant: "destructive" });
    },
  });

  const filteredLPs = lps?.filter(lp => 
    lp.lp_name.toLowerCase().includes(search.toLowerCase()) ||
    lp.lp_type?.toLowerCase().includes(search.toLowerCase()) ||
    lp.headquarters_country?.toLowerCase().includes(search.toLowerCase())
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
          <h1 className="text-2xl font-bold" data-testid="text-lps-title">Limited Partners</h1>
          <p className="text-muted-foreground">Capital allocators and institutional investors</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-lp">
              <Plus className="h-4 w-4 mr-2" />
              Add LP
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Limited Partner</DialogTitle>
              <DialogDescription>Enter the LP details below</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lp_name">LP Name *</Label>
                  <Input
                    id="lp_name"
                    value={newLP.lp_name}
                    onChange={(e) => setNewLP({ ...newLP, lp_name: e.target.value })}
                    placeholder="CalPERS"
                    data-testid="input-lp-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lp_type">LP Type</Label>
                  <Select value={newLP.lp_type} onValueChange={(v) => setNewLP({ ...newLP, lp_type: v })}>
                    <SelectTrigger data-testid="select-lp-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pension">Pension Fund</SelectItem>
                      <SelectItem value="Endowment">Endowment</SelectItem>
                      <SelectItem value="SWF">Sovereign Wealth Fund</SelectItem>
                      <SelectItem value="FoF">Fund of Funds</SelectItem>
                      <SelectItem value="Family Office">Family Office</SelectItem>
                      <SelectItem value="Insurance">Insurance Company</SelectItem>
                      <SelectItem value="Corporate">Corporate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="headquarters_country">Country</Label>
                  <Input
                    id="headquarters_country"
                    value={newLP.headquarters_country}
                    onChange={(e) => setNewLP({ ...newLP, headquarters_country: e.target.value })}
                    placeholder="United States"
                    data-testid="input-lp-country"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="headquarters_city">City</Label>
                  <Input
                    id="headquarters_city"
                    value={newLP.headquarters_city}
                    onChange={(e) => setNewLP({ ...newLP, headquarters_city: e.target.value })}
                    placeholder="Sacramento"
                    data-testid="input-lp-city"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="total_aum">Total AUM</Label>
                  <Input
                    id="total_aum"
                    type="number"
                    value={newLP.total_aum}
                    onChange={(e) => setNewLP({ ...newLP, total_aum: e.target.value })}
                    placeholder="500000000000"
                    data-testid="input-lp-aum"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="private_markets_allocation">Private Markets Allocation %</Label>
                  <Input
                    id="private_markets_allocation"
                    type="number"
                    value={newLP.private_markets_allocation_percent}
                    onChange={(e) => setNewLP({ ...newLP, private_markets_allocation_percent: e.target.value })}
                    placeholder="15"
                    data-testid="input-lp-allocation"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => createMutation.mutate(newLP)}
                disabled={!newLP.lp_name || createMutation.isPending}
                data-testid="button-submit-lp"
              >
                {createMutation.isPending ? "Creating..." : "Create LP"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search LPs by name, type, or country..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
          data-testid="input-search-lps"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>LP Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>HQ</TableHead>
                <TableHead>AUM</TableHead>
                <TableHead>PE Allocation</TableHead>
                <TableHead>Commitments</TableHead>
                <TableHead>PRI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredLPs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No LPs found. Add your first LP to get started.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLPs.map((lp) => (
<TableRow
  key={lp.id}
  className="cursor-pointer hover-elevate"
  data-testid={`row-lp-${lp.id}`}
  onClick={() => navigate(`/entity/lp/${lp.id}`)}
>                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{lp.lp_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {lp.lp_type && <Badge variant="secondary">{lp.lp_type}</Badge>}
                    </TableCell>
                    <TableCell>
                      {lp.headquarters_city || lp.headquarters_country ? (
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {[lp.headquarters_city, lp.headquarters_country].filter(Boolean).join(", ")}
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        {formatAUM(lp.total_aum, lp.aum_currency)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {lp.private_markets_allocation_percent !== null ? (
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3 text-muted-foreground" />
                          {lp.private_markets_allocation_percent}%
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {lp.active_fund_commitments_count ?? "-"}
                    </TableCell>
                    <TableCell>
                      {lp.pri_signatory ? (
                        <Badge variant="default">PRI</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
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
