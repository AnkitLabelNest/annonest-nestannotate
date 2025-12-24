import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Plus, Search, Leaf, Blocks, Heart, TrendingUp, 
  Eye, Pencil, X, Globe, MapPin, DollarSign, Shield,
  FlaskConical, Users, Factory, BarChart3
} from "lucide-react";

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

interface BlockchainCompany {
  id: string;
  portfolio_company_id: string | null;
  company_name: string | null;
  headquarters_country: string | null;
  headquarters_city: string | null;
  website: string | null;
  blockchain_platform: string | null;
  token_ticker: string | null;
  consensus_mechanism: string | null;
  smart_contract_language: string | null;
  defi_category: string | null;
  tvl_usd: number | null;
  audit_status: string | null;
  notes: string | null;
}

interface HealthcareCompany {
  id: string;
  portfolio_company_id: string | null;
  company_name: string | null;
  headquarters_country: string | null;
  headquarters_city: string | null;
  website: string | null;
  healthcare_segment: string | null;
  therapeutic_area: string | null;
  regulatory_status: string | null;
  fda_approval_stage: string | null;
  clinical_trial_phase: string | null;
  target_patient_population: string | null;
  reimbursement_model: string | null;
  notes: string | null;
}

interface PublicMarketCompany {
  id: string;
  company_name: string;
  ticker: string | null;
  exchange: string | null;
  isin: string | null;
  cusip: string | null;
  sector: string | null;
  industry: string | null;
  market_cap: number | null;
  enterprise_value: number | null;
  revenue_ttm: number | null;
  ebitda_ttm: number | null;
  pe_ratio: number | null;
  headquarters_country: string | null;
  headquarters_city: string | null;
  website: string | null;
  description: string | null;
  notes: string | null;
}

interface PortfolioCompany {
  id: string;
  company_name: string;
}

export interface SectorsPageProps {
  defaultTab?: "agritech" | "blockchain" | "healthcare" | "public-market";
}

function FieldDisplay({ label, value, isLink = false }: { label: string; value?: string | number | null; isLink?: boolean }) {
  if (value === null || value === undefined || value === "") {
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">-</p>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      {isLink ? (
        <a href={String(value)} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
          {String(value)}
        </a>
      ) : (
        <p className="text-sm">{String(value)}</p>
      )}
    </div>
  );
}

