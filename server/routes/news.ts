import { Router } from "express";
import {
  listNews,
  generateAiForNews,
  ingestNews,
} from "../services/news";
import { processNewsJob } from "../jobs/processNewsJob";

const router = Router();

router.get("/", listNews);
router.post("/ingest", ingestNews);

/* admin retry for failed news */
router.post("/:id/retry", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const orgId = req.headers["x-org-id"] as string;
    const userId = req.headers["x-user-id"] as string;
    const newsId = req.params.id;

    processNewsJob({
      db,
      orgId,
      newsId,
      userId,
    }).catch((err) => {
      console.error("Retry job failed:", err);
    });

    res.json({ status: "retry_queued" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "news_retry_failed" });
  }
});


/* legacy / manual trigger (keep for now) */
router.post("/:id/generate-ai", generateAiForNews);

/* canonical pipeline trigger — BACKGROUND */
router.post("/:id/process", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const orgId = req.headers["x-org-id"] as string;
    const userId = req.headers["x-user-id"] as string;
    const newsId = req.params.id;

    processNewsJob({
      db,
      orgId,
      newsId,
      userId,
    }).catch((err) => {
      console.error("Background news job failed:", err);
    });

    res.json({ status: "queued" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "news_process_failed" });
  }
});

export default router;
