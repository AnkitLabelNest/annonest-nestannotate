if (!process.env.GOOGLE_AI_API_KEY) {
  console.warn("⚠️ GOOGLE_AI_API_KEY not set — AI generation disabled");
}

import { GoogleGenerativeAI } from "@google/generative-ai";

/* ===============================
   TYPES
================================ */

export type NewsAIOutput = {
  deal_detected: boolean;

  deal_type: "fundraise" | "investment" | "acquisition" | "exit" | null;

  entities: {
    general_partners: string[];
    funds: string[];
    portfolio_companies: string[];
    limited_partners: string[];
    service_providers: string[];
  };

  amounts: {
    value: number | null;
    currency: string | null;
  };

  geography: {
    country: string | null;
    city: string | null;
  };

  dates: {
    announcement_date: string | null;
  };

  confidence_score: number; // 0–100
  reasoning: string;
};

type GenerateAiInput = {
  db: any;
  orgId: string;
  newsId: string;
  userId?: string;
};

/* ===============================
   AI CLIENT
================================ */

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY as string);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

/* ===============================
   MAIN FUNCTION
================================ */

export const generateAi = async ({
  db,
  orgId,
  newsId,
  userId,
}: GenerateAiInput) => {
  /* -------------------------------
     1️⃣ Fetch news content
  -------------------------------- */
  const newsResult = await db.query(
    `
    select
      headline,
      raw_text
    from news
    where id = $1
      and org_id = $2
    limit 1
    `,
    [newsId, orgId]
  );

  if (newsResult.rows.length === 0) {
    throw new Error("news_not_found");
  }

  const { headline, raw_text } = newsResult.rows[0];

  /* -------------------------------
     2️⃣ Build canonical prompt
  -------------------------------- */
  const prompt = `
You are a private markets research analyst.

Analyze the following news article and extract ONLY factual information.
Do NOT guess. Do NOT hallucinate.

Return output strictly in valid JSON matching this schema:

{
  "deal_detected": boolean,
  "deal_type": "fundraise" | "investment" | "acquisition" | "exit" | null,
  "entities": {
    "general_partners": string[],
    "funds": string[],
    "portfolio_companies": string[],
    "limited_partners": string[],
    "service_providers": string[]
  },
  "amounts": {
    "value": number | null,
    "currency": string | null
  },
  "geography": {
    "country": string | null,
    "city": string | null
  },
  "dates": {
    "announcement_date": string | null
  },
  "confidence_score": number,
  "reasoning": string
}

Rules:
- If no deal is present, set deal_detected=false and keep fields null/empty
- Use ISO date format (YYYY-MM-DD)
- confidence_score must be between 0 and 100
- reasoning must be max 2 sentences

NEWS HEADLINE:
${headline}

NEWS BODY:
${raw_text || ""}
`;

  /* -------------------------------
     3️⃣ Call Gemini
  -------------------------------- */
  const result = await model.generateContent(prompt);
  const responseText = result.response.text();

  let aiJson: NewsAIOutput;

  try {
    aiJson = JSON.parse(responseText);
  } catch (err) {
    console.error("AI raw output:", responseText);
    throw new Error("ai_invalid_json");
  }

  /* -------------------------------
     4️⃣ Persist AI output
  -------------------------------- */
  const insert = await db.query(
    `
    insert into ai_outputs (
      org_id,
      source_type,
      source_id,
      output_json,
      status,
      created_by
    )
    values ($1, 'news', $2, $3, 'AI_DONE', $4)
    returning id
    `,
    [orgId, newsId, aiJson, userId || null]
  );

  return insert.rows[0].id;
};
