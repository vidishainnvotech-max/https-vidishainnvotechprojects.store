import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  CalendarDays,
  Download,
  Eye,
  FileText,
  IndianRupee,
  Mail,
  Package,
  Search,
  ShoppingCart,
  UserRound,
  X,
} from "lucide-react";

import apiClient from "../../api/client";
import { downloadAdminInvoice, getAdminOrderDetails } from "../../api/orders";
import { saveBlob } from "../../api/student";
import useDocumentScrollLock from "../../hooks/useDocumentScrollLock";
import "../../styles/admin-orders.css";

const formatAmount = (amount) => Number(amount ?? 0).toLocaleString("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const formatDateTime = (value) => {
  if (!value) return "Not paid yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};

const getStatusClass = (value) => {
  const normalized = String(value || "pending").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `admin-orders-status admin-orders-status--${normalized}`;
};

function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [invoiceLoadingId, setInvoiceLoadingId] = useState(null);

  const closeOrderDetails = () => {
    setSelectedOrder(null);
    setDetailsError("");
    setDetailsLoading(false);
  };

  const openOrderDetails = async (orderId) => {
    try {
      setDetailsLoading(true);
      setDetailsError("");
      setSelectedOrder(null);
      const response = await getAdminOrderDetails(orderId);
      setSelectedOrder(response.data);
    } catch (requestError) {
      setDetailsError(requestError.response?.data?.message || "Unable to load order details.");
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleInvoiceDownload = async (orderId) => {
    try {
      setInvoiceLoadingId(orderId);
      setError("");
      const blob = await downloadAdminInvoice(orderId);
      saveBlob(blob, `invoice-order-${orderId}.pdf`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to download this invoice.");
    } finally {
      setInvoiceLoadingId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function loadOrders() {
      try {
        setLoading(true);
        setError("");
        const response = await apiClient.get("/admin/orders");
        const payload = response.data?.data;
        const orderList = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(response.data?.orders)
              ? response.data.orders
              : [];
        if (!cancelled) setOrders(orderList);
      } catch (requestError) {
        if (!cancelled) setError(requestError.response?.data?.message || "Unable to load orders. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadOrders();
    return () => { cancelled = true; };
  }, []);

  const modalOpen = detailsLoading || Boolean(detailsError) || Boolean(selectedOrder);
  useDocumentScrollLock(modalOpen);

  useEffect(() => {
    if (!modalOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeOrderDetails();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [modalOpen]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders.filter((order) => {
      const student = order.user || order.student || {};
      const project = order.project || {};
      const matchesSearch = !query || [order.id, student.name, student.email, project.title, project.name]
        .some((value) => String(value ?? "").toLowerCase().includes(query));
      const matchesStatus = !status || String(order.status ?? "").toLowerCase() === status.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [orders, search, status]);

  return (
    <main className="admin-orders-page">
      <header className="admin-orders-header">
        <div>
          <span className="admin-orders-eyebrow">Management</span>
          <h1>Orders</h1>
          <p>Review user purchases, payments and downloadable invoices.</p>
        </div>
      </header>

      {error && <div className="admin-orders-alert" role="alert"><AlertCircle size={18} /><span>{error}</span></div>}

      <section className="admin-orders-toolbar">
        <label className="admin-orders-search">
          <Search size={19} aria-hidden="true" />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order ID, user, email or software..." aria-label="Search orders" />
        </label>
        <label className="admin-orders-status-filter">
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter orders by status">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="complete">Complete</option>
          </select>
        </label>
      </section>

      <section className="admin-orders-card">
        <div className="admin-orders-card__header">
          <div className="admin-orders-card__title">
            <span className="admin-orders-card__icon"><ShoppingCart size={20} /></span>
            <div><h2>All Orders</h2><p>{loading ? "Loading order records..." : `${filteredOrders.length} of ${orders.length} orders`}</p></div>
          </div>
        </div>

        {loading ? (
          <div className="admin-orders-state"><span className="admin-orders-spinner" /><p>Loading orders...</p></div>
        ) : error && orders.length === 0 ? (
          <div className="admin-orders-state"><p>Orders could not be loaded.</p></div>
        ) : filteredOrders.length === 0 ? (
          <div className="admin-orders-state"><ShoppingCart size={30} /><h3>No orders found</h3><p>{search || status ? "Try changing your search or status filter." : "Orders will appear here when they are available."}</p></div>
        ) : (
          <div className="admin-orders-table-wrap">
            <table className="admin-orders-table">
              <thead><tr><th>Order</th><th>User</th><th>Software</th><th>Amount</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const student = order.user || order.student || {};
                  const project = order.project || {};
                  return (
                    <tr key={order.id}>
                      <td data-label="Order"><strong className="admin-orders-id">#{order.id}</strong></td>
                      <td data-label="User"><div className="admin-orders-student"><strong>{student.name || "Unknown user"}</strong><span>{student.email || "—"}</span></div></td>
                      <td data-label="Software"><span className="admin-orders-project">{project.title || project.name || "Software unavailable"}</span></td>
                      <td data-label="Amount">
                        <div className="admin-orders-price"><strong>{formatAmount(order.total)}</strong><span>Original {formatAmount(order.base_price)}{Number(order.discount_amount) > 0 ? ` · Saved ${formatAmount(order.discount_amount)}` : ""}</span></div>
                      </td>
                      <td data-label="Status"><span className={getStatusClass(order.status)}>{order.status || "pending"}</span></td>
                      <td data-label="Date"><span className="admin-orders-date">{formatDate(order.created_at || order.date)}</span></td>
                      <td data-label="Actions">
                        <div className="admin-orders-actions">
                          <button type="button" className="admin-orders-view-btn" onClick={() => openOrderDetails(order.id)}><Eye size={16} />View details</button>
                          <button type="button" className="admin-orders-invoice-btn" onClick={() => handleInvoiceDownload(order.id)} disabled={invoiceLoadingId === order.id}><Download size={16} />{invoiceLoadingId === order.id ? "Preparing..." : "Invoice"}</button>
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

      {modalOpen && createPortal(
        <div className="admin-orders-details-overlay ui-overlay" onMouseDown={closeOrderDetails}>
          <section className="admin-orders-details ui-scroll-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-order-details-title" onMouseDown={(event) => event.stopPropagation()}>
            <header className="admin-orders-details__header">
              <div className="admin-orders-details__title">
                <span><FileText size={20} /></span>
                <div><small>Purchase record</small><h2 id="admin-order-details-title">Order {selectedOrder ? `#${selectedOrder.id}` : "details"}</h2>{selectedOrder && <p>{selectedOrder.project?.title || "Software order"}</p>}</div>
              </div>
              <div className="admin-orders-details__header-actions">
                {selectedOrder && <button type="button" className="admin-orders-details__invoice" onClick={() => handleInvoiceDownload(selectedOrder.id)} disabled={invoiceLoadingId === selectedOrder.id}><Download size={17} /><span>{invoiceLoadingId === selectedOrder.id ? "Preparing" : "Invoice"}</span></button>}
                <button type="button" className="admin-orders-details__close" onClick={closeOrderDetails} aria-label="Close order details"><X size={20} /></button>
              </div>
            </header>

            <div className="admin-orders-details__body ui-scroll-dialog__body" data-scroll-lock-allow>
              {detailsLoading ? (
                <div className="admin-orders-modal-state"><span className="admin-orders-spinner" /><p>Loading order details...</p></div>
              ) : detailsError ? (
                <div className="admin-orders-alert" role="alert"><AlertCircle size={18} /><span>{detailsError}</span></div>
              ) : selectedOrder && (
                <>
                  <section className="admin-orders-detail-section">
                    <div className="admin-orders-detail-section__heading"><div><span>Order overview</span><h3>Customer and software</h3></div><span className={getStatusClass(selectedOrder.status)}>{selectedOrder.status}</span></div>
                    <div className="admin-orders-info-grid">
                      <div><i><UserRound size={18} /></i><span>User</span><strong>{selectedOrder.user?.name || "—"}</strong></div>
                      <div><i><Mail size={18} /></i><span>Email</span><strong>{selectedOrder.user?.email || "—"}</strong></div>
                      <div><i><Package size={18} /></i><span>Software</span><strong>{selectedOrder.project?.title || "—"}</strong></div>
                      <div><i><CalendarDays size={18} /></i><span>Ordered</span><strong>{formatDateTime(selectedOrder.created_at)}</strong></div>
                    </div>
                  </section>

                  <section className="admin-orders-detail-section">
                    <div className="admin-orders-detail-section__heading"><div><span>Billing</span><h3>Price breakdown</h3></div></div>
                    <div className="admin-orders-price-grid">
                      <div><span>Original price</span><strong>{formatAmount(selectedOrder.base_price)}</strong></div>
                      <div><span>Discount</span><strong>{formatAmount(selectedOrder.discount_amount)}</strong></div>
                      <div className="is-total"><i><IndianRupee size={18} /></i><span>Final amount</span><strong>{formatAmount(selectedOrder.total)}</strong></div>
                      <div><span>Coupon</span><strong>{selectedOrder.coupon?.code || "No coupon"}</strong></div>
                    </div>
                  </section>

                  <section className="admin-orders-detail-section">
                    <div className="admin-orders-detail-section__heading"><div><span>Transactions</span><h3>Payment history</h3></div><strong className="admin-orders-payment-count">{selectedOrder.payments?.length || 0} payments</strong></div>
                    {selectedOrder.payments?.length ? (
                      <div className="admin-orders-payments">
                        {selectedOrder.payments.map((payment) => (
                          <article key={payment.id} className="admin-orders-payment">
                            <span className="admin-orders-payment__number">{payment.installment_no}</span>
                            <div><strong>Installment {payment.installment_no}</strong><time>{formatDateTime(payment.paid_at)}</time></div>
                            <strong className="admin-orders-payment__amount">{formatAmount(payment.amount)}</strong>
                            <span className={`admin-orders-payment__status is-${payment.status}`}>{payment.status}</span>
                          </article>
                        ))}
                      </div>
                    ) : <div className="admin-orders-no-payments">No payments recorded for this order.</div>}
                  </section>
                </>
              )}
            </div>
          </section>
        </div>,
        document.body
      )}
    </main>
  );
}

export default AdminOrders;
