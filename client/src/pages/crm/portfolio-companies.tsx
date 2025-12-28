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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Search, Factory, MapPin, Globe, Users, TrendingUp } from "lucide-react";

interface PortfolioCompany {
  id: string;
  company_name: string;
  growth_stage: string | null;
  headquarters_country: string | null;
  headquarters_city: string | null;
  primary_industry: string | null;
  sub_industry: string | null;
  business_model_type: string | null;
  employee_count_band: string | null;
  latest_revenue: number | null;
  current_owner_type: string | null;
  exit_type: string | null;
  website: string | null;
  data_confidence_score: number | null;
}

export default function PortfolioCompaniesPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newCompany, setNewCompany] = useState({
    company_name: "",
    growth_stage: "",
    headquarters_country: "",
    headquarters_city: "",
    primary_industry: "",
    business_model_type: "",
    website: "",
    business_description: "",
  });

  const { data: companies, isLoading } = useQuery<PortfolioCompany[]>({
    queryKey: ["/api/crm/portfolio-companies"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newCompany) => {
      return apiRequest("POST", "/api/crm/portfolio-companies", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/portfolio-companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/counts"] });
      setIsAddDialogOpen(false);
      setNewCompany({
        company_name: "",
        growth_stage: "",
        headquarters_country: "",
        headquarters_city: "",
        primary_industry: "",
        business_model_type: "",
        website: "",
        business_description: "",
      });
      toast({ title: "Portfolio company created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error creating company", description: error.message, variant: "destructive" });
    },
  });

  const filteredCompanies = companies?.filter(c => 
    c.company_name.toLowerCase().includes(search.toLowerCase()) ||
    c.primary_industry?.toLowerCase().includes(search.toLowerCase()) ||
    c.headquarters_country?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-portfolio-title">Portfolio Companies</h1>
          <p className="text-muted-foreground">Backed companies and investments</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-company">
              <Plus className="h-4 w-4 mr-2" />
              Add Company
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Portfolio Company</DialogTitle>
              <DialogDescription>Enter the company details below</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name *</Label>
                  <Input
                    id="company_name"
                    value={newCompany.company_name}
                    onChange={(e) => setNewCompany({ ...newCompany, company_name: e.target.value })}
                    placeholder="Acme Corp"
                    data-testid="input-company-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="growth_stage">Growth Stage</Label>
                  <Select value={newCompany.growth_stage} onValueChange={(v) => setNewCompany({ ...newCompany, growth_stage: v })}>
                    <SelectTrigger data-testid="select-growth-stage">
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Seed">Seed</SelectItem>
                      <SelectItem value="Early">Early</SelectItem>
                      <SelectItem value="Growth">Growth</SelectItem>
                      <SelectItem value="Mature">Mature</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primary_industry">Industry</Label>
                  <Input
                    id="primary_industry"
                    value={newCompany.primary_industry}
                    onChange={(e) => setNewCompany({ ...newCompany, primary_industry: e.target.value })}
                    placeholder="Technology"
                    data-testid="input-industry"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business_model_type">Business Model</Label>
                  <Select value={newCompany.business_model_type} onValueChange={(v) => setNewCompany({ ...newCompany, business_model_type: v })}>
                    <SelectTrigger data-testid="select-business-model">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="B2B">B2B</SelectItem>
                      <SelectItem value="B2C">B2C</SelectItem>
                      <SelectItem value="B2B2C">B2B2C</SelectItem>
                      <SelectItem value="SaaS">SaaS</SelectItem>
                      <SelectItem value="Marketplace">Marketplace</SelectItem>
                      <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="headquarters_country">Country</Label>
                  <Input
                    id="headquarters_country"
                    value={newCompany.headquarters_country}
                    onChange={(e) => setNewCompany({ ...newCompany, headquarters_country: e.target.value })}
                    placeholder="United States"
                    data-testid="input-company-country"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="headquarters_city">City</Label>
                  <Input
                    id="headquarters_city"
                    value={newCompany.headquarters_city}
                    onChange={(e) => setNewCompany({ ...newCompany, headquarters_city: e.target.value })}
                    placeholder="San Francisco"
                    data-testid="input-company-city"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={newCompany.website}
                  onChange={(e) => setNewCompany({ ...newCompany, website: e.target.value })}
                  placeholder="https://www.acme.com"
                  data-testid="input-company-website"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business_description">Description</Label>
                <Textarea
                  id="business_description"
                  value={newCompany.business_description}
                  onChange={(e) => setNewCompany({ ...newCompany, business_description: e.target.value })}
                  placeholder="Brief description of the company..."
                  data-testid="input-company-description"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => createMutation.mutate(newCompany)}
                disabled={!newCompany.company_name || createMutation.isPending}
                data-testid="button-submit-company"
              >
                {createMutation.isPending ? "Creating..." : "Create Company"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search companies by name, industry, or country..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
          data-testid="input-search-companies"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>HQ</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
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
                    No portfolio companies found. Add your first company to get started.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCompanies.map((company) => (
                  <TableRow key={company.id} className="cursor-pointer hover-elevate" data-testid={`row-company-${company.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Factory className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{company.company_name}</p>
                          {company.website && (
                            <a 
                              href={company.website} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Globe className="h-3 w-3" />
                              {new URL(company.website).hostname}
                            </a>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        {company.primary_industry && <Badge variant="secondary">{company.primary_industry}</Badge>}
                        {company.sub_industry && (
                          <p className="text-xs text-muted-foreground mt-1">{company.sub_industry}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {company.business_model_type || "-"}
                    </TableCell>
                    <TableCell>
                      {company.headquarters_city || company.headquarters_country ? (
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {[company.headquarters_city, company.headquarters_country].filter(Boolean).join(", ")}
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {company.employee_count_band ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          {company.employee_count_band}
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {company.exit_type ? (
                        <Badge variant={company.exit_type === "Active" ? "default" : "secondary"}>
                          {company.exit_type}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Active</Badge>
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
