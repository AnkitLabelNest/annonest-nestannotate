import { useState } from "react";
import { SourceTrackingSection } from "@/components/source-tracking-section";
import { EntityUrlsSection } from "@/components/entity-urls-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Mail, Phone, Linkedin, Building2, Users, Loader2, Shield, Target, Globe, Award, Star } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { EntityContact } from "@shared/schema";

const roleCategories = ["Investment", "IR", "Ops", "Legal", "Board", "Other"];
const seniorityLevels = ["Partner", "Principal", "VP", "Associate", "Analyst", "Other"];
const verificationStatuses = ["verified", "partial", "unverified"];
const verificationSources = ["website", "linkedin", "filing", "manual"];

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  inactive: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  prospect: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
};

const entityTypeOptions = ["GP Firm", "LP Firm", "Portfolio Company", "Service Provider", "Other"];

export default function ContactsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewItem, setViewItem] = useState<EntityContact | null>(null);
  const [editItem, setEditItem] = useState<EntityContact | null>(null);
  const { toast } = useToast();

  const { data: contacts = [], isLoading, error } = useQuery<EntityContact[]>({
    queryKey: ["/api/entities/contacts"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/crm/contacts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entities/contacts"] });
      setIsAddDialogOpen(false);
      toast({ title: "Contact created", description: "The contact has been added successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EntityContact> }) => {
      const res = await apiRequest("PATCH", `/api/crm/contacts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entities/contacts"] });
      setEditItem(null);
      toast({ title: "Contact updated", description: "The contact has been updated successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getInitials = (firstName: string, lastName: string) => {
    return `${(firstName?.[0] || "?").toUpperCase()}${(lastName?.[0] || "?").toUpperCase()}`;
  };

  const filteredContacts = contacts.filter(
    (c) =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.companyName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns = [
    {
      key: "name",
      header: "Contact",
      sortable: true,
      render: (contact: EntityContact) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {getInitials(contact.firstName, contact.lastName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{contact.firstName} {contact.lastName}</p>
            <p className="text-xs text-muted-foreground">{contact.title || "-"}</p>
          </div>
        </div>
      ),
    },
    {
      key: "company",
      header: "Company",
      render: (contact: EntityContact) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span>{contact.companyName || "-"}</span>
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      render: (contact: EntityContact) =>
        contact.email ? (
          <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-sm text-primary hover:underline">
            <Mail className="h-3 w-3" />
            {contact.email}
          </a>
        ) : "-",
    },
    {
      key: "phone",
      header: "Phone",
      render: (contact: EntityContact) =>
        contact.phone ? (
          <div className="flex items-center gap-1 text-sm">
            <Phone className="h-3 w-3 text-muted-foreground" />
            {contact.phone}
          </div>
        ) : "-",
    },
    {
      key: "linkedin",
      header: "LinkedIn",
      render: (contact: EntityContact) =>
        contact.linkedinUrl ? (
          <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
            <Linkedin className="h-3 w-3" />
            Profile
          </a>
        ) : "-",
    },
    {
      key: "status",
      header: "Status",
      render: (contact: EntityContact) => (
        <Badge className={statusColors[contact.status || "active"]}>
          {contact.status || "active"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Contacts</h1>
          <p className="text-muted-foreground">Manage contact records linked to entities</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-contact">
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Add New Contact</DialogTitle>
            </DialogHeader>
            <ContactForm
              onSubmit={(data) => createMutation.mutate(data)}
              isPending={createMutation.isPending}
              onCancel={() => setIsAddDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Contacts", value: contacts.length, icon: Users },
          { label: "With Email", value: contacts.filter((c) => c.email).length, icon: Mail },
          { label: "With LinkedIn", value: contacts.filter((c) => c.linkedinUrl).length, icon: Linkedin },
          { label: "Active", value: contacts.filter((c) => c.status === "active").length, icon: Users },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{isLoading ? "-" : stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
          <CardTitle>All Contacts</CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
              data-testid="input-search-contacts"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              Failed to load contacts. Please try again.
            </div>
          ) : (
            <DataTable
              data={filteredContacts}
              columns={columns}
              onView={(contact) => setViewItem(contact)}
              onEdit={(contact) => setEditItem(contact)}
              emptyMessage="No contacts found"
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Contact Details</DialogTitle>
          </DialogHeader>
          {viewItem && <ContactView contact={viewItem} onClose={() => setViewItem(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          {editItem && (
            <ContactForm
              defaultValues={editItem}
              onSubmit={(data) => updateMutation.mutate({ id: editItem.id, data })}
              isPending={updateMutation.isPending}
              onCancel={() => setEditItem(null)}
              isEdit
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContactForm({
  defaultValues,
  onSubmit,
  isPending,
  onCancel,
  isEdit = false,
}: {
  defaultValues?: Partial<EntityContact>;
  onSubmit: (data: Partial<EntityContact>) => void;
  isPending: boolean;
  onCancel: () => void;
  isEdit?: boolean;
}) {
  const dv = defaultValues as any || {};
  const [sourceTracking, setSourceTracking] = useState({
    sourcesUsed: dv.sources_used || [],
    sourceUrls: dv.source_urls || [],
    lastUpdatedBy: dv.last_updated_by,
    lastUpdatedOn: dv.last_updated_on,
  });
  const form = useForm({
    defaultValues: {
      first_name: defaultValues?.firstName || "",
      last_name: defaultValues?.lastName || "",
      email: defaultValues?.email || "",
      phone: defaultValues?.phone || "",
      title: defaultValues?.title || "",
      company_name: defaultValues?.companyName || "",
      entity_type: defaultValues?.entityType || "",
      linkedin_url: defaultValues?.linkedinUrl || "",
      notes: defaultValues?.notes || "",
      status: defaultValues?.status || "active",
      role_category: (defaultValues as any)?.roleCategory || (defaultValues as any)?.role_category || "",
      seniority_level: (defaultValues as any)?.seniorityLevel || (defaultValues as any)?.seniority_level || "",
      asset_class_focus: (defaultValues as any)?.assetClassFocus || (defaultValues as any)?.asset_class_focus || "",
      sector_focus: (defaultValues as any)?.sectorFocus || (defaultValues as any)?.sector_focus || "",
      geography_focus: (defaultValues as any)?.geographyFocus || (defaultValues as any)?.geography_focus || "",
      verification_status: (defaultValues as any)?.verificationStatus || (defaultValues as any)?.verification_status || "",
      verification_source: (defaultValues as any)?.verificationSource || (defaultValues as any)?.verification_source || "",
      associated_fund_ids: (defaultValues as any)?.associatedFundIds || (defaultValues as any)?.associated_fund_ids || "",
      board_roles: (defaultValues as any)?.boardRoles || (defaultValues as any)?.board_roles || "",
      confidence_score: (defaultValues as any)?.confidenceScore || (defaultValues as any)?.confidence_score || "",
      importance_score: (defaultValues as any)?.importanceScore || (defaultValues as any)?.importance_score || "",
    },
  });

  const handleSubmit = (data: any) => {
    onSubmit({
      first_name: data.first_name || null,
      last_name: data.last_name || null,
      email: data.email || null,
      phone: data.phone || null,
      title: data.title || null,
      company_name: data.company_name || null,
      entity_type: data.entity_type || null,
      linkedin_url: data.linkedin_url || null,
      notes: data.notes || null,
      status: data.status || "active",
      role_category: data.role_category || null,
      seniority_level: data.seniority_level || null,
      asset_class_focus: data.asset_class_focus || null,
      sector_focus: data.sector_focus || null,
      geography_focus: data.geography_focus || null,
      verification_status: data.verification_status || null,
      verification_source: data.verification_source || null,
      associated_fund_ids: data.associated_fund_ids || null,
      board_roles: data.board_roles || null,
      confidence_score: data.confidence_score ? parseInt(data.confidence_score) : null,
      importance_score: data.importance_score ? parseInt(data.importance_score) : null,
      sources_used: sourceTracking.sourcesUsed,
      source_urls: sourceTracking.sourceUrls,
    } as any);
  };

  const handleSourceTrackingChange = (field: string, value: any) => {
    setSourceTracking(prev => ({ ...prev, [field]: value }));
  };

  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <Form {...form}>
        <form className="space-y-6" onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="First name" data-testid="input-first-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Last name" data-testid="input-last-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="email@example.com" data-testid="input-email" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="+1 (555) 123-4567" data-testid="input-phone" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Job title" data-testid="input-title" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="company_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Company name" data-testid="input-company" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="entity_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entity Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-entity-type">
                          <SelectValue placeholder="Select entity type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {entityTypeOptions.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="linkedin_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>LinkedIn URL</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://linkedin.com/in/..." data-testid="input-linkedin" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Professional Context</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="role_category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role Category</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-role-category">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roleCategories.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="seniority_level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Seniority Level</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-seniority">
                          <SelectValue placeholder="Select seniority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {seniorityLevels.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Coverage Intelligence</h3>
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="asset_class_focus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asset Class Focus</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., PE, VC, RE" data-testid="input-asset-class" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sector_focus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sector Focus</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Tech, Healthcare" data-testid="input-sector-focus" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="geography_focus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Geography Focus</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., North America" data-testid="input-geography-focus" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Verification & Trust</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="verification_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verification Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-verification-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {verificationStatuses.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="verification_source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verification Source</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-verification-source">
                          <SelectValue placeholder="Select source" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {verificationSources.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Relationship Intelligence</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="associated_fund_ids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Associated Fund IDs</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Comma-separated fund IDs" data-testid="input-fund-ids" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="board_roles"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Board Roles</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Board positions held" data-testid="input-board-roles" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Internal Scoring</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="confidence_score"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confidence Score (0-100)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min="0" max="100" placeholder="0-100" data-testid="input-confidence" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="importance_score"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Importance Score (0-100)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min="0" max="100" placeholder="0-100" data-testid="input-importance" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Additional Info</h3>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Additional notes..." data-testid="input-notes" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-status">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="prospect">Prospect</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Source Tracking</h3>
            <SourceTrackingSection
              data={sourceTracking}
              onChange={handleSourceTrackingChange}
              isEditing={true}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} data-testid="button-submit-contact">
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? "Save Changes" : "Add Contact"}
            </Button>
          </div>
        </form>
      </Form>
    </ScrollArea>
  );
}

function ContactView({ contact, onClose }: { contact: EntityContact; onClose: () => void }) {
  const c = contact as any;
  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <div className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Basic Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{contact.firstName} {contact.lastName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Title</p>
              <p className="font-medium">{contact.title || "-"}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              {contact.email ? (
                <a href={`mailto:${contact.email}`} className="text-primary hover:underline">{contact.email}</a>
              ) : <p className="font-medium">-</p>}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium">{contact.phone || "-"}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Company</p>
              <p className="font-medium">{contact.companyName || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Entity Type</p>
              <p className="font-medium">{contact.entityType || "-"}</p>
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">LinkedIn</p>
            {contact.linkedinUrl ? (
              <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{contact.linkedinUrl}</a>
            ) : <p className="font-medium">-</p>}
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Professional Context</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Role Category</p>
              <p className="font-medium">{c.role_category || c.roleCategory || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Seniority Level</p>
              <p className="font-medium">{c.seniority_level || c.seniorityLevel || "-"}</p>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Coverage Intelligence</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Asset Class Focus</p>
              <p className="font-medium">{c.asset_class_focus || c.assetClassFocus || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sector Focus</p>
              <p className="font-medium">{c.sector_focus || c.sectorFocus || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Geography Focus</p>
              <p className="font-medium">{c.geography_focus || c.geographyFocus || "-"}</p>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Verification & Trust</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Verification Status</p>
              {(c.verification_status || c.verificationStatus) ? (
                <Badge variant={
                  (c.verification_status || c.verificationStatus) === "verified" ? "default" : 
                  (c.verification_status || c.verificationStatus) === "partial" ? "secondary" : "outline"
                }>
                  {c.verification_status || c.verificationStatus}
                </Badge>
              ) : <p className="font-medium">-</p>}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Verification Source</p>
              <p className="font-medium">{c.verification_source || c.verificationSource || "-"}</p>
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Last Verified</p>
            <p className="font-medium">{c.last_verified_at || c.lastVerifiedAt ? new Date(c.last_verified_at || c.lastVerifiedAt).toLocaleDateString() : "-"}</p>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Relationship Intelligence</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Associated Fund IDs</p>
              <p className="font-medium">{c.associated_fund_ids || c.associatedFundIds || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Board Roles</p>
              <p className="font-medium">{c.board_roles || c.boardRoles || "-"}</p>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Internal Scoring</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Confidence Score</p>
              <p className="font-medium">{c.confidence_score ?? c.confidenceScore ?? "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Importance Score</p>
              <p className="font-medium">{c.importance_score ?? c.importanceScore ?? "-"}</p>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Additional Info</h3>
          <div>
            <p className="text-sm text-muted-foreground">Notes</p>
            <p className="font-medium">{contact.notes || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge className={statusColors[contact.status || "active"]}>
              {contact.status || "active"}
            </Badge>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Source Tracking</h3>
          <SourceTrackingSection
            data={{
              sourcesUsed: c.sources_used || [],
              sourceUrls: c.source_urls || [],
              lastUpdatedBy: c.last_updated_by,
              lastUpdatedOn: c.last_updated_on,
            }}
            onChange={() => {}}
            isEditing={false}
          />
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">URLs</h3>
          <EntityUrlsSection entityType="contact" entityId={contact.id} />
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </ScrollArea>
  );
}
