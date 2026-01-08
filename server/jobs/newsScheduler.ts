import { processNewsJob } from "./processNewsJob";

export const startNewsScheduler = (db: any) => {
  console.log("🕒 News scheduler started");

  /* --------------------------------
     Process NEW news
  --------------------------------- */
  setInterval(async () => {
    try {
      const result = await db.query(
        `
        select id, org_id
        from news
        where processing_status = 'NEW'
        order by created_at asc
        limit 5
        `
      );

      for (const row of result.rows) {
        processNewsJob({
          db,
          orgId: row.org_id,
          newsId: row.id,
        }).catch((err) => {
          console.error("Scheduled job failed:", err);
        });
      }
    } catch (err) {
      console.error("Scheduler NEW failed:", err);
    }
  }, 60_000); // every 1 minute

  /* --------------------------------
     Retry FAILED news (controlled)
  --------------------------------- */
  setInterval(async () => {
    try {
      const result = await db.query(
        `
        select id, org_id
        from news
        where processing_status = 'FAILED'
        order by updated_at asc
        limit 3
        `
      );

      for (const row of result.rows) {
        processNewsJob({
          db,
          orgId: row.org_id,
          newsId: row.id,
        }).catch((err) => {
          console.error("Retry scheduler failed:", err);
        });
      }
    } catch (err) {
      console.error("Scheduler FAILED failed:", err);
    }
  }, 10 * 60_000); // every 10 minutes
};
