import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Building2, Users, Pencil } from "lucide-react";
import type { Organization } from "@shared/schema";

export default function OrganizationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgType, setNewOrgType] = useState<"internal" | "client">("client");
  const [newOrgStatus, setNewOrgStatus] = useState<"active" | "inactive" | "pending">("active");

  const { data: organizations = [], isLoading } = useQuery<Organization[]>({
    queryKey: ["/api/organizations"],
  });

  const { data: userCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/organizations/user-counts"],
    enabled: organizations.length > 0,
  });

  const createOrgMutation = useMutation({
    mutationFn: async (data: { name: string; orgType: string; status: string }) => {
      return apiRequest("POST", "/api/organizations", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      toast({ title: "Organization created successfully" });
      setIsAddDialogOpen(false);
      setNewOrgName("");
      setNewOrgType("client");
      setNewOrgStatus("active");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create organization", description: error.message, variant: "destructive" });
    },
  });

  const updateOrgMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; orgType: string; status: string }) => {
      return apiRequest("PATCH", `/api/organizations/${data.id}`, { name: data.name, orgType: data.orgType, status: data.status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      toast({ title: "Organization updated successfully" });
      setIsEditDialogOpen(false);
      setEditingOrg(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update organization", description: error.message, variant: "destructive" });
    },
  });

  const handleCreateOrg = () => {
    if (!newOrgName.trim()) {
      toast({ title: "Please enter organization name", variant: "destructive" });
      return;
    }
    createOrgMutation.mutate({ name: newOrgName, orgType: newOrgType, status: newOrgStatus });
  };

  const handleUpdateOrg = () => {
    if (!editingOrg) return;
    updateOrgMutation.mutate({
      id: editingOrg.id,
      name: editingOrg.name,
      orgType: editingOrg.orgType || "client",
      status: editingOrg.status || "active",
    });
  };

  const openEditDialog = (org: Organization) => {
    setEditingOrg({ ...org });
    setIsEditDialogOpen(true);
  };

  if (user?.role !== "super_admin") {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">You don't have permission to view this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Active</Badge>;
      case "inactive":
        return <Badge variant="secondary">Inactive</Badge>;
      case "pending":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Pending</Badge>;
      default:
        return <Badge variant="outline">{status || "Unknown"}</Badge>;
    }
  };

  const getTypeBadge = (type: string | null) => {
    switch (type) {
      case "internal":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Internal</Badge>;
      case "client":
        return <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20">Client</Badge>;
      default:
        return <Badge variant="outline">{type || "Unknown"}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Organizations</h1>
          <p className="text-muted-foreground">Manage all organizations in AnnoNest</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-org">
              <Plus className="h-4 w-4 mr-2" />
              Add Organization
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Organization</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization Name</Label>
                <Input
                  id="org-name"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="Enter organization name"
                  data-testid="input-org-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-type">Type</Label>
                <Select value={newOrgType} onValueChange={(v) => setNewOrgType(v as "internal" | "client")}>
                  <SelectTrigger data-testid="select-org-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Internal</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-status">Status</Label>
                <Select value={newOrgStatus} onValueChange={(v) => setNewOrgStatus(v as "active" | "inactive" | "pending")}>
                  <SelectTrigger data-testid="select-org-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleCreateOrg}
                disabled={createOrgMutation.isPending}
                className="w-full"
                data-testid="button-submit-org"
              >
                {createOrgMutation.isPending ? "Creating..." : "Create Organization"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            All Organizations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : organizations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No organizations found. Create your first organization to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.map((org) => (
                  <TableRow key={org.id} data-testid={`row-org-${org.id}`}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell>{getTypeBadge(org.orgType)}</TableCell>
                    <TableCell>{getStatusBadge(org.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{userCounts[org.id] || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {org.createdAt ? new Date(org.createdAt).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(org)}
                        data-testid={`button-edit-org-${org.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
          </DialogHeader>
          {editingOrg && (
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="edit-org-name">Organization Name</Label>
                <Input
                  id="edit-org-name"
                  value={editingOrg.name}
                  onChange={(e) => setEditingOrg({ ...editingOrg, name: e.target.value })}
                  data-testid="input-edit-org-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-org-type">Type</Label>
                <Select
                  value={editingOrg.orgType || "client"}
                  onValueChange={(v) => setEditingOrg({ ...editingOrg, orgType: v as "internal" | "client" })}
                >
                  <SelectTrigger data-testid="select-edit-org-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Internal</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-org-status">Status</Label>
                <Select
                  value={editingOrg.status || "active"}
                  onValueChange={(v) => setEditingOrg({ ...editingOrg, status: v as "active" | "inactive" | "pending" })}
                >
                  <SelectTrigger data-testid="select-edit-org-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleUpdateOrg}
                disabled={updateOrgMutation.isPending}
                className="w-full"
                data-testid="button-update-org"
              >
                {updateOrgMutation.isPending ? "Updating..." : "Update Organization"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
