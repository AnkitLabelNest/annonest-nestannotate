type LinkEntitiesInput = {
  db: any;
  aiOutputId: string;
};

/* ===============================
   ENTITY CONFIG
================================ */

const ENTITY_MAP = {
  general_partners: {
    table: "general_partners",
    column: "name",
    type: "gp",
  },
  funds: {
    table: "funds",
    column: "name",
    type: "fund",
  },
  portfolio_companies: {
    table: "portfolio_companies",
    column: "name",
    type: "company",
  },
  limited_partners: {
    table: "limited_partners",
    column: "name",
    type: "lp",
  },
  service_providers: {
    table: "service_providers",
    column: "name",
    type: "sp",
  },
};

/* ===============================
   MAIN LINKER
================================ */

export const linkEntitiesFromAi = async ({
  db,
  aiOutputId,
}: LinkEntitiesInput) => {
  /* -------------------------------
     1️⃣ Fetch AI output + context
  -------------------------------- */
  const aiResult = await db.query(
    `
    select
      id,
      org_id,
      source_id,
      output_json
    from ai_outputs
    where id = $1
      and status = 'AI_DONE'
    limit 1
    `,
    [aiOutputId]
  );

  if (aiResult.rows.length === 0) {
    throw new Error("ai_output_not_found");
  }

  const {
    org_id: orgId,
    source_id: newsId,
    output_json: aiOutput,
  } = aiResult.rows[0];

  if (!aiOutput?.entities) {
    return { status: "NO_ENTITIES" };
  }

  /* -------------------------------
     2️⃣ Iterate entity buckets
  -------------------------------- */
  for (const [key, config] of Object.entries(ENTITY_MAP)) {
    const names: string[] = aiOutput.entities[key] || [];

    for (const rawName of names) {
      const name = rawName.trim();
      if (!name) continue;

      /* ---------- Exact match ---------- */
      const exact = await db.query(
        `
        select id
        from ${config.table}
        where org_id = $1
          and lower(${config.column}) = lower($2)
        limit 1
        `,
        [orgId, name]
      );

      if (exact.rows.length > 0) {
        await insertEntityLink({
          db,
          orgId,
          newsId,
          entityType: config.type,
          entityId: exact.rows[0].id,
          confidence: 95,
          matchType: "exact",
        });
        continue;
      }

      /* ---------- Fuzzy match ---------- */
      const fuzzy = await db.query(
        `
        select id
        from ${config.table}
        where org_id = $1
          and ${config.column} ilike $2
        limit 1
        `,
        [orgId, `%${name}%`]
      );

      if (fuzzy.rows.length > 0) {
        await insertEntityLink({
          db,
          orgId,
          newsId,
          entityType: config.type,
          entityId: fuzzy.rows[0].id,
          confidence: 70,
          matchType: "fuzzy",
        });
      }
    }
  }

  /* -------------------------------
     3️⃣ Mark AI output as linked
  -------------------------------- */
  await db.query(
    `
    update ai_outputs
    set status = 'LINKED'
    where id = $1
    `,
    [aiOutputId]
  );

  return { status: "LINKING_COMPLETE" };
};

/* ===============================
   INSERT HELPER
================================ */

const insertEntityLink = async ({
  db,
  orgId,
  newsId,
  entityType,
  entityId,
  confidence,
  matchType,
}: {
  db: any;
  orgId: string;
  newsId: string;
  entityType: string;
  entityId: string;
  confidence: number;
  matchType: "exact" | "fuzzy";
}) => {
  await db.query(
    `
    insert into entity_links (
      org_id,
      source_type,
      source_id,
      entity_type,
      entity_id,
      confidence_score,
      match_type,
      status
    )
    values (
      $1,
      'news',
      $2,
      $3,
      $4,
      $5,
      $6,
      case when $5 >= 80 then 'LINKED' else 'REVIEW' end
    )
    on conflict do nothing
    `,
    [
      orgId,
      newsId,
      entityType,
      entityId,
      confidence,
      matchType,
    ]
  );
};
