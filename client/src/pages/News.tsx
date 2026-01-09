import { useEffect, useState } from "react";

type NewsItem = {
  id: string;
  headline: string;
  source_name: string;
  publish_date: string;
  ai_status?: string | null;
};

export default function News() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  useEffect(() => {
    fetchNews();
  }, []);

  function fetchNews() {
    setLoading(true);

    fetch("https://annonest-backend.onrender.com/api/news", {
      headers: {
        "x-org-id": "demo-org",
        "x-user-id": "demo-user",
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setNews(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch news", err);
        setLoading(false);
      });
  }

  function retryNews(id: string) {
    setRetryingId(id);

    fetch(
      `https://annonest-backend.onrender.com/api/news/${id}/retry`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-org-id": "demo-org",
          "x-user-id": "demo-user",
        },
      }
    )
      .then(() => {
        alert("Retry triggered");
        setRetryingId(null);
        fetchNews(); // refresh list
      })
      .catch((err) => {
        console.error("Retry failed", err);
        setRetryingId(null);
      });
  }

  if (loading) {
    return <div style={{ padding: 24 }}>Loading news…</div>;
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>News</h2>

      <table width="100%" cellPadding={8}>
        <thead>
          <tr>
            <th align="left">Headline</th>
            <th align="left">Source</th>
            <th align="left">Status</th>
            <th />
          </tr>
        </thead>

        <tbody>
          {news.map((n) => {
            const status =
              n.ai_status === "FAILED"
                ? "FAILED"
                : n.ai_status === "PROCESSING"
                ? "PROCESSING"
                : n.ai_status === "COMPLETED"
                ? "COMPLETED"
                : "NEW";

            return (
              <tr key={n.id}>
                <td>{n.headline}</td>
                <td>{n.source_name}</td>
                <td>
                  <StatusBadge status={status} />
                </td>
                <td>
                  {status === "FAILED" && (
                    <button
                      onClick={() => retryNews(n.id)}
                      disabled={retryingId === n.id}
                    >
                      {retryingId === n.id ? "Retrying…" : "Retry"}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "FAILED"
      ? "#e53935"
      : status === "PROCESSING"
      ? "#fb8c00"
      : status === "COMPLETED"
      ? "#43a047"
      : "#757575";

  return (
    <span
      style={{
        padding: "4px 8px",
        borderRadius: 4,
        backgroundColor: color,
        color: "white",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {status}
    </span>
  );
}
