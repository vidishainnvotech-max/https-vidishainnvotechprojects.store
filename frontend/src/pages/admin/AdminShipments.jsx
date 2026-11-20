import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle, CalendarDays, ExternalLink, History, PackageOpen,
  Pencil, RefreshCw, Search, Truck, X,
} from "lucide-react";

import apiClient from "../../api/client";
import useDocumentScrollLock from "../../hooks/useDocumentScrollLock";
import "../../styles/admin-shipments.css";

const STATUSES = ["pending", "packed", "shipped", "in_transit", "out_for_delivery", "delivered", "cancelled"];
const NEXT_STATUSES = {
  pending: ["packed", "cancelled"], packed: ["shipped", "cancelled"],
  shipped: ["in_transit", "cancelled"],
  in_transit: ["out_for_delivery", "delivered", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"], delivered: [], cancelled: [],
};
const PICKUP_NEXT_STATUSES = {
  pending: ["packed", "cancelled"],
  packed: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};
const DELIVERY_PARTNERS = ["Delhivery", "Blue Dart", "DTDC", "India Post", "Ecom Express", "Xpressbees", "Shadowfax"];
const SHIPPING_ACTIVE = ["shipped", "in_transit", "out_for_delivery", "delivered"];
const label = (value) => String(value || "pending").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const fulfillmentStatusLabel = (status, method) => {
  if (method !== "pickup") return label(status);
  return {
    pending: "Pickup requested",
    packed: "Ready for pickup",
    delivered: "Picked up",
    cancelled: "Pickup cancelled",
  }[status] || label(status);
};
const dateTime = (value) => value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
const dateOnly = (value) => value ? new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—";
const toDate = (value) => value ? String(value).slice(0, 10) : "";
const toDateTimeLocal = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function AdminShipments() {
  const [shipments, setShipments] = useState([]);
  const [filters, setFilters] = useState({ status: "", courier: "", order_status: "" });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadShipments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiClient.get("/admin/iot-shipments", {
        params: {
          ...(search ? { search } : {}), ...(filters.status ? { status: filters.status } : {}),
          ...(filters.courier ? { courier: filters.courier } : {}),
          ...(filters.order_status ? { order_status: filters.order_status } : {}), per_page: 100,
        },
      });
      const payload = response.data?.data;
      setShipments(Array.isArray(payload) ? payload : payload?.data || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load shipments.");
    } finally { setLoading(false); }
  }, [search, filters.status, filters.courier, filters.order_status]);

  useEffect(() => {
    const timer = window.setTimeout(loadShipments, 0);
    return () => window.clearTimeout(timer);
  }, [loadShipments]);

  const partnerOptions = useMemo(() => [...new Set([
    ...DELIVERY_PARTNERS, ...shipments.map((shipment) => shipment.courier_name).filter(Boolean),
  ])].sort(), [shipments]);

  const openManage = (shipment) => {
    setSelected(shipment);
    setForm({
      status: shipment.status || "pending", courier_name: shipment.courier_name || "",
      tracking_number: shipment.tracking_number || "", tracking_url: shipment.tracking_url || "",
      dispatched_at: toDateTimeLocal(shipment.dispatched_at),
      estimated_delivery_date: toDate(shipment.estimated_delivery_date),
      delivery_remarks: shipment.delivery_remarks || "",
    });
    setError("");
  };
  const updateForm = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const closeManage = useCallback(() => setSelected(null), []);

  const saveShipment = async (event) => {
    event.preventDefault();
    if (!selected || !form || saving) return;
    if (selected.delivery_method !== "pickup" && SHIPPING_ACTIVE.includes(form.status) && (!form.courier_name.trim() || !form.tracking_number.trim())) {
      setError("Delivery partner and AWB/tracking number are required once a shipment is shipped.");
      return;
    }
    setSaving(true); setError(""); setNotice("");
    try {
      const nullable = (value) => String(value || "").trim() || null;
      const response = await apiClient.patch(`/admin/iot-shipments/${selected.id}`, {
        status: form.status, courier_name: nullable(form.courier_name),
        tracking_number: nullable(form.tracking_number), tracking_url: nullable(form.tracking_url),
        dispatched_at: nullable(form.dispatched_at),
        estimated_delivery_date: nullable(form.estimated_delivery_date),
        delivery_remarks: nullable(form.delivery_remarks),
      });
      const updated = response.data?.data;
      setNotice(response.data?.message || "Shipment updated successfully.");
      if (updated) openManage(updated);
      await loadShipments();
    } catch (requestError) {
      const validation = requestError.response?.data?.errors;
      setError(requestError.response?.data?.message || (validation ? Object.values(validation).flat()[0] : null) || "Unable to update shipment.");
    } finally { setSaving(false); }
  };

  const availableStatuses = selected
    ? [...new Set([
        selected.status,
        ...((selected.delivery_method === "pickup" ? PICKUP_NEXT_STATUSES : NEXT_STATUSES)[selected.status] || []),
      ])]
    : STATUSES;

  return (
    <main className="admin-shipments-page">
      <header className="admin-shipments-header">
        <div><span className="admin-shipments-eyebrow">Fulfillment</span><h1>Shipment Management</h1><p>Manage physical IoT delivery separately from payment-driven order status.</p></div>
        <button type="button" className="admin-shipments-refresh-btn" onClick={loadShipments} disabled={loading}><RefreshCw size={16} /> Refresh</button>
      </header>
      {error && <div className="admin-shipments-alert" role="alert"><AlertCircle size={18} /><span>{error}</span></div>}
      {notice && <div className="admin-shipments-notice" role="status">{notice}</div>}

      <section className="admin-shipments-toolbar" aria-label="Shipment filters">
        <label className="admin-shipments-search"><Search size={18} /><input type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search shipment, order, customer, software or AWB" aria-label="Search shipments" /></label>
        <Filter labelText="Shipment" value={filters.status} onChange={(value) => setFilters((current) => ({ ...current, status: value }))} options={STATUSES} />
        <Filter labelText="Order" value={filters.order_status} onChange={(value) => setFilters((current) => ({ ...current, order_status: value }))} options={["pending", "partial", "complete"]} />
        <Filter labelText="Partner" value={filters.courier} onChange={(value) => setFilters((current) => ({ ...current, courier: value }))} options={partnerOptions} raw />
      </section>

      <section className="admin-shipments-card">
        <div className="admin-shipments-card__header"><div className="admin-shipments-card__title"><span className="admin-shipments-card__icon"><Truck size={20} /></span><div><h2>All shipments</h2><p>{loading ? "Loading shipment records…" : `${shipments.length} shipment${shipments.length === 1 ? "" : "s"}`}</p></div></div></div>
        {loading ? <div className="admin-shipments-state"><span className="admin-shipments-spinner" /><p>Loading shipments…</p></div> : shipments.length === 0 ? (
          <div className="admin-shipments-state"><PackageOpen size={30} /><h3>No shipments found</h3><p>Physical IoT shipments will appear here automatically when orders are created.</p></div>
        ) : <ShipmentTable shipments={shipments} onManage={openManage} />}
      </section>

      {selected && form && <ShipmentDrawer
        selected={selected} form={form} saving={saving} statuses={availableStatuses}
        onChange={updateForm} onSave={saveShipment} onClose={closeManage}
      />}
    </main>
  );
}

