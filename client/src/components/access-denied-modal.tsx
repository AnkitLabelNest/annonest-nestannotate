import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, ShieldX } from "lucide-react";

interface AccessDeniedModalProps {
  open: boolean;
  onClose: () => void;
  moduleName: string;
  requiredRole?: string;
}

export function AccessDeniedModal({
  open,
  onClose,
  moduleName,
  requiredRole,
}: AccessDeniedModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md" data-testid="modal-access-denied">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <ShieldX className="h-8 w-8 text-destructive" />
          </div>
          <DialogTitle className="text-xl font-semibold">Access Denied</DialogTitle>
          <DialogDescription className="text-muted-foreground mt-2">
            You don't have permission to access{" "}
            <span className="font-medium text-foreground">{moduleName}</span>.
            {requiredRole && (
              <>
                {" "}
                This module requires{" "}
                <span className="font-medium text-foreground capitalize">
                  {requiredRole}
                </span>{" "}
                access or higher.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/50 p-4">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Contact your administrator for access
          </span>
        </div>
        <div className="mt-6 flex justify-center">
          <Button onClick={onClose} data-testid="button-close-access-denied">
            Go Back
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
