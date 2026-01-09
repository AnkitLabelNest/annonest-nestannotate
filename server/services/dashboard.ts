import { Request, Response } from "express";

export const getDashboardMetrics = async (
  req: Request,
  res: Response
) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const db = req.app.locals.db;

    /* -------------------------------
       1️⃣ Total news
    -------------------------------- */
    const totalNews = await db.query(
      `
      select count(*)::int as count
      from news
      where org_id = $1
      `,
      [orgId]
    );

    /* -------------------------------
       2️⃣ AI processed vs pending
    -------------------------------- */
    const aiStats = await db.query(
      `
      select
        count(*) filter (where ao.id is not null)::int as ai_processed,
        count(*) filter (where ao.id is null)::int as ai_pending
      from news n
      left join ai_outputs ao
        on ao.source_type = 'news'
       and ao.source_id = n.id
       and ao.org_id = n.org_id
      where n.org_id = $1
      `,
      [orgId]
    );

    /* -------------------------------
       3️⃣ Entity linking stats
    -------------------------------- */
    const linkingStats = await db.query(
      `
      select
        count(*) filter (where status = 'LINKED')::int as linked,
        count(*) filter (where status = 'REVIEW')::int as review_required
      from entity_links
      where org_id = $1
        and source_type = 'news'
      `,
      [orgId]
    );

    /* -------------------------------
       4️⃣ Freshness
    -------------------------------- */
    const freshness = await db.query(
      `
      select
        count(*) filter (where created_at >= now() - interval '24 hours')::int
          as news_last_24h
      from news
      where org_id = $1
      `,
      [orgId]
    );

    const aiFreshness = await db.query(
      `
      select
        count(*) filter (where created_at >= now() - interval '24 hours')::int
          as ai_last_24h
      from ai_outputs
      where org_id = $1
        and source_type = 'news'
      `,
      [orgId]
    );

    /* -------------------------------
       5️⃣ Derived metrics
    -------------------------------- */
    const total = totalNews.rows[0].count;
    const aiProcessed = aiStats.rows[0].ai_processed;
    const linked = linkingStats.rows[0].linked;

    const response = {
      totals: {
        total_news: total,
        ai_processed: aiProcessed,
        ai_pending: aiStats.rows[0].ai_pending,
        linked,
        review_required: linkingStats.rows[0].review_required,
      },
      rates: {
        ai_coverage_pct: total > 0 ? Math.round((aiProcessed / total) * 100) : 0,
        auto_link_rate:
          aiProcessed > 0 ? Math.round((linked / aiProcessed) * 100) : 0,
      },
      freshness: {
        news_last_24h: freshness.rows[0].news_last_24h,
        ai_last_24h: aiFreshness.rows[0].ai_last_24h,
      },
    };

    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "dashboard_metrics_failed" });
  }
};
export const getSystemHealth = async (req: any, res: any) => {
  try {
    const db = req.app.locals.db;

    /* -------------------------------
       DB health (cheap ping)
    -------------------------------- */
    await db.query("select 1");

    /* -------------------------------
       Last processed news
    -------------------------------- */
    const lastProcessed = await db.query(
      `
      select max(updated_at) as last_processed
      from news
      where processing_status = 'COMPLETED'
      `
    );

    /* -------------------------------
       Failed in last 24h
    -------------------------------- */
    const failed24h = await db.query(
      `
      select count(*)::int as failed
      from news
      where processing_status = 'FAILED'
        and updated_at >= now() - interval '24 hours'
      `
    );

    res.json({
      db: "ok",
      scheduler: "running",
      last_news_processed_at:
        lastProcessed.rows[0]?.last_processed || null,
      failed_last_24h: failed24h.rows[0]?.failed || 0,
    });
  } catch (err) {
    console.error("SYSTEM HEALTH CHECK FAILED", err);
    res.status(500).json({
      db: "error",
      scheduler: "unknown",
      error: String(err),
    });
  }
};
export const getBacklogMetrics = async (req: any, res: any) => {
  try {
    const db = req.app.locals.db;

    // Backlog counts
    const backlog = await db.query(`
      select
        count(*) filter (where processing_status = 'NEW')::int as new_count,
        count(*) filter (where processing_status = 'PROCESSING')::int as processing_count,
        count(*) filter (where processing_status = 'FAILED')::int as failed_count,
        count(*) filter (where processing_status = 'COMPLETED')::int as completed_count
      from news
    `);

    // Latency for completed items
    const latency = await db.query(`
      select
        percentile_cont(0.5) within group (order by (updated_at - created_at)) as p50_latency,
        percentile_cont(0.9) within group (order by (updated_at - created_at)) as p90_latency
      from news
      where processing_status = 'COMPLETED'
    `);

    res.json({
      backlog: backlog.rows[0],
      latency: latency.rows[0],
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("BACKLOG METRICS ERROR", err);
    res.status(500).json({ error: "backlog_metrics_failed" });
  }
};

