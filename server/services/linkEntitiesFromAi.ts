// server/services/linkEntitiesFromAi.ts

export async function linkEntitiesFromAi(db: any, aiOutputId: string) {
  // 1️⃣ Load AI output
  const { rows } = await db.query(
    `
    select 
      org_id,
      source_id as news_id,
      output_json
    from ai_outputs
    where id = $1
    `,
    [aiOutputId]
  );

  if (!rows.length) return;

  const { org_id, news_id, output_json } = rows[0];

  if (!output_json?.entities) return;

  /* ------------------------------------
     2️⃣ Map AI buckets → LabelNest types
  ------------------------------------ */
  const mapping: Record<string, string> = {
    general_partners: "gp",
    funds: "fund",
    portfolio_companies: "portfolio_company",
    limited_partners: "lp",
    service_providers: "service_provider",
  };

  /* ------------------------------------
     3️⃣ Flatten AI entities
  ------------------------------------ */
  const extracted: { name: string; type: string }[] = [];

  for (const [bucket, values] of Object.entries(output_json.entities)) {
    const entityType = mapping[bucket];
    if (!entityType || !Array.isArray(values)) continue;

    for (const rawName of values) {
      const name = String(rawName || "").trim();
      if (name.length > 1) {
        extracted.push({ name, type: entityType });
      }
    }
  }

  if (!extracted.length) return;

  /* ------------------------------------
     4️⃣ Resolve → Create → Link
  ------------------------------------ */
  for (const { name, type } of extracted) {
    // Try to find existing entity
    const existing = await db.query(
      `
      select id
      from entities
      where org_id = $1
        and type = $2
        and lower(name) = lower($3)
      limit 1
      `,
      [org_id, type, name]
    );

    let entityId: string;

    if (existing.rows.length) {
      entityId = existing.rows[0].id;
    } else {
      // Create shell entity
      const created = await db.query(
        `
        insert into entities (org_id, type, name, status)
        values ($1, $2, $3, 'shell')
        returning id
        `,
        [org_id, type, name]
      );

      entityId = created.rows[0].id;
    }

    // Link entity to this news item (idempotent)
    await db.query(
      `
      insert into news_entity_links (org_id, news_id, entity_type, entity_id)
      values ($1, $2, $3, $4)
      on conflict do nothing
      `,
      [org_id, news_id, type, entityId]
    );
  }
}
