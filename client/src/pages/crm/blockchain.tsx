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
import { Plus, Search, Blocks, ExternalLink, DollarSign, Shield } from "lucide-react";
import { SourceTrackingSection } from "@/components/source-tracking-section";

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
  sources_used: string[] | null;
  source_urls: string[] | null;
  last_updated_by: string | null;
  last_updated_on: string | null;
}

interface PortfolioCompany {
  id: string;
  company_name: string;
}

export default function BlockchainPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<BlockchainCompany | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [sourceTracking, setSourceTracking] = useState<{
    sourcesUsed: string[];
    sourceUrls: string[];
  }>({ sourcesUsed: [], sourceUrls: [] });
  const [newRecord, setNewRecord] = useState({
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

  const { data: companies, isLoading } = useQuery<BlockchainCompany[]>({
    queryKey: ["/api/crm/blockchain"],
  });

  const { data: portfolioCompanies } = useQuery<PortfolioCompany[]>({
    queryKey: ["/api/crm/portfolio-companies"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newRecord) => {
      return apiRequest("POST", "/api/crm/blockchain", {
        ...data,
        tvl_usd: data.tvl_usd ? parseFloat(data.tvl_usd) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/blockchain"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/counts"] });
      setIsAddDialogOpen(false);
      setNewRecord({
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
      toast({ title: "Blockchain record created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error creating record", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/crm/blockchain/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/blockchain"] });
      setIsDetailOpen(false);
      setSelectedCompany(null);
      toast({ title: "Record updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating record", description: error.message, variant: "destructive" });
    },
  });

  const handleOpenDetail = (company: BlockchainCompany) => {
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
    c.blockchain_platform?.toLowerCase().includes(search.toLowerCase()) ||
    c.token_ticker?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const formatTVL = (tvl: number | null) => {
    if (!tvl) return "-";
    if (tvl >= 1e9) return `$${(tvl / 1e9).toFixed(2)}B`;
    if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(2)}M`;
    return `$${tvl.toLocaleString()}`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-blockchain-title">Blockchain</h1>
          <p className="text-muted-foreground">Web3, DeFi, and blockchain technology companies</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-blockchain">
              <Plus className="h-4 w-4 mr-2" />
              Add Blockchain
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Blockchain Record</DialogTitle>
              <DialogDescription>Link to an existing portfolio company or add blockchain-specific details</DialogDescription>
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
                  <Label htmlFor="blockchain_platform">Platform</Label>
                  <Select value={newRecord.blockchain_platform} onValueChange={(v) => setNewRecord({ ...newRecord, blockchain_platform: v })}>
                    <SelectTrigger data-testid="select-platform">
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ethereum">Ethereum</SelectItem>
                      <SelectItem value="Solana">Solana</SelectItem>
                      <SelectItem value="Polygon">Polygon</SelectItem>
                      <SelectItem value="Arbitrum">Arbitrum</SelectItem>
                      <SelectItem value="Optimism">Optimism</SelectItem>
                      <SelectItem value="Avalanche">Avalanche</SelectItem>
                      <SelectItem value="BNB Chain">BNB Chain</SelectItem>
                      <SelectItem value="Multi-chain">Multi-chain</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="token_ticker">Token Ticker</Label>
                  <Input
                    id="token_ticker"
                    value={newRecord.token_ticker}
                    onChange={(e) => setNewRecord({ ...newRecord, token_ticker: e.target.value.toUpperCase() })}
                    placeholder="e.g., UNI, AAVE"
                    data-testid="input-token-ticker"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="defi_category">DeFi Category</Label>
                  <Select value={newRecord.defi_category} onValueChange={(v) => setNewRecord({ ...newRecord, defi_category: v })}>
                    <SelectTrigger data-testid="select-defi-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DEX">DEX</SelectItem>
                      <SelectItem value="Lending">Lending</SelectItem>
                      <SelectItem value="Staking">Staking</SelectItem>
                      <SelectItem value="NFT">NFT</SelectItem>
                      <SelectItem value="Gaming">Gaming</SelectItem>
                      <SelectItem value="Infrastructure">Infrastructure</SelectItem>
                      <SelectItem value="DAO">DAO</SelectItem>
                      <SelectItem value="Bridge">Bridge</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tvl_usd">TVL (USD)</Label>
                  <Input
                    id="tvl_usd"
                    type="number"
                    value={newRecord.tvl_usd}
                    onChange={(e) => setNewRecord({ ...newRecord, tvl_usd: e.target.value })}
                    placeholder="1000000000"
                    data-testid="input-tvl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smart_contract_language">Smart Contract Language</Label>
                  <Select value={newRecord.smart_contract_language} onValueChange={(v) => setNewRecord({ ...newRecord, smart_contract_language: v })}>
                    <SelectTrigger data-testid="select-language">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Solidity">Solidity</SelectItem>
                      <SelectItem value="Rust">Rust</SelectItem>
                      <SelectItem value="Vyper">Vyper</SelectItem>
                      <SelectItem value="Move">Move</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="audit_status">Audit Status</Label>
                  <Select value={newRecord.audit_status} onValueChange={(v) => setNewRecord({ ...newRecord, audit_status: v })}>
                    <SelectTrigger data-testid="select-audit-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Audited">Audited</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Not Audited">Not Audited</SelectItem>
                      <SelectItem value="Multiple Audits">Multiple Audits</SelectItem>
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
                data-testid="button-submit-blockchain"
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
          placeholder="Search by company, platform, or token..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
          data-testid="input-search-blockchain"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>TVL</TableHead>
                <TableHead>Audit</TableHead>
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
                    No blockchain records found. Add your first record to get started.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCompanies.map((company) => (
                  <TableRow key={company.id} className="cursor-pointer hover-elevate" data-testid={`row-blockchain-${company.id}`} onClick={() => handleOpenDetail(company)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Blocks className="h-4 w-4 text-purple-600" />
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
                      {company.blockchain_platform ? (
                        <Badge variant="secondary">{company.blockchain_platform}</Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {company.token_ticker ? (
                        <Badge variant="outline" className="font-mono">{company.token_ticker}</Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {company.defi_category || "-"}
                    </TableCell>
                    <TableCell>
                      {company.tvl_usd ? (
                        <div className="flex items-center gap-1 text-sm font-medium">
                          <DollarSign className="h-3 w-3 text-green-600" />
                          {formatTVL(company.tvl_usd)}
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {company.audit_status ? (
                        <Badge variant={company.audit_status === "Audited" || company.audit_status === "Multiple Audits" ? "default" : "outline"}>
                          <Shield className="h-3 w-3 mr-1" />
                          {company.audit_status}
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

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedCompany?.company_name || "Blockchain Record"}</DialogTitle>
            <DialogDescription>View and edit source tracking for this record</DialogDescription>
          </DialogHeader>
          
          {selectedCompany && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Platform</Label>
                  <p className="font-medium">{selectedCompany.blockchain_platform || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Token</Label>
                  <p className="font-medium">{selectedCompany.token_ticker || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Category</Label>
                  <p className="font-medium">{selectedCompany.defi_category || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">TVL</Label>
                  <p className="font-medium">{selectedCompany.tvl_usd ? `$${selectedCompany.tvl_usd.toLocaleString()}` : "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Smart Contract Language</Label>
                  <p className="font-medium">{selectedCompany.smart_contract_language || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Audit Status</Label>
                  <p className="font-medium">{selectedCompany.audit_status || "-"}</p>
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
