import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarDays, CheckCircle2, CreditCard, Download, ExternalLink, IndianRupee, MapPin, PackageCheck, ShoppingBag, Truck } from "lucide-react";

import { saveBlob } from "../api/student";
import { downloadStudentInvoice, getStudentOrder } from "../api/studentOrders";
import StudentHeader from "../components/student/StudentHeader";
import "../styles/student-orders.css";

const label = (value) => String(value || "pending").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const shipmentLabel = (shipment, status = shipment?.status) => shipment?.delivery_method === "pickup"
  ? ({ pending: "Pickup requested", packed: "Ready for pickup", delivered: "Picked up", cancelled: "Pickup cancelled" }[status] || label(status))
  : label(status);
const dateTime = (value) => value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
const dateOnly = (value) => value ? new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—";
const money = (value) => Number(value || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" });

function StudentOrderDetails() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await getStudentOrder(id);
        if (active) setOrder(response?.data || null);
      } catch (requestError) {
        if (active) setError(requestError?.response?.data?.message || "Unable to load this order.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    const timer = window.setInterval(load, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [id]);

  const shipment = order?.shipment;
  const events = shipment?.events || [];
  const isPickup = shipment?.delivery_method === "pickup";

  const handleInvoiceDownload = async () => {
    try {
      setInvoiceLoading(true);
      setError("");
      const blob = await downloadStudentInvoice(order.id);
      saveBlob(blob, `invoice-order-${order.id}.pdf`);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to download this invoice.");
    } finally {
      setInvoiceLoading(false);
    }
  };

  return (
    <div className="student-page">
      <StudentHeader />
      <main className="container student-order-detail page-enter">
        <Link to="/student/orders" className="student-order-detail__back"><ShoppingBag size={16} /> Back to My Orders</Link>
        {loading ? <div className="student-orders__empty">Loading order details…</div> : error ? (
          <div className="student-orders__alert" role="alert">{error}</div>
        ) : order && (
          <>
            <header className="student-order-detail__head">
              <div><span>Order #{order.id}</span><h1>{order.project?.title}</h1><p>Placed {dateTime(order.created_at)}</p></div>
              <div className="student-order-detail__actions">
                <span className={`student-order-status is-${order.status}`}>{label(order.status)}</span>
                <button type="button" className="student-order-detail__invoice" onClick={handleInvoiceDownload} disabled={invoiceLoading}><Download size={17} />{invoiceLoading ? "Preparing..." : "Download invoice"}</button>
              </div>
            </header>

            <section className="student-order-summary">
              <div><i><IndianRupee size={18} /></i><span>Order total</span><strong>{money(order.total)}</strong></div>
              <div><i><CreditCard size={18} /></i><span>Payment plan</span><strong>{order.plan?.name || "One-time"}</strong></div>
              <div><i><CheckCircle2 size={18} /></i><span>Successful payments</span><strong>{order.payments?.filter((payment) => payment.status === "success").length || 0}</strong></div>
            </section>

            <section className="student-payment-history">
              <div className="student-payment-history__head"><div><span>Transactions</span><h2>Payment history</h2></div><strong>{order.payments?.length || 0} payments</strong></div>
              {order.payments?.length ? (
                <div className="student-payment-history__list">
                  {order.payments.map((payment) => (
                    <article key={payment.id}>
                      <span>{payment.installment_no}</span>
                      <div><strong>Installment {payment.installment_no}</strong><time>{payment.paid_at ? dateTime(payment.paid_at) : "Not paid yet"}</time></div>
                      <b>{money(payment.amount)}</b>
                      <em className={`is-${payment.status}`}>{label(payment.status)}</em>
                    </article>
                  ))}
                </div>
              ) : <p className="student-payment-history__empty">No payments have been recorded for this order.</p>}
            </section>

            {!shipment ? (
              <section className="student-digital-order"><PackageCheck size={28} /><div><h2>Digital software delivery</h2><p>This order does not include a physical shipment. Your unlocked files are available in the software workspace.</p></div></section>
            ) : (
              <section className="student-shipment-card">
                <div className="student-shipment-card__head">
                  <div><span>{isPickup ? <PackageCheck size={17} /> : <Truck size={17} />} {isPickup ? "Office pickup" : "Physical shipment"}</span><h2>{shipment.shipment_number || `Shipment #${shipment.id}`}</h2></div>
                  <span className={`shipment-pill is-${shipment.status}`}>{shipmentLabel(shipment)}</span>
                </div>

                <div className="student-shipment-facts">
                  <div><span>Receiving method</span><strong>{isPickup ? "Office pickup" : "Home delivery"}</strong></div>
                  {!isPickup && <div><span>Delivery partner</span><strong>{shipment.courier_name || "To be assigned"}</strong></div>}
                  {!isPickup && <div><span>AWB / tracking number</span><strong>{shipment.tracking_number || "Not available yet"}</strong></div>}
                  <div>
                    <span>{isPickup ? "Estimated pickup date" : "Estimated delivery"}</span>
                    <strong>{dateOnly(shipment.estimated_delivery_date)}</strong>
                  </div>
                  <div><span>Quantity</span><strong>{shipment.quantity || 1}</strong></div>
                </div>

                {!isPickup && shipment.tracking_url && (
                  <a className="student-shipment-track" href={shipment.tracking_url} target="_blank" rel="noreferrer">Track on delivery partner website <ExternalLink size={15} /></a>
                )}

                <div className="student-shipment-address"><MapPin size={18} /><div><span>{isPickup ? "Pickup instructions" : "Delivery address"}</span><p>{isPickup ? "Collect from the Sal Software office after our team confirms that your kit is ready." : [shipment.shipping_address, shipment.city, shipment.state, shipment.postal_code, shipment.country].filter(Boolean).join(", ")}</p></div></div>

                {shipment.delivery_remarks && <div className="student-shipment-remarks"><strong>Delivery remarks</strong><p>{shipment.delivery_remarks}</p></div>}

                <div className="shipment-timeline">
                  <h3><CalendarDays size={17} /> Shipment history</h3>
                  {events.length === 0 ? <p>No tracking events yet.</p> : (
                    <ol>
                      {[...events].reverse().map((event, index) => (
                        <li key={event.id} className={index === 0 ? "is-current" : ""}>
                          <span className="shipment-timeline__dot" />
                          <div><strong>{event.title || shipmentLabel(shipment, event.status)}</strong><time>{dateTime(event.occurred_at)}</time>{event.description && <p>{event.description}</p>}</div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default StudentOrderDetails;
