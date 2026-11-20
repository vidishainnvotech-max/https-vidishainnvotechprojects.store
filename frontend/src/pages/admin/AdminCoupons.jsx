import { useCallback, useEffect, useState } from "react";
import {
  Search,
  Plus,
  Pencil,
  Ban,
  X,
  Tag,
  CheckCircle2,
  CircleOff,
  Gift,
} from "lucide-react";
import apiClient from "../../api/client";
import { useToastOn } from "../../components/Toast";

const emptyForm = {
  code: "",
  type: "percentage",
  value: "",
  scope: "site_wide",
  project_id: "",
  valid_from: "",
  valid_until: "",
  max_uses: "",
  is_active: true,
};

function getItems(response) {
  const payload = response?.data;

  // Supports Laravel paginator responses, resource collections, and plain arrays.
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.projects)) return payload.projects;
  if (Array.isArray(payload?.coupons)) return payload.coupons;

  return [];
}

function formatDate(value) {
  if (!value) return "No expiry";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function AdminCoupons() {
  const [coupons, setCoupons] = useState([]);
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useToastOn(error, "error", setError);
  useToastOn(success, "success", setSuccess);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [couponResponse, projectResponse] = await Promise.all([
        apiClient.get("/admin/coupons", {
          params: { per_page: 100 },
        }),
        apiClient.get("/projects"),
      ]);

      setCoupons(getItems(couponResponse));
      setProjects(getItems(projectResponse));
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load coupons. Check your admin access and try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateField = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const openCreate = () => {
    setEditingCoupon(null);
    setForm({ ...emptyForm });
    setError("");
    setSuccess("");
    setModalOpen(true);
  };

  const openEdit = (coupon) => {
    if (coupon.source === "referral_reward") {
      setError("Referral reward coupons cannot be edited here.");
      return;
    }

    setEditingCoupon(coupon);
    setForm({
      code: coupon.code ?? "",
      type: coupon.type ?? "percentage",
      value: String(coupon.value ?? ""),
      scope: coupon.scope ?? "site_wide",
      project_id: coupon.project_id ? String(coupon.project_id) : "",
      valid_from: coupon.valid_from
        ? String(coupon.valid_from).slice(0, 16)
        : "",
      valid_until: coupon.valid_until
        ? String(coupon.valid_until).slice(0, 16)
        : "",
      max_uses:
        coupon.max_uses === null || coupon.max_uses === undefined
          ? ""
          : String(coupon.max_uses),
      is_active: Boolean(coupon.is_active),
    });
    setError("");
    setSuccess("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingCoupon(null);
    setForm({ ...emptyForm });
  };

  const saveCoupon = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: Number(form.value),
      scope: form.scope,
      project_id:
        form.scope === "project" ? Number(form.project_id) : null,
      valid_from: form.valid_from || null,
      valid_until: form.valid_until || null,
      max_uses: form.max_uses === "" ? null : Number(form.max_uses),
      is_active: form.is_active,
    };

    try {
      if (editingCoupon) {
        await apiClient.patch(
          `/admin/coupons/${editingCoupon.id}`,
          payload
        );
        setSuccess("Coupon updated successfully.");
      } else {
        await apiClient.post("/admin/coupons", payload);
        setSuccess("Coupon created successfully.");
      }

      setModalOpen(false);
      setEditingCoupon(null);
      setForm({ ...emptyForm });
      await loadData();
    } catch (err) {
      const validationErrors = err.response?.data?.errors;
      const firstValidationMessage = validationErrors
        ? Object.values(validationErrors).flat()[0]
        : null;

      setError(
        firstValidationMessage ||
          err.response?.data?.message ||
          "Unable to save the coupon."
      );
    } finally {
      setSaving(false);
    }
  };

  const disableCoupon = async (coupon) => {
    if (coupon.source === "referral_reward") {
      setError("Referral reward coupons cannot be disabled here.");
      return;
    }

    if (!window.confirm(`Disable coupon "${coupon.code}"?`)) return;

    setError("");
    setSuccess("");

    try {
      await apiClient.delete(`/admin/coupons/${coupon.id}`);
      setSuccess(`Coupon ${coupon.code} has been disabled.`);
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to disable this coupon."
      );
    }
  };

  const filteredCoupons = coupons.filter((coupon) => {
    const term = search.trim().toLowerCase();
    const project = projects.find(
      (item) => Number(item.id) === Number(coupon.project_id)
    );
    const projectName = project?.title || project?.name || "";
    const status = coupon.is_active ? "active" : "inactive";
    const sourceLabel =
      coupon.source === "referral_reward" ? "referral reward" : "admin coupon";

    return (
      !term ||
      String(coupon.code ?? "").toLowerCase().includes(term) ||
      String(coupon.source ?? "").toLowerCase().includes(term) ||
      sourceLabel.includes(term) ||
      String(coupon.scope ?? "").toLowerCase().includes(term) ||
      String(projectName).toLowerCase().includes(term) ||
      status.includes(term)
    );
  });

  return (
    <div className="student-page">
    <main className="container admin-page admin-coupons">
      <header className="admin-header">
        <div>
          <span className="student-dashboard__eyebrow">Content management</span>
          <h1>Coupons</h1>
          <p className="admin-header__desc">
            Create promotional discounts and manage coupon validity.
          </p>
        </div>

        <button type="button" className="btn btn-primary" onClick={openCreate}>
          <Plus size={17} />
          Create coupon
        </button>
      </header>

        <section className="admin-summary-grid" aria-label="Summary">
          <article className="admin-summary-card">
            <div className="admin-summary-card__icon"><Tag size={20} /></div>
            <div className="admin-summary-card__content">
              <span>Total coupons</span>
              <strong>{coupons.length}</strong>
            </div>
          </article>
          <article className="admin-summary-card">
            <div className="admin-summary-card__icon"><CheckCircle2 size={20} /></div>
            <div className="admin-summary-card__content">
              <span>Active</span>
              <strong>{coupons.filter((coupon) => coupon.is_active).length}</strong>
            </div>
          </article>
          <article className="admin-summary-card">
            <div className="admin-summary-card__icon"><CircleOff size={20} /></div>
            <div className="admin-summary-card__content">
              <span>Inactive</span>
              <strong>{coupons.filter((coupon) => !coupon.is_active).length}</strong>
            </div>
          </article>
          <article className="admin-summary-card">
            <div className="admin-summary-card__icon"><Gift size={20} /></div>
            <div className="admin-summary-card__content">
              <span>Referral rewards</span>
              <strong>
                {coupons.filter((coupon) => coupon.source === "referral_reward").length}
              </strong>
            </div>
          </article>
        </section>

        <section style={styles.panel}>
          <div style={styles.toolbar}>
            <div className="coupon-search">
              <Search size={17} aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search coupons..."
              />
            </div>
          </div>

          {loading ? (
            <p style={styles.message}>Loading coupons...</p>
          ) : filteredCoupons.length === 0 ? (
            <p style={styles.message}>
              {search.trim()
                ? "No coupons match your search. Try another code, software, source, or status."
                : "No coupons found. Create a coupon to get started."}
            </p>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Coupon</th>
                    <th style={styles.th}>Discount</th>
                    <th style={styles.th}>Scope</th>
                    <th style={styles.th}>Usage</th>
                    <th style={styles.th}>Validity</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCoupons.map((coupon) => {
                    const isReward = coupon.source === "referral_reward";
                    const project = projects.find(
                      (item) => Number(item.id) === Number(coupon.project_id)
                    );

                    return (
                      <tr key={coupon.id}>
                        <td style={styles.td}>
                          <strong>{coupon.code}</strong>
                          <small style={styles.small}>
                            {isReward ? "Referral reward" : "Admin coupon"}
                          </small>
                        </td>
                        <td style={styles.td}>
                          {coupon.type === "percentage"
                            ? `${Number(coupon.value)}%`
                            : `₹${Number(coupon.value).toFixed(2)}`}
                        </td>
                        <td style={styles.td}>
                          {coupon.scope === "project"
                            ? project?.title || `Software #${coupon.project_id}`
                            : "Site-wide"}
                        </td>
                        <td style={styles.td}>
                          {coupon.used_count ?? 0}
                          {coupon.max_uses != null
                            ? ` / ${coupon.max_uses}`
                            : " / ∞"}
                        </td>
                        <td style={styles.td}>
                          {formatDate(coupon.valid_from)}
                          <small style={styles.small}>
                            Until {formatDate(coupon.valid_until)}
                          </small>
                        </td>
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.badge,
                              ...(coupon.is_active
                                ? styles.activeBadge
                                : styles.inactiveBadge),
                            }}
                          >
                            {coupon.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <div style={styles.actions}>
                            <button
                              type="button"
                              title={isReward ? "Referral rewards are protected" : "Edit coupon"}
                              style={{
                                ...styles.iconButton,
                                ...(isReward ? styles.disabledButton : {}),
                              }}
                              disabled={isReward}
                              onClick={() => openEdit(coupon)}
                            >
                              <Pencil size={16} />
                            </button>

                            {coupon.is_active && (
                              <button
                                type="button"
                                title={isReward ? "Referral rewards are protected" : "Disable coupon"}
                                style={{
                                  ...styles.iconButton,
                                  ...styles.dangerButton,
                                  ...(isReward ? styles.disabledButton : {}),
                                }}
                                disabled={isReward}
                                onClick={() => disableCoupon(coupon)}
                              >
                                <Ban size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

      {modalOpen && (
        <div style={styles.overlay}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="coupon-dialog-title"
            style={styles.modal}
          >
            <header style={styles.modalHeader}>
              <div>
                <h2 id="coupon-dialog-title" style={styles.modalTitle}>
                  {editingCoupon ? "Edit coupon" : "Create coupon"}
                </h2>
                <p style={styles.subtitle}>
                  Configure the discount and usage rules.
                </p>
              </div>
              <button
                type="button"
                style={styles.iconButton}
                onClick={closeModal}
                disabled={saving}
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </header>

            <form onSubmit={saveCoupon}>
              <div style={styles.formGrid}>
                <label style={styles.label}>
                  Coupon code
                  <input
                    name="code"
                    value={form.code}
                    onChange={updateField}
                    style={styles.input}
                    maxLength={50}
                    required
                    pattern="[A-Za-z0-9_-]+"
                    placeholder="WELCOME20"
                  />
                </label>

                <label style={styles.label}>
                  Discount type
                  <select
                    name="type"
                    value={form.type}
                    onChange={updateField}
                    style={styles.input}
                    required
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed amount (₹)</option>
                  </select>
                </label>

                <label style={styles.label}>
                  Discount value
                  <input
                    name="value"
                    type="number"
                    value={form.value}
                    onChange={updateField}
                    style={styles.input}
                    min="0.01"
                    max={form.type === "percentage" ? "100" : undefined}
                    step="0.01"
                    required
                  />
                </label>

                <label style={styles.label}>
                  Coupon scope
                  <select
                    name="scope"
                    value={form.scope}
                    onChange={updateField}
                    style={styles.input}
                    required
                  >
                    <option value="site_wide">Site-wide</option>
                    <option value="project">Specific software</option>
                  </select>
                </label>

                {form.scope === "project" && (
                  <label style={styles.label}>
                    Software
                    <select
                      name="project_id"
                      value={form.project_id}
                      onChange={updateField}
                      style={styles.input}
                      required
                    >
                      <option value="">Select a software</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.title || project.name || `Software #${project.id}`}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label style={styles.label}>
                  Valid from
                  <input
                    name="valid_from"
                    type="datetime-local"
                    value={form.valid_from}
                    onChange={updateField}
                    style={styles.input}
                  />
                </label>

                <label style={styles.label}>
                  Valid until
                  <input
                    name="valid_until"
                    type="datetime-local"
                    value={form.valid_until}
                    onChange={updateField}
                    style={styles.input}
                    min={form.valid_from || undefined}
                  />
                </label>

                <label style={styles.label}>
                  Maximum uses
                  <input
                    name="max_uses"
                    type="number"
                    value={form.max_uses}
                    onChange={updateField}
                    style={styles.input}
                    min="1"
                    step="1"
                    placeholder="Unlimited"
                  />
                </label>
              </div>

              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  name="is_active"
                  checked={form.is_active}
                  onChange={updateField}
                />
                Coupon is active
              </label>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={styles.primaryButton}
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingCoupon
                      ? "Save changes"
                      : "Create coupon"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "28px 20px",
    background: "#f5f7fb",
    color: "#172033",
  },
  container: {
    maxWidth: "1400px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "16px",
    marginBottom: "24px",
  },
  eyebrow: {
    margin: "0 0 7px",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "1.5px",
  },
  heading: {
    margin: "0 0 8px",
    fontSize: "clamp(25px, 4vw, 34px)",
    fontWeight: 750,
  },
  subtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  primaryButton: {
    display: "inline-flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "8px",
    padding: "11px 15px",
    border: "none",
    borderRadius: "9px",
    background: "#4f46e5",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },
  secondaryButton: {
    display: "inline-flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "8px",
    padding: "10px 13px",
    border: "1px solid #dbe2ea",
    borderRadius: "9px",
    background: "#fff",
    color: "#334155",
    cursor: "pointer",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "14px",
    marginBottom: "20px",
  },
  summaryCard: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "18px",
    border: "1px solid #e2e8f0",
    borderRadius: "13px",
    background: "#fff",
    color: "#4f46e5",
    fontSize: "13px",
  },
  panel: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "15px",
    overflow: "hidden",
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    padding: "18px",
    borderBottom: "1px solid #e2e8f0",
  },
  tableWrap: {
    width: "100%",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
    fontSize: "13px",
    minWidth: "900px",
  },
  small: {
    display: "block",
    color: "#64748b",
    fontSize: "11px",
    marginTop: "5px",
  },
  actions: {
    display: "flex",
    gap: "7px",
  },
  iconButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    background: "#fff",
    color: "#475569",
    cursor: "pointer",
  },
  dangerButton: {
    color: "#b91c1c",
    borderColor: "#fecaca",
  },
  disabledButton: {
    opacity: 0.4,
    cursor: "not-allowed",
  },
  message: {
    padding: "35px 20px",
    textAlign: "center",
    color: "#64748b",
  },
  error: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    padding: "13px 16px",
    marginBottom: "16px",
    borderRadius: "9px",
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#b91c1c",
  },
  success: {
    padding: "13px 16px",
    marginBottom: "16px",
    borderRadius: "9px",
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    color: "#166534",
  },
  dismissButton: {
    display: "inline-flex",
    border: "none",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "18px",
    background: "rgba(15, 23, 42, 0.55)",
    overflowY: "auto",
  },
  modal: {
    width: "100%",
    maxWidth: "700px",
    maxHeight: "90vh",
    overflowY: "auto",
    padding: "24px",
    borderRadius: "16px",
    background: "#fff",
    boxShadow: "0 24px 70px rgba(15, 23, 42, 0.2)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "15px",
    marginBottom: "24px",
  },
  modalTitle: {
    margin: "0 0 7px",
    fontSize: "22px",
    fontWeight: 750,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "17px",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    color: "#334155",
    fontSize: "13px",
    fontWeight: 600,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "#fff",
    color: "#172033",
    fontSize: "14px",
    fontWeight: 400,
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    marginTop: "20px",
    fontSize: "13px",
    color: "#334155",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    flexWrap: "wrap",
    marginTop: "25px",
    paddingTop: "18px",
    borderTop: "1px solid #e2e8f0",
  },
};

export default AdminCoupons;