export default function SectorsPage({ defaultTab = "agritech" }: SectorsPageProps) {
  const [activeTab, setActiveTab] = useState<"agritech" | "blockchain" | "healthcare" | "public-market">(defaultTab);
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-sectors-title">Sector Extensions</h1>
        <p className="text-muted-foreground">Manage sector-specific company data and extensions</p>
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search records..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
          data-testid="input-search-sectors"
        />
      </div>

      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="agritech" data-testid="tab-agritech">Agritech</TabsTrigger>
          <TabsTrigger value="blockchain" data-testid="tab-blockchain">Blockchain</TabsTrigger>
          <TabsTrigger value="healthcare" data-testid="tab-healthcare">Healthcare</TabsTrigger>
          <TabsTrigger value="public-market" data-testid="tab-public-market">Public Market</TabsTrigger>
        </TabsList>

        <TabsContent value="agritech">
          <AgritechTab searchQuery={searchQuery} />
        </TabsContent>
        <TabsContent value="blockchain">
          <BlockchainTab searchQuery={searchQuery} />
        </TabsContent>
        <TabsContent value="healthcare">
          <HealthcareTab searchQuery={searchQuery} />
        </TabsContent>
        <TabsContent value="public-market">
          <PublicMarketTab searchQuery={searchQuery} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AgritechTab({ searchQuery }: { searchQuery: string }) {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AgritechCompany | null>(null);
  const [dialogMode, setDialogMode] = useState<"view" | "edit">("view");

  const { data: companies = [], isLoading } = useQuery<AgritechCompany[]>({
    queryKey: ["/api/crm/agritech"],
  });

  const { data: portfolioCompanies = [] } = useQuery<PortfolioCompany[]>({
    queryKey: ["/api/crm/portfolio-companies"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/crm/agritech", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/agritech"] });
      setIsAddDialogOpen(false);
      toast({ title: "Agritech record created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filtered = companies.filter(c =>
    c.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.crop_types?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.farming_method?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openDialog = (record: AgritechCompany, mode: "view" | "edit") => {
    setSelectedRecord(record);
    setDialogMode(mode);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-agritech">
              <Plus className="h-4 w-4 mr-2" />
              Add Agritech
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Agritech Record</DialogTitle>
              <DialogDescription>Create a new agritech sector extension</DialogDescription>
            </DialogHeader>
            <AgritechForm portfolioCompanies={portfolioCompanies} onSubmit={(data) => createMutation.mutate(data)} isPending={createMutation.isPending} onCancel={() => setIsAddDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Crop Types</TableHead>
                <TableHead>Farming Method</TableHead>
                <TableHead>Geographic Focus</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No records found</TableCell>
                </TableRow>
              ) : (
                filtered.map((record) => (
                  <TableRow key={record.id} data-testid={`row-agritech-${record.id}`}>
                    <TableCell className="font-medium">{record.company_name || "-"}</TableCell>
                    <TableCell>{record.crop_types || "-"}</TableCell>
                    <TableCell><Badge variant="secondary">{record.farming_method || "-"}</Badge></TableCell>
                    <TableCell>{record.geographic_focus || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openDialog(record, "view")} data-testid={`button-view-agritech-${record.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => openDialog(record, "edit")} data-testid={`button-edit-agritech-${record.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <DialogTitle>{dialogMode === "view" ? "Agritech Details" : "Edit Agritech"}</DialogTitle>
              {dialogMode === "view" && (
                <Button variant="outline" size="sm" onClick={() => setDialogMode("edit")}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          </DialogHeader>
          {selectedRecord && dialogMode === "view" && (
            <AgritechFullView record={selectedRecord} onClose={() => setSelectedRecord(null)} />
          )}
          {selectedRecord && dialogMode === "edit" && (
            <AgritechEditForm record={selectedRecord} portfolioCompanies={portfolioCompanies} onClose={() => setSelectedRecord(null)} onSwitchToView={() => setDialogMode("view")} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AgritechForm({ portfolioCompanies, onSubmit, isPending, onCancel }: { portfolioCompanies: PortfolioCompany[]; onSubmit: (data: any) => void; isPending: boolean; onCancel: () => void }) {
  const [formData, setFormData] = useState({
    portfolio_company_id: "",
    crop_types: "",
    farming_method: "",
    tech_stack: "",
    sustainability_certifications: "",
    geographic_focus: "",
    target_market: "",
    notes: "",
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Portfolio Company</Label>
          <Select value={formData.portfolio_company_id} onValueChange={(v) => setFormData({ ...formData, portfolio_company_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
            <SelectContent>
              {portfolioCompanies.map((pc) => (
                <SelectItem key={pc.id} value={pc.id}>{pc.company_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Crop Types</Label>
          <Input value={formData.crop_types} onChange={(e) => setFormData({ ...formData, crop_types: e.target.value })} placeholder="e.g., Corn, Wheat, Soybeans" />
        </div>
        <div className="space-y-2">
          <Label>Farming Method</Label>
          <Select value={formData.farming_method} onValueChange={(v) => setFormData({ ...formData, farming_method: v })}>
            <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Precision Agriculture">Precision Agriculture</SelectItem>
              <SelectItem value="Vertical Farming">Vertical Farming</SelectItem>
              <SelectItem value="Hydroponics">Hydroponics</SelectItem>
              <SelectItem value="Organic">Organic</SelectItem>
              <SelectItem value="Regenerative">Regenerative</SelectItem>
              <SelectItem value="Indoor Farming">Indoor Farming</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Tech Stack</Label>
          <Input value={formData.tech_stack} onChange={(e) => setFormData({ ...formData, tech_stack: e.target.value })} placeholder="e.g., IoT, AI, Drones" />
        </div>
        <div className="space-y-2">
          <Label>Sustainability Certifications</Label>
          <Input value={formData.sustainability_certifications} onChange={(e) => setFormData({ ...formData, sustainability_certifications: e.target.value })} placeholder="e.g., USDA Organic, B Corp" />
        </div>
        <div className="space-y-2">
          <Label>Geographic Focus</Label>
          <Input value={formData.geographic_focus} onChange={(e) => setFormData({ ...formData, geographic_focus: e.target.value })} placeholder="e.g., North America, Europe" />
        </div>
        <div className="space-y-2">
          <Label>Target Market</Label>
          <Input value={formData.target_market} onChange={(e) => setFormData({ ...formData, target_market: e.target.value })} placeholder="e.g., Commercial farms, Consumers" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Additional notes..." />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSubmit(formData)} disabled={isPending}>{isPending ? "Creating..." : "Create"}</Button>
      </div>
    </div>
  );
}

function AgritechFullView({ record, onClose }: { record: AgritechCompany; onClose: () => void }) {
  return (
    <ScrollArea className="h-[60vh]">
      <div className="space-y-6 p-4">
        <div>
          <h3 className="font-semibold mb-3">Company Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <FieldDisplay label="Company Name" value={record.company_name} />
            <FieldDisplay label="Website" value={record.website} isLink />
            <FieldDisplay label="Headquarters Country" value={record.headquarters_country} />
            <FieldDisplay label="Headquarters City" value={record.headquarters_city} />
          </div>
        </div>
        <Separator />
        <div>
          <h3 className="font-semibold mb-3">Agritech Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <FieldDisplay label="Crop Types" value={record.crop_types} />
            <FieldDisplay label="Farming Method" value={record.farming_method} />
            <FieldDisplay label="Tech Stack" value={record.tech_stack} />
            <FieldDisplay label="Sustainability Certifications" value={record.sustainability_certifications} />
            <FieldDisplay label="Geographic Focus" value={record.geographic_focus} />
            <FieldDisplay label="Target Market" value={record.target_market} />
          </div>
        </div>
        <Separator />
        <div>
          <h3 className="font-semibold mb-3">Notes</h3>
          <FieldDisplay label="Notes" value={record.notes} />
        </div>
      </div>
    </ScrollArea>
  );
}

function AgritechEditForm({ record, portfolioCompanies, onClose, onSwitchToView }: { record: AgritechCompany; portfolioCompanies: PortfolioCompany[]; onClose: () => void; onSwitchToView: () => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    portfolio_company_id: record.portfolio_company_id || "",
    crop_types: record.crop_types || "",
    farming_method: record.farming_method || "",
    tech_stack: record.tech_stack || "",
    sustainability_certifications: record.sustainability_certifications || "",
    geographic_focus: record.geographic_focus || "",
    target_market: record.target_market || "",
    notes: record.notes || "",
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("PATCH", `/api/crm/agritech/${record.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/agritech"] });
      toast({ title: "Agritech record updated" });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <ScrollArea className="h-[60vh]">
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Portfolio Company</Label>
            <Select value={formData.portfolio_company_id} onValueChange={(v) => setFormData({ ...formData, portfolio_company_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
              <SelectContent>
                {portfolioCompanies.map((pc) => (
                  <SelectItem key={pc.id} value={pc.id}>{pc.company_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Crop Types</Label>
            <Input value={formData.crop_types} onChange={(e) => setFormData({ ...formData, crop_types: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Farming Method</Label>
            <Select value={formData.farming_method} onValueChange={(v) => setFormData({ ...formData, farming_method: v })}>
              <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Precision Agriculture">Precision Agriculture</SelectItem>
                <SelectItem value="Vertical Farming">Vertical Farming</SelectItem>
                <SelectItem value="Hydroponics">Hydroponics</SelectItem>
                <SelectItem value="Organic">Organic</SelectItem>
                <SelectItem value="Regenerative">Regenerative</SelectItem>
                <SelectItem value="Indoor Farming">Indoor Farming</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tech Stack</Label>
            <Input value={formData.tech_stack} onChange={(e) => setFormData({ ...formData, tech_stack: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Sustainability Certifications</Label>
            <Input value={formData.sustainability_certifications} onChange={(e) => setFormData({ ...formData, sustainability_certifications: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Geographic Focus</Label>
            <Input value={formData.geographic_focus} onChange={(e) => setFormData({ ...formData, geographic_focus: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Target Market</Label>
            <Input value={formData.target_market} onChange={(e) => setFormData({ ...formData, target_market: e.target.value })} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onSwitchToView}>Cancel</Button>
          <Button onClick={() => updateMutation.mutate(formData)} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}

function BlockchainTab({ searchQuery }: { searchQuery: string }) {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<BlockchainCompany | null>(null);
  const [dialogMode, setDialogMode] = useState<"view" | "edit">("view");

  const { data: companies = [], isLoading } = useQuery<BlockchainCompany[]>({
    queryKey: ["/api/crm/blockchain"],
  });

  const { data: portfolioCompanies = [] } = useQuery<PortfolioCompany[]>({
    queryKey: ["/api/crm/portfolio-companies"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/crm/blockchain", {
      ...data,
      tvl_usd: data.tvl_usd ? parseFloat(data.tvl_usd) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/blockchain"] });
      setIsAddDialogOpen(false);
      toast({ title: "Blockchain record created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const formatTVL = (tvl: number | null) => {
    if (!tvl) return "-";
    if (tvl >= 1e9) return `$${(tvl / 1e9).toFixed(2)}B`;
    if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(2)}M`;
    return `$${tvl.toLocaleString()}`;
  };

  const filtered = companies.filter(c =>
    c.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.blockchain_platform?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.token_ticker?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openDialog = (record: BlockchainCompany, mode: "view" | "edit") => {
    setSelectedRecord(record);
    setDialogMode(mode);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-blockchain">
              <Plus className="h-4 w-4 mr-2" />
              Add Blockchain
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Blockchain Record</DialogTitle>
              <DialogDescription>Create a new blockchain sector extension</DialogDescription>
            </DialogHeader>
            <BlockchainForm portfolioCompanies={portfolioCompanies} onSubmit={(data) => createMutation.mutate(data)} isPending={createMutation.isPending} onCancel={() => setIsAddDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>TVL</TableHead>
                <TableHead>Audit Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No records found</TableCell>
                </TableRow>
              ) : (
                filtered.map((record) => (
                  <TableRow key={record.id} data-testid={`row-blockchain-${record.id}`}>
                    <TableCell className="font-medium">{record.company_name || "-"}</TableCell>
                    <TableCell><Badge variant="secondary">{record.blockchain_platform || "-"}</Badge></TableCell>
                    <TableCell>{record.token_ticker || "-"}</TableCell>
                    <TableCell>{formatTVL(record.tvl_usd)}</TableCell>
                    <TableCell>
                      <Badge variant={record.audit_status === "Audited" ? "default" : "secondary"}>
                        {record.audit_status || "-"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openDialog(record, "view")} data-testid={`button-view-blockchain-${record.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => openDialog(record, "edit")} data-testid={`button-edit-blockchain-${record.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <DialogTitle>{dialogMode === "view" ? "Blockchain Details" : "Edit Blockchain"}</DialogTitle>
              {dialogMode === "view" && (
                <Button variant="outline" size="sm" onClick={() => setDialogMode("edit")}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          </DialogHeader>
          {selectedRecord && dialogMode === "view" && (
            <BlockchainFullView record={selectedRecord} onClose={() => setSelectedRecord(null)} />
          )}
          {selectedRecord && dialogMode === "edit" && (
            <BlockchainEditForm record={selectedRecord} portfolioCompanies={portfolioCompanies} onClose={() => setSelectedRecord(null)} onSwitchToView={() => setDialogMode("view")} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BlockchainForm({ portfolioCompanies, onSubmit, isPending, onCancel }: { portfolioCompanies: PortfolioCompany[]; onSubmit: (data: any) => void; isPending: boolean; onCancel: () => void }) {
  const [formData, setFormData] = useState({
    portfolio_company_id: "",
    blockchain_platform: "",
    token_ticker: "",
    consensus_mechanism: "",
    smart_contract_language: "",
    defi_category: "",
    tvl_usd: "",
    audit_status: "",
    notes: "",
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Portfolio Company</Label>
          <Select value={formData.portfolio_company_id} onValueChange={(v) => setFormData({ ...formData, portfolio_company_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
            <SelectContent>
              {portfolioCompanies.map((pc) => (
                <SelectItem key={pc.id} value={pc.id}>{pc.company_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Blockchain Platform</Label>
          <Select value={formData.blockchain_platform} onValueChange={(v) => setFormData({ ...formData, blockchain_platform: v })}>
            <SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Ethereum">Ethereum</SelectItem>
              <SelectItem value="Solana">Solana</SelectItem>
              <SelectItem value="Polygon">Polygon</SelectItem>
              <SelectItem value="Avalanche">Avalanche</SelectItem>
              <SelectItem value="BNB Chain">BNB Chain</SelectItem>
              <SelectItem value="Arbitrum">Arbitrum</SelectItem>
              <SelectItem value="Optimism">Optimism</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Token Ticker</Label>
          <Input value={formData.token_ticker} onChange={(e) => setFormData({ ...formData, token_ticker: e.target.value })} placeholder="e.g., ETH, SOL" />
        </div>
        <div className="space-y-2">
          <Label>Consensus Mechanism</Label>
          <Select value={formData.consensus_mechanism} onValueChange={(v) => setFormData({ ...formData, consensus_mechanism: v })}>
            <SelectTrigger><SelectValue placeholder="Select mechanism" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Proof of Stake">Proof of Stake</SelectItem>
              <SelectItem value="Proof of Work">Proof of Work</SelectItem>
              <SelectItem value="Delegated PoS">Delegated PoS</SelectItem>
              <SelectItem value="Proof of Authority">Proof of Authority</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Smart Contract Language</Label>
          <Input value={formData.smart_contract_language} onChange={(e) => setFormData({ ...formData, smart_contract_language: e.target.value })} placeholder="e.g., Solidity, Rust" />
        </div>
        <div className="space-y-2">
          <Label>DeFi Category</Label>
          <Select value={formData.defi_category} onValueChange={(v) => setFormData({ ...formData, defi_category: v })}>
            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="DEX">DEX</SelectItem>
              <SelectItem value="Lending">Lending</SelectItem>
              <SelectItem value="Staking">Staking</SelectItem>
              <SelectItem value="Yield Aggregator">Yield Aggregator</SelectItem>
              <SelectItem value="Bridge">Bridge</SelectItem>
              <SelectItem value="NFT">NFT</SelectItem>
              <SelectItem value="Infrastructure">Infrastructure</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>TVL (USD)</Label>
          <Input type="number" value={formData.tvl_usd} onChange={(e) => setFormData({ ...formData, tvl_usd: e.target.value })} placeholder="e.g., 1000000000" />
        </div>
        <div className="space-y-2">
          <Label>Audit Status</Label>
          <Select value={formData.audit_status} onValueChange={(v) => setFormData({ ...formData, audit_status: v })}>
            <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Audited">Audited</SelectItem>
              <SelectItem value="Pending Audit">Pending Audit</SelectItem>
              <SelectItem value="Not Audited">Not Audited</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Additional notes..." />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSubmit(formData)} disabled={isPending}>{isPending ? "Creating..." : "Create"}</Button>
      </div>
    </div>
  );
}

function BlockchainFullView({ record, onClose }: { record: BlockchainCompany; onClose: () => void }) {
  const formatTVL = (tvl: number | null) => {
    if (!tvl) return "-";
    if (tvl >= 1e9) return `$${(tvl / 1e9).toFixed(2)}B`;
    if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(2)}M`;
    return `$${tvl.toLocaleString()}`;
  };

  return (
    <ScrollArea className="h-[60vh]">
      <div className="space-y-6 p-4">
        <div>
          <h3 className="font-semibold mb-3">Company Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <FieldDisplay label="Company Name" value={record.company_name} />
            <FieldDisplay label="Website" value={record.website} isLink />
            <FieldDisplay label="Headquarters Country" value={record.headquarters_country} />
            <FieldDisplay label="Headquarters City" value={record.headquarters_city} />
          </div>
        </div>
        <Separator />
        <div>
          <h3 className="font-semibold mb-3">Blockchain Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <FieldDisplay label="Blockchain Platform" value={record.blockchain_platform} />
            <FieldDisplay label="Token Ticker" value={record.token_ticker} />
            <FieldDisplay label="Consensus Mechanism" value={record.consensus_mechanism} />
            <FieldDisplay label="Smart Contract Language" value={record.smart_contract_language} />
            <FieldDisplay label="DeFi Category" value={record.defi_category} />
            <FieldDisplay label="Total Value Locked (TVL)" value={formatTVL(record.tvl_usd)} />
            <FieldDisplay label="Audit Status" value={record.audit_status} />
          </div>
        </div>
        <Separator />
        <div>
          <h3 className="font-semibold mb-3">Notes</h3>
          <FieldDisplay label="Notes" value={record.notes} />
        </div>
      </div>
    </ScrollArea>
  );
}

function BlockchainEditForm({ record, portfolioCompanies, onClose, onSwitchToView }: { record: BlockchainCompany; portfolioCompanies: PortfolioCompany[]; onClose: () => void; onSwitchToView: () => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    portfolio_company_id: record.portfolio_company_id || "",
    blockchain_platform: record.blockchain_platform || "",
    token_ticker: record.token_ticker || "",
    consensus_mechanism: record.consensus_mechanism || "",
    smart_contract_language: record.smart_contract_language || "",
    defi_category: record.defi_category || "",
    tvl_usd: record.tvl_usd?.toString() || "",
    audit_status: record.audit_status || "",
    notes: record.notes || "",
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("PATCH", `/api/crm/blockchain/${record.id}`, {
      ...data,
      tvl_usd: data.tvl_usd ? parseFloat(data.tvl_usd) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/blockchain"] });
      toast({ title: "Blockchain record updated" });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <ScrollArea className="h-[60vh]">
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Portfolio Company</Label>
            <Select value={formData.portfolio_company_id} onValueChange={(v) => setFormData({ ...formData, portfolio_company_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
              <SelectContent>
                {portfolioCompanies.map((pc) => (
                  <SelectItem key={pc.id} value={pc.id}>{pc.company_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Blockchain Platform</Label>
            <Select value={formData.blockchain_platform} onValueChange={(v) => setFormData({ ...formData, blockchain_platform: v })}>
              <SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Ethereum">Ethereum</SelectItem>
                <SelectItem value="Solana">Solana</SelectItem>
                <SelectItem value="Polygon">Polygon</SelectItem>
                <SelectItem value="Avalanche">Avalanche</SelectItem>
                <SelectItem value="BNB Chain">BNB Chain</SelectItem>
                <SelectItem value="Arbitrum">Arbitrum</SelectItem>
                <SelectItem value="Optimism">Optimism</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Token Ticker</Label>
            <Input value={formData.token_ticker} onChange={(e) => setFormData({ ...formData, token_ticker: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Consensus Mechanism</Label>
            <Select value={formData.consensus_mechanism} onValueChange={(v) => setFormData({ ...formData, consensus_mechanism: v })}>
              <SelectTrigger><SelectValue placeholder="Select mechanism" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Proof of Stake">Proof of Stake</SelectItem>
                <SelectItem value="Proof of Work">Proof of Work</SelectItem>
                <SelectItem value="Delegated PoS">Delegated PoS</SelectItem>
                <SelectItem value="Proof of Authority">Proof of Authority</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Smart Contract Language</Label>
            <Input value={formData.smart_contract_language} onChange={(e) => setFormData({ ...formData, smart_contract_language: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>DeFi Category</Label>
            <Select value={formData.defi_category} onValueChange={(v) => setFormData({ ...formData, defi_category: v })}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DEX">DEX</SelectItem>
                <SelectItem value="Lending">Lending</SelectItem>
                <SelectItem value="Staking">Staking</SelectItem>
                <SelectItem value="Yield Aggregator">Yield Aggregator</SelectItem>
                <SelectItem value="Bridge">Bridge</SelectItem>
                <SelectItem value="NFT">NFT</SelectItem>
                <SelectItem value="Infrastructure">Infrastructure</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>TVL (USD)</Label>
            <Input type="number" value={formData.tvl_usd} onChange={(e) => setFormData({ ...formData, tvl_usd: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Audit Status</Label>
            <Select value={formData.audit_status} onValueChange={(v) => setFormData({ ...formData, audit_status: v })}>
              <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Audited">Audited</SelectItem>
                <SelectItem value="Pending Audit">Pending Audit</SelectItem>
                <SelectItem value="Not Audited">Not Audited</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onSwitchToView}>Cancel</Button>
          <Button onClick={() => updateMutation.mutate(formData)} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}

function HealthcareTab({ searchQuery }: { searchQuery: string }) {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<HealthcareCompany | null>(null);
  const [dialogMode, setDialogMode] = useState<"view" | "edit">("view");

  const { data: companies = [], isLoading } = useQuery<HealthcareCompany[]>({
    queryKey: ["/api/crm/healthcare"],
  });

  const { data: portfolioCompanies = [] } = useQuery<PortfolioCompany[]>({
    queryKey: ["/api/crm/portfolio-companies"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/crm/healthcare", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/healthcare"] });
      setIsAddDialogOpen(false);
      toast({ title: "Healthcare record created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filtered = companies.filter(c =>
    c.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.healthcare_segment?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.therapeutic_area?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openDialog = (record: HealthcareCompany, mode: "view" | "edit") => {
    setSelectedRecord(record);
    setDialogMode(mode);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-healthcare">
              <Plus className="h-4 w-4 mr-2" />
              Add Healthcare
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Healthcare Record</DialogTitle>
              <DialogDescription>Create a new healthcare sector extension</DialogDescription>
            </DialogHeader>
            <HealthcareForm portfolioCompanies={portfolioCompanies} onSubmit={(data) => createMutation.mutate(data)} isPending={createMutation.isPending} onCancel={() => setIsAddDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead>Therapeutic Area</TableHead>
                <TableHead>FDA Stage</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No records found</TableCell>
                </TableRow>
              ) : (
                filtered.map((record) => (
                  <TableRow key={record.id} data-testid={`row-healthcare-${record.id}`}>
                    <TableCell className="font-medium">{record.company_name || "-"}</TableCell>
                    <TableCell><Badge variant="secondary">{record.healthcare_segment || "-"}</Badge></TableCell>
                    <TableCell>{record.therapeutic_area || "-"}</TableCell>
                    <TableCell>{record.fda_approval_stage || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openDialog(record, "view")} data-testid={`button-view-healthcare-${record.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => openDialog(record, "edit")} data-testid={`button-edit-healthcare-${record.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <DialogTitle>{dialogMode === "view" ? "Healthcare Details" : "Edit Healthcare"}</DialogTitle>
              {dialogMode === "view" && (
                <Button variant="outline" size="sm" onClick={() => setDialogMode("edit")}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          </DialogHeader>
          {selectedRecord && dialogMode === "view" && (
            <HealthcareFullView record={selectedRecord} onClose={() => setSelectedRecord(null)} />
          )}
          {selectedRecord && dialogMode === "edit" && (
            <HealthcareEditForm record={selectedRecord} portfolioCompanies={portfolioCompanies} onClose={() => setSelectedRecord(null)} onSwitchToView={() => setDialogMode("view")} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HealthcareForm({ portfolioCompanies, onSubmit, isPending, onCancel }: { portfolioCompanies: PortfolioCompany[]; onSubmit: (data: any) => void; isPending: boolean; onCancel: () => void }) {
  const [formData, setFormData] = useState({
    portfolio_company_id: "",
    healthcare_segment: "",
    therapeutic_area: "",
    regulatory_status: "",
    fda_approval_stage: "",
    clinical_trial_phase: "",
    target_patient_population: "",
    reimbursement_model: "",
    notes: "",
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Portfolio Company</Label>
          <Select value={formData.portfolio_company_id} onValueChange={(v) => setFormData({ ...formData, portfolio_company_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
            <SelectContent>
              {portfolioCompanies.map((pc) => (
                <SelectItem key={pc.id} value={pc.id}>{pc.company_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Healthcare Segment</Label>
          <Select value={formData.healthcare_segment} onValueChange={(v) => setFormData({ ...formData, healthcare_segment: v })}>
            <SelectTrigger><SelectValue placeholder="Select segment" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Pharmaceuticals">Pharmaceuticals</SelectItem>
              <SelectItem value="Biotechnology">Biotechnology</SelectItem>
              <SelectItem value="Medical Devices">Medical Devices</SelectItem>
              <SelectItem value="Diagnostics">Diagnostics</SelectItem>
              <SelectItem value="Digital Health">Digital Health</SelectItem>
              <SelectItem value="Healthcare Services">Healthcare Services</SelectItem>
              <SelectItem value="Life Sciences Tools">Life Sciences Tools</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Therapeutic Area</Label>
          <Input value={formData.therapeutic_area} onChange={(e) => setFormData({ ...formData, therapeutic_area: e.target.value })} placeholder="e.g., Oncology, Cardiovascular" />
        </div>
        <div className="space-y-2">
          <Label>Regulatory Status</Label>
          <Select value={formData.regulatory_status} onValueChange={(v) => setFormData({ ...formData, regulatory_status: v })}>
            <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Under Review">Under Review</SelectItem>
              <SelectItem value="Clinical Trials">Clinical Trials</SelectItem>
              <SelectItem value="Pre-Clinical">Pre-Clinical</SelectItem>
              <SelectItem value="Not Applicable">Not Applicable</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>FDA Approval Stage</Label>
          <Select value={formData.fda_approval_stage} onValueChange={(v) => setFormData({ ...formData, fda_approval_stage: v })}>
            <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="FDA Approved">FDA Approved</SelectItem>
              <SelectItem value="NDA/BLA Submitted">NDA/BLA Submitted</SelectItem>
              <SelectItem value="Phase 3">Phase 3</SelectItem>
              <SelectItem value="Phase 2">Phase 2</SelectItem>
              <SelectItem value="Phase 1">Phase 1</SelectItem>
              <SelectItem value="IND Filed">IND Filed</SelectItem>
              <SelectItem value="Pre-IND">Pre-IND</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Clinical Trial Phase</Label>
          <Input value={formData.clinical_trial_phase} onChange={(e) => setFormData({ ...formData, clinical_trial_phase: e.target.value })} placeholder="e.g., Phase 2b" />
        </div>
        <div className="space-y-2">
          <Label>Target Patient Population</Label>
          <Input value={formData.target_patient_population} onChange={(e) => setFormData({ ...formData, target_patient_population: e.target.value })} placeholder="e.g., Adult cancer patients" />
        </div>
        <div className="space-y-2">
          <Label>Reimbursement Model</Label>
          <Input value={formData.reimbursement_model} onChange={(e) => setFormData({ ...formData, reimbursement_model: e.target.value })} placeholder="e.g., Value-based, Fee-for-service" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Additional notes..." />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSubmit(formData)} disabled={isPending}>{isPending ? "Creating..." : "Create"}</Button>
      </div>
    </div>
  );
}

function HealthcareFullView({ record, onClose }: { record: HealthcareCompany; onClose: () => void }) {
  return (
    <ScrollArea className="h-[60vh]">
      <div className="space-y-6 p-4">
        <div>
          <h3 className="font-semibold mb-3">Company Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <FieldDisplay label="Company Name" value={record.company_name} />
            <FieldDisplay label="Website" value={record.website} isLink />
            <FieldDisplay label="Headquarters Country" value={record.headquarters_country} />
            <FieldDisplay label="Headquarters City" value={record.headquarters_city} />
          </div>
        </div>
        <Separator />
        <div>
          <h3 className="font-semibold mb-3">Healthcare Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <FieldDisplay label="Healthcare Segment" value={record.healthcare_segment} />
            <FieldDisplay label="Therapeutic Area" value={record.therapeutic_area} />
            <FieldDisplay label="Regulatory Status" value={record.regulatory_status} />
            <FieldDisplay label="FDA Approval Stage" value={record.fda_approval_stage} />
            <FieldDisplay label="Clinical Trial Phase" value={record.clinical_trial_phase} />
            <FieldDisplay label="Target Patient Population" value={record.target_patient_population} />
            <FieldDisplay label="Reimbursement Model" value={record.reimbursement_model} />
          </div>
        </div>
        <Separator />
        <div>
          <h3 className="font-semibold mb-3">Notes</h3>
          <FieldDisplay label="Notes" value={record.notes} />
        </div>
      </div>
    </ScrollArea>
  );
}

function HealthcareEditForm({ record, portfolioCompanies, onClose, onSwitchToView }: { record: HealthcareCompany; portfolioCompanies: PortfolioCompany[]; onClose: () => void; onSwitchToView: () => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    portfolio_company_id: record.portfolio_company_id || "",
    healthcare_segment: record.healthcare_segment || "",
    therapeutic_area: record.therapeutic_area || "",
    regulatory_status: record.regulatory_status || "",
    fda_approval_stage: record.fda_approval_stage || "",
    clinical_trial_phase: record.clinical_trial_phase || "",
    target_patient_population: record.target_patient_population || "",
    reimbursement_model: record.reimbursement_model || "",
    notes: record.notes || "",
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("PATCH", `/api/crm/healthcare/${record.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/healthcare"] });
      toast({ title: "Healthcare record updated" });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <ScrollArea className="h-[60vh]">
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Portfolio Company</Label>
            <Select value={formData.portfolio_company_id} onValueChange={(v) => setFormData({ ...formData, portfolio_company_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
              <SelectContent>
                {portfolioCompanies.map((pc) => (
                  <SelectItem key={pc.id} value={pc.id}>{pc.company_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Healthcare Segment</Label>
            <Select value={formData.healthcare_segment} onValueChange={(v) => setFormData({ ...formData, healthcare_segment: v })}>
              <SelectTrigger><SelectValue placeholder="Select segment" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Pharmaceuticals">Pharmaceuticals</SelectItem>
                <SelectItem value="Biotechnology">Biotechnology</SelectItem>
                <SelectItem value="Medical Devices">Medical Devices</SelectItem>
                <SelectItem value="Diagnostics">Diagnostics</SelectItem>
                <SelectItem value="Digital Health">Digital Health</SelectItem>
                <SelectItem value="Healthcare Services">Healthcare Services</SelectItem>
                <SelectItem value="Life Sciences Tools">Life Sciences Tools</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Therapeutic Area</Label>
            <Input value={formData.therapeutic_area} onChange={(e) => setFormData({ ...formData, therapeutic_area: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Regulatory Status</Label>
            <Select value={formData.regulatory_status} onValueChange={(v) => setFormData({ ...formData, regulatory_status: v })}>
              <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Under Review">Under Review</SelectItem>
                <SelectItem value="Clinical Trials">Clinical Trials</SelectItem>
                <SelectItem value="Pre-Clinical">Pre-Clinical</SelectItem>
                <SelectItem value="Not Applicable">Not Applicable</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>FDA Approval Stage</Label>
            <Select value={formData.fda_approval_stage} onValueChange={(v) => setFormData({ ...formData, fda_approval_stage: v })}>
              <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="FDA Approved">FDA Approved</SelectItem>
                <SelectItem value="NDA/BLA Submitted">NDA/BLA Submitted</SelectItem>
                <SelectItem value="Phase 3">Phase 3</SelectItem>
                <SelectItem value="Phase 2">Phase 2</SelectItem>
                <SelectItem value="Phase 1">Phase 1</SelectItem>
                <SelectItem value="IND Filed">IND Filed</SelectItem>
                <SelectItem value="Pre-IND">Pre-IND</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Clinical Trial Phase</Label>
            <Input value={formData.clinical_trial_phase} onChange={(e) => setFormData({ ...formData, clinical_trial_phase: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Target Patient Population</Label>
            <Input value={formData.target_patient_population} onChange={(e) => setFormData({ ...formData, target_patient_population: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Reimbursement Model</Label>
            <Input value={formData.reimbursement_model} onChange={(e) => setFormData({ ...formData, reimbursement_model: e.target.value })} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onSwitchToView}>Cancel</Button>
          <Button onClick={() => updateMutation.mutate(formData)} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}

function PublicMarketTab({ searchQuery }: { searchQuery: string }) {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PublicMarketCompany | null>(null);
  const [dialogMode, setDialogMode] = useState<"view" | "edit">("view");

  const { data: companies = [], isLoading } = useQuery<PublicMarketCompany[]>({
    queryKey: ["/api/crm/public-market"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/crm/public-market", {
      ...data,
      market_cap: data.market_cap ? parseFloat(data.market_cap) : null,
      enterprise_value: data.enterprise_value ? parseFloat(data.enterprise_value) : null,
      revenue_ttm: data.revenue_ttm ? parseFloat(data.revenue_ttm) : null,
      ebitda_ttm: data.ebitda_ttm ? parseFloat(data.ebitda_ttm) : null,
      pe_ratio: data.pe_ratio ? parseFloat(data.pe_ratio) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/public-market"] });
      setIsAddDialogOpen(false);
      toast({ title: "Public market company created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const formatValue = (value: number | null) => {
    if (!value) return "-";
    if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
    return `$${value.toLocaleString()}`;
  };

  const filtered = companies.filter(c =>
    c.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.ticker?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.sector?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openDialog = (record: PublicMarketCompany, mode: "view" | "edit") => {
    setSelectedRecord(record);
    setDialogMode(mode);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-public-market">
              <Plus className="h-4 w-4 mr-2" />
              Add Company
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Public Market Company</DialogTitle>
              <DialogDescription>Create a new public market company record</DialogDescription>
            </DialogHeader>
            <PublicMarketForm onSubmit={(data) => createMutation.mutate(data)} isPending={createMutation.isPending} onCancel={() => setIsAddDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticker</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Exchange</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>Market Cap</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No records found</TableCell>
                </TableRow>
              ) : (
                filtered.map((record) => (
                  <TableRow key={record.id} data-testid={`row-public-market-${record.id}`}>
                    <TableCell><Badge variant="outline">{record.ticker || "-"}</Badge></TableCell>
                    <TableCell className="font-medium">{record.company_name}</TableCell>
                    <TableCell>{record.exchange || "-"}</TableCell>
                    <TableCell><Badge variant="secondary">{record.sector || "-"}</Badge></TableCell>
                    <TableCell>{formatValue(record.market_cap)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openDialog(record, "view")} data-testid={`button-view-public-market-${record.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => openDialog(record, "edit")} data-testid={`button-edit-public-market-${record.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <DialogTitle>{dialogMode === "view" ? "Company Details" : "Edit Company"}</DialogTitle>
              {dialogMode === "view" && (
                <Button variant="outline" size="sm" onClick={() => setDialogMode("edit")}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          </DialogHeader>
          {selectedRecord && dialogMode === "view" && (
            <PublicMarketFullView record={selectedRecord} onClose={() => setSelectedRecord(null)} />
          )}
          {selectedRecord && dialogMode === "edit" && (
            <PublicMarketEditForm record={selectedRecord} onClose={() => setSelectedRecord(null)} onSwitchToView={() => setDialogMode("view")} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PublicMarketForm({ onSubmit, isPending, onCancel }: { onSubmit: (data: any) => void; isPending: boolean; onCancel: () => void }) {
  const [formData, setFormData] = useState({
    company_name: "",
    ticker: "",
    exchange: "",
    isin: "",
    cusip: "",
    sector: "",
    industry: "",
    market_cap: "",
    enterprise_value: "",
    revenue_ttm: "",
    ebitda_ttm: "",
    pe_ratio: "",
    headquarters_country: "",
    headquarters_city: "",
    website: "",
    description: "",
    notes: "",
  });

  return (
    <ScrollArea className="h-[60vh]">
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Company Name *</Label>
            <Input value={formData.company_name} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} placeholder="Company name" />
          </div>
          <div className="space-y-2">
            <Label>Ticker</Label>
            <Input value={formData.ticker} onChange={(e) => setFormData({ ...formData, ticker: e.target.value })} placeholder="e.g., AAPL" />
          </div>
          <div className="space-y-2">
            <Label>Exchange</Label>
            <Select value={formData.exchange} onValueChange={(v) => setFormData({ ...formData, exchange: v })}>
              <SelectTrigger><SelectValue placeholder="Select exchange" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NYSE">NYSE</SelectItem>
                <SelectItem value="NASDAQ">NASDAQ</SelectItem>
                <SelectItem value="LSE">LSE</SelectItem>
                <SelectItem value="TSE">TSE</SelectItem>
                <SelectItem value="HKEX">HKEX</SelectItem>
                <SelectItem value="Euronext">Euronext</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>ISIN</Label>
            <Input value={formData.isin} onChange={(e) => setFormData({ ...formData, isin: e.target.value })} placeholder="e.g., US0378331005" />
          </div>
          <div className="space-y-2">
            <Label>CUSIP</Label>
            <Input value={formData.cusip} onChange={(e) => setFormData({ ...formData, cusip: e.target.value })} placeholder="e.g., 037833100" />
          </div>
          <div className="space-y-2">
            <Label>Sector</Label>
            <Select value={formData.sector} onValueChange={(v) => setFormData({ ...formData, sector: v })}>
              <SelectTrigger><SelectValue placeholder="Select sector" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Technology">Technology</SelectItem>
                <SelectItem value="Healthcare">Healthcare</SelectItem>
                <SelectItem value="Financials">Financials</SelectItem>
                <SelectItem value="Consumer Discretionary">Consumer Discretionary</SelectItem>
                <SelectItem value="Consumer Staples">Consumer Staples</SelectItem>
                <SelectItem value="Industrials">Industrials</SelectItem>
                <SelectItem value="Energy">Energy</SelectItem>
                <SelectItem value="Materials">Materials</SelectItem>
                <SelectItem value="Real Estate">Real Estate</SelectItem>
                <SelectItem value="Utilities">Utilities</SelectItem>
                <SelectItem value="Communication Services">Communication Services</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Industry</Label>
            <Input value={formData.industry} onChange={(e) => setFormData({ ...formData, industry: e.target.value })} placeholder="e.g., Software" />
          </div>
          <div className="space-y-2">
            <Label>Market Cap (USD)</Label>
            <Input type="number" value={formData.market_cap} onChange={(e) => setFormData({ ...formData, market_cap: e.target.value })} placeholder="e.g., 2500000000000" />
          </div>
          <div className="space-y-2">
            <Label>Enterprise Value (USD)</Label>
            <Input type="number" value={formData.enterprise_value} onChange={(e) => setFormData({ ...formData, enterprise_value: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Revenue TTM (USD)</Label>
            <Input type="number" value={formData.revenue_ttm} onChange={(e) => setFormData({ ...formData, revenue_ttm: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>EBITDA TTM (USD)</Label>
            <Input type="number" value={formData.ebitda_ttm} onChange={(e) => setFormData({ ...formData, ebitda_ttm: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>P/E Ratio</Label>
            <Input type="number" step="0.01" value={formData.pe_ratio} onChange={(e) => setFormData({ ...formData, pe_ratio: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Headquarters Country</Label>
            <Input value={formData.headquarters_country} onChange={(e) => setFormData({ ...formData, headquarters_country: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Headquarters City</Label>
            <Input value={formData.headquarters_city} onChange={(e) => setFormData({ ...formData, headquarters_city: e.target.value })} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Website</Label>
            <Input value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} placeholder="https://" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Company description..." />
        </div>
        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Additional notes..." />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => onSubmit(formData)} disabled={isPending || !formData.company_name}>
            {isPending ? "Creating..." : "Create"}
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}

function PublicMarketFullView({ record, onClose }: { record: PublicMarketCompany; onClose: () => void }) {
  const formatValue = (value: number | null) => {
    if (!value) return "-";
    if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
    return `$${value.toLocaleString()}`;
  };

  return (
    <ScrollArea className="h-[60vh]">
      <div className="space-y-6 p-4">
        <div>
          <h3 className="font-semibold mb-3">Company Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <FieldDisplay label="Company Name" value={record.company_name} />
            <FieldDisplay label="Ticker" value={record.ticker} />
            <FieldDisplay label="Exchange" value={record.exchange} />
            <FieldDisplay label="ISIN" value={record.isin} />
            <FieldDisplay label="CUSIP" value={record.cusip} />
            <FieldDisplay label="Website" value={record.website} isLink />
            <FieldDisplay label="Headquarters Country" value={record.headquarters_country} />
            <FieldDisplay label="Headquarters City" value={record.headquarters_city} />
          </div>
        </div>
        <Separator />
        <div>
          <h3 className="font-semibold mb-3">Industry Classification</h3>
          <div className="grid grid-cols-2 gap-4">
            <FieldDisplay label="Sector" value={record.sector} />
            <FieldDisplay label="Industry" value={record.industry} />
          </div>
        </div>
        <Separator />
        <div>
          <h3 className="font-semibold mb-3">Financial Metrics</h3>
          <div className="grid grid-cols-2 gap-4">
            <FieldDisplay label="Market Cap" value={formatValue(record.market_cap)} />
            <FieldDisplay label="Enterprise Value" value={formatValue(record.enterprise_value)} />
            <FieldDisplay label="Revenue TTM" value={formatValue(record.revenue_ttm)} />
            <FieldDisplay label="EBITDA TTM" value={formatValue(record.ebitda_ttm)} />
            <FieldDisplay label="P/E Ratio" value={record.pe_ratio?.toFixed(2)} />
          </div>
        </div>
        <Separator />
        <div>
          <h3 className="font-semibold mb-3">Description & Notes</h3>
          <FieldDisplay label="Description" value={record.description} />
          <div className="mt-4">
            <FieldDisplay label="Notes" value={record.notes} />
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

function PublicMarketEditForm({ record, onClose, onSwitchToView }: { record: PublicMarketCompany; onClose: () => void; onSwitchToView: () => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    company_name: record.company_name || "",
    ticker: record.ticker || "",
    exchange: record.exchange || "",
    isin: record.isin || "",
    cusip: record.cusip || "",
    sector: record.sector || "",
    industry: record.industry || "",
    market_cap: record.market_cap?.toString() || "",
    enterprise_value: record.enterprise_value?.toString() || "",
    revenue_ttm: record.revenue_ttm?.toString() || "",
    ebitda_ttm: record.ebitda_ttm?.toString() || "",
    pe_ratio: record.pe_ratio?.toString() || "",
    headquarters_country: record.headquarters_country || "",
    headquarters_city: record.headquarters_city || "",
    website: record.website || "",
    description: record.description || "",
    notes: record.notes || "",
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("PATCH", `/api/crm/public-market/${record.id}`, {
      ...data,
      market_cap: data.market_cap ? parseFloat(data.market_cap) : null,
      enterprise_value: data.enterprise_value ? parseFloat(data.enterprise_value) : null,
      revenue_ttm: data.revenue_ttm ? parseFloat(data.revenue_ttm) : null,
      ebitda_ttm: data.ebitda_ttm ? parseFloat(data.ebitda_ttm) : null,
      pe_ratio: data.pe_ratio ? parseFloat(data.pe_ratio) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/public-market"] });
      toast({ title: "Company updated" });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <ScrollArea className="h-[60vh]">
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Company Name *</Label>
            <Input value={formData.company_name} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Ticker</Label>
            <Input value={formData.ticker} onChange={(e) => setFormData({ ...formData, ticker: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Exchange</Label>
            <Select value={formData.exchange} onValueChange={(v) => setFormData({ ...formData, exchange: v })}>
              <SelectTrigger><SelectValue placeholder="Select exchange" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NYSE">NYSE</SelectItem>
                <SelectItem value="NASDAQ">NASDAQ</SelectItem>
                <SelectItem value="LSE">LSE</SelectItem>
                <SelectItem value="TSE">TSE</SelectItem>
                <SelectItem value="HKEX">HKEX</SelectItem>
                <SelectItem value="Euronext">Euronext</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>ISIN</Label>
            <Input value={formData.isin} onChange={(e) => setFormData({ ...formData, isin: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>CUSIP</Label>
            <Input value={formData.cusip} onChange={(e) => setFormData({ ...formData, cusip: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Sector</Label>
            <Select value={formData.sector} onValueChange={(v) => setFormData({ ...formData, sector: v })}>
              <SelectTrigger><SelectValue placeholder="Select sector" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Technology">Technology</SelectItem>
                <SelectItem value="Healthcare">Healthcare</SelectItem>
                <SelectItem value="Financials">Financials</SelectItem>
                <SelectItem value="Consumer Discretionary">Consumer Discretionary</SelectItem>
                <SelectItem value="Consumer Staples">Consumer Staples</SelectItem>
                <SelectItem value="Industrials">Industrials</SelectItem>
                <SelectItem value="Energy">Energy</SelectItem>
                <SelectItem value="Materials">Materials</SelectItem>
                <SelectItem value="Real Estate">Real Estate</SelectItem>
                <SelectItem value="Utilities">Utilities</SelectItem>
                <SelectItem value="Communication Services">Communication Services</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Industry</Label>
            <Input value={formData.industry} onChange={(e) => setFormData({ ...formData, industry: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Market Cap (USD)</Label>
            <Input type="number" value={formData.market_cap} onChange={(e) => setFormData({ ...formData, market_cap: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Enterprise Value (USD)</Label>
            <Input type="number" value={formData.enterprise_value} onChange={(e) => setFormData({ ...formData, enterprise_value: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Revenue TTM (USD)</Label>
            <Input type="number" value={formData.revenue_ttm} onChange={(e) => setFormData({ ...formData, revenue_ttm: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>EBITDA TTM (USD)</Label>
            <Input type="number" value={formData.ebitda_ttm} onChange={(e) => setFormData({ ...formData, ebitda_ttm: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>P/E Ratio</Label>
            <Input type="number" step="0.01" value={formData.pe_ratio} onChange={(e) => setFormData({ ...formData, pe_ratio: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Headquarters Country</Label>
            <Input value={formData.headquarters_country} onChange={(e) => setFormData({ ...formData, headquarters_country: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Headquarters City</Label>
            <Input value={formData.headquarters_city} onChange={(e) => setFormData({ ...formData, headquarters_city: e.target.value })} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Website</Label>
            <Input value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onSwitchToView}>Cancel</Button>
          <Button onClick={() => updateMutation.mutate(formData)} disabled={updateMutation.isPending || !formData.company_name}>
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}
