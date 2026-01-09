import { Router } from "express";
import {
  getDashboardMetrics,
  getSystemHealth,
  getBacklogMetrics,
} from "../services/dashboard";

const router = Router();

router.get("/metrics", getDashboardMetrics);
router.get("/health", getSystemHealth);
router.get("/backlog", getBacklogMetrics);

export default router;
