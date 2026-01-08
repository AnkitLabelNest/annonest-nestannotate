import { generateAi } from "../services/aiGeneration";
import { linkEntitiesFromAi } from "../services/entityLinker";

export const processNewsJob = async ({
  db,
  orgId,
  newsId,
  userId,
}: {
  db: any;
  orgId: string;
  newsId: string;
  userId?: string;
}) => {
  /* --------------------------------
     Mark as PROCESSING
  --------------------------------- */
  await db.query(
    `
    update news
    set processing_status = 'PROCESSING'
    where id = $1
      and org_id = $2
    `,
    [newsId, orgId]
  );

  try {
    /* --------------------------------
       1️⃣ Generate AI
    --------------------------------- */
    const aiOutputId = await generateAi({
      db,
      orgId,
      newsId,
      userId,
    });

    /* --------------------------------
       2️⃣ Link entities
    --------------------------------- */
    await linkEntitiesFromAi({
      db,
      aiOutputId,
    });

    /* --------------------------------
       Mark as COMPLETED
    --------------------------------- */
    await db.query(
      `
      update news
      set processing_status = 'COMPLETED'
      where id = $1
        and org_id = $2
      `,
      [newsId, orgId]
    );

    return { status: "COMPLETED" };
  } catch (err) {
    /* --------------------------------
       Mark as FAILED
    --------------------------------- */
    await db.query(
      `
      update news
      set processing_status = 'FAILED'
      where id = $1
        and org_id = $2
      `,
      [newsId, orgId]
    );

    throw err;
  }
};
