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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Search, ArrowRight, Link as LinkIcon } from "lucide-react";

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

export default function RelationshipsPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newRelationship, setNewRelationship] = useState({
    from_entity_type: "",
    from_entity_name_snapshot: "",
    to_entity_type: "",
    to_entity_name_snapshot: "",
    relationship_type: "",
    relationship_subtype: "",
    relationship_status: "Active",
  });

  const { data: relationships, isLoading } = useQuery<Relationship[]>({
    queryKey: ["/api/crm/relationships"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newRelationship) => {
      return apiRequest("POST", "/api/crm/relationships", {
        ...data,
        from_entity_id: crypto.randomUUID(),
        to_entity_id: crypto.randomUUID(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/relationships"] });
      setIsAddDialogOpen(false);
      setNewRelationship({
        from_entity_type: "",
        from_entity_name_snapshot: "",
        to_entity_type: "",
        to_entity_name_snapshot: "",
        relationship_type: "",
        relationship_subtype: "",
        relationship_status: "Active",
      });
      toast({ title: "Relationship created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error creating relationship", description: error.message, variant: "destructive" });
    },
  });

  const filteredRelationships = relationships?.filter(r => 
    r.from_entity_name_snapshot?.toLowerCase().includes(search.toLowerCase()) ||
    r.to_entity_name_snapshot?.toLowerCase().includes(search.toLowerCase()) ||
    r.relationship_type.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const getEntityTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      GP: "bg-blue-500/10 text-blue-600",
      LP: "bg-green-500/10 text-green-600",
      Fund: "bg-purple-500/10 text-purple-600",
      PortfolioCompany: "bg-orange-500/10 text-orange-600",
      ServiceProvider: "bg-pink-500/10 text-pink-600",
      Contact: "bg-cyan-500/10 text-cyan-600",
      Deal: "bg-amber-500/10 text-amber-600",
    };
    return colors[type] || "bg-gray-500/10 text-gray-600";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-relationships-title">Relationships</h1>
          <p className="text-muted-foreground">Entity connections and linkages</p>
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
              <DialogTitle>Create Relationship</DialogTitle>
              <DialogDescription>Link two entities together</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-5 gap-4 items-end">
                <div className="col-span-2 space-y-2">
                  <Label>From Entity Type</Label>
                  <Select 
                    value={newRelationship.from_entity_type} 
                    onValueChange={(v) => setNewRelationship({ ...newRelationship, from_entity_type: v })}
                  >
                    <SelectTrigger data-testid="select-from-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {entityTypes.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-center">
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>To Entity Type</Label>
                  <Select 
                    value={newRelationship.to_entity_type} 
                    onValueChange={(v) => setNewRelationship({ ...newRelationship, to_entity_type: v })}
                  >
                    <SelectTrigger data-testid="select-to-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {entityTypes.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From Entity Name</Label>
                  <Input
                    value={newRelationship.from_entity_name_snapshot}
                    onChange={(e) => setNewRelationship({ ...newRelationship, from_entity_name_snapshot: e.target.value })}
                    placeholder="Entity name"
                    data-testid="input-from-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>To Entity Name</Label>
                  <Input
                    value={newRelationship.to_entity_name_snapshot}
                    onChange={(e) => setNewRelationship({ ...newRelationship, to_entity_name_snapshot: e.target.value })}
                    placeholder="Entity name"
                    data-testid="input-to-name"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Relationship Type *</Label>
                  <Select 
                    value={newRelationship.relationship_type} 
                    onValueChange={(v) => setNewRelationship({ ...newRelationship, relationship_type: v })}
                  >
                    <SelectTrigger data-testid="select-relationship-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {relationshipTypes.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Subtype</Label>
                  <Input
                    value={newRelationship.relationship_subtype}
                    onChange={(e) => setNewRelationship({ ...newRelationship, relationship_subtype: e.target.value })}
                    placeholder="Lead, Co-investor, etc."
                    data-testid="input-subtype"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => createMutation.mutate(newRelationship)}
                disabled={!newRelationship.relationship_type || !newRelationship.from_entity_type || !newRelationship.to_entity_type || createMutation.isPending}
                data-testid="button-submit-relationship"
              >
                {createMutation.isPending ? "Creating..." : "Create Relationship"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search relationships..."
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
                <TableHead>From</TableHead>
                <TableHead></TableHead>
                <TableHead>To</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Since</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredRelationships.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No relationships found. Create your first relationship to get started.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRelationships.map((rel) => (
                  <TableRow key={rel.id} className="cursor-pointer hover-elevate" data-testid={`row-relationship-${rel.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge className={getEntityTypeColor(rel.from_entity_type)} variant="secondary">
                          {rel.from_entity_type}
                        </Badge>
                        <span className="font-medium">{rel.from_entity_name_snapshot || "Unknown"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center">
                        <LinkIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge className={getEntityTypeColor(rel.to_entity_type)} variant="secondary">
                          {rel.to_entity_type}
                        </Badge>
                        <span className="font-medium">{rel.to_entity_name_snapshot || "Unknown"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{rel.relationship_type}</Badge>
                      {rel.relationship_subtype && (
                        <span className="text-xs text-muted-foreground ml-2">{rel.relationship_subtype}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={rel.relationship_status === "Active" ? "default" : "secondary"}>
                        {rel.relationship_status || "Active"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {rel.start_year || "-"}
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
