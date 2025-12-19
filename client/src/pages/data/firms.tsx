import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Filter, Building2, Globe, MapPin, Calendar, AlertTriangle, Loader2 } from "lucide-react";
import type { Firm, FirmType } from "@shared/schema";

const firmTypeLabels: Record<FirmType, string> = {
  gp: "GP",
  lp: "LP",
  service_provider: "Service Provider",
  company: "Company",
};

const firmTypeColors: Record<FirmType, string> = {
  gp: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  lp: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  service_provider: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  company: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
};

export default function FirmsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<{ type: "error" | "warning"; message: string } | null>(null);
  const { toast } = useToast();

  const { data: firms = [], isLoading, error } = useQuery<Firm[]>({
    queryKey: ["/api/firms"],
  });

  const createFirmMutation = useMutation({
    mutationFn: async (data: { name: string; type: FirmType; website?: string; headquarters?: string; foundedYear?: number; description?: string }) => {
      const res = await apiRequest("POST", "/api/firms", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/firms"] });
      setIsAddDialogOpen(false);
      form.reset();
      toast({ title: "Firm created", description: "The firm has been added successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const form = useForm({
    defaultValues: {
      name: "",
      type: "gp" as FirmType,
      website: "",
      headquarters: "",
      foundedYear: "",
      description: "",
    },
  });

  const checkDuplicate = (website: string, type: FirmType) => {
    const existingFirm = firms.find((f) => f.website === website);
    if (existingFirm) {
      if (existingFirm.type === type) {
        setDuplicateWarning({
          type: "error",
          message: `A ${firmTypeLabels[type]} firm with this website already exists: ${existingFirm.name}`,
        });
      } else {
        setDuplicateWarning({
          type: "warning",
          message: `A ${firmTypeLabels[existingFirm.type]} firm with this website exists: ${existingFirm.name}. Adding as ${firmTypeLabels[type]} will create a separate record.`,
        });
      }
    } else {
      setDuplicateWarning(null);
    }
  };

  const onSubmit = (data: { name: string; type: FirmType; website: string; headquarters: string; foundedYear: string; description: string }) => {
    createFirmMutation.mutate({
      name: data.name,
      type: data.type,
      website: data.website || undefined,
      headquarters: data.headquarters || undefined,
      foundedYear: data.foundedYear ? parseInt(data.foundedYear) : undefined,
      description: data.description || undefined,
    });
  };

  const filteredFirms = firms.filter((firm) => {
    const matchesSearch = firm.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === "all" || firm.type === selectedType;
    return matchesSearch && matchesType;
  });

  const columns = [
    {
      key: "name",
      header: "Firm Name",
      sortable: true,
      render: (firm: Firm) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{firm.name}</span>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (firm: Firm) => (
        <Badge className={firmTypeColors[firm.type]}>{firmTypeLabels[firm.type]}</Badge>
      ),
    },
    {
      key: "headquarters",
      header: "Headquarters",
      render: (firm: Firm) => (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {firm.headquarters || "-"}
        </div>
      ),
    },
    {
      key: "website",
      header: "Website",
      render: (firm: Firm) =>
        firm.website ? (
          <a
            href={firm.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <Globe className="h-3 w-3" />
            {new URL(firm.website).hostname}
          </a>
        ) : (
          "-"
        ),
    },
    {
      key: "aum",
      header: "AUM",
      render: (firm: Firm) => <span className="font-medium">{firm.aum || "-"}</span>,
    },
    {
      key: "foundedYear",
      header: "Founded",
      render: (firm: Firm) => (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {firm.foundedYear || "-"}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Firms</h1>
          <p className="text-muted-foreground">Manage GP, LP, Service Provider, and Company records</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-firm">
              <Plus className="h-4 w-4 mr-2" />
              Add Firm
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Firm</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Firm Name *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter firm name" data-testid="input-firm-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Firm Type *</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(v) => {
                          field.onChange(v);
                          const website = form.getValues("website");
                          if (website) checkDuplicate(website, v as FirmType);
                        }}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-firm-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="gp">GP</SelectItem>
                          <SelectItem value="lp">LP</SelectItem>
                          <SelectItem value="service_provider">Service Provider</SelectItem>
                          <SelectItem value="company">Company</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="https://example.com"
                          onChange={(e) => {
                            field.onChange(e);
                            const type = form.getValues("type");
                            if (e.target.value) checkDuplicate(e.target.value, type);
                          }}
                          data-testid="input-firm-website"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {duplicateWarning && (
                  <div
                    className={`p-3 rounded-lg flex items-start gap-2 ${
                      duplicateWarning.type === "error"
                        ? "bg-red-100 border border-red-200 text-red-700 dark:bg-red-950 dark:border-red-900 dark:text-red-400"
                        : "bg-amber-100 border border-amber-200 text-amber-700 dark:bg-amber-950 dark:border-amber-900 dark:text-amber-400"
                    }`}
                  >
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">{duplicateWarning.message}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="headquarters"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Headquarters</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="City, State" data-testid="input-headquarters" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="foundedYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Founded Year</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="YYYY" type="number" data-testid="input-founded" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={duplicateWarning?.type === "error" || createFirmMutation.isPending}
                    data-testid="button-submit-firm"
                  >
                    {createFirmMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Add Firm
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
          <CardTitle>All Firms</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search firms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
                data-testid="input-search-firms"
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
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-9 w-24" />
                ))}
              </div>
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              Failed to load firms. Please try again.
            </div>
          ) : (
          <Tabs value={selectedType} onValueChange={setSelectedType}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All ({firms.length})</TabsTrigger>
              <TabsTrigger value="gp">GP ({firms.filter((f) => f.type === "gp").length})</TabsTrigger>
              <TabsTrigger value="lp">LP ({firms.filter((f) => f.type === "lp").length})</TabsTrigger>
              <TabsTrigger value="service_provider">Service Provider ({firms.filter((f) => f.type === "service_provider").length})</TabsTrigger>
              <TabsTrigger value="company">Company ({firms.filter((f) => f.type === "company").length})</TabsTrigger>
            </TabsList>
            <DataTable
              data={filteredFirms}
              columns={columns}
              onView={(firm) => console.log("View", firm)}
              onEdit={(firm) => console.log("Edit", firm)}
              showAudit
              getAuditInfo={(firm) => ({
                viewedBy: firm.viewedBy as string[],
                lastEditedBy: firm.lastEditedBy || undefined,
              })}
              emptyMessage="No firms found"
            />
          </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
