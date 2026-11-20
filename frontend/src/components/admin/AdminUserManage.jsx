import { useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Trash2, UsersRound, X } from "lucide-react";
import apiClient from "../../api/client";
import useDocumentScrollLock from "../../hooks/useDocumentScrollLock";

const errMsg = (e, fallback) => {
  const d = e?.response?.data;
  const first = d?.errors && Object.values(d.errors)[0];
  return (Array.isArray(first) && first[0]) || d?.message || fallback;
};

const USER_FIELDS = [
  ["name", "Name"], ["email", "Email"], ["mobile", "Mobile"],
];
const GROUP_FIELDS = [
  ["pincode", "Pincode"], ["whatsapp", "WhatsApp"],
  ["guide_name", "Main guide"], ["guide_mobile", "Main guide mobile"],
  ["second_guide_name", "Second guide"], ["second_guide_mobile", "Second guide mobile"],
];

export default function AdminUserManage({ user, onChanged, onDeleted, onFlash }) {
  const [mode, setMode] = useState(null); // "user" | "group"
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useDocumentScrollLock(Boolean(mode));

  const group = user.group;
  const fields = mode === "group" ? GROUP_FIELDS : USER_FIELDS;

  const openEdit = (type) => {
    const src = type === "group" ? group : user;
    const keys = (type === "group" ? GROUP_FIELDS : USER_FIELDS).map(([k]) => k);
    setForm(Object.fromEntries(keys.map((k) => [k, src?.[k] ?? ""])));
    setError("");
    setMode(type);
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const url = mode === "group" ? `/admin/groups/${group.id}` : `/admin/users/${user.id}`;
      await apiClient.put(url, form);
      setMode(null);
      onFlash?.(mode === "group" ? "Group updated." : "User updated.");
      onChanged?.();
    } catch (err) {
      setError(errMsg(err, "Unable to save changes."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (type) => {
    const msg = type === "group"
      ? `Delete Group #${group.id} and ALL its user accounts? This cannot be undone.`
      : `Delete ${user.name}? This cannot be undone.`;
    if (!window.confirm(msg)) return;
    try {
      await apiClient.delete(type === "group" ? `/admin/groups/${group.id}` : `/admin/users/${user.id}`);
      onDeleted?.();
    } catch (err) {
      onFlash?.(errMsg(err, "Unable to delete."), "error");
    }
  };

  return (
    <>
      <div className="manage-bar">
        <button type="button" className="manage-btn" onClick={() => openEdit("user")}>
          <Pencil size={15} /> Edit user
        </button>
        <button type="button" className="manage-btn manage-btn--danger" onClick={() => remove("user")}>
          <Trash2 size={15} /> Delete user
        </button>
        {group && (
          <>
            <button type="button" className="manage-btn" onClick={() => openEdit("group")}>
              <UsersRound size={15} /> Edit group
            </button>
            <button type="button" className="manage-btn manage-btn--danger" onClick={() => remove("group")}>
              <Trash2 size={15} /> Delete group
            </button>
          </>
        )}
      </div>

      {mode &&
        createPortal(
          <div className="manage-overlay ui-overlay" onMouseDown={() => setMode(null)}>
            <form
              className="manage-dialog ui-scroll-dialog"
              onSubmit={save}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <header>
                <h2>{mode === "group" ? `Edit Group #${group.id}` : "Edit user"}</h2>
                <button type="button" onClick={() => setMode(null)} aria-label="Close"><X size={18} /></button>
              </header>
              <div className="manage-dialog__body ui-scroll-dialog__body" data-scroll-lock-allow>
                {fields.map(([key, label]) => (
                  <label key={key} className="manage-field">
                    <span>{label}</span>
                    <input
                      value={form[key] ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    />
                  </label>
                ))}
                {error && <p className="manage-error">{error}</p>}
              </div>
              <footer>
                <button type="button" className="manage-btn" onClick={() => setMode(null)}>Cancel</button>
                <button type="submit" className="manage-btn manage-btn--primary" disabled={busy}>
                  {busy ? "Saving..." : "Save changes"}
                </button>
              </footer>
            </form>
          </div>,
          document.body,
        )}
    </>
  );
}
