import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useEntityLock } from "@/hooks/use-entity-lock";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

import { Pencil, Save, X, Landmark } from "lucide-react";

interface LPProfileProps {
  entityId: string;
}

export default function LPProfile({ entityId }: LPProfileProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [editData, setEditData] = useState<any>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const {
    isLocked,
    acquireLock,
    releaseLock,
  } = useEntityLock({ entityType: "lp", entityId });

  const { data: lp, isLoading } = useQuery({
    queryKey: ["lp", entityId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/entities/lps/${entityId}`);
      return res.json();
    },
  });

  useEffect(() => {
    if (lp) setEditData(lp);
  }, [lp]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!editData?.lp_name) e.lp_name = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest(
        "PUT",
        `/api/entities/lps/${entityId}`,
        data
      );
      return res.json();
    },
    onSuccess: async () => {
      await releaseLock();
      queryClient.invalidateQueries({ queryKey: ["lp", entityId] });
      toast({ title: "LP updated successfully" });
      setMode("view");
    },
  });

  if (isLoading || !editData) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Landmark className="h-6 w-6" />
          <h1 className="text-xl font-bold">{editData.lp_name}</h1>
          <Badge>LP</Badge>
        </div>

        <div className="flex gap-2">
          {mode === "view" && !isLocked && (
            <Button
              onClick={async () => {
                if (await acquireLock()) setMode("edit");
              }}
            >
              <Pencil className="h-4 w-4 mr-2" /> Edit
            </Button>
          )}

          {mode === "edit" && (
            <>
              <Button variant="outline" onClick={releaseLock}>
                <X className="h-4 w-4 mr-2" /> Cancel
              </Button>
              <Button
                onClick={() =>
                  validate() && updateMutation.mutate(editData)
                }
              >
                <Save className="h-4 w-4 mr-2" /> Save
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <div>
            <Section title="Basic Information" />
            <div className="grid grid-cols-3 gap-4">
              <Field
                label="LP Name"
                value={editData.lp_name}
                required
                isEditing={mode === "edit"}
                error={errors.lp_name}
                onChange={(v) =>
                  setEditData({ ...editData, lp_name: v })
                }
              />
              <Field
                label="Country"
                value={editData.headquarters_country}
                isEditing={mode === "edit"}
                onChange={(v) =>
                  setEditData({
                    ...editData,
                    headquarters_country: v,
                  })
                }
              />
              <Field
                label="City"
                value={editData.headquarters_city}
                isEditing={mode === "edit"}
                onChange={(v) =>
                  setEditData({
                    ...editData,
                    headquarters_city: v,
                  })
                }
              />
            </div>
          </div>

          <div>
            <Section title="Profile" />
            <Field
              label="Description"
              value={editData.description}
              isEditing={mode === "edit"}
              onChange={(v) =>
                setEditData({ ...editData, description: v })
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- helpers ---------------- */

function Section({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h4 className="text-sm font-semibold uppercase text-muted-foreground">
        {title}
      </h4>
      <Separator className="flex-1" />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  isEditing,
  required,
  error,
}: any) {
  if (isEditing) {
    return (
      <div className="space-y-1">
        <Label>
          {label}
          {required && (
            <span className="text-destructive ml-1">*</span>
          )}
        </Label>
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={error ? "border-destructive" : ""}
        />
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "-"}</p>
    </div>
  );
}
