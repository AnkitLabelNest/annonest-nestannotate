import { Router } from "express";
import { getDashboardMetrics } from "../services/dashboard";

const router = Router();

router.get("/metrics", getDashboardMetrics);

export default router;
