import { Router } from "express";
import {
  getDashboardMetrics,
  getSystemHealth,
} from "../services/dashboard";

const router = Router();

router.get("/metrics", getDashboardMetrics);
router.get("/health", getSystemHealth);

export default router;
