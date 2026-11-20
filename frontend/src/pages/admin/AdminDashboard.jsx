import { useEffect, useState } from "react";
import {
  UsersRound,
  FolderKanban,
  GraduationCap,
  Layers,
  ShoppingCart,
  CheckCircle,
  Tags,
  FileText,
  Gift,
  GitBranch,
  Lightbulb,
  ArrowUpRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import apiClient from "../../api/client";

const statsConfig = [
  { key: "groups", label: "Total Groups", icon: UsersRound, color: "purple" },
  { key: "projects", label: "Standard Software", icon: FolderKanban, color: "blue" },
  { key: "mini_projects", label: "Small Software", icon: GraduationCap, color: "orange" },
  { key: "active_projects", label: "Active Software", icon: Layers, color: "teal" },
  { key: "orders", label: "Total Orders", icon: ShoppingCart, color: "blue" },
  { key: "pending_orders", label: "Pending Orders", icon: ShoppingCart, color: "orange" },
  { key: "partial_orders", label: "Partial Orders", icon: Layers, color: "blue" },
  { key: "complete_orders", label: "Complete Orders", icon: CheckCircle, color: "green" },
];

const quickLinks = [
  { label: "Users & Groups", description: "Manage users and groups", to: "/admin/users", icon: UsersRound },
  { label: "Orders", description: "Review purchases and payment status", to: "/admin/orders", icon: ShoppingCart },
  { label: "Categories", description: "Organize software categories", to: "/admin/categories", icon: Tags },
  { label: "Software", description: "Manage standard and Small Software", to: "/admin/projects", icon: FolderKanban },
  { label: "Software Stages", description: "Configure software access", to: "/admin/stages", icon: Layers },
  { label: "Documentation", description: "Manage software documents", to: "/admin/documentation", icon: FileText },
  { label: "Coupons", description: "Manage offers and discounts", to: "/admin/coupons", icon: Gift },
  { label: "Referrals", description: "Review referral activity", to: "/admin/referrals", icon: GitBranch },
  { label: "Ideas Inbox", description: "Review software ideas", to: "/admin/ideas", icon: Lightbulb },
];

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const recentOrders = stats?.recent_orders ?? [];

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const response = await apiClient.get("/admin/dashboard");

        if (!cancelled) {
          setStats(response.data?.data ?? null);

          if (!response.data?.data) {
            setError("Unexpected dashboard response.");
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.message ||
              "Unable to load dashboard statistics."
          );
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="admin-dashboard-page">
      <header className="admin-dashboard-header">
        <div>
          <span className="admin-dashboard-eyebrow">OVERVIEW</span>
          <h1>Dashboard</h1>
          <p>Monitor your software, groups and orders at a glance.</p>
        </div>
      </header>

      {error && (
        <div className="admin-dashboard-error" role="alert">
          {error}
        </div>
      )}

      <section
        className="admin-dashboard-stats"
        aria-label="Website statistics"
      >
        {statsConfig.map(({ key, label, icon: Icon, color }) => (
          <article className="admin-dashboard-stat" key={key}>
            <div className={`admin-dashboard-stat__icon ${color}`}>
              <Icon size={21} strokeWidth={2} />
            </div>

            <div className="admin-dashboard-stat__body">
              <p>{label}</p>
              <h2>
                {stats
                  ? Number(stats[key] ?? 0).toLocaleString("en-IN")
                  : "—"}
              </h2>
            </div>
          </article>
        ))}
      </section>

      <section className="admin-dashboard-section">
        <div className="admin-dashboard-section__heading">
          <div>
            <h2>Quick Access</h2>
            <p>Jump directly to a management section.</p>
          </div>
        </div>

        <div className="admin-dashboard-links">
          {quickLinks.map(({ label, description, to, icon: Icon }) => (
            <Link className="admin-dashboard-link" to={to} key={to}>
              <span className="admin-dashboard-link__icon">
                <Icon size={19} />
              </span>

              <span className="admin-dashboard-link__content">
                <strong>{label}</strong>
                <small>{description}</small>
              </span>

              <ArrowUpRight
                size={17}
                className="admin-dashboard-link__arrow"
              />
            </Link>
          ))}
        </div>
      </section>

  <section className="admin-dashboard-section admin-dashboard-recent-orders">
    <div className="admin-dashboard-section__heading">
      <div>
        <h2>Recent Orders</h2>
        <p>Latest five orders and their current status.</p>
      </div>
    </div>

    {recentOrders.length === 0 ? (
      <p>No recent orders available.</p>
    ) : (
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Software</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {recentOrders.map((order) => (
              <tr key={order.id}>
                <td>
                  <strong>{order.student_name || "Unknown"}</strong>
                  <br />
                  <small>{order.student_email || "—"}</small>
                </td>
                <td>{order.project_name || "Unknown software"}</td>
                <td>
                  {Number(order.amount ?? 0).toLocaleString("en-IN", {
                    style: "currency",
                    currency: "INR",
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td>{order.status || "Unknown"}</td>
                <td>
                  {order.created_at
                    ? new Date(order.created_at).toLocaleDateString("en-IN")
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
</div>
);
}

export default AdminDashboard;
