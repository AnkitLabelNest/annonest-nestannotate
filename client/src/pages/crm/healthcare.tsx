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
import { Plus, Search, Heart, ExternalLink, FlaskConical, Users } from "lucide-react";
import { SourceTrackingSection } from "@/components/source-tracking-section";

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
  sources_used: string[] | null;
  source_urls: string[] | null;
  last_updated_by: string | null;
  last_updated_on: string | null;
}

interface PortfolioCompany {
  id: string;
  company_name: string;
}

export default function HealthcarePage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<HealthcareCompany | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [sourceTracking, setSourceTracking] = useState<{
    sourcesUsed: string[];
    sourceUrls: string[];
  }>({ sourcesUsed: [], sourceUrls: [] });
  const [newRecord, setNewRecord] = useState({
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

  const { data: companies, isLoading } = useQuery<HealthcareCompany[]>({
    queryKey: ["/api/crm/healthcare"],
  });

  const { data: portfolioCompanies } = useQuery<PortfolioCompany[]>({
    queryKey: ["/api/crm/portfolio-companies"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newRecord) => {
      return apiRequest("POST", "/api/crm/healthcare", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/healthcare"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/counts"] });
      setIsAddDialogOpen(false);
      setNewRecord({
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
      toast({ title: "Healthcare record created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error creating record", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/crm/healthcare/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/healthcare"] });
      setIsDetailOpen(false);
      setSelectedCompany(null);
      toast({ title: "Record updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating record", description: error.message, variant: "destructive" });
    },
  });

  const handleOpenDetail = (company: HealthcareCompany) => {
    setSelectedCompany(company);
    setSourceTracking({
      sourcesUsed: company.sources_used || [],
      sourceUrls: company.source_urls || [],
    });
    setIsDetailOpen(true);
  };

  const handleSourceTrackingChange = (field: string, value: string[]) => {
    setSourceTracking(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveSourceTracking = () => {
    if (!selectedCompany) return;
    updateMutation.mutate({
      id: selectedCompany.id,
      data: {
        sources_used: sourceTracking.sourcesUsed,
        source_urls: sourceTracking.sourceUrls,
      },
    });
  };

  const filteredCompanies = companies?.filter(c => 
    c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.healthcare_segment?.toLowerCase().includes(search.toLowerCase()) ||
    c.therapeutic_area?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-healthcare-title">Healthcare</h1>
          <p className="text-muted-foreground">Healthcare, biotech, and life sciences companies</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-healthcare">
              <Plus className="h-4 w-4 mr-2" />
              Add Healthcare
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Healthcare Record</DialogTitle>
              <DialogDescription>Link to an existing portfolio company or add healthcare-specific details</DialogDescription>
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
                  <Label htmlFor="healthcare_segment">Segment</Label>
                  <Select value={newRecord.healthcare_segment} onValueChange={(v) => setNewRecord({ ...newRecord, healthcare_segment: v })}>
                    <SelectTrigger data-testid="select-segment">
                      <SelectValue placeholder="Select segment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Biotech">Biotech</SelectItem>
                      <SelectItem value="Pharma">Pharma</SelectItem>
                      <SelectItem value="Medical Devices">Medical Devices</SelectItem>
                      <SelectItem value="Digital Health">Digital Health</SelectItem>
                      <SelectItem value="Diagnostics">Diagnostics</SelectItem>
                      <SelectItem value="Healthcare IT">Healthcare IT</SelectItem>
                      <SelectItem value="Provider Services">Provider Services</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="therapeutic_area">Therapeutic Area</Label>
                  <Input
                    id="therapeutic_area"
                    value={newRecord.therapeutic_area}
                    onChange={(e) => setNewRecord({ ...newRecord, therapeutic_area: e.target.value })}
                    placeholder="Oncology, Cardiology, etc."
                    data-testid="input-therapeutic-area"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fda_approval_stage">FDA Approval Stage</Label>
                  <Select value={newRecord.fda_approval_stage} onValueChange={(v) => setNewRecord({ ...newRecord, fda_approval_stage: v })}>
                    <SelectTrigger data-testid="select-fda-stage">
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pre-IND">Pre-IND</SelectItem>
                      <SelectItem value="IND Filed">IND Filed</SelectItem>
                      <SelectItem value="Phase I">Phase I</SelectItem>
                      <SelectItem value="Phase II">Phase II</SelectItem>
                      <SelectItem value="Phase III">Phase III</SelectItem>
                      <SelectItem value="NDA/BLA Filed">NDA/BLA Filed</SelectItem>
                      <SelectItem value="Approved">Approved</SelectItem>
                      <SelectItem value="510(k) Cleared">510(k) Cleared</SelectItem>
                      <SelectItem value="N/A">N/A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clinical_trial_phase">Clinical Trial Phase</Label>
                  <Select value={newRecord.clinical_trial_phase} onValueChange={(v) => setNewRecord({ ...newRecord, clinical_trial_phase: v })}>
                    <SelectTrigger data-testid="select-trial-phase">
                      <SelectValue placeholder="Select phase" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Preclinical">Preclinical</SelectItem>
                      <SelectItem value="Phase I">Phase I</SelectItem>
                      <SelectItem value="Phase I/II">Phase I/II</SelectItem>
                      <SelectItem value="Phase II">Phase II</SelectItem>
                      <SelectItem value="Phase II/III">Phase II/III</SelectItem>
                      <SelectItem value="Phase III">Phase III</SelectItem>
                      <SelectItem value="Post-Market">Post-Market</SelectItem>
                      <SelectItem value="N/A">N/A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="target_patient_population">Target Population</Label>
                  <Input
                    id="target_patient_population"
                    value={newRecord.target_patient_population}
                    onChange={(e) => setNewRecord({ ...newRecord, target_patient_population: e.target.value })}
                    placeholder="Adults with Type 2 Diabetes, etc."
                    data-testid="input-target-population"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reimbursement_model">Reimbursement Model</Label>
                  <Select value={newRecord.reimbursement_model} onValueChange={(v) => setNewRecord({ ...newRecord, reimbursement_model: v })}>
                    <SelectTrigger data-testid="select-reimbursement">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fee-for-Service">Fee-for-Service</SelectItem>
                      <SelectItem value="Value-Based">Value-Based</SelectItem>
                      <SelectItem value="Capitation">Capitation</SelectItem>
                      <SelectItem value="Direct-to-Consumer">Direct-to-Consumer</SelectItem>
                      <SelectItem value="Mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
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
                data-testid="button-submit-healthcare"
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
          placeholder="Search by company, segment, or therapeutic area..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
          data-testid="input-search-healthcare"
        />
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
                <TableHead>Trial Phase</TableHead>
                <TableHead>Target Population</TableHead>
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
                    No healthcare records found. Add your first record to get started.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCompanies.map((company) => (
                  <TableRow key={company.id} className="cursor-pointer hover-elevate" data-testid={`row-healthcare-${company.id}`} onClick={() => handleOpenDetail(company)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Heart className="h-4 w-4 text-red-500" />
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
                      {company.healthcare_segment ? (
                        <Badge variant="secondary">{company.healthcare_segment}</Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {company.therapeutic_area || "-"}
                    </TableCell>
                    <TableCell>
                      {company.fda_approval_stage ? (
                        <Badge variant={company.fda_approval_stage === "Approved" ? "default" : "outline"}>
                          <FlaskConical className="h-3 w-3 mr-1" />
                          {company.fda_approval_stage}
                        </Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {company.clinical_trial_phase || "-"}
                    </TableCell>
                    <TableCell>
                      {company.target_patient_population ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          {company.target_patient_population}
                        </div>
                      ) : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedCompany?.company_name || "Healthcare Record"}</DialogTitle>
            <DialogDescription>View and edit source tracking for this record</DialogDescription>
          </DialogHeader>
          
          {selectedCompany && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Segment</Label>
                  <p className="font-medium">{selectedCompany.healthcare_segment || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Therapeutic Area</Label>
                  <p className="font-medium">{selectedCompany.therapeutic_area || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">FDA Stage</Label>
                  <p className="font-medium">{selectedCompany.fda_approval_stage || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Trial Phase</Label>
                  <p className="font-medium">{selectedCompany.clinical_trial_phase || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Target Population</Label>
                  <p className="font-medium">{selectedCompany.target_patient_population || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Reimbursement</Label>
                  <p className="font-medium">{selectedCompany.reimbursement_model || "-"}</p>
                </div>
              </div>

              <SourceTrackingSection
                data={sourceTracking}
                onChange={handleSourceTrackingChange}
                isEditing={true}
              />

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDetailOpen(false)}>Cancel</Button>
                <Button 
                  onClick={handleSaveSourceTracking}
                  disabled={updateMutation.isPending}
                  data-testid="button-save-source-tracking"
                >
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
