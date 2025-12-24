import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { EntityUrl } from "@shared/schema";

const URL_TYPES = [
  { value: "fundamentals", label: "Fundamentals" },
  { value: "about_us", label: "About Us" },
  { value: "service", label: "Service" },
  { value: "product", label: "Product" },
  { value: "financial_report", label: "Financial Report" },
  { value: "address", label: "Address" },
  { value: "people", label: "People" },
  { value: "portfolio", label: "Portfolio" },
  { value: "press_release", label: "Press Release" },
];

interface EntityUrlsSectionProps {
  entityType: string;
  entityId: string;
  readOnly?: boolean;
}

export function EntityUrlsSection({ entityType, entityId, readOnly = false }: EntityUrlsSectionProps) {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingUrl, setEditingUrl] = useState<EntityUrl | null>(null);
  const [formData, setFormData] = useState({
    url_type: "",
    url_link: "",
    status: "active",
  });

  const { data: urls = [], isLoading } = useQuery<EntityUrl[]>({
    queryKey: ["/api/crm/entity-urls", entityType, entityId],
    queryFn: async () => {
      const res = await fetch(`/api/crm/entity-urls?entity_type=${entityType}&entity_id=${entityId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch URLs");
      return res.json();
    },
    enabled: !!entityId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/crm/entity-urls", {
        ...data,
        entity_type: entityType,
        entity_id: entityId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/entity-urls", entityType, entityId] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({ title: "URL added successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/crm/entity-urls/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/entity-urls", entityType, entityId] });
      setEditingUrl(null);
      resetForm();
      toast({ title: "URL updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/crm/entity-urls/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/entity-urls", entityType, entityId] });
      toast({ title: "URL deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ url_type: "", url_link: "", status: "active" });
  };

  const handleSubmit = () => {
    if (!formData.url_type || !formData.url_link) {
      toast({ title: "Error", description: "URL type and link are required", variant: "destructive" });
      return;
    }

    if (editingUrl) {
      updateMutation.mutate({ id: editingUrl.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (url: EntityUrl) => {
    setEditingUrl(url);
    setFormData({
      url_type: url.urlType || "",
      url_link: url.urlLink || "",
      status: url.status || "active",
    });
  };

  const formatUrlType = (type: string) => {
    const found = URL_TYPES.find((t) => t.value === type);
    return found ? found.label : type;
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString();
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading URLs...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="text-base">URLs</CardTitle>
        {!readOnly && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              resetForm();
              setIsAddDialogOpen(true);
            }}
            data-testid="button-add-url"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add URL
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {urls.length === 0 ? (
          <p className="text-sm text-muted-foreground">No URLs added yet.</p>
        ) : (
          <div className="space-y-2">
            {urls.map((url: any) => (
              <div
                key={url.id}
                className="flex items-center justify-between gap-2 p-2 rounded-md border bg-muted/30"
                data-testid={`url-item-${url.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      {formatUrlType(url.url_type || url.urlType)}
                    </Badge>
                    <Badge variant={url.status === "active" ? "default" : "outline"} className="text-xs">
                      {url.status}
                    </Badge>
                  </div>
                  <a
                    href={url.url_link || url.urlLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1 mt-1 truncate"
                    data-testid={`link-url-${url.id}`}
                  >
                    {url.url_link || url.urlLink}
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  </a>
                  <span className="text-xs text-muted-foreground">
                    Added: {formatDate(url.added_date || url.addedDate)}
                  </span>
                </div>
                {!readOnly && (
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleEdit(url)}
                      data-testid={`button-edit-url-${url.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(url.id)}
                      data-testid={`button-delete-url-${url.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={isAddDialogOpen || !!editingUrl} onOpenChange={(open) => {
        if (!open) {
          setIsAddDialogOpen(false);
          setEditingUrl(null);
          resetForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUrl ? "Edit URL" : "Add URL"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="url_type">URL Type</Label>
              <Select
                value={formData.url_type}
                onValueChange={(value) => setFormData({ ...formData, url_type: value })}
              >
                <SelectTrigger data-testid="select-url-type">
                  <SelectValue placeholder="Select URL type" />
                </SelectTrigger>
                <SelectContent>
                  {URL_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="url_link">URL Link</Label>
              <Input
                id="url_link"
                type="url"
                value={formData.url_link}
                onChange={(e) => setFormData({ ...formData, url_link: e.target.value })}
                placeholder="https://..."
                data-testid="input-url-link"
              />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger data-testid="select-url-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                setEditingUrl(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-url"
            >
              {editingUrl ? "Update" : "Add"} URL
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
