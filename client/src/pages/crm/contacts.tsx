import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Search, Users, Building2, Mail, Linkedin } from "lucide-react";

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  full_name_snapshot: string | null;
  current_job_title: string | null;
  current_employer_name_snapshot: string | null;
  seniority_level: string | null;
  email_primary: string | null;
  linkedin_url: string | null;
  data_confidence_score: number | null;
}

export default function CRMContactsPage() {
  const [search, setSearch] = useState("");

  const { data: contacts, isLoading } = useQuery<Contact[]>({
    queryKey: ["/api/crm/contacts"],
  });

  const filteredContacts = contacts?.filter(c => 
    c.first_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.last_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.current_employer_name_snapshot?.toLowerCase().includes(search.toLowerCase()) ||
    c.current_job_title?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-crm-contacts-title">Contacts</h1>
          <p className="text-muted-foreground">Professionals and decision makers</p>
        </div>
        <Button data-testid="button-add-contact" disabled>
          Add Contact (Coming Soon)
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search contacts by name, title, or company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
          data-testid="input-search-crm-contacts"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Contact</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredContacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No contacts found. Contacts will appear here once added.
                  </TableCell>
                </TableRow>
              ) : (
                filteredContacts.map((contact) => (
                  <TableRow key={contact.id} className="cursor-pointer hover-elevate" data-testid={`row-crm-contact-${contact.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {contact.full_name_snapshot || `${contact.first_name} ${contact.last_name}`}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {contact.current_job_title || "-"}
                    </TableCell>
                    <TableCell>
                      {contact.current_employer_name_snapshot ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          {contact.current_employer_name_snapshot}
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {contact.seniority_level && <Badge variant="secondary">{contact.seniority_level}</Badge>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {contact.email_primary && (
                          <a 
                            href={`mailto:${contact.email_primary}`}
                            className="text-muted-foreground"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Mail className="h-4 w-4" />
                          </a>
                        )}
                        {contact.linkedin_url && (
                          <a 
                            href={contact.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Linkedin className="h-4 w-4" />
                          </a>
                        )}
                        {!contact.email_primary && !contact.linkedin_url && "-"}
                      </div>
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
