import { useState, useEffect, useCallback, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";
import type { EntityType, EntityEditLock } from "@shared/schema";

interface LockStatus {
  isLocked: boolean;
  lock: EntityEditLock | null;
}

interface AcquireResult {
  acquired: boolean;
  lock: EntityEditLock | null;
}

interface UseEntityLockOptions {
  entityType: EntityType;
  entityId: string;
  autoAcquire?: boolean;
  heartbeatIntervalMs?: number;
}

interface UseEntityLockReturn {
  isLocked: boolean;
  lockOwner: string | null;
  lockOwnerId: string | null;
  isOwnLock: boolean;
  isLoading: boolean;
  error: string | null;
  acquireLock: () => Promise<boolean>;
  releaseLock: () => Promise<void>;
  refreshLockStatus: () => Promise<void>;
}

export function useEntityLock({
  entityType,
  entityId,
  autoAcquire = false,
  heartbeatIntervalMs = 60000,
}: UseEntityLockOptions): UseEntityLockReturn {
  const [isLocked, setIsLocked] = useState(false);
  const [lock, setLock] = useState<EntityEditLock | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const isOwnLockRef = useRef(false);

  const getCurrentUserId = useCallback(async () => {
    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        const user = JSON.parse(stored);
        return user.id;
      }
    } catch {
      return null;
    }
    return null;
  }, []);

  const refreshLockStatus = useCallback(async () => {
    if (!entityId) return;
    
    try {
      const res = await apiRequest("GET", `/api/locks/${entityType}/${entityId}`);
      const data: LockStatus = await res.json();
      setIsLocked(data.isLocked);
      setLock(data.lock);
      setError(null);
    } catch (err) {
      // Non-blocking: lock status check failure shouldn't prevent entity viewing
      console.warn("Lock check failed (non-blocking):", err);
      setIsLocked(false);
      setLock(null);
      setError(null);
    }
  }, [entityType, entityId]);

  const acquireLock = useCallback(async (): Promise<boolean> => {
    if (!entityId) return false;
    
    try {
      const res = await apiRequest("POST", `/api/locks/${entityType}/${entityId}/acquire`);
      const data: AcquireResult = await res.json();
      
      if (data.acquired) {
        setIsLocked(true);
        setLock(data.lock);
        isOwnLockRef.current = true;
        setError(null);
        
        heartbeatRef.current = setInterval(async () => {
          try {
            await apiRequest("POST", `/api/locks/${entityType}/${entityId}/heartbeat`);
          } catch (err) {
            console.error("Heartbeat failed:", err);
            clearInterval(heartbeatRef.current!);
            heartbeatRef.current = null;
            isOwnLockRef.current = false;
          }
        }, heartbeatIntervalMs);
        
        return true;
      } else {
        setIsLocked(true);
        setLock(data.lock);
        isOwnLockRef.current = false;
        return false;
      }
    } catch (err) {
      // Non-blocking: lock acquisition failure shouldn't prevent entity viewing
      console.warn("Lock acquisition failed (non-blocking):", err);
      setIsLocked(false);
      setLock(null);
      setError(null);
      return false;
    }
  }, [entityType, entityId, heartbeatIntervalMs]);

  const releaseLock = useCallback(async () => {
    if (!entityId || !isOwnLockRef.current) return;
    
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    
    try {
      await apiRequest("DELETE", `/api/locks/${entityType}/${entityId}`);
      setIsLocked(false);
      setLock(null);
      isOwnLockRef.current = false;
      setError(null);
    } catch (err) {
      console.error("Lock release failed:", err);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      const userId = await getCurrentUserId();
      setCurrentUserId(userId);
      
      if (autoAcquire) {
        await acquireLock();
      } else {
        await refreshLockStatus();
      }
      setIsLoading(false);
    };
    
    init();
    
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };
  }, [entityType, entityId, autoAcquire, acquireLock, refreshLockStatus, getCurrentUserId]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isOwnLockRef.current && entityId) {
        const payload = JSON.stringify({ entityType, entityId });
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon(`/api/locks/release-beacon`, blob);
      }
    };
    
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [entityType, entityId]);

  const isOwnLock = lock?.lockedBy === currentUserId;

  return {
    isLocked,
    lockOwner: lock?.lockedByName || null,
    lockOwnerId: lock?.lockedBy || null,
    isOwnLock,
    isLoading,
    error,
    acquireLock,
    releaseLock,
    refreshLockStatus,
  };
}

export function openEntityProfile(
  entityType: EntityType,
  entityId: string,
  mode: "view" | "edit" = "view"
) {
  const url = `/entity/${entityType}/${entityId}?mode=${mode}`;
  const newWindow = window.open(url, "_blank", "noopener,noreferrer");
  if (!newWindow) {
    window.location.href = url;
  }
}
