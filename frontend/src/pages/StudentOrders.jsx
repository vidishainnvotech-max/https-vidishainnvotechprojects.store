import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Box, Download, Eye, PackageSearch, RefreshCw, Truck } from "lucide-react";

import { saveBlob } from "../api/student";
import { downloadStudentInvoice, getStudentOrders } from "../api/studentOrders";
import StudentHeader from "../components/student/StudentHeader";
import "../styles/student-orders.css";

const money = (value) => Number(value || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" });
const dateTime = (value) => value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
const dateOnly = (value) => value ? new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—";
const label = (value) => String(value || "pending").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const shipmentLabel = (shipment) => shipment?.delivery_method === "pickup"
  ? ({ pending: "Pickup requested", packed: "Ready for pickup", delivered: "Picked up", cancelled: "Pickup cancelled" }[shipment.status] || label(shipment.status))
  : label(shipment?.status);

function StudentOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invoiceLoadingId, setInvoiceLoadingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getStudentOrders();
      const payload = response?.data;
      setOrders(Array.isArray(payload) ? payload : payload?.data || []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to load your orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const handleInvoiceDownload = async (orderId) => {
    try {
      setInvoiceLoadingId(orderId);
      setError("");
      const blob = await downloadStudentInvoice(orderId);
      saveBlob(blob, `invoice-order-${orderId}.pdf`);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to download this invoice.");
    } finally {
      setInvoiceLoadingId(null);
    }
  };

  return (
    <div className="student-page">
      <StudentHeader />
      <main className="container student-orders page-enter">
        <header className="student-orders__head">
          <div>
            <span>Purchases &amp; delivery</span>
            <h1>My Orders</h1>
            <p>Review payments and track physical IoT software deliveries.</p>
          </div>
          <div className="student-orders__actions">
            {!loading && <span className="student-orders__count">{orders.length} {orders.length === 1 ? "order" : "orders"}</span>}
            <button type="button" className="student-orders__refresh" onClick={load} disabled={loading}>
              <RefreshCw size={16} className={loading ? "is-spinning" : ""} /> Refresh
            </button>
          </div>
        </header>

        {error && <div className="student-orders__alert" role="alert">{error}</div>}
        {loading ? (
          <div className="student-orders__empty">Loading your orders…</div>
        ) : orders.length === 0 ? (
          <div className="student-orders__empty">
            <PackageSearch size={34} />
            <h2>No orders yet</h2>
            <p>Your software purchases will appear here.</p>
            <Link to="/projects" className="btn btn-primary">Browse software</Link>
          </div>
        ) : (
          <section className="student-order-grid" aria-label="Your orders">
            {orders.map((order) => (
              <article className="student-order-card" key={order.id}>
                <div className="student-order-card__top">
                  <span className="student-order-card__icon">
                    {order.shipment ? <Truck size={19} /> : <Box size={19} />}
                  </span>
                  <div>
                    <small>Order #{order.id}</small>
                    <h2>{order.project?.title || "Software order"}</h2>
                  </div>
                  <span className={`student-order-status is-${order.status}`}>{label(order.status)}</span>
                </div>
                <dl className="student-order-card__facts">
                  <div><dt>Ordered</dt><dd>{dateTime(order.created_at)}</dd></div>
                  <div><dt>Total</dt><dd>{money(order.total)}</dd></div>
                  <div className="is-delivery">
                    <dt>Delivery</dt>
                    <dd>
                      {order.shipment
                        ? `${order.shipment.delivery_method === "pickup" ? "Office pickup" : "Delivery"} · ${shipmentLabel(order.shipment)}`
                        : "Digital order"}
                    </dd>
                  </div>
                </dl>
                {order.shipment && (
                  <p className="student-order-card__shipment">
                    <span>Shipment {order.shipment.shipment_number || `#${order.shipment.id}`}</span>
                    {order.shipment.estimated_delivery_date && (
                      <span>
                        {order.shipment.delivery_method === "pickup" ? "Estimated pickup" : "Estimated delivery"}: {dateOnly(order.shipment.estimated_delivery_date)}
                      </span>
                    )}
                  </p>
                )}
                <div className="student-order-card__actions">
                  <Link to={`/student/orders/${order.id}`} className="student-order-card__link"><Eye size={16} /> View order details</Link>
                  <button type="button" className="student-order-card__invoice" onClick={() => handleInvoiceDownload(order.id)} disabled={invoiceLoadingId === order.id}>
                    <Download size={16} /> {invoiceLoadingId === order.id ? "Preparing..." : "Invoice"}
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

export default StudentOrders;
