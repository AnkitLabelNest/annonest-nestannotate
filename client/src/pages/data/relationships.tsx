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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Search, ArrowRight, Eye, Pencil, Link as LinkIcon } from "lucide-react";

interface Relationship {
  id: string;
  from_entity_type: string;
  from_entity_id: string;
  from_entity_name_snapshot: string | null;
  to_entity_type: string;
  to_entity_id: string;
  to_entity_name_snapshot: string | null;
  relationship_type: string;
  relationship_subtype: string | null;
  relationship_status: string | null;
  start_year: number | null;
  commitment_amount: number | null;
  commitment_currency: string | null;
  notes?: string | null;
  created_at: string;
}

const entityTypes = [
  { value: "GP", label: "General Partner" },
  { value: "LP", label: "Limited Partner" },
  { value: "Fund", label: "Fund" },
  { value: "PortfolioCompany", label: "Portfolio Company" },
  { value: "ServiceProvider", label: "Service Provider" },
  { value: "Contact", label: "Contact" },
  { value: "Deal", label: "Deal" },
];

const relationshipTypes = [
  { value: "Manager", label: "Manager" },
  { value: "Investor", label: "Investor" },
  { value: "PortfolioCompany", label: "Portfolio Company" },
  { value: "Advisor", label: "Advisor" },
  { value: "Employer", label: "Employer" },
  { value: "BoardMember", label: "Board Member" },
  { value: "Auditor", label: "Auditor" },
  { value: "LegalCounsel", label: "Legal Counsel" },
  { value: "FundAdmin", label: "Fund Administrator" },
];

function FieldDisplay({ label, value }: { label: string; value?: string | number | null }) {
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
      <p className="text-sm">{String(value)}</p>
    </div>
  );
}

