import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

const ToastContext = createContext(null);
const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };
const DURATION = 3000;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (type, message) => {
      if (!message) return;
      const id = ++idRef.current;
      setToasts((list) => [...list.slice(-3), { id, type, message }]);
      setTimeout(() => dismiss(id), DURATION);
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      success: (m) => push("success", m),
      error: (m) => push("error", m),
      info: (m) => push("info", m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          return (
            <div key={t.id} className={`toast toast--${t.type}`} role="status">
              <Icon size={18} aria-hidden="true" />
              <span className="toast__msg">{t.message}</span>
              <button type="button" className="toast__close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                <X size={14} />
              </button>
              <span className="toast__bar" style={{ animationDuration: `${DURATION}ms` }} />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

export function useToastOn(message, type, reset) {
  const toast = useToast();
  useEffect(() => {
    if (!message) return;
    toast[type](message);
    reset?.("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);
}
