import { useEffect, useState } from "react";
import { Download, FileText, RefreshCw, Search } from "lucide-react";

import apiClient from "../api/client";

function StudentDocumentation() {
  const [documents, setDocuments] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadDocuments(searchTerm = search) {
    setLoading(true);
    setError("");

    try {
      const response = await apiClient.get(
        "/student/documentation-templates",
        {
          params: searchTerm.trim()
            ? { search: searchTerm.trim() }
            : {},
        }
      );

      const result = response.data;
      setDocuments(
        Array.isArray(result.data) ? result.data : []
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load documentation. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDocuments("");
  }, []);

  async function handleSearch(event) {
    event.preventDefault();
    setMessage("");
    await loadDocuments(search);
  }

  async function handleDownload(document) {
    setDownloadingId(document.id);
    setError("");
    setMessage("");

    try {
      const response = await apiClient.get(
        `/student/documentation-templates/${document.id}/download`,
        { responseType: "blob" }
      );

      const blob = new Blob([response.data], {
        type: response.headers["content-type"] ||
          "application/octet-stream",
      });

      const objectUrl = window.URL.createObjectURL(blob);
      const link = window.document.createElement("a");

      link.href = objectUrl;
      link.download = `${document.title || "documentation"}.${document.file_type || "pdf"}`;

      window.document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(objectUrl);
      setMessage("Your document download has started.");
    } catch (err) {
      let errorMessage =
        "Unable to download this document. Please try again.";

      if (err.response?.data instanceof Blob) {
        try {
          const body = await err.response.data.text();
          const parsed = JSON.parse(body);
          errorMessage = parsed.message || errorMessage;
        } catch {
          errorMessage =
            "The download failed. Please sign in again and retry.";
        }
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      }

      setError(errorMessage);
    } finally {
      setDownloadingId(null);
    }
  }

  const styles = {
    page: {
      maxWidth: "1100px",
      margin: "0 auto",
      padding: "24px",
      color: "#172033",
    },
    card: {
      background: "#fff",
      border: "1px solid #e2e8f0",
      borderRadius: "12px",
      padding: "20px",
    },
    input: {
      flex: 1,
      minWidth: "0",
      padding: "12px",
      border: "1px solid #cbd5e1",
      borderRadius: "8px",
      font: "inherit",
    },
    button: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
      padding: "11px 15px",
      border: "none",
      borderRadius: "8px",
      background: "#2457d6",
      color: "#fff",
      font: "inherit",
      cursor: "pointer",
    },
  };

  return (
    <main style={styles.page}>
      <header style={{ marginBottom: "24px" }}>
        <h1 style={{ margin: "0 0 8px" }}>
          Documentation
        </h1>
        <p style={{ color: "#64748b", margin: 0 }}>
          Access documents available for your college and
          general documentation shared with all colleges.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          style={{
            ...styles.card,
            marginBottom: "16px",
            color: "#b91c1c",
            borderColor: "#fecaca",
          }}
        >
          {error}
        </div>
      )}

      {message && (
        <div
          role="status"
          style={{
            ...styles.card,
            marginBottom: "16px",
            color: "#166534",
            borderColor: "#bbf7d0",
          }}
        >
          {message}
        </div>
      )}

      <section style={{ ...styles.card, marginBottom: "20px" }}>
        <form
          onSubmit={handleSearch}
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <input
            style={styles.input}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by document title or description"
            aria-label="Search documentation"
          />

          <button type="submit" style={styles.button}>
            <Search size={18} />
            Search
          </button>

          <button
            type="button"
            style={{
              ...styles.button,
              background: "#475569",
            }}
            onClick={() => {
              setSearch("");
              setMessage("");
              loadDocuments("");
            }}
            disabled={loading}
          >
            <RefreshCw size={17} />
            Reset
          </button>
        </form>
      </section>

      <section>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <h2 style={{ margin: 0 }}>Available Documents</h2>
          <span style={{ color: "#64748b", fontSize: "14px" }}>
            {documents.length} shown
          </span>
        </div>

        {loading ? (
          <div style={styles.card}>Loading documentation...</div>
        ) : documents.length === 0 ? (
          <div style={styles.card}>
            <FileText
              size={32}
              color="#94a3b8"
              style={{ marginBottom: "10px" }}
            />
            <h3 style={{ margin: "0 0 8px" }}>
              No documents found
            </h3>
            <p style={{ color: "#64748b", margin: 0 }}>
              No active documents are available for your selection.
              Try another search or check again later.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "16px",
            }}
          >
            {documents.map((document) => (
              <article
                key={document.id}
                style={{
                  ...styles.card,
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      placeItems: "center",
                      minWidth: "44px",
                      height: "44px",
                      borderRadius: "10px",
                      background: "#eff6ff",
                      color: "#2457d6",
                    }}
                  >
                    <FileText size={23} />
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ margin: "0 0 6px", overflowWrap: "anywhere" }}>
                      {document.title}
                    </h3>

                    <span
                      style={{
                        display: "inline-block",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#475569",
                        background: "#f1f5f9",
                        padding: "4px 8px",
                        borderRadius: "20px",
                      }}
                    >
                      {(document.file_type || "file").toUpperCase()}
                    </span>
                  </div>
                </div>

                <p
                  style={{
                    color: "#64748b",
                    fontSize: "14px",
                    lineHeight: 1.6,
                    margin: 0,
                    overflowWrap: "anywhere",
                    flex: 1,
                  }}
                >
                  {document.description || "No description provided."}
                </p>

                <div
                  style={{
                    fontSize: "13px",
                    color: "#64748b",
                  }}
                >
                  <strong>Available to:</strong>{" "}
                  {typeof document.college === "string"
                    ? document.college
                    : document.college?.name || "All Colleges"}
                </div>

                <button
                  type="button"
                  style={{
                    ...styles.button,
                    width: "100%",
                    opacity: downloadingId === document.id ? 0.7 : 1,
                  }}
                  onClick={() => handleDownload(document)}
                  disabled={downloadingId !== null}
                >
                  <Download size={18} />
                  {downloadingId === document.id
                    ? "Downloading..."
                    : "Download Document"}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default StudentDocumentation;
