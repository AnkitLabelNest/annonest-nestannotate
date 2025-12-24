import { useState } from "react";
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
import { Search, Plus, Mail, Phone, Linkedin, Building2, Users, Loader2 } from "lucide-react";
import type { EntityContact } from "@shared/schema";

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
    mutationFn: async (data: Partial<EntityContact>) => {
      const res = await apiRequest("POST", "/api/entities/contacts", data);
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
      const res = await apiRequest("PUT", `/api/entities/contacts/${id}`, data);
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
  const form = useForm({
    defaultValues: {
      firstName: defaultValues?.firstName || "",
      lastName: defaultValues?.lastName || "",
      email: defaultValues?.email || "",
      phone: defaultValues?.phone || "",
      title: defaultValues?.title || "",
      companyName: defaultValues?.companyName || "",
      entityType: defaultValues?.entityType || "",
      linkedinUrl: defaultValues?.linkedinUrl || "",
      notes: defaultValues?.notes || "",
      status: defaultValues?.status || "active",
    },
  });

  const handleSubmit = (data: any) => {
    onSubmit({
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      email: data.email || null,
      phone: data.phone || null,
      title: data.title || null,
      companyName: data.companyName || null,
      entityType: data.entityType || null,
      linkedinUrl: data.linkedinUrl || null,
      notes: data.notes || null,
      status: data.status || "active",
    });
  };

  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="firstName"
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
              name="lastName"
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
              name="companyName"
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

          <FormField
            control={form.control}
            name="entityType"
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
            name="linkedinUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>LinkedIn URL</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="https://linkedin.com/in/..." data-testid="input-linkedin" />
                </FormControl>
              </FormItem>
            )}
          />

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
  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <div className="space-y-4">
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
        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </ScrollArea>
  );
}
