import { Request, Response } from "express";
import { generateAi } from "./aiGeneration";

export const listNews = async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const db = req.app.locals.db;

    const result = await db.query(
      `
      select
        n.id,
        n.headline,
        n.source_name,
        n.publish_date,
        ao.status as ai_status
      from news n
      left join ai_outputs ao
        on ao.source_id = n.id
        and ao.source_type = 'news'
      where n.org_id = $1
      order by n.created_at desc
      limit 50
      `,
      [orgId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "news_list_failed" });
  }
};

export const generateAiForNews = async (req: Request, res: Response) => {
  try {
    const newsId = req.params.id;
    const orgId = req.headers["x-org-id"] as string;
    const userId = req.headers["x-user-id"] as string;
    const db = req.app.locals.db;

    const aiOutputId = await generateAi({
      db,
      orgId,
      newsId,
      userId,
    });

    res.json({ ai_output_id: aiOutputId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ai_generation_failed" });
  }
};

export const ingestNews = async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const userId = req.headers["x-user-id"] as string;
    const db = req.app.locals.db;

    const {
      headline,
      source_name,
      publish_date,
      url,
      raw_text,
    } = req.body;

    if (!headline || !source_name || !publish_date || !url) {
      return res.status(400).json({ error: "missing_required_fields" });
    }

    // 1️⃣ Check for duplicate (idempotency)
    const existing = await db.query(
      `
      select id
      from news
      where org_id = $1
        and url = $2
      limit 1
      `,
      [orgId, url]
    );

    if (existing.rows.length > 0) {
      return res.json({
        news_id: existing.rows[0].id,
        deduplicated: true,
      });
    }

    // 2️⃣ Insert new news
    const insertResult = await db.query(
      `
      insert into news (
        org_id,
        headline,
        source_name,
        publish_date,
        url,
        raw_text,
        created_by,
        status
      )
      values ($1, $2, $3, $4, $5, $6, $7, 'NEW')
      returning id
      `,
      [
        orgId,
        headline,
        source_name,
        publish_date,
        url,
        raw_text || null,
        userId,
      ]
    );

    res.json({
      news_id: insertResult.rows[0].id,
      deduplicated: false,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "news_ingest_failed" });
  }
};
