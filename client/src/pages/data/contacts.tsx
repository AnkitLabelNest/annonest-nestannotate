import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, Filter, Mail, Phone, Linkedin, Building2 } from "lucide-react";
import type { Contact, Firm } from "@shared/schema";

export default function ContactsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: contacts = [], isLoading, error } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: firms = [] } = useQuery<Firm[]>({
    queryKey: ["/api/firms"],
  });

  const firmNames = firms.reduce((acc, firm) => {
    acc[firm.id] = firm.name;
    return acc;
  }, {} as Record<string, string>);

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  };

  const columns = [
    {
      key: "name",
      header: "Contact",
      sortable: true,
      render: (contact: Contact) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {getInitials(contact.firstName, contact.lastName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{contact.firstName} {contact.lastName}</p>
            <p className="text-xs text-muted-foreground">{contact.title}</p>
          </div>
        </div>
      ),
    },
    {
      key: "firm",
      header: "Firm",
      render: (contact: Contact) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span>{firmNames[contact.firmId || ""] || "-"}</span>
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      render: (contact: Contact) => (
        <a
          href={`mailto:${contact.email}`}
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <Mail className="h-3 w-3" />
          {contact.email}
        </a>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      render: (contact: Contact) =>
        contact.phone ? (
          <div className="flex items-center gap-1 text-sm">
            <Phone className="h-3 w-3 text-muted-foreground" />
            {contact.phone}
          </div>
        ) : (
          "-"
        ),
    },
    {
      key: "linkedin",
      header: "LinkedIn",
      render: (contact: Contact) =>
        contact.linkedIn ? (
          <a
            href={contact.linkedIn}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            <Linkedin className="h-3 w-3" />
            Profile
          </a>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
  ];

  const filteredContacts = contacts.filter(
    (c) =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-muted-foreground">Manage contact records linked to firms</p>
        </div>
        <Button data-testid="button-add-contact">
          <Plus className="h-4 w-4 mr-2" />
          Add Contact
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Contacts", value: contacts.length, color: "text-primary" },
          { label: "With Email", value: contacts.filter((c) => c.email).length, color: "text-emerald-600" },
          { label: "With LinkedIn", value: contacts.filter((c) => c.linkedIn).length, color: "text-blue-600" },
          { label: "Linked to Firms", value: contacts.filter((c) => c.firmId).length, color: "text-purple-600" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className={`text-2xl font-bold ${stat.color}`}>{isLoading ? "-" : stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
          <CardTitle>All Contacts</CardTitle>
          <div className="flex items-center gap-2">
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
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
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
              onView={(contact) => console.log("View", contact)}
              onEdit={(contact) => console.log("Edit", contact)}
              emptyMessage="No contacts found"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
