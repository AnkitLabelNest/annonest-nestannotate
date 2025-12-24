import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RoleBadge } from "@/components/role-badge";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  Shield,
  Check,
  X,
  RefreshCw,
  Building2,
  Plus,
} from "lucide-react";
import type { UserRole, User, ApprovalStatus, Organization } from "@shared/schema";

type UserWithoutPassword = Omit<User, "password">;

const roleOptions: UserRole[] = ["admin", "manager", "researcher", "annotator", "qa", "guest"];

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<UserWithoutPassword | null>(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [orgDialogOpen, setOrgDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState<UserRole>("annotator");
  const [approveRole, setApproveRole] = useState<UserRole>("annotator");
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [newOrgName, setNewOrgName] = useState("");
  const [assignOrgDialogOpen, setAssignOrgDialogOpen] = useState(false);
  const [assignOrgId, setAssignOrgId] = useState<string>("");

  const { data: organizations = [] } = useQuery<Organization[]>({
    queryKey: ["/api/organizations"],
  });

  const { data: allUsers = [], isLoading } = useQuery<UserWithoutPassword[]>({
    queryKey: ["/api/users"],
  });

  const { data: pendingGuests = [] } = useQuery<UserWithoutPassword[]>({
    queryKey: ["/api/admin/pending-guests"],
  });

  const createOrgMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/organizations", { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      setOrgDialogOpen(false);
      setNewOrgName("");
      toast({ title: "Organization created", description: "New organization has been created." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create organization", variant: "destructive" });
    },
  });

  const updateUserOrgMutation = useMutation({
    mutationFn: async ({ userId, orgId }: { userId: string; orgId: string }) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}`, { orgId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setAssignOrgDialogOpen(false);
      setSelectedUser(null);
      toast({ title: "Organization updated", description: "User's organization has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update user organization", variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole?: string }) => {
      const res = await apiRequest("POST", `/api/admin/users/${userId}/approve`, { newRole });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-guests"] });
      toast({ title: "User approved", description: "The user has been approved and can now access the platform." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to approve user", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("POST", `/api/admin/users/${userId}/reject`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-guests"] });
      toast({ title: "User rejected", description: "The user's access request has been rejected." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reject user", variant: "destructive" });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}`, { role });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setRoleDialogOpen(false);
      setSelectedUser(null);
      toast({ title: "Role updated", description: "The user's role has been updated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update role", variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}`, { isActive });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ 
        title: variables.isActive ? "User activated" : "User deactivated",
        description: `The user has been ${variables.isActive ? "activated" : "deactivated"}.`
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update user status", variant: "destructive" });
    },
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getApprovalBadge = (status: ApprovalStatus | null) => {
    switch (status) {
      case "approved":
        return <Badge variant="default" className="bg-green-600 dark:bg-green-700"><UserCheck className="w-3 h-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive"><UserX className="w-3 h-3 mr-1" />Rejected</Badge>;
      case "pending":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">N/A</Badge>;
    }
  };

  const openRoleDialog = (user: UserWithoutPassword) => {
    setSelectedUser(user);
    setNewRole(user.role as UserRole);
    setRoleDialogOpen(true);
  };

  const openApproveDialog = (user: UserWithoutPassword) => {
    setSelectedUser(user);
    setApproveRole("annotator");
    setApproveDialogOpen(true);
  };

  const handleRoleChange = () => {
    if (selectedUser) {
      updateRoleMutation.mutate({ userId: selectedUser.id, role: newRole });
    }
  };

  const handleApprove = () => {
    if (selectedUser) {
      approveMutation.mutate({ userId: selectedUser.id, newRole: approveRole });
      setApproveDialogOpen(false);
      setSelectedUser(null);
    }
  };

  const getOrgName = (orgId: string | null) => {
    if (!orgId) return "No Organization";
    const org = organizations.find(o => o.id === orgId);
    return org?.name || "Unknown";
  };

  const openAssignOrgDialog = (user: UserWithoutPassword) => {
    setSelectedUser(user);
    setAssignOrgId(user.orgId || "");
    setAssignOrgDialogOpen(true);
  };

  const handleAssignOrg = () => {
    if (selectedUser && assignOrgId) {
      updateUserOrgMutation.mutate({ userId: selectedUser.id, orgId: assignOrgId });
    }
  };

  const filteredUsers = selectedOrgId
    ? allUsers.filter(u => u.orgId === selectedOrgId)
    : allUsers;

  const approvedUsers = filteredUsers.filter(u => u.approvalStatus === "approved" || !u.approvalStatus);
  const pendingUsers = filteredUsers.filter(u => u.approvalStatus === "pending");
  const rejectedUsers = filteredUsers.filter(u => u.approvalStatus === "rejected");

  if (currentUser?.role !== "admin" && currentUser?.role !== "manager") {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You don't have permission to access user management.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">User Management</h1>
          <p className="text-muted-foreground">Manage users, approve registrations, and assign roles</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedOrgId || "all"} onValueChange={(v) => setSelectedOrgId(v === "all" ? null : v)}>
            <SelectTrigger className="w-[200px]" data-testid="select-org-filter">
              <Building2 className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Organizations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Organizations</SelectItem>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id} data-testid={`option-org-${org.id}`}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setOrgDialogOpen(true)} data-testid="button-create-org">
            <Plus className="h-4 w-4 mr-1" />
            New Org
          </Button>
          <Badge variant="outline" className="gap-1">
            <Users className="h-3 w-3" />
            {filteredUsers.length} Users
          </Badge>
          {pendingUsers.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3 w-3" />
              {pendingUsers.length} Pending
            </Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList data-testid="tabs-user-list">
          <TabsTrigger value="all" data-testid="tab-all-users">All Users ({allUsers.length})</TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending Approval ({pendingUsers.length})
          </TabsTrigger>
          <TabsTrigger value="approved" data-testid="tab-approved">Approved ({approvedUsers.length})</TabsTrigger>
          <TabsTrigger value="rejected" data-testid="tab-rejected">Rejected ({rejectedUsers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <UserTable
            users={filteredUsers}
            isLoading={isLoading}
            getInitials={getInitials}
            getApprovalBadge={getApprovalBadge}
            getOrgName={getOrgName}
            onApprove={openApproveDialog}
            onReject={(userId) => rejectMutation.mutate(userId)}
            onChangeRole={openRoleDialog}
            onToggleActive={(user) => toggleActiveMutation.mutate({ userId: user.id, isActive: !user.isActive })}
            onAssignOrg={openAssignOrgDialog}
            currentUserId={currentUser?.id}
            isApproving={approveMutation.isPending}
            isRejecting={rejectMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="pending" className="mt-4">
          {pendingUsers.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <UserCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No pending user approvals</p>
              </CardContent>
            </Card>
          ) : (
            <UserTable
              users={pendingUsers}
              isLoading={isLoading}
              getInitials={getInitials}
              getApprovalBadge={getApprovalBadge}
              getOrgName={getOrgName}
              onApprove={openApproveDialog}
              onReject={(userId) => rejectMutation.mutate(userId)}
              onChangeRole={openRoleDialog}
              onToggleActive={(user) => toggleActiveMutation.mutate({ userId: user.id, isActive: !user.isActive })}
              onAssignOrg={openAssignOrgDialog}
              currentUserId={currentUser?.id}
              isApproving={approveMutation.isPending}
              isRejecting={rejectMutation.isPending}
              showApprovalActions
            />
          )}
        </TabsContent>

        <TabsContent value="approved" className="mt-4">
          <UserTable
            users={approvedUsers}
            isLoading={isLoading}
            getInitials={getInitials}
            getApprovalBadge={getApprovalBadge}
            getOrgName={getOrgName}
            onApprove={openApproveDialog}
            onReject={(userId) => rejectMutation.mutate(userId)}
            onChangeRole={openRoleDialog}
            onToggleActive={(user) => toggleActiveMutation.mutate({ userId: user.id, isActive: !user.isActive })}
            onAssignOrg={openAssignOrgDialog}
            currentUserId={currentUser?.id}
            isApproving={approveMutation.isPending}
            isRejecting={rejectMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="rejected" className="mt-4">
          {rejectedUsers.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground">No rejected users</p>
              </CardContent>
            </Card>
          ) : (
            <UserTable
              users={rejectedUsers}
              isLoading={isLoading}
              getInitials={getInitials}
              getApprovalBadge={getApprovalBadge}
              getOrgName={getOrgName}
              onApprove={openApproveDialog}
              onReject={(userId) => rejectMutation.mutate(userId)}
              onChangeRole={openRoleDialog}
              onToggleActive={(user) => toggleActiveMutation.mutate({ userId: user.id, isActive: !user.isActive })}
              onAssignOrg={openAssignOrgDialog}
              currentUserId={currentUser?.id}
              isApproving={approveMutation.isPending}
              isRejecting={rejectMutation.isPending}
            />
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Update the role for {selectedUser?.displayName}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={newRole} onValueChange={(v) => setNewRole(v as UserRole)}>
              <SelectTrigger data-testid="select-new-role">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((role) => (
                  <SelectItem key={role} value={role} data-testid={`option-role-${role}`}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)} data-testid="button-cancel-role">
              Cancel
            </Button>
            <Button 
              onClick={handleRoleChange} 
              disabled={updateRoleMutation.isPending}
              data-testid="button-confirm-role"
            >
              {updateRoleMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              Update Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve User</DialogTitle>
            <DialogDescription>
              Approve {selectedUser?.displayName} and assign them a role
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-md">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {selectedUser ? getInitials(selectedUser.displayName) : "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{selectedUser?.displayName}</p>
                <p className="text-sm text-muted-foreground">{selectedUser?.email}</p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Assign Role</label>
              <Select value={approveRole} onValueChange={(v) => setApproveRole(v as UserRole)}>
                <SelectTrigger data-testid="select-approve-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.filter(r => r !== "guest").map((role) => (
                    <SelectItem key={role} value={role} data-testid={`option-approve-role-${role}`}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)} data-testid="button-cancel-approve">
              Cancel
            </Button>
            <Button 
              onClick={handleApprove} 
              disabled={approveMutation.isPending}
              data-testid="button-confirm-approve"
            >
              {approveMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              Approve User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={orgDialogOpen} onOpenChange={setOrgDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
            <DialogDescription>
              Create a new organization to group users
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                placeholder="Enter organization name"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                data-testid="input-org-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrgDialogOpen(false)} data-testid="button-cancel-org">
              Cancel
            </Button>
            <Button 
              onClick={() => createOrgMutation.mutate(newOrgName)}
              disabled={createOrgMutation.isPending || !newOrgName.trim()}
              data-testid="button-confirm-org"
            >
              {createOrgMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              Create Organization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOrgDialogOpen} onOpenChange={setAssignOrgDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Organization</DialogTitle>
            <DialogDescription>
              Assign {selectedUser?.displayName} to an organization
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-md">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {selectedUser ? getInitials(selectedUser.displayName) : "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{selectedUser?.displayName}</p>
                <p className="text-sm text-muted-foreground">{selectedUser?.email}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Select Organization</Label>
              <Select value={assignOrgId} onValueChange={setAssignOrgId}>
                <SelectTrigger data-testid="select-assign-org">
                  <SelectValue placeholder="Select an organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id} data-testid={`option-assign-org-${org.id}`}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOrgDialogOpen(false)} data-testid="button-cancel-assign-org">
              Cancel
            </Button>
            <Button 
              onClick={handleAssignOrg}
              disabled={updateUserOrgMutation.isPending || !assignOrgId}
              data-testid="button-confirm-assign-org"
            >
              {updateUserOrgMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              Assign Organization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface UserTableProps {
  users: UserWithoutPassword[];
  isLoading: boolean;
  getInitials: (name: string) => string;
  getApprovalBadge: (status: ApprovalStatus | null) => JSX.Element;
  getOrgName: (orgId: string | null) => string;
  onApprove: (user: UserWithoutPassword) => void;
  onReject: (userId: string) => void;
  onChangeRole: (user: UserWithoutPassword) => void;
  onToggleActive: (user: UserWithoutPassword) => void;
  onAssignOrg: (user: UserWithoutPassword) => void;
  currentUserId?: string;
  isApproving: boolean;
  isRejecting: boolean;
  showApprovalActions?: boolean;
}

function UserTable({
  users,
  isLoading,
  getInitials,
  getApprovalBadge,
  getOrgName,
  onApprove,
  onReject,
  onChangeRole,
  onToggleActive,
  onAssignOrg,
  currentUserId,
  isApproving,
  isRejecting,
  showApprovalActions = false,
}: UserTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <RefreshCw className="h-8 w-8 mx-auto text-muted-foreground animate-spin mb-4" />
          <p className="text-muted-foreground">Loading users...</p>
        </CardContent>
      </Card>
    );
  }

  if (users.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No users found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Approval</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {getInitials(user.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{user.displayName}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="gap-1">
                    <Building2 className="h-3 w-3" />
                    {getOrgName(user.orgId)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <RoleBadge role={user.role as UserRole} size="sm" />
                </TableCell>
                <TableCell>
                  <Badge variant={user.isActive ? "default" : "secondary"}>
                    {user.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {getApprovalBadge(user.approvalStatus as ApprovalStatus | null)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1 flex-wrap">
                    {(showApprovalActions || user.approvalStatus === "pending") && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onApprove(user)}
                          disabled={isApproving}
                          data-testid={`button-approve-${user.id}`}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onReject(user.id)}
                          disabled={isRejecting}
                          data-testid={`button-reject-${user.id}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onAssignOrg(user)}
                      data-testid={`button-assign-org-${user.id}`}
                    >
                      <Building2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onChangeRole(user)}
                      disabled={user.id === currentUserId}
                      data-testid={`button-change-role-${user.id}`}
                    >
                      <Shield className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant={user.isActive ? "destructive" : "default"}
                      onClick={() => onToggleActive(user)}
                      disabled={user.id === currentUserId}
                      data-testid={`button-toggle-active-${user.id}`}
                    >
                      {user.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
