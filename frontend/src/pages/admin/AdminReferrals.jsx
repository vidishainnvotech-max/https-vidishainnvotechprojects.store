import { useCallback, useEffect, useMemo, useState } from "react";
import { GitBranch, RefreshCw, Search, Users, Ticket, CheckCircle2, Clock3 } from "lucide-react";
import apiClient from "../../api/client";
import { useToastOn } from "../../components/Toast";

function extractItems(response, keys = []) {
  const payload = response?.data;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;

  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
    if (Array.isArray(payload?.data?.[key])) return payload.data[key];
  }
  return [];
}

function statusLabel(status) {
  const normalized = String(status || "pending").toLowerCase();
  return normalized === "qualified" ? "Qualified" : normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function getGroupLabel(referral, side) {
  const group = side === "referrer"
    ? referral.referrer_group || referral.referrerGroup
    : referral.referred_group || referral.referredGroup;

  const id = side === "referrer" ? referral.referrer_group_id : referral.referred_group_id;
  return group?.name || group?.group_name || (id ? `Group #${id}` : "—");
}

export default function AdminReferrals() {
  const [referrals, setReferrals] = useState([]);
  const [codes, setCodes] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  useToastOn(error, "error", setError);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const results = await Promise.allSettled([
        apiClient.get("/admin/referrals", { params: { per_page: 100 } }),
        apiClient.get("/admin/referral-codes", { params: { per_page: 100 } }),
        apiClient.get("/admin/referral-rewards", { params: { per_page: 100 } }),
      ]);

      const labels = ["referrals", "referral codes", "referral rewards"];
      const failed = results
        .map((result, index) => ({ result, label: labels[index] }))
        .filter(({ result }) => result.status === "rejected");

      if (results[0].status === "fulfilled") {
        setReferrals(extractItems(results[0].value, ["referrals"]));
      } else {
        setReferrals([]);
      }
      if (results[1].status === "fulfilled") {
        setCodes(extractItems(results[1].value, ["codes", "referral_codes"]));
      } else {
        setCodes([]);
      }
      if (results[2].status === "fulfilled") {
        setRewards(extractItems(results[2].value, ["rewards", "coupons"]));
      } else {
        setRewards([]);
      }

      if (failed.length) {
        setError(
          `Some referral data could not be loaded (${failed.map((item) => item.label).join(", ")}). ` +
          "Check the API response and admin permissions."
        );
      }
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load referral data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredReferrals = useMemo(() => {
    const term = search.trim().toLowerCase();
    return referrals.filter((referral) => {
      const status = String(referral.status || "pending").toLowerCase();
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      const referrer = getGroupLabel(referral, "referrer").toLowerCase();
      const referred = getGroupLabel(referral, "referred").toLowerCase();
      const code = String(referral.referral_code?.code || referral.referralCode?.code || referral.code || "").toLowerCase();
      const matchesSearch =
        !term ||
        referrer.includes(term) ||
        referred.includes(term) ||
        code.includes(term) ||
        String(referral.id ?? "").includes(term) ||
        status.includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [referrals, search, statusFilter]);

  const stats = useMemo(() => ({
    total: referrals.length,
    pending: referrals.filter((item) => String(item.status).toLowerCase() === "pending").length,
    qualified: referrals.filter((item) => String(item.status).toLowerCase() === "qualified").length,
    activeCodes: codes.filter((item) => Boolean(item.is_active)).length,
    rewards: rewards.length,
  }), [referrals, codes, rewards]);

  return (
    <div className="student-page">
    <main className="container admin-page admin-referrals">
      <header className="admin-header">
        <div>
          <span className="student-dashboard__eyebrow">Content management</span>
          <h1>Referrals</h1>
          <p className="admin-header__desc">
            Review referral attribution, qualification status, group codes, and reward coupons.
          </p>
        </div>
      </header>

        <section className="admin-summary-grid" aria-label="Summary">
          <SummaryCard icon={<GitBranch size={20} />} label="Total referrals" value={stats.total} />
          <SummaryCard icon={<Clock3 size={20} />} label="Pending" value={stats.pending} />
          <SummaryCard icon={<CheckCircle2 size={20} />} label="Qualified" value={stats.qualified} />
          <SummaryCard icon={<Users size={20} />} label="Active referral codes" value={stats.activeCodes} />
          <SummaryCard icon={<Ticket size={20} />} label="Reward coupons" value={stats.rewards} />
        </section>

        <section style={styles.panel}>
          <div style={styles.toolbar}>
            <div style={styles.searchBox}>
              <Search size={18} color="#64748b" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search group, referral code, ID, or status..."
                style={styles.searchInput}
              />
            </div>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={styles.filter}>
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="qualified">Qualified</option>
            </select>
            {lastUpdated && <span style={styles.updated}>Updated {lastUpdated.toLocaleTimeString()}</span>}
          </div>

          {loading ? (
            <p style={styles.message}>Loading referral data...</p>
          ) : filteredReferrals.length === 0 ? (
            <p style={styles.message}>
              {search.trim() || statusFilter !== "all"
                ? "No referrals match these filters."
                : "No referrals found yet. Referral records will appear after a group registers with a referral code."}
            </p>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>No.</th>
                    <th style={styles.th}>Referring group</th>
                    <th style={styles.th}>Referred group</th>
                    <th style={styles.th}>Code</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Qualified at</th>
                    <th style={styles.th}>Qualified order</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReferrals.map((referral, index) => {
                    const qualified = String(referral.status).toLowerCase() === "qualified";
                    const code = referral.referral_code?.code || referral.referralCode?.code || referral.code || "—";
                    return (
                      <tr key={referral.id}>
                        <td style={styles.td}>{index + 1}</td>
                        <td style={styles.td}>{getGroupLabel(referral, "referrer")}</td>
                        <td style={styles.td}>{getGroupLabel(referral, "referred")}</td>
                        <td style={styles.td}><code style={styles.code}>{code}</code></td>
                        <td style={styles.td}>
                          <span style={{ ...styles.badge, ...(qualified ? styles.qualifiedBadge : styles.pendingBadge) }}>
                            {statusLabel(referral.status)}
                          </span>
                        </td>
                        <td style={styles.td}>{formatDate(referral.qualified_at)}</td>
                        <td style={styles.td}>{referral.qualified_order_id ? `#${referral.qualified_order_id}` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="ref-lower">
          <section className="ref-card" style={styles.panel}>
            <div style={styles.panelHeader}>
              <h2 style={styles.panelTitle}>Group referral codes</h2>
              <span style={styles.counter}>{codes.length}</span>
            </div>
            {loading ? <p style={styles.message}>Loading codes...</p> : codes.length === 0 ? (
              <p style={styles.message}>No referral codes returned by the API.</p>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead><tr><th style={styles.th}>Code</th><th style={styles.th}>Group</th><th style={styles.th}>Status</th></tr></thead>
                  <tbody>
                    {codes.map((item) => (
                      <tr key={item.id}>
                        <td style={styles.td}><code style={styles.code}>{item.code || "—"}</code></td>
                        <td style={styles.td}>{item.group?.name || item.group?.group_name || (item.group_id ? `Group #${item.group_id}` : "—")}</td>
                        <td style={styles.td}>
                          <span style={{ ...styles.badge, ...(item.is_active ? styles.qualifiedBadge : styles.pendingBadge) }}>
                            {item.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="ref-card" style={styles.panel}>
            <div style={styles.panelHeader}>
              <h2 style={styles.panelTitle}>Referral reward coupons</h2>
              <span style={styles.counter}>{rewards.length}</span>
            </div>
            {loading ? <p style={styles.message}>Loading rewards...</p> : rewards.length === 0 ? (
              <p style={styles.message}>No referral rewards returned by the API.</p>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead><tr><th style={styles.th}>Coupon</th><th style={styles.th}>Group</th><th style={styles.th}>Discount</th><th style={styles.th}>Uses</th></tr></thead>
                  <tbody>
                    {rewards.map((item) => (
                      <tr key={item.id}>
                        <td style={styles.td}><code style={styles.code}>{item.code || "—"}</code></td>
                        <td style={styles.td}>{item.owner_group?.name || item.ownerGroup?.name || (item.owner_group_id ? `Group #${item.owner_group_id}` : "—")}</td>
                        <td style={styles.td}>{item.type === "percentage" ? `${Number(item.value)}%` : `₹${Number(item.value || 0).toFixed(2)}`}</td>
                        <td style={styles.td}>{item.used_count ?? 0}{item.max_uses != null ? ` / ${item.max_uses}` : " / ∞"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
    </main>
  </div>
  );
}

function SummaryCard({ icon, label, value }) {
  return (
    <article className="admin-summary-card">
      <div className="admin-summary-card__icon">{icon}</div>
      <div className="admin-summary-card__content">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

const styles = {
  page: { minHeight: "100vh", padding: "28px 20px", background: "#f5f7fb", color: "#172033" },
  container: { maxWidth: "1400px", margin: "0 auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "24px" },
  eyebrow: { margin: "0 0 7px", color: "#64748b", fontSize: "12px", fontWeight: 700, letterSpacing: "1.5px" },
  heading: { margin: "0 0 8px", fontSize: "clamp(25px, 4vw, 34px)", fontWeight: 750 },
  subtitle: { margin: 0, color: "#64748b", fontSize: "13px", lineHeight: 1.6 },
  secondaryButton: { display: "inline-flex", justifyContent: "center", alignItems: "center", gap: "8px", padding: "10px 13px", border: "1px solid #dbe2ea", borderRadius: "9px", background: "#fff", color: "#334155", cursor: "pointer" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))", gap: "14px", marginBottom: "20px" },
  summaryCard: { display: "flex", flexDirection: "column", gap: "10px", padding: "18px", border: "1px solid #e2e8f0", borderRadius: "13px", background: "#fff", color: "#4f46e5", fontSize: "13px" },
  panel: { minWidth: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: "15px", overflow: "hidden" },
  toolbar: { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", padding: "18px", borderBottom: "1px solid #e2e8f0" },
  searchBox: { display: "flex", alignItems: "center", gap: "10px", flex: "1 1 300px", maxWidth: "500px", padding: "10px 12px", border: "1px solid #dbe2ea", borderRadius: "9px" },
  searchInput: { width: "100%", border: "none", outline: "none", fontSize: "14px", background: "transparent" },
  filter: { padding: "10px 12px", border: "1px solid #dbe2ea", borderRadius: "9px", background: "#fff", color: "#334155" },
  updated: { marginLeft: "auto", color: "#64748b", fontSize: "12px" },
  tableWrap: { width: "100%", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px", minWidth: "720px" },
  th: { padding: "14px 16px", background: "#f8fafc", color: "#64748b", fontWeight: 650, whiteSpace: "nowrap" },
  td: { padding: "14px 16px", borderTop: "1px solid #eef2f7", verticalAlign: "middle" },
  code: { display: "inline-block", padding: "4px 7px", borderRadius: "6px", background: "#f1f5f9", color: "#334155", fontSize: "12px" },
  badge: { display: "inline-block", padding: "5px 9px", borderRadius: "999px", fontSize: "11px", fontWeight: 700 },
  qualifiedBadge: { background: "#dcfce7", color: "#166534" },
  pendingBadge: { background: "#fef3c7", color: "#92400e" },
  message: { padding: "28px 20px", textAlign: "center", color: "#64748b", fontSize: "13px" },
  error: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "13px 16px", marginBottom: "16px", borderRadius: "9px", border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c" },
  dismissButton: { display: "inline-flex", border: "none", background: "transparent", color: "inherit", cursor: "pointer" },
  panelHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "17px 18px", borderBottom: "1px solid #e2e8f0" },
  panelTitle: { margin: 0, fontSize: "16px", fontWeight: 700, color: "#172033" },
  counter: { display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "28px", height: "28px", padding: "0 7px", borderRadius: "999px", background: "#eef2ff", color: "#4338ca", fontWeight: 700, fontSize: "12px" },
  lowerGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 430px), 1fr))", gap: "20px", marginTop: "20px" },
};

