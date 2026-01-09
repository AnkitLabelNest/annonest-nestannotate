import { useEffect, useState } from "react";

type NewsItem = {
  id: string;
  headline: string;
  source_name: string;
  publish_date: string;
  ai_status?: string | null;
};

export default function NewsListPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  useEffect(() => {
    loadNews();
  }, []);

  function loadNews() {
    setLoading(true);

    fetch("/api/news", {
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

    fetch(`/api/news/${id}/retry`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-org-id": "demo-org",
        "x-user-id": "demo-user",
      },
    })
      .then(() => {
        setRetryingId(null);
        loadNews();
      })
      .catch((err) => {
        console.error("Retry failed", err);
        setRetryingId(null);
      });
  }

  if (loading) {
    return <div className="p-6">Loading news…</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">News Processing</h1>

      <table className="w-full text-sm border border-border">
        <thead className="bg-muted">
          <tr>
            <th className="text-left p-2">Headline</th>
            <th className="text-left p-2">Source</th>
            <th className="text-left p-2">Status</th>
            <th className="p-2" />
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
              <tr key={n.id} className="border-t border-border">
                <td className="p-2">{n.headline}</td>
                <td className="p-2 text-muted-foreground">
                  {n.source_name}
                </td>
                <td className="p-2">
                  <StatusBadge status={status} />
                </td>
                <td className="p-2">
                  {status === "FAILED" && (
                    <button
                      className="text-sm text-destructive hover:underline"
                      disabled={retryingId === n.id}
                      onClick={() => retryNews(n.id)}
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
      ? "bg-red-600"
      : status === "PROCESSING"
      ? "bg-yellow-500"
      : status === "COMPLETED"
      ? "bg-green-600"
      : "bg-gray-500";

  return (
    <span
      className={`px-2 py-1 rounded text-white text-xs font-medium ${color}`}
    >
      {status}
    </span>
  );
}
