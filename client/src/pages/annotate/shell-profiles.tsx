import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  ArrowLeft,
  Check,
  X,
  Building2,
  User,
  MapPin,
  Tag,
  Briefcase,
  DollarSign,
  Clock,
} from "lucide-react";

interface ShellProfile {
  id: string;
  org_id: string;
  entity_type: string;
  entity_name: string;
  source_task_id: string | null;
  source_news_id: string | null;
  text_span: string | null;
  status: string;
  approved_entity_id: string | null;
  created_by: string | null;
  created_by_name: string | null;
  reviewed_by: string | null;
  created_at: string;
  reviewed_at: string | null;
}

const entityTypeConfig: Record<string, { icon: typeof Building2; color: string; label: string }> = {
  firm: { icon: Building2, color: "bg-purple-500", label: "Firm" },
  person: { icon: User, color: "bg-blue-500", label: "Person" },
  location: { icon: MapPin, color: "bg-emerald-500", label: "Location" },
  topic: { icon: Tag, color: "bg-amber-500", label: "Topic" },
  fund: { icon: Briefcase, color: "bg-indigo-500", label: "Fund" },
  deal: { icon: DollarSign, color: "bg-pink-500", label: "Deal" },
};

export default function ShellProfilesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pending");

  const isManager = user?.role === "admin" || user?.role === "manager" || user?.role === "super_admin";

  const { data: profiles, isLoading } = useQuery<ShellProfile[]>({
    queryKey: ["/api/nest-annotate/shell-profiles", statusFilter],
    queryFn: async () => {
      const res = await fetch(`/api/nest-annotate/shell-profiles?status=${statusFilter}`, {
        credentials: "include",
        headers: { "x-user-id": user?.id || "" },
      });
      if (!res.ok) throw new Error("Failed to fetch shell profiles");
      return res.json();
    },
    enabled: !!user,
  });

  const approveMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const res = await fetch(`/api/nest-annotate/shell-profiles/${profileId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-id": user?.id || "" },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to approve");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nest-annotate/shell-profiles"] });
      toast({ title: "Approved", description: "Shell profile approved successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to approve profile.", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const res = await fetch(`/api/nest-annotate/shell-profiles/${profileId}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-id": user?.id || "" },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to reject");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nest-annotate/shell-profiles"] });
      toast({ title: "Rejected", description: "Shell profile rejected." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reject profile.", variant: "destructive" });
    },
  });

  if (!isManager) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">You don't have permission to view this page.</p>
            <Link href="/annotate/projects">
              <Button className="mt-4" data-testid="button-back">Back to Projects</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/annotate/projects">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">Shell Profile Queue</h1>
            <p className="text-sm text-muted-foreground">Review new entities created from tagging</p>
          </div>
        </div>
        <div className="flex gap-2">
          {["pending", "approved", "rejected"].map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(status)}
              data-testid={`button-filter-${status}`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : profiles?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No {statusFilter} shell profiles found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {profiles?.map((profile) => {
            const config = entityTypeConfig[profile.entity_type] || {
              icon: Tag,
              color: "bg-gray-500",
              label: profile.entity_type,
            };
            const Icon = config.icon;

            return (
              <Card key={profile.id} data-testid={`card-profile-${profile.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`${config.color} text-white p-2 rounded-md`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-medium">{profile.entity_name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{config.label}</Badge>
                          {profile.text_span && (
                            <span className="text-sm text-muted-foreground">
                              "{profile.text_span}"
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Created by {profile.created_by_name || "Unknown"} on{" "}
                          {new Date(profile.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {statusFilter === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => approveMutation.mutate(profile.id)}
                          disabled={approveMutation.isPending}
                          data-testid={`button-approve-${profile.id}`}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rejectMutation.mutate(profile.id)}
                          disabled={rejectMutation.isPending}
                          data-testid={`button-reject-${profile.id}`}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}

                    {statusFilter !== "pending" && (
                      <Badge variant={profile.status === "approved" ? "default" : "secondary"}>
                        {profile.status}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
