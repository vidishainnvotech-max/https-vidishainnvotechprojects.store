import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  Lightbulb,
  Eye,
  Download,
  Save,
  X,
  Sparkles,
} from "lucide-react";

import apiClient from "../../api/client";
import { useToast } from "../../components/Toast";
import "./admin-ideas-modal.css";

const STATUSES = ["new", "contacted", "accepted", "rejected"];

const getMessage = (err, fallback) => {
  const errors = err.response?.data?.errors;
  const first = errors ? Object.values(errors).flat()[0] : null;
  return first || err.response?.data?.message || fallback;
};

const capitalize = (value) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : "";

function AdminIdeas() {
  const toast = useToast();

  const [ideas, setIdeas] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [openingId, setOpeningId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");
  const [newStatus, setNewStatus] = useState("new");

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadIdeas = useCallback(async () => {
    setLoading(true);

    try {
      const params = {};
      if (status) params.status = status;

      const response = await apiClient.get("/admin/ideas", { params });
      const payload = response?.data?.data ?? response?.data;
      setIdeas(Array.isArray(payload) ? payload : payload?.data ?? []);
    } catch (err) {
      setIdeas([]);
      toast.error(getMessage(err, "Unable to load ideas."));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    loadIdeas();
  }, [loadIdeas]);

  const filteredIdeas = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return ideas;
    return ideas.filter((idea) =>
      [
        idea.title,
        idea.description,
        idea.whatsapp,
        idea.user?.name,
        idea.user?.email,
        idea.user?.mobile,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [ideas, search]);

  useEffect(() => {
    if (!selected) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setSelected(null);
    };
    document.addEventListener("keydown", onKey);

    const html = document.documentElement;
    const prevHtml = html.style.overflow;
    const prevBody = document.body.style.overflow;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      html.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, [selected]);

  const openIdea = async (id) => {
    setOpeningId(id);

    try {
      const response = await apiClient.get(`/admin/ideas/${id}`);
      const idea = response?.data?.idea ?? response?.data;
      setSelected(idea);
      setNotes(idea.admin_notes ?? "");
      setNewStatus(idea.status ?? "new");
    } catch (err) {
      toast.error(getMessage(err, "Unable to load idea details."));
    } finally {
      setOpeningId(null);
    }
  };

  const saveReview = async () => {
    if (!selected) return;

    setSaving(true);

    try {
      const response = await apiClient.patch(`/admin/ideas/${selected.id}`, {
        status: newStatus,
        admin_notes: notes,
      });

      const updated = response?.data?.idea;
      if (updated) setSelected(updated);

      toast.success(response?.data?.message || "Review saved successfully.");
      await loadIdeas();
    } catch (err) {
      toast.error(getMessage(err, "Unable to save review."));
    } finally {
      setSaving(false);
    }
  };

  const downloadAttachment = async (id, title) => {
    try {
      const response = await apiClient.get(`/admin/ideas/${id}/attachment`, {
        responseType: "blob",
      });

      const blobUrl = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${(title || "idea-attachment").replace(/[^a-z0-9-_]/gi, "_")}-attachment`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      toast.error(getMessage(err, "Unable to download attachment."));
    }
  };

  const newCount = ideas.filter((idea) => idea.status === "new").length;
  const hasFilters = Boolean(search || status);

  return (
    <div className="student-page">
      <main className="container admin-page">
        <header className="admin-header">
          <div>
            <span className="student-dashboard__eyebrow">Admin</span>
            <h1>Ideas Inbox</h1>
            <p className="admin-header__desc">
              Review software ideas, contact users and record decisions.
            </p>
          </div>

          <div className="admin-users-toolbar">
            <div className="admin-search">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                placeholder="Search title, user or email"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                aria-label="Search ideas"
              />
            </div>

            <select
              className="admin-ideas-filter"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {STATUSES.map((item) => (
                <option key={item} value={item}>
                  {capitalize(item)}
                </option>
              ))}
            </select>
          </div>
        </header>

        <section className="admin-summary-grid" aria-label="Summary">
          <article className="admin-summary-card">
            <div className="admin-summary-card__icon">
              <Lightbulb size={20} aria-hidden="true" />
            </div>
            <div className="admin-summary-card__content">
              <span>Total ideas</span>
              <strong>{ideas.length}</strong>
            </div>
          </article>

          <article className="admin-summary-card">
            <div className="admin-summary-card__icon">
              <Sparkles size={20} aria-hidden="true" />
            </div>
            <div className="admin-summary-card__content">
              <span>New ideas</span>
              <strong>{newCount}</strong>
            </div>
          </article>
        </section>

        {loading && (
          <div aria-busy="true" style={{ display: "grid", gap: 10 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton" style={{ height: 52 }} />
            ))}
          </div>
        )}

        {!loading && filteredIdeas.length === 0 && (
          <div className="empty-state">
            <span className="empty-state__icon">
              <Lightbulb size={24} aria-hidden="true" />
            </span>
            <h3>{hasFilters ? "No matching ideas" : "No ideas yet"}</h3>
            <p>
              {hasFilters
                ? "Nothing matches your filters. Try a different search or status."
                : "User software ideas will appear here."}
            </p>
            {hasFilters && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSearchInput("");
                  setStatus("");
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {!loading && filteredIdeas.length > 0 && (
          <>
            <div className="admin-result-count" role="status">
              {filteredIdeas.length} {filteredIdeas.length === 1 ? "idea" : "ideas"}
              {search ? ` · matching "${search}"` : ""}
              {status ? ` · ${status}` : ""}
            </div>

            <div className="admin-table-wrap admin-ideas-wrap">
              <table className="admin-table admin-users-table admin-ideas-table">
                <colgroup>
                  <col style={{ width: "30%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: 130 }} />
                </colgroup>

                <thead>
                  <tr>
                    <th>Software idea</th>
                    <th>User</th>
                    <th>Email</th>
                    <th>WhatsApp</th>
                    <th>Submitted</th>
                      <th className="admin-ideas-actioncol">
                        <span className="admin-visually-hidden">Actions</span>
                      </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredIdeas.map((idea) => (
                    <tr key={idea.id}>
                      <td data-label="Software idea" className="admin-ideas-title">
                        <strong title={idea.title}>{idea.title}</strong>
                      </td>

                      <td data-label="User">
                        <strong>{idea.user?.name || "—"}</strong>
                      </td>

                      <td data-label="Email" className="admin-ideas-email">
                        <span title={idea.user?.email || ""}>
                          {idea.user?.email || "—"}
                        </span>
                      </td>

                      <td data-label="WhatsApp">{idea.whatsapp || "—"}</td>

                      <td data-label="Submitted">
                        {idea.created_at
                          ? new Date(idea.created_at).toLocaleDateString()
                          : "—"}
                      </td>

                      <td data-label="Actions" className="admin-table__action">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={openingId === idea.id}
                          onClick={() => openIdea(idea.id)}
                        >
                          <Eye size={14} aria-hidden="true" />
                          {openingId === idea.id ? "Opening..." : "Review"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {selected &&
          createPortal(
            <div
              className="admin-ideas-overlay"
              onClick={() => setSelected(null)}
            >
              <section
                className="admin-ideas-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-ideas-modal-title"
                onClick={(event) => event.stopPropagation()}
              >
              <header className="admin-ideas-modal__header">
                <div>
                  <span className="student-dashboard__eyebrow">Idea review</span>
                  <h2 id="admin-ideas-modal-title">{selected.title}</h2>
                  <span className={`admin-ideas-pill admin-ideas-pill--${selected.status}`}>
                    {selected.status}
                  </span>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setSelected(null)}
                  aria-label="Close review"
                >
                  <X size={18} />
                </button>
              </header>

              <div className="admin-ideas-modal__body">
                <div className="admin-ideas-student">
                  <div>
                    <span>User</span>
                    <strong>{selected.user?.name || "User"}</strong>
                  </div>
                  <div>
                    <span>WhatsApp</span>
                    <strong>{selected.whatsapp || "—"}</strong>
                  </div>
                  <div className="is-wide">
                    <span>Email</span>
                    <strong>{selected.user?.email || "—"}</strong>
                  </div>
                </div>

                <div className="admin-ideas-block">
                  <h3>Software description</h3>
                  <p className="admin-ideas-description">
                    {selected.description}
                  </p>

                  {selected.attachment_available && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() =>
                        downloadAttachment(selected.id, selected.title)
                      }
                    >
                      <Download size={15} aria-hidden="true" /> Download synopsis
                    </button>
                  )}
                </div>

                <div className="admin-ideas-review-fields">
                  <div className="admin-ideas-field">
                    <label htmlFor="idea-status">Review status</label>
                    <select
                      id="idea-status"
                      value={newStatus}
                      onChange={(event) => setNewStatus(event.target.value)}
                    >
                      {STATUSES.map((item) => (
                        <option key={item} value={item}>
                          {capitalize(item)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="admin-ideas-field">
                    <label htmlFor="idea-notes">Private admin notes</label>
                    <textarea
                      id="idea-notes"
                      rows={4}
                      maxLength={10000}
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Internal review notes (not visible to users)"
                    />
                  </div>
                </div>

                {selected.reviewer && (
                  <p className="admin-ideas-reviewed">
                    Last reviewed by {selected.reviewer.name}
                    {selected.reviewed_at
                      ? ` on ${new Date(selected.reviewed_at).toLocaleString()}`
                      : ""}
                  </p>
                )}
              </div>

              <footer className="admin-ideas-modal__footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelected(null)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={saveReview}
                  disabled={saving}
                >
                  <Save size={16} aria-hidden="true" />
                  {saving ? "Saving..." : "Save review"}
                </button>
              </footer>
              </section>
            </div>,
            document.body
          )}
      </main>
    </div>
  );
}

export default AdminIdeas;