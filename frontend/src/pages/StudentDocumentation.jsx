import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Download,
  FileText,
  RefreshCw,
  Search,
  LockKeyhole,
  CheckCircle2,
  X,
} from "lucide-react";
import apiClient from "../api/client";
import StudentHeader from "../components/student/StudentHeader";
import { useToastOn } from "../components/Toast";

const FILE_ACCENTS = {
  pdf: "rose",
  doc: "blue",
  docx: "blue",
  ppt: "amber",
  pptx: "amber",
  xls: "green",
  xlsx: "green",
};
const getAccent = (ext = "") => FILE_ACCENTS[String(ext).toLowerCase()] || "violet";

function StudentDocumentation() {
  const [documents, setDocuments] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);

  useToastOn(error, "error", setError);
  useToastOn(notice, "success", setNotice);

  const loadDocuments = useCallback(async (searchTerm = "") => {
    setLoading(true);
    setError("");
    setNotice("");
    setLoadFailed(false);

    try {
      const response = await apiClient.get(
        "/student/documentation-templates",
        {
          params: searchTerm.trim()
            ? { search: searchTerm.trim() }
            : {},
        }
      );

      const payload = response?.data;
      const rows = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.data?.data)
            ? payload.data.data
            : [];

      setDocuments(
        rows.map((document) => ({
          ...document,
          is_unlocked:
            document.is_unlocked === true ||
            document.is_unlocked === 1 ||
            document.is_unlocked === "1" ||
            document.is_unlocked === "true",
        }))
      );
    } catch (err) {
      setLoadFailed(true);
      setError(
        err?.response?.data?.message ||
          "Unable to load documentation. Please refresh and try again."
      );
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleSearch = async (event) => {
    event.preventDefault();
    await loadDocuments(search);
  };

  const handleRefresh = async () => {
    await loadDocuments(search);
  };

  const handleDownload = async (document) => {
    if (document.is_unlocked !== true) {
      setError(
        "This document is locked. Complete the required access stage first."
      );
      return;
    }

    setDownloadingId(document.id);
    setError("");
    setNotice("");

    try {
      const response = await apiClient.get(
        `/student/documentation-templates/${document.id}/download`,
        { responseType: "blob" }
      );

      const blob = new Blob([response.data], {
        type:
          response.headers?.["content-type"] ||
          "application/octet-stream",
      });

      const objectUrl = window.URL.createObjectURL(blob);
      const link = window.document.createElement("a");

      const extension =
        String(document.file_type || "").toLowerCase() === "pdf"
          ? "pdf"
          : "docx";

      const safeTitle = String(document.title || "documentation")
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
        .trim();

      link.href = objectUrl;
      link.download = `${safeTitle || "documentation"}.${extension}`;

      window.document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => {
        window.URL.revokeObjectURL(objectUrl);
      }, 1000);

      setNotice("Download started.");
    } catch (err) {
      let message =
        err?.response?.data?.message ||
        "Unable to download this document. Please try again.";

      if (err?.response?.data instanceof Blob) {
        try {
          const responseText = await err.response.data.text();
          const parsed = JSON.parse(responseText);

          if (parsed?.message) {
            message = parsed.message;
          }
        } catch {
          message =
            "Unable to download this document. Please try again.";
        }
      }

      setError(message);
    } finally {
      setDownloadingId(null);
    }
  };

  const getCollegeName = (document) => {
    if (typeof document.college === "string") {
      return document.college;
    }

    return (
      document.college?.name ||
      (document.college_id
        ? `College #${document.college_id}`
        : "All colleges")
    );
  };

  const getGroupName = (document) => {
    if (typeof document.group === "string") {
      return document.group;
    }

    return (
      document.group?.name ||
      document.group?.group_name ||
      (document.group_id ? `Group #${document.group_id}` : null)
    );
  };

  const getProjectName = (document) => {
    if (typeof document.project === "string") {
      return document.project;
    }

    return (
      document.project?.title ||
      document.project?.name ||
      document.project_title ||
      (document.project_id ? `Software #${document.project_id}` : null)
    );
  };

  const getAssignmentDetails = (document) => {
    const details = [
      {
        label: "College",
        value: getCollegeName(document),
      },
    ];

    const groupName = getGroupName(document);
    const projectName = getProjectName(document);

    if (groupName) {
      details.push({
        label: "Group",
        value: groupName,
      });
    }

    if (projectName) {
      details.push({
        label: "Software",
        value: projectName,
      });
    }

    if (document.stage_percent != null) {
      details.push({
        label: "Required stage",
        value: `${document.stage_percent}%`,
      });
    }

    if (document.bundle) {
      details.push({
        label: "Bundle",
        value: document.bundle,
      });
    }

    return details;
  };

  const getAccessMessage = (document) => {
    if (document.is_unlocked === true) {
      return "You can download this document.";
    }

    if (document.stage_percent != null) {
      return `Unlock the ${document.stage_percent}% software stage to access this document.`;
    }

    if (document.bundle) {
      return "Unlock the required bundle to access this document.";
    }

    if (document.project_id) {
      return "Unlock access to this software to download this document.";
    }

    return "This document is currently locked. Contact your administrator if you think this is incorrect.";
  };

  const q = search.trim().toLowerCase();
  const visibleDocuments = q
    ? documents.filter((d) =>
        [
          d.title,
          d.description,
          d.file_type,
          getCollegeName(d),
          getGroupName(d),
          getProjectName(d),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
    : documents;

  const unlockedCount = visibleDocuments.filter((d) => d.is_unlocked === true).length;

  return (
    <div className="student-page">
    <StudentHeader />
    <main className="container student-documentation-page sx-page">
      <section className="sx-hero">
        <span className="sx-hero__eyebrow">User resources</span>
        <h1>Documentation</h1>
        <p>Templates and guides assigned to your college, group and software.</p>
      </section>

      <form
        className="student-documentation-page__search"
        onSubmit={handleSearch}
      >
        <Search size={19} aria-hidden="true" />

        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search documentation..."
          aria-label="Search documentation"
        />

        {search && (
          <button
            type="button"
            className="sxd-clear"
            aria-label="Clear search"
            onClick={() => {
              setSearch("");
              loadDocuments("");
            }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}

        <button type="submit" disabled={loading}>
          Search
        </button>
      </form>

      <section
        className="student-documentation-page__results"
        aria-live="polite"
      >
        <div className="student-documentation-page__results-header">
          <h2>My Documentation</h2>

          {!loading && !loadFailed && (
            <div className="sxd-counts">
              <span>
                {visibleDocuments.length} {visibleDocuments.length === 1 ? "document" : "documents"}
              </span>
              <span className="sxd-counts__ok">
                <CheckCircle2 size={13} aria-hidden="true" /> {unlockedCount} unlocked
              </span>
              {visibleDocuments.length - unlockedCount > 0 && (
                <span className="sxd-counts__lock">
                  <LockKeyhole size={13} aria-hidden="true" /> {visibleDocuments.length - unlockedCount} locked
                </span>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="student-documentation-page__grid" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton sxd-skel" />
            ))}
          </div>
        ) : loadFailed ? (
          <div className="error-state" role="alert">
            <span className="error-state__icon">
              <AlertTriangle size={24} aria-hidden="true" />
            </span>
            <h3>We couldn't load documentation</h3>
            <p>Check your connection and try again.</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleRefresh}>
              <RefreshCw size={15} aria-hidden="true" /> Try again
            </button>
          </div>
        ) : visibleDocuments.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state__icon">
              <FileText size={24} aria-hidden="true" />
            </span>
            <h3>{search.trim() ? "No matching documents" : "No documentation yet"}</h3>
            <p>
              {search.trim()
                ? "Try a different keyword or clear the search."
                : "Documents assigned to your college, group or software will appear here."}
            </p>
            {search.trim() && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => { setSearch(""); loadDocuments(""); }}
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="student-documentation-page__grid">
            {visibleDocuments.map((document, index) => {
              const extension = String(
                document.file_type || "file"
              ).toUpperCase();

              const isUnlocked = document.is_unlocked === true;
              const isDownloading = downloadingId === document.id;
              const assignmentDetails = getAssignmentDetails(document);

              return (
                <article
                  className={`student-documentation-page__card sx-doc sx-doc--${getAccent(document.file_type)}${
                    isUnlocked ? "" : " student-documentation-page__card--locked"
                  }`}
                  style={{ "--i": Math.min(index, 8) }}
                  key={document.id}
                >
                  <div className="student-documentation-page__card-top">
                    <div
                      className={`student-documentation-page__file-icon ${
                        isUnlocked
                          ? ""
                          : "student-documentation-page__file-icon--locked"
                      }`}
                    >
                      <FileText size={22} />
                    </div>

                    <span
                      className={`student-documentation-page__access-badge ${
                        isUnlocked
                          ? "student-documentation-page__access-badge--unlocked"
                          : "student-documentation-page__access-badge--locked"
                      }`}
                    >
                      {isUnlocked ? <CheckCircle2 size={14} /> : <LockKeyhole size={14} />}
                      {isUnlocked ? "Unlocked" : "Locked"}
                    </span>
                  </div>

                  <div className="student-documentation-page__card-content">
                    <div className="sx-doc__meta">
                      <span className="sx-doc__type">{extension}</span>
                      <span className="sx-doc__college" title={getCollegeName(document)}>
                        <Building2 size={13} aria-hidden="true" />
                        {getCollegeName(document)}
                      </span>
                    </div>

                    <h3>{document.title}</h3>

                    <p className="student-documentation-page__description">
                      {document.description || "No description provided."}
                    </p>

                    {assignmentDetails.filter((d) => d.label !== "College").length > 0 && (
                      <dl className="sx-doc__facts">
                        {assignmentDetails
                          .filter((d) => d.label !== "College")
                          .map((detail) => (
                            <div
                              key={detail.label}
                              className={`sx-fact${
                                ["Software", "Bundle"].includes(detail.label) ? " sx-fact--wide" : ""
                              }`}
                            >
                              <dt>{detail.label}</dt>
                              <dd title={detail.value}>{detail.value}</dd>
                            </div>
                          ))}
                      </dl>
                    )}

                    <p
                      className={`student-documentation-page__access-message ${
                        isUnlocked
                          ? "student-documentation-page__access-message--unlocked"
                          : "student-documentation-page__access-message--locked"
                      }`}
                    >
                      {getAccessMessage(document)}
                    </p>
                  </div>

                  {isUnlocked ? (
                    <button
                      type="button"
                      className="student-documentation-page__download"
                      onClick={() => handleDownload(document)}
                      disabled={isDownloading}
                    >
                      <Download size={17} />
                      {isDownloading ? "Downloading..." : "Download"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="student-documentation-page__download student-documentation-page__download--locked"
                      disabled
                      title="Complete the required access stage first"
                    >
                      <LockKeyhole size={17} />
                      Access Locked
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <style>{`
        .student-documentation-page {
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          padding: 28px;
          color: var(--text-primary, #172033);
        }

        .student-documentation-page__header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 24px;
        }

        .student-documentation-page__eyebrow {
          margin: 0 0 8px;
          color: var(--primary, #4f46e5);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: .12em;
        }

        .student-documentation-page__header h1 {
          margin: 0 0 8px;
          font-size: clamp(26px, 4vw, 34px);
          line-height: 1.2;
        }

        .student-documentation-page__header p:last-child {
          margin: 0;
          color: var(--text-secondary, #64748b);
          line-height: 1.6;
        }

        .student-documentation-page__refresh,
        .student-documentation-page__search button,
        .student-documentation-page__download {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 0;
          border-radius: 10px;
          cursor: pointer;
          font: inherit;
          font-weight: 600;
          transition: opacity .2s ease, transform .2s ease;
        }

        .student-documentation-page__refresh {
          padding: 11px 14px;
          background: var(--surface-secondary, #f1f5f9);
          color: var(--text-primary, #172033);
          white-space: nowrap;
        }

        .student-documentation-page__search {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 10px 8px 14px;
          margin-bottom: 28px;
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 14px;
          background: var(--surface, #fff);
        }

        .student-documentation-page__search > svg {
          flex: 0 0 auto;
          color: var(--text-secondary, #64748b);
        }

        .student-documentation-page__search input {
          flex: 1;
          min-width: 0;
          padding: 9px 0;
          border: 0;
          outline: none;
          background: transparent;
          color: inherit;
          font: inherit;
        }

        .student-documentation-page__search button,
        .student-documentation-page__download {
          padding: 11px 15px;
          background: var(--primary, #4f46e5);
          color: #fff;
        }

        .student-documentation-page__results-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }

        .student-documentation-page__results-header h2 {
          margin: 0;
          font-size: 20px;
        }

        .student-documentation-page__results-header span {
          color: var(--text-secondary, #64748b);
          font-size: 14px;
        }

        .student-documentation-page__grid {
          display: grid;
          grid-template-columns: repeat(
            auto-fit,
            minmax(min(100%, 320px), 1fr)
          );
          gap: 16px;
        }

        .student-documentation-page__card {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 16px;
          min-width: 0;
          padding: 20px;
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 16px;
          background: var(--surface, #fff);
          box-shadow: 0 4px 18px rgba(15, 23, 42, .04);
        }

        .student-documentation-page__card--locked {
          border-color: #e2e8f0;
          background: var(--surface, #fff);
        }

        .student-documentation-page__card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .student-documentation-page__file-icon {
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          width: 48px;
          height: 48px;
          border-radius: 13px;
          background: var(--surface-secondary, #eef2ff);
          color: var(--primary, #4f46e5);
        }

        .student-documentation-page__file-icon--locked {
          background: #f1f5f9;
          color: #64748b;
        }

        .student-documentation-page__access-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 9px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }

        .student-documentation-page__access-badge--unlocked {
          background: #dcfce7;
          color: #166534;
        }

        .student-documentation-page__access-badge--locked {
          background: #fef3c7;
          color: #92400e;
        }

        .student-documentation-page__card-content {
          width: 100%;
          flex: 1;
          overflow-wrap: anywhere;
        }

        .student-documentation-page__metadata {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 10px;
          color: var(--text-secondary, #64748b);
          font-size: 12px;
        }

        .student-documentation-page__metadata span:first-child {
          padding: 3px 7px;
          border-radius: 6px;
          background: var(--surface-secondary, #f1f5f9);
          font-weight: 700;
        }

        .student-documentation-page__card h3 {
          margin: 0 0 8px;
          font-size: 17px;
          line-height: 1.4;
        }

        .student-documentation-page__description {
          margin: 0;
          color: var(--text-secondary, #64748b);
          font-size: 14px;
          line-height: 1.6;
        }

        .student-documentation-page__assignments {
          margin-top: 18px;
          padding: 13px;
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 11px;
          background: var(--surface-secondary, #f8fafc);
        }

        .student-documentation-page__assignments h4 {
          margin: 0 0 10px;
          font-size: 13px;
        }

        .student-documentation-page__assignment-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          padding: 7px 0;
          border-bottom: 1px solid var(--border-color, #e2e8f0);
          font-size: 12px;
        }

        .student-documentation-page__assignment-row:last-child {
          border-bottom: 0;
        }

        .student-documentation-page__assignment-row > span {
          flex: 0 0 auto;
          color: var(--text-secondary, #64748b);
        }

        .student-documentation-page__assignment-row strong {
          text-align: right;
          overflow-wrap: anywhere;
        }

        .student-documentation-page__access-message {
          margin: 14px 0 0;
          font-size: 13px;
          line-height: 1.5;
        }

        .student-documentation-page__access-message--unlocked {
          color: #166534;
        }

        .student-documentation-page__access-message--locked {
          color: #92400e;
        }

        .student-documentation-page__download {
          width: 100%;
          min-height: 42px;
        }

        .student-documentation-page__download--locked {
          background: #e2e8f0;
          color: #475569;
          cursor: not-allowed;
        }

        .student-documentation-page__empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          min-height: 220px;
          padding: 28px;
          border: 1px dashed var(--border-color, #cbd5e1);
          border-radius: 16px;
          color: var(--text-secondary, #64748b);
          text-align: center;
        }

        .student-documentation-page__empty h3,
        .student-documentation-page__empty p {
          margin: 0;
        }

        .student-documentation-page__empty h3 {
          color: var(--text-primary, #172033);
        }

        .student-documentation-page__message {
          margin-bottom: 18px;
          padding: 12px 14px;
          border-radius: 10px;
          background: #ecfdf5;
          color: #065f46;
        }

        .student-documentation-page__message--error {
          background: #fef2f2;
          color: #991b1b;
        }

        .student-documentation-page__spinner {
          animation: student-documentation-spin 1s linear infinite;
        }

        .student-documentation-page button:disabled {
          cursor: not-allowed;
          opacity: .6;
        }

        .student-documentation-page button:not(:disabled):hover {
          opacity: .9;
          transform: translateY(-1px);
        }

        @keyframes student-documentation-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 640px) {
          .student-documentation-page {
            padding: 18px 14px;
          }

          .student-documentation-page__header {
            flex-direction: column;
          }

          .student-documentation-page__refresh {
            align-self: flex-start;
          }

          .student-documentation-page__search {
            gap: 8px;
          }

          .student-documentation-page__search button {
            padding: 10px;
          }

          .student-documentation-page__card {
            padding: 16px;
          }
        }
      `}</style>
    </main>
    </div>
  );
}

export default StudentDocumentation;