function Filter({ labelText, value, onChange, options, raw = false }) {
  return <label className="admin-shipments-status-filter"><span>{labelText}</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="">All</option>{options.map((item) => <option key={item} value={item}>{raw ? item : label(item)}</option>)}</select></label>;
}

function ShipmentTable({ shipments, onManage }) {
  return <div className="admin-shipments-table-wrap"><table className="admin-shipments-table"><thead><tr><th>Shipment / Order</th><th>Customer / Software</th><th>Order status</th><th>Shipment status</th><th>Partner / AWB</th><th>Estimated delivery</th><th>Action</th></tr></thead><tbody>
    {shipments.map((shipment) => <tr key={shipment.id}>
      <td data-label="Shipment / Order"><strong className="admin-shipments-id">{shipment.shipment_number || `SHP-${shipment.id}`}</strong><span className="admin-shipments-subline">Order #{shipment.order_id} · Qty {shipment.quantity || 1}</span><span className="admin-shipments-subline">{shipment.delivery_method === "pickup" ? "Office pickup" : "Home delivery"} · {dateTime(shipment.created_at)}</span></td>
      <td data-label="Customer / Software"><div className="admin-shipments-student"><strong>{shipment.recipient_name || shipment.user?.name}</strong><span>{shipment.recipient_phone || shipment.user?.mobile}</span><span>{shipment.user?.email}</span><span className="admin-shipments-project">{shipment.project?.title}</span></div></td>
      <td data-label="Order status"><span className={`admin-order-status is-${shipment.order?.status}`}>{label(shipment.order?.status)}</span><small className="admin-shipments-readonly">Payment-driven</small></td>
      <td data-label="Shipment status"><span className={`admin-shipments-status admin-shipments-status--${String(shipment.status).replaceAll("_", "-")}`}>{fulfillmentStatusLabel(shipment.status, shipment.delivery_method)}</span></td>
      <td data-label="Partner / AWB">{shipment.delivery_method === "pickup" ? <div className="admin-shipments-student"><strong>Office pickup</strong><span>Courier and AWB not required</span></div> : <div className="admin-shipments-student"><strong>{shipment.courier_name || "Not assigned"}</strong><span>{shipment.tracking_number || "AWB pending"}</span>{shipment.tracking_url && <a href={shipment.tracking_url} target="_blank" rel="noreferrer">Open tracking <ExternalLink size={12} /></a>}</div>}</td>
      <td data-label="Estimated delivery">{shipment.delivery_method === "pickup" ? `Pickup: ${dateOnly(shipment.estimated_delivery_date)}` : dateOnly(shipment.estimated_delivery_date)}</td>
      <td data-label="Action"><button type="button" className="admin-shipments-action-btn" onClick={() => onManage(shipment)}><Pencil size={14} /> Manage</button></td>
    </tr>)}
  </tbody></table></div>;
}

