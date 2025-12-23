import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Search, Leaf, MapPin, Globe, Factory, ExternalLink } from "lucide-react";

interface AgritechCompany {
  id: string;
  portfolio_company_id: string | null;
  company_name: string | null;
  headquarters_country: string | null;
  headquarters_city: string | null;
  website: string | null;
  crop_types: string | null;
  farming_method: string | null;
  tech_stack: string | null;
  sustainability_certifications: string | null;
  geographic_focus: string | null;
  target_market: string | null;
  notes: string | null;
}

interface PortfolioCompany {
  id: string;
  company_name: string;
}

export default function AgritechPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newRecord, setNewRecord] = useState({
    portfolio_company_id: "",
    crop_types: "",
    farming_method: "",
    tech_stack: "",
    sustainability_certifications: "",
    geographic_focus: "",
    target_market: "",
    notes: "",
  });

  const { data: companies, isLoading } = useQuery<AgritechCompany[]>({
    queryKey: ["/api/crm/agritech"],
  });

  const { data: portfolioCompanies } = useQuery<PortfolioCompany[]>({
    queryKey: ["/api/crm/portfolio-companies"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newRecord) => {
      return apiRequest("POST", "/api/crm/agritech", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/agritech"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/counts"] });
      setIsAddDialogOpen(false);
      setNewRecord({
        portfolio_company_id: "",
        crop_types: "",
        farming_method: "",
        tech_stack: "",
        sustainability_certifications: "",
        geographic_focus: "",
        target_market: "",
        notes: "",
      });
      toast({ title: "Agritech record created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error creating record", description: error.message, variant: "destructive" });
    },
  });

  const filteredCompanies = companies?.filter(c => 
    c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.crop_types?.toLowerCase().includes(search.toLowerCase()) ||
    c.farming_method?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-agritech-title">Agritech</h1>
          <p className="text-muted-foreground">Agricultural technology companies and extensions</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-agritech">
              <Plus className="h-4 w-4 mr-2" />
              Add Agritech
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Agritech Record</DialogTitle>
              <DialogDescription>Link to an existing portfolio company or add sector-specific details</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="portfolio_company_id">Link to Portfolio Company</Label>
                <Select value={newRecord.portfolio_company_id} onValueChange={(v) => setNewRecord({ ...newRecord, portfolio_company_id: v })}>
                  <SelectTrigger data-testid="select-portfolio-company">
                    <SelectValue placeholder="Select a portfolio company" />
                  </SelectTrigger>
                  <SelectContent>
                    {portfolioCompanies?.map(pc => (
                      <SelectItem key={pc.id} value={pc.id}>{pc.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="crop_types">Crop Types</Label>
                  <Input
                    id="crop_types"
                    value={newRecord.crop_types}
                    onChange={(e) => setNewRecord({ ...newRecord, crop_types: e.target.value })}
                    placeholder="Grains, Vegetables, etc."
                    data-testid="input-crop-types"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="farming_method">Farming Method</Label>
                  <Select value={newRecord.farming_method} onValueChange={(v) => setNewRecord({ ...newRecord, farming_method: v })}>
                    <SelectTrigger data-testid="select-farming-method">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Vertical Farming">Vertical Farming</SelectItem>
                      <SelectItem value="Hydroponics">Hydroponics</SelectItem>
                      <SelectItem value="Precision Agriculture">Precision Agriculture</SelectItem>
                      <SelectItem value="Organic">Organic</SelectItem>
                      <SelectItem value="Regenerative">Regenerative</SelectItem>
                      <SelectItem value="Traditional">Traditional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tech_stack">Technology Stack</Label>
                  <Input
                    id="tech_stack"
                    value={newRecord.tech_stack}
                    onChange={(e) => setNewRecord({ ...newRecord, tech_stack: e.target.value })}
                    placeholder="IoT, AI/ML, Drones, etc."
                    data-testid="input-tech-stack"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="geographic_focus">Geographic Focus</Label>
                  <Input
                    id="geographic_focus"
                    value={newRecord.geographic_focus}
                    onChange={(e) => setNewRecord({ ...newRecord, geographic_focus: e.target.value })}
                    placeholder="North America, Europe, etc."
                    data-testid="input-geographic-focus"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sustainability_certifications">Certifications</Label>
                  <Input
                    id="sustainability_certifications"
                    value={newRecord.sustainability_certifications}
                    onChange={(e) => setNewRecord({ ...newRecord, sustainability_certifications: e.target.value })}
                    placeholder="USDA Organic, B-Corp, etc."
                    data-testid="input-certifications"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target_market">Target Market</Label>
                  <Input
                    id="target_market"
                    value={newRecord.target_market}
                    onChange={(e) => setNewRecord({ ...newRecord, target_market: e.target.value })}
                    placeholder="Commercial Farms, Consumers, etc."
                    data-testid="input-target-market"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={newRecord.notes}
                  onChange={(e) => setNewRecord({ ...newRecord, notes: e.target.value })}
                  placeholder="Additional notes..."
                  data-testid="input-notes"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => createMutation.mutate(newRecord)}
                disabled={createMutation.isPending}
                data-testid="button-submit-agritech"
              >
                {createMutation.isPending ? "Creating..." : "Create Record"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by company, crops, or method..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
          data-testid="input-search-agritech"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Crop Types</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Tech Stack</TableHead>
                <TableHead>Focus Region</TableHead>
                <TableHead>Certifications</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredCompanies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No agritech records found. Add your first record to get started.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCompanies.map((company) => (
                  <TableRow key={company.id} className="cursor-pointer hover-elevate" data-testid={`row-agritech-${company.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Leaf className="h-4 w-4 text-green-600" />
                        <div>
                          <p className="font-medium">{company.company_name || "Unlinked"}</p>
                          {company.portfolio_company_id && (
                            <Link href="/data/portfolio-companies" className="text-xs text-muted-foreground flex items-center gap-1">
                              <ExternalLink className="h-3 w-3" />
                              View in Portfolio
                            </Link>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {company.crop_types || "-"}
                    </TableCell>
                    <TableCell>
                      {company.farming_method ? (
                        <Badge variant="secondary">{company.farming_method}</Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {company.tech_stack || "-"}
                    </TableCell>
                    <TableCell>
                      {company.geographic_focus ? (
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {company.geographic_focus}
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {company.sustainability_certifications ? (
                        <Badge variant="outline">{company.sustainability_certifications}</Badge>
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