export default function RelationshipsPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedRelationship, setSelectedRelationship] = useState<Relationship | null>(null);
  const [dialogMode, setDialogMode] = useState<"view" | "edit">("view");

  const { data: relationships = [], isLoading } = useQuery<Relationship[]>({
    queryKey: ["/api/crm/relationships"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/crm/relationships", {
      ...data,
      from_entity_id: crypto.randomUUID(),
      to_entity_id: crypto.randomUUID(),
      commitment_amount: data.commitment_amount ? parseFloat(data.commitment_amount) : null,
      start_year: data.start_year ? parseInt(data.start_year) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/relationships"] });
      setIsAddDialogOpen(false);
      toast({ title: "Relationship created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filtered = relationships.filter(r => 
    r.from_entity_name_snapshot?.toLowerCase().includes(search.toLowerCase()) ||
    r.to_entity_name_snapshot?.toLowerCase().includes(search.toLowerCase()) ||
    r.relationship_type?.toLowerCase().includes(search.toLowerCase())
  );

  const openDialog = (rel: Relationship, mode: "view" | "edit") => {
    setSelectedRelationship(rel);
    setDialogMode(mode);
  };

  const getEntityTypeLabel = (value: string) => entityTypes.find(t => t.value === value)?.label || value;
  const getRelationshipTypeLabel = (value: string) => relationshipTypes.find(t => t.value === value)?.label || value;

  const formatAmount = (amount: number | null, currency: string | null) => {
    if (!amount) return "-";
    const formatted = amount >= 1e9 
      ? `${(amount / 1e9).toFixed(1)}B` 
      : amount >= 1e6 
        ? `${(amount / 1e6).toFixed(0)}M` 
        : amount.toLocaleString();
    return `${currency || "$"}${formatted}`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-relationships-title">Relationships</h1>
          <p className="text-muted-foreground">Entity relationship mapping and tracking</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-relationship">
              <Plus className="h-4 w-4 mr-2" />
              Add Relationship
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Relationship</DialogTitle>
              <DialogDescription>Create a new relationship between entities</DialogDescription>
            </DialogHeader>
            <RelationshipForm onSubmit={(data) => createMutation.mutate(data)} isPending={createMutation.isPending} onCancel={() => setIsAddDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by entity name or relationship type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
          data-testid="input-search-relationships"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>From Entity</TableHead>
                <TableHead></TableHead>
                <TableHead>To Entity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Commitment</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No relationships found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((rel) => (
                  <TableRow key={rel.id} data-testid={`row-relationship-${rel.id}`}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{rel.from_entity_name_snapshot || "Unknown"}</p>
                        <Badge variant="outline" className="text-xs">{getEntityTypeLabel(rel.from_entity_type)}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{rel.to_entity_name_snapshot || "Unknown"}</p>
                        <Badge variant="outline" className="text-xs">{getEntityTypeLabel(rel.to_entity_type)}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{getRelationshipTypeLabel(rel.relationship_type)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={rel.relationship_status === "Active" ? "default" : "secondary"}>
                        {rel.relationship_status || "-"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatAmount(rel.commitment_amount, rel.commitment_currency)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openDialog(rel, "view")} data-testid={`button-view-relationship-${rel.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => openDialog(rel, "edit")} data-testid={`button-edit-relationship-${rel.id}`}>
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

      <Dialog open={!!selectedRelationship} onOpenChange={(open) => !open && setSelectedRelationship(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <DialogTitle>{dialogMode === "view" ? "Relationship Details" : "Edit Relationship"}</DialogTitle>
              {dialogMode === "view" && (
                <Button variant="outline" size="sm" onClick={() => setDialogMode("edit")}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          </DialogHeader>
          {selectedRelationship && dialogMode === "view" && (
            <RelationshipFullView relationship={selectedRelationship} onClose={() => setSelectedRelationship(null)} />
          )}
          {selectedRelationship && dialogMode === "edit" && (
            <RelationshipEditForm relationship={selectedRelationship} onClose={() => setSelectedRelationship(null)} onSwitchToView={() => setDialogMode("view")} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RelationshipForm({ onSubmit, isPending, onCancel }: { onSubmit: (data: any) => void; isPending: boolean; onCancel: () => void }) {
  const [formData, setFormData] = useState({
    from_entity_type: "",
    from_entity_name_snapshot: "",
    to_entity_type: "",
    to_entity_name_snapshot: "",
    relationship_type: "",
    relationship_subtype: "",
    relationship_status: "Active",
    start_year: "",
    commitment_amount: "",
    commitment_currency: "USD",
    notes: "",
  });

  return (
    <ScrollArea className="h-[60vh]">
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>From Entity Type *</Label>
            <Select value={formData.from_entity_type} onValueChange={(v) => setFormData({ ...formData, from_entity_type: v })}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {entityTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>From Entity Name *</Label>
            <Input value={formData.from_entity_name_snapshot} onChange={(e) => setFormData({ ...formData, from_entity_name_snapshot: e.target.value })} placeholder="Entity name" />
          </div>
          <div className="space-y-2">
            <Label>To Entity Type *</Label>
            <Select value={formData.to_entity_type} onValueChange={(v) => setFormData({ ...formData, to_entity_type: v })}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {entityTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>To Entity Name *</Label>
            <Input value={formData.to_entity_name_snapshot} onChange={(e) => setFormData({ ...formData, to_entity_name_snapshot: e.target.value })} placeholder="Entity name" />
          </div>
          <div className="space-y-2">
            <Label>Relationship Type *</Label>
            <Select value={formData.relationship_type} onValueChange={(v) => setFormData({ ...formData, relationship_type: v })}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {relationshipTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Relationship Subtype</Label>
            <Input value={formData.relationship_subtype} onChange={(e) => setFormData({ ...formData, relationship_subtype: e.target.value })} placeholder="e.g., Lead Investor" />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={formData.relationship_status} onValueChange={(v) => setFormData({ ...formData, relationship_status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Historical">Historical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Start Year</Label>
            <Input type="number" value={formData.start_year} onChange={(e) => setFormData({ ...formData, start_year: e.target.value })} placeholder="e.g., 2020" />
          </div>
          <div className="space-y-2">
            <Label>Commitment Amount</Label>
            <Input type="number" value={formData.commitment_amount} onChange={(e) => setFormData({ ...formData, commitment_amount: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Currency</Label>
            <Select value={formData.commitment_currency} onValueChange={(v) => setFormData({ ...formData, commitment_currency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => onSubmit(formData)} disabled={isPending || !formData.from_entity_type || !formData.to_entity_type || !formData.relationship_type}>
            {isPending ? "Creating..." : "Create"}
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}

function RelationshipFullView({ relationship, onClose }: { relationship: Relationship; onClose: () => void }) {
  const getEntityTypeLabel = (value: string) => entityTypes.find(t => t.value === value)?.label || value;
  const getRelationshipTypeLabel = (value: string) => relationshipTypes.find(t => t.value === value)?.label || value;

  const formatAmount = (amount: number | null, currency: string | null) => {
    if (!amount) return "-";
    const formatted = amount >= 1e9 
      ? `${(amount / 1e9).toFixed(1)}B` 
      : amount >= 1e6 
        ? `${(amount / 1e6).toFixed(0)}M` 
        : amount.toLocaleString();
    return `${currency || "$"}${formatted}`;
  };

  return (
    <ScrollArea className="h-[60vh]">
      <div className="space-y-6 p-4">
        <div>
          <h3 className="font-semibold mb-3">From Entity</h3>
          <div className="grid grid-cols-2 gap-4">
            <FieldDisplay label="Entity Type" value={getEntityTypeLabel(relationship.from_entity_type)} />
            <FieldDisplay label="Entity Name" value={relationship.from_entity_name_snapshot} />
          </div>
        </div>
        <Separator />
        <div>
          <h3 className="font-semibold mb-3">To Entity</h3>
          <div className="grid grid-cols-2 gap-4">
            <FieldDisplay label="Entity Type" value={getEntityTypeLabel(relationship.to_entity_type)} />
            <FieldDisplay label="Entity Name" value={relationship.to_entity_name_snapshot} />
          </div>
        </div>
        <Separator />
        <div>
          <h3 className="font-semibold mb-3">Relationship Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <FieldDisplay label="Relationship Type" value={getRelationshipTypeLabel(relationship.relationship_type)} />
            <FieldDisplay label="Subtype" value={relationship.relationship_subtype} />
            <FieldDisplay label="Status" value={relationship.relationship_status} />
            <FieldDisplay label="Start Year" value={relationship.start_year} />
            <FieldDisplay label="Commitment Amount" value={formatAmount(relationship.commitment_amount, relationship.commitment_currency)} />
            <FieldDisplay label="Created" value={new Date(relationship.created_at).toLocaleDateString()} />
          </div>
        </div>
        <Separator />
        <div>
          <h3 className="font-semibold mb-3">Notes</h3>
          <FieldDisplay label="Notes" value={relationship.notes} />
        </div>
      </div>
    </ScrollArea>
  );
}

function RelationshipEditForm({ relationship, onClose, onSwitchToView }: { relationship: Relationship; onClose: () => void; onSwitchToView: () => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    from_entity_type: relationship.from_entity_type || "",
    from_entity_name_snapshot: relationship.from_entity_name_snapshot || "",
    to_entity_type: relationship.to_entity_type || "",
    to_entity_name_snapshot: relationship.to_entity_name_snapshot || "",
    relationship_type: relationship.relationship_type || "",
    relationship_subtype: relationship.relationship_subtype || "",
    relationship_status: relationship.relationship_status || "Active",
    start_year: relationship.start_year?.toString() || "",
    commitment_amount: relationship.commitment_amount?.toString() || "",
    commitment_currency: relationship.commitment_currency || "USD",
    notes: relationship.notes || "",
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("PATCH", `/api/crm/relationships/${relationship.id}`, {
      ...data,
      commitment_amount: data.commitment_amount ? parseFloat(data.commitment_amount) : null,
      start_year: data.start_year ? parseInt(data.start_year) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/relationships"] });
      toast({ title: "Relationship updated" });
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
            <Label>From Entity Type *</Label>
            <Select value={formData.from_entity_type} onValueChange={(v) => setFormData({ ...formData, from_entity_type: v })}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {entityTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>From Entity Name *</Label>
            <Input value={formData.from_entity_name_snapshot} onChange={(e) => setFormData({ ...formData, from_entity_name_snapshot: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>To Entity Type *</Label>
            <Select value={formData.to_entity_type} onValueChange={(v) => setFormData({ ...formData, to_entity_type: v })}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {entityTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>To Entity Name *</Label>
            <Input value={formData.to_entity_name_snapshot} onChange={(e) => setFormData({ ...formData, to_entity_name_snapshot: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Relationship Type *</Label>
            <Select value={formData.relationship_type} onValueChange={(v) => setFormData({ ...formData, relationship_type: v })}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {relationshipTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Relationship Subtype</Label>
            <Input value={formData.relationship_subtype} onChange={(e) => setFormData({ ...formData, relationship_subtype: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={formData.relationship_status} onValueChange={(v) => setFormData({ ...formData, relationship_status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Historical">Historical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Start Year</Label>
            <Input type="number" value={formData.start_year} onChange={(e) => setFormData({ ...formData, start_year: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Commitment Amount</Label>
            <Input type="number" value={formData.commitment_amount} onChange={(e) => setFormData({ ...formData, commitment_amount: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Currency</Label>
            <Select value={formData.commitment_currency} onValueChange={(v) => setFormData({ ...formData, commitment_currency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