function ShipmentDrawer({ selected, form, saving, statuses, onChange, onSave, onClose }) {
  const closeButtonRef = useRef(null);
  useDocumentScrollLock(true);

  useEffect(() => {
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(<div className="admin-shipment-drawer-backdrop ui-overlay" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="admin-shipment-drawer ui-scroll-dialog" role="dialog" aria-modal="true" aria-labelledby="manage-shipment-title">
    <header><div><span>{selected.shipment_number || `Shipment #${selected.id}`}</span><h2 id="manage-shipment-title">{selected.delivery_method === "pickup" ? "Manage office pickup" : "Manage shipment"}</h2><p>Order #{selected.order_id} · {selected.project?.title}</p></div><button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close shipment modal" title="Close"><X size={20} /></button></header>
    <div className="admin-shipment-drawer__body ui-scroll-dialog__body" data-scroll-lock-allow>
    <div className="admin-shipment-drawer__order"><div><span>Order status</span><strong>{label(selected.order?.status)}</strong><small>Updated automatically from payments</small></div><div><span>{selected.delivery_method === "pickup" ? "Pickup customer" : "Delivery customer"}</span><strong>{selected.recipient_name}</strong><small>{selected.recipient_phone}</small></div></div>
    <div className={`admin-shipment-method is-${selected.delivery_method}`}>
      {selected.delivery_method === "pickup" ? <PackageOpen size={20} /> : <Truck size={20} />}
      <div><strong>{selected.delivery_method === "pickup" ? "Office pickup selected" : "Home delivery selected"}</strong><span>{selected.delivery_method === "pickup" ? "Courier, AWB and dispatch details are not required. Mark Ready for pickup when the kit is packed." : "Choose or type a delivery partner, enter AWB details, then mark the order Shipped."}</span></div>
    </div>
    <form onSubmit={onSave}>
      <label>{selected.delivery_method === "pickup" ? "Pickup status" : "Shipment status"}<select name="status" value={form.status} onChange={onChange} required>{statuses.map((item) => <option key={item} value={item}>{fulfillmentStatusLabel(item, selected.delivery_method)}</option>)}</select></label>
      {selected.delivery_method !== "pickup" && <div className="admin-shipment-form-heading"><strong>Delivery service details</strong><span>Required when shipment status is Shipped or later.</span></div>}
      {selected.delivery_method !== "pickup" && <label>Delivery partner<input name="courier_name" list="delivery-partners" value={form.courier_name} onChange={onChange} required={SHIPPING_ACTIVE.includes(form.status)} placeholder="Select or enter delivery partner" /><datalist id="delivery-partners">{DELIVERY_PARTNERS.map((item) => <option key={item} value={item} />)}</datalist></label>}
      {selected.delivery_method !== "pickup" && <label>AWB / tracking number<input name="tracking_number" value={form.tracking_number} onChange={onChange} required={SHIPPING_ACTIVE.includes(form.status)} maxLength={150} /></label>}
      {selected.delivery_method !== "pickup" && <label>Tracking URL<input name="tracking_url" type="url" value={form.tracking_url} onChange={onChange} placeholder="https://…" maxLength={2048} /></label>}
      <div className="admin-shipment-drawer__grid">{selected.delivery_method !== "pickup" && <label>Dispatch date &amp; time<input name="dispatched_at" type="datetime-local" value={form.dispatched_at} onChange={onChange} /></label>}<label>{selected.delivery_method === "pickup" ? "Estimated pickup date" : "Estimated delivery"}<input name="estimated_delivery_date" type="date" value={form.estimated_delivery_date} onChange={onChange} /></label></div>
      <label>Delivery remarks<textarea name="delivery_remarks" value={form.delivery_remarks} onChange={onChange} rows={4} maxLength={2000} placeholder="Add delivery notes visible to the customer" /></label>
      {((selected.delivery_method === "delivery" && form.status === "shipped") || (selected.delivery_method === "pickup" && form.status === "packed")) && <div className="admin-shipment-email-note">An email update will be sent to {selected.user?.email || "the customer"} after saving.</div>}
      <button type="submit" className="admin-shipment-save" disabled={saving}>{saving ? "Saving…" : "Save shipment update"}</button>
    </form>
    <section className="admin-shipment-history"><h3><History size={17} /> Shipment history</h3>{selected.events?.length ? <ol>{[...selected.events].reverse().map((event) => <li key={event.id}><span /><div><strong>{event.title || fulfillmentStatusLabel(event.status, selected.delivery_method)}</strong><time><CalendarDays size={12} /> {dateTime(event.occurred_at)}</time>{event.description && <p>{event.description}</p>}{event.updated_by && <small>Updated by {event.updated_by.name}</small>}</div></li>)}</ol> : <p>No history events yet.</p>}</section>
    </div>
  </aside></div>, document.body);
}

export default AdminShipments;
