import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, BadgeCheck, Check, CheckCircle2, Eye, FileText, Lightbulb, MessageCircle, RefreshCw, Send, Sparkles, Type, Upload, X } from "lucide-react";
import apiClient from "../api/client";
import StudentHeader from "../components/student/StudentHeader";
import { useToastOn } from "../components/Toast";

function StudentIdeas() {
  const [form, setForm] = useState({
    title: "",
    description: "",
    whatsapp: "",
  });
  const [attachment, setAttachment] = useState(null);
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);

  useToastOn(error, "error", setError);

  const loadIdeas = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const response = await apiClient.get("/student/ideas");
      const payload = response?.data?.data ?? response?.data ?? [];
      setIdeas(Array.isArray(payload) ? payload : payload.data ?? []);
    } catch (err) {
      setLoadFailed(true);
      setError(err.response?.data?.message || "Unable to load your ideas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIdeas();
  }, [loadIdeas]);

  const handleChange = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (form.description.trim().length < 20) {
      setError("Description must contain at least 20 characters.");
      return;
    }

    if (!/^[+]?[0-9\s()-]{8,20}$/.test(form.whatsapp.trim())) {
      setError("Enter a valid WhatsApp contact number.");
      return;
    }

    if (attachment) {
      const allowed = /\.(pdf|doc|docx)$/i.test(attachment.name);
      if (!allowed) {
        setError("Only PDF, DOC, or DOCX files are allowed.");
        return;
      }
      if (attachment.size > 10 * 1024 * 1024) {
        setError("Attachment must be 10 MB or smaller.");
        return;
      }
    }

    const data = new FormData();
    data.append("title", form.title.trim());
    data.append("description", form.description.trim());
    data.append("whatsapp", form.whatsapp.trim());
    if (attachment) data.append("attachment", attachment);

    setSubmitting(true);
    try {
      const response = await apiClient.post("/student/ideas", data);
      setMessage(
        response?.data?.message || "Your idea was submitted successfully."
      );
      setForm({ title: "", description: "", whatsapp: "" });
      setAttachment(null);
      event.target.reset();
      await loadIdeas();
    } catch (err) {
      const validationErrors = err.response?.data?.errors;
      setError(
        validationErrors
          ? Object.values(validationErrors).flat().join(" ")
          : err.response?.data?.message || "Unable to submit your idea."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const statusLabel = {
    new: "Submitted",
    contacted: "Contacted",
    accepted: "Accepted",
    rejected: "Rejected",
  };

  const descLen = form.description.length;
  const descOk = form.description.trim().length >= 20;
  const titleOk = form.title.trim().length > 0;
  const phoneOk = /^[+]?[0-9\s()-]{8,20}$/.test(form.whatsapp.trim());
  const doneCount = [titleOk, descOk, phoneOk].filter(Boolean).length;
  const statusCounts = ideas.reduce((acc, idea) => {
    const key = idea.status || "new";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="student-page">
      <StudentHeader />
      <main className="container sx-page sxi">
        <section className="sx-hero">
          <span className="sx-hero__eyebrow">User innovation</span>
          <h1>Suggest Your Idea</h1>
          <p>Share your software concept with our team for review.</p>
        </section>

        <div className="sxi-layout">
          <section className="sxi-card sxi-form-card">
            <div className="sxi-head">
              <span className="sxi-head__icon"><Lightbulb size={22} aria-hidden="true" /></span>
              <div>
                <h2>Submit a software idea</h2>
                <p>Describe your idea clearly so our team can understand it.</p>
              </div>
              <span className={`sxi-done${doneCount === 3 ? " is-full" : ""}`}>
                {doneCount === 3 ? <Check size={13} aria-hidden="true" /> : null}
                {doneCount}/3 required
              </span>
            </div>
            <div className="sxi-stepbar" aria-hidden="true">
              <span style={{ width: `${(doneCount / 3) * 100}%` }} />
            </div>

            <form onSubmit={handleSubmit} className="sxi-form">
              <div className="sxi-body">
                <p className="sxi-tip">
                  <Sparkles size={15} aria-hidden="true" />
                  <span><b>Tip:</b> state the problem, list the main features, and attach a synopsis if you have one.</span>
                </p>

                {error && (
                  <div className="sxi-alert sxi-alert--error" role="alert">
                    <AlertTriangle size={16} aria-hidden="true" /> {error}
                  </div>
                )}
                {message && (
                  <div className="sxi-alert sxi-alert--success" role="status">
                    <CheckCircle2 size={16} aria-hidden="true" /> {message}
                  </div>
                )}

                <div className="sxi-sec">
                  <h3 className="sxi-sec__title"><span className="sxi-sec__n">1</span> Idea details</h3>

                  <label className="sxi-field">
                    <span className="sxi-label">Software idea title <i>*</i></span>
                    <span className="sxi-prefix sxi-prefix--r">
                      <Type size={17} aria-hidden="true" />
                      <input
                        className="sxi-input"
                        name="title"
                        value={form.title}
                        onChange={handleChange}
                        maxLength={255}
                        placeholder="Enter your software title"
                        required
                      />
                      {titleOk && <Check size={16} className="sxi-ok" aria-hidden="true" />}
                    </span>
                  </label>

                  <label className="sxi-field">
                    <span className="sxi-label">Software description / abstract <i>*</i></span>
                    <textarea
                      className="sxi-input sxi-textarea"
                      name="description"
                      value={form.description}
                      onChange={handleChange}
                      minLength={20}
                      maxLength={20000}
                      rows={6}
                      placeholder="Explain the problem, proposed solution, and main features..."
                      required
                    />
                    <span className="sxi-count">
                      <span className="sxi-meter">
                        <span
                          className={descOk ? "is-ok" : ""}
                          style={{ width: `${Math.min((descLen / 20) * 100, 100)}%` }}
                        />
                      </span>
                      <small className={descOk ? "is-ok" : ""}>
                        {descOk ? `${descLen} / 20000 characters` : `${20 - descLen} more characters needed`}
                      </small>
                    </span>
                  </label>
                </div>

                <div className="sxi-sec">
                  <h3 className="sxi-sec__title"><span className="sxi-sec__n">2</span> Contact &amp; attachment</h3>

                  <div className="sxi-row">
                    <label className="sxi-field">
                      <span className="sxi-label">WhatsApp contact number <i>*</i></span>
                      <span className="sxi-prefix sxi-prefix--r">
                        <MessageCircle size={17} aria-hidden="true" />
                        <input
                          className="sxi-input"
                          name="whatsapp"
                          value={form.whatsapp}
                          onChange={handleChange}
                          maxLength={20}
                          placeholder="Enter your WhatsApp number"
                          required
                        />
                        {phoneOk && <Check size={16} className="sxi-ok" aria-hidden="true" />}
                      </span>
                    </label>

                    <div className="sxi-field">
                      <span className="sxi-label">Synopsis attachment <em>optional</em></span>
                      <label className={`sxi-drop${attachment ? " has-file" : ""}`}>
                        <input
                          key={attachment ? attachment.name : "empty"}
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={(event) => setAttachment(event.target.files?.[0] || null)}
                        />
                        <span className="sxi-drop__icon">
                          {attachment ? <FileText size={19} aria-hidden="true" /> : <Upload size={19} aria-hidden="true" />}
                        </span>
                        <span className="sxi-drop__text">
                          <b>{attachment ? attachment.name : "Click to upload"}</b>
                          <small>
                            {attachment
                              ? `${(attachment.size / 1024 / 1024).toFixed(2)} MB`
                              : "PDF, DOC or DOCX · max 10 MB"}
                          </small>
                        </span>
                        {attachment && (
                          <button
                            type="button"
                            className="sxi-drop__remove"
                            aria-label="Remove file"
                            onClick={(e) => { e.preventDefault(); setAttachment(null); }}
                          >
                            <X size={15} aria-hidden="true" />
                          </button>
                        )}
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="sxi-foot">
                <p>
                  <BadgeCheck size={15} aria-hidden="true" />
                  Fields marked * are required. Track the review status on this page.
                </p>
                <button className="sxi-submit" type="submit" disabled={submitting}>
                  {submitting ? <RefreshCw size={17} className="sxi-spin" aria-hidden="true" /> : <Send size={17} aria-hidden="true" />}
                  {submitting ? "Submitting..." : "Submit Idea"}
                </button>
              </div>
            </form>
          </section>

          <aside className="sxi-side">
            <section className="sxi-card sxi-flowcard">
              <h2>How review works</h2>
              <ol className="sxi-flow">
                <li style={{ "--i": 0 }}>
                  <span className="sxi-flow__dot sxi-flow__dot--blue"><Send size={16} aria-hidden="true" /></span>
                  <div><b>Submitted</b><small>Your idea reaches our team.</small></div>
                </li>
                <li style={{ "--i": 1 }}>
                  <span className="sxi-flow__dot sxi-flow__dot--amber"><Eye size={16} aria-hidden="true" /></span>
                  <div><b>Contacted</b><small>We may reach out using your WhatsApp number.</small></div>
                </li>
                <li style={{ "--i": 2 }}>
                  <span className="sxi-flow__dot sxi-flow__dot--green"><BadgeCheck size={16} aria-hidden="true" /></span>
                  <div><b>Decision</b><small>Your idea is marked Accepted or Rejected.</small></div>
                </li>
              </ol>
            </section>

            <section className="sxi-card sxi-history">
              <div className="sxi-history__head">
                <div>
                  <h2>Your submitted ideas</h2>
                  <p>View the review status of your submissions.</p>
                </div>
                <button
                  type="button"
                  className="sxi-refresh"
                  onClick={loadIdeas}
                  disabled={loading}
                  aria-label="Refresh ideas"
                >
                  <RefreshCw size={16} className={loading ? "sxi-spin" : ""} aria-hidden="true" />
                </button>
              </div>

              {!loading && !loadFailed && ideas.length > 0 && (
                <div className="sxi-chips">
                  {Object.entries(statusCounts).map(([key, count]) => (
                    <span key={key} className={`sxi-pill sxi-pill--${key}`}>
                      {statusLabel[key] || key} · {count}
                    </span>
                  ))}
                </div>
              )}

              {loading ? (
                <div aria-busy="true">
                  {[0, 1].map((i) => <div key={i} className="skeleton sxi-skel" />)}
                </div>
              ) : loadFailed ? (
                <div className="sxi-empty">
                  <span><AlertTriangle size={22} aria-hidden="true" /></span>
                  <h3>Couldn't load your ideas</h3>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={loadIdeas}>Try again</button>
                </div>
              ) : ideas.length === 0 ? (
                <div className="sxi-empty">
                  <span><Lightbulb size={22} aria-hidden="true" /></span>
                  <h3>No ideas yet</h3>
                  <p>Your submissions and their review status will appear here.</p>
                </div>
              ) : (
                <ul className="sxi-list">
                  {ideas.map((idea, i) => (
                    <li className="sxi-item" key={idea.id} style={{ "--i": i }}>
                      <span className="sxi-item__icon"><Lightbulb size={18} aria-hidden="true" /></span>
                      <div className="sxi-item__body">
                        <strong>{idea.title}</strong>
                        <p>{idea.description}</p>
                        <small>
                          Submitted {idea.created_at ? new Date(idea.created_at).toLocaleDateString() : ""}
                        </small>
                      </div>
                      <span className={`sxi-pill sxi-pill--${idea.status || "new"}`}>
                        {statusLabel[idea.status] || "Submitted"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}

export default StudentIdeas;
