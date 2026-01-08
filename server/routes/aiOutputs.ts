import { Router } from "express";
import { reviewAiOutput } from "../services/aiReview";

const router = Router();

router.post("/:id/review", reviewAiOutput);

export default router;
