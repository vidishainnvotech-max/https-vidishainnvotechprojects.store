import { useEffect, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Save,
  ShieldCheck,
} from "lucide-react";

import {
  getPaymentGatewaySettings,
  updatePaymentGatewaySettings,
} from "../../api/paymentGateway";
import "./admin-api-keys.css";

const EMPTY_FORM = {
  mode: "test",
  test_key_id: "",
  test_key_secret: "",
  live_key_id: "",
  live_key_secret: "",
};

function errorMessage(error) {
  const validation = error?.response?.data?.errors;
  if (validation) return Object.values(validation).flat()[0];
  return error?.response?.data?.message || "Unable to save Razorpay settings.";
}

function AdminApiKeys() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [gateway, setGateway] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [visible, setVisible] = useState({ test: false, live: false });

  useEffect(() => {
    let active = true;

    getPaymentGatewaySettings()
      .then((data) => {
        if (!active) return;
        const settings = data?.gateway;
        setGateway(settings);
        setForm((current) => ({
          ...current,
          mode: settings?.mode || "test",
          test_key_id: settings?.test?.key_id || "",
          live_key_id: settings?.live?.key_id || "",
        }));
      })
      .catch((requestError) => {
        if (active) setError(errorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const change = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setError("");
    setSuccess("");
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = { mode: form.mode };
      for (const field of ["test_key_id", "test_key_secret", "live_key_id", "live_key_secret"]) {
        if (form[field].trim()) payload[field] = form[field].trim();
      }

      const data = await updatePaymentGatewaySettings(payload);
      setGateway(data.gateway);
      setForm((current) => ({
        ...current,
        test_key_secret: "",
        live_key_secret: "",
      }));
      setSuccess(data.message || "Razorpay settings saved.");
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page api-keys-page">
      <header className="api-keys-head">
        <div>
          <span className="api-keys-eyebrow"><KeyRound size={15} /> Integrations</span>
          <h1>API Keys</h1>
          <p>Configure Razorpay checkout and choose which environment receives payments.</p>
        </div>
        <div className={`api-keys-status ${gateway?.configured ? "is-ready" : ""}`}>
          {gateway?.configured ? <CheckCircle2 size={18} /> : <CircleAlert size={18} />}
          <span>{gateway?.configured ? `${gateway.mode} mode ready` : "Setup required"}</span>
        </div>
      </header>

      {error && <div className="api-keys-alert is-error" role="alert">{error}</div>}
      {success && <div className="api-keys-alert is-success" role="status">{success}</div>}

      <form className="api-keys-panel" onSubmit={submit}>
        <div className="api-keys-panel__intro">
          <span className="api-keys-icon"><ShieldCheck size={22} /></span>
          <div>
            <h2>Razorpay payment gateway</h2>
            <p>Secrets are encrypted on the server and are never sent back to this page.</p>
          </div>
        </div>

        {loading ? (
          <div className="api-keys-loading">Loading gateway configuration…</div>
        ) : (
          <>
            <fieldset className="api-mode-picker">
              <legend>Active payment mode</legend>
              {[
                { value: "test", title: "Test mode", text: "Use Razorpay sandbox payments. No real money is charged." },
                { value: "live", title: "Live mode", text: "Accept real customer payments using your live account." },
              ].map((mode) => (
                <label key={mode.value} className={`api-mode-card ${form.mode === mode.value ? "is-active" : ""}`}>
                  <input type="radio" name="mode" value={mode.value} checked={form.mode === mode.value} onChange={change} />
                  <span className="api-mode-card__radio" />
                  <span>
                    <strong>{mode.title}</strong>
                    <small>{mode.text}</small>
                  </span>
                  <em className={gateway?.[mode.value]?.configured ? "is-ready" : ""}>
                    {gateway?.[mode.value]?.configured ? "Configured" : "Not configured"}
                  </em>
                </label>
              ))}
            </fieldset>

            {[
              { mode: "test", title: "Test credentials", prefix: "rzp_test_" },
              { mode: "live", title: "Live credentials", prefix: "rzp_live_" },
            ].map((section) => (
              <section key={section.mode} className={`api-credential-card ${form.mode === section.mode ? "is-active" : ""}`}>
                <div className="api-credential-card__head">
                  <div>
                    <h3>{section.title}</h3>
                    <p>{form.mode === section.mode ? "Currently selected for checkout" : "Saved for quick mode switching"}</p>
                  </div>
                  <span>{section.mode.toUpperCase()}</span>
                </div>

                <div className="api-field-grid">
                  <label className="api-field">
                    <span>Key ID</span>
                    <input
                      name={`${section.mode}_key_id`}
                      value={form[`${section.mode}_key_id`]}
                      onChange={change}
                      placeholder={`${section.prefix}xxxxxxxx`}
                      autoComplete="off"
                    />
                  </label>

                  <label className="api-field">
                    <span>Key secret</span>
                    <div className="api-secret-input">
                      <LockKeyhole size={17} />
                      <input
                        type={visible[section.mode] ? "text" : "password"}
                        name={`${section.mode}_key_secret`}
                        value={form[`${section.mode}_key_secret`]}
                        onChange={change}
                        placeholder={gateway?.[section.mode]?.key_secret_set ? "Saved — enter only to replace" : "Enter key secret"}
                        autoComplete="new-password"
                      />
                      <button type="button" onClick={() => setVisible((current) => ({ ...current, [section.mode]: !current[section.mode] }))} aria-label={`${visible[section.mode] ? "Hide" : "Show"} ${section.mode} secret`}>
                        {visible[section.mode] ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </label>
                </div>
              </section>
            ))}

            <div className="api-keys-actions">
              <p><LockKeyhole size={14} /> Existing secrets remain unchanged when the field is left blank.</p>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                <Save size={17} /> {saving ? "Saving…" : "Save gateway settings"}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

export default AdminApiKeys;
