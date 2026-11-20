import { useCallback, useEffect, useState } from "react";
import apiClient from "../../api/client";
import { useToastOn } from "../../components/Toast";
import "./admin-documentation.css";

const ENDPOINT = "/admin/documentation-templates";

const initialForm = {
  title: "",
  description: "",
  college_id: "",
  group_id: "",
  project_id: "",
  stage_percent: "",
  bundle: "",
  file: null,
  is_active: true,
};

const styles = {
  page: {
    padding: "24px",
    maxWidth: "1400px",
    margin: "0 auto",
    color: "#172033",
  },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "22px",
    boxShadow: "0 2px 8px rgba(15, 23, 42, 0.03)",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "7px",
    minWidth: 0,
  },
  input: {
    padding: "11px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    width: "100%",
    boxSizing: "border-box",
    font: "inherit",
    background: "#fff",
    color: "#172033",
  },
  button: {
    padding: "10px 14px",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    cursor: "pointer",
    background: "#fff",
    color: "#172033",
    font: "inherit",
  },
  primary: {
    padding: "11px 16px",
    border: 0,
    borderRadius: "7px",
    cursor: "pointer",
    background: "#2457d6",
    color: "#fff",
    font: "inherit",
  },
  tableWrap: {
    overflowX: "auto",
    width: "100%",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
    minWidth: "950px",
  },
  cell: {
    padding: "12px 10px",
    borderBottom: "1px solid #e2e8f0",
    verticalAlign: "middle",
  },
  muted: {
    color: "#64748b",
    fontSize: "13px",
  },
  badge: {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 600,
    background: "#f1f5f9",
    color: "#334155",
  },
};

function toList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  return [];
}

function normalizeStages(payload, projectId) {
  return toList(payload)
    .map((stage, index) => {
      const percent =
        stage.stage_percent ??
        stage.unlock_percent ??
        stage.percent ??
        stage.percentage;

      if (percent === null || percent === undefined || percent === "") {
        return null;
      }

      return {
        ...stage,
        id: stage.id ?? `${projectId}-${percent}-${index}`,
        stage_percent: Number(percent),
        label: stage.label || stage.name || stage.title || `Stage ${percent}%`,
      };
    })
    .filter(Boolean);
}

function getAssignmentLabels(doc) {
  const labels = [];

  if (doc.college?.name) {
    labels.push(doc.college.name);
  } else if (doc.college_id) {
    labels.push(`College #${doc.college_id}`);
  } else {
    labels.push("All Colleges");
  }

  if (doc.group?.name) {
    labels.push(doc.group.name);
  } else if (doc.group_id) {
    labels.push(`Group #${doc.group_id}`);
  }

  if (doc.project?.title) {
    labels.push(doc.project.title);
  } else if (doc.project_id) {
    labels.push(`Software #${doc.project_id}`);
  }

  if (doc.stage_percent != null) {
    labels.push(`Stage ${doc.stage_percent}%`);
  }

  if (doc.bundle) {
    labels.push(`Bundle: ${doc.bundle}`);
  }

  return labels;
}

export default function AdminDocumentation() {
  const [documents, setDocuments] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [groups, setGroups] = useState([]);
  const [projects, setProjects] = useState([]);
  const [stages, setStages] = useState([]);

  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);

  const [search, setSearch] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingSelectors, setLoadingSelectors] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);

  useToastOn(error, "error", setError);
  useToastOn(message, "success", setMessage);

  // ---------- Data loading ----------

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = { per_page: 100 };

      if (search.trim()) {
        params.search = search.trim();
      }

      if (collegeFilter === "generic") {
        params.college_id = "null";
      } else if (collegeFilter) {
        params.college_id = collegeFilter;
      }

      if (activeFilter !== "") {
        params.is_active = activeFilter;
      }

      const response = await apiClient.get(ENDPOINT, { params });
      setDocuments(Array.isArray(response.data.data) ? response.data.data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load documentation.");
    } finally {
      setLoading(false);
    }
  }, [search, collegeFilter, activeFilter]);

  // Load colleges, groups, and projects once.
  useEffect(() => {
    async function loadInitialData() {
      setLoadingSelectors(true);

      try {
        const [collegesRes, groupsRes, projectsRes] = await Promise.all([
          apiClient.get(`${ENDPOINT}/colleges`),
          apiClient.get(`${ENDPOINT}/groups`),
          apiClient.get(`${ENDPOINT}/projects`),
        ]);

        setColleges(Array.isArray(collegesRes.data.data) ? collegesRes.data.data : []);
        setGroups(Array.isArray(groupsRes.data.data) ? groupsRes.data.data : []);
        setProjects(Array.isArray(projectsRes.data.data) ? projectsRes.data.data : []);
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Unable to load college, group, or software options."
        );
      } finally {
        setLoadingSelectors(false);
      }
    }

    loadInitialData();
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Load stages whenever the selected project changes.
  useEffect(() => {
    let cancelled = false;

    async function loadProjectStages() {
      if (!form.project_id) {
        setStages([]);
        return;
      }

      try {
        const response = await apiClient.get(`${ENDPOINT}/stages`, {
          params: { project_id: form.project_id },
        });

        if (!cancelled) {
          setStages(normalizeStages(response.data, form.project_id));
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setStages([]);
          setError(
            err.response?.data?.message ||
              "Unable to load stages for the selected software."
          );
        }
      }
    }

    loadProjectStages();

    return () => {
      cancelled = true;
    };
  }, [form.project_id]);

  // ---------- Derived data ----------

  const filteredGroups = groups.filter(
    (group) =>
      form.college_id && String(group.college_id) === String(form.college_id)
  );

  // ---------- Form handlers ----------

  function updateField(event) {
    const { name, value, type, checked, files } = event.target;

    setForm((current) => {
      let nextValue = value;
      if (type === "checkbox") nextValue = checked;
      if (type === "file") nextValue = files?.[0] ?? null;

      const updated = { ...current, [name]: nextValue };

      if (name === "college_id") {
        updated.group_id = "";
      }

      if (name === "project_id") {
        updated.stage_percent = "";
        updated.bundle = "";
      }

      if (name === "stage_percent" && value) {
        updated.bundle = "";
      }

      if (name === "bundle" && value.trim()) {
        updated.stage_percent = "";
      }

      return updated;
    });

    setError("");
  }

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
    setStages([]);

    const input = window.document.getElementById("documentation-file");
    if (input) {
      input.value = "";
    }
  }

  function editDocument(doc) {
    setEditingId(doc.id);

    setForm({
      title: doc.title ?? "",
      description: doc.description ?? "",
      college_id: doc.college_id == null ? "" : String(doc.college_id),
      group_id: doc.group_id == null ? "" : String(doc.group_id),
      project_id: doc.project_id == null ? "" : String(doc.project_id),
      stage_percent: doc.stage_percent == null ? "" : String(doc.stage_percent),
      bundle: doc.bundle ?? "",
      file: null,
      is_active: Boolean(doc.is_active),
    });

    setMessage("");
    setError("");

    // Stages are loaded automatically by the form.project_id effect.
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!editingId && !form.file) {
      setError("Please select a PDF or DOCX file.");
      return;
    }

    if (form.group_id && !form.college_id) {
      setError("Select a college before assigning a group.");
      return;
    }

    if (
      (form.stage_percent !== "" || form.bundle.trim() !== "") &&
      !form.project_id
    ) {
      setError("Select a software before assigning a stage or bundle.");
      return;
    }

    setSaving(true);

    const data = new FormData();
    data.append("title", form.title.trim());
    data.append("description", form.description);
    data.append("is_active", form.is_active ? "1" : "0");
    data.append("college_id", form.college_id);
    data.append("group_id", form.group_id);
    data.append("project_id", form.project_id);
    data.append("stage_percent", form.stage_percent);
    data.append("bundle", form.bundle.trim());

    if (form.file) {
      data.append("file", form.file);
    }

    try {
      if (editingId) {
        data.append("_method", "PUT");
        await apiClient.post(`${ENDPOINT}/${editingId}`, data);
        setMessage("Documentation updated successfully.");
      } else {
        await apiClient.post(ENDPOINT, data);
        setMessage("Documentation uploaded successfully.");
      }

      resetForm();
      await loadDocuments();
    } catch (err) {
      const errors = err.response?.data?.errors;
      const firstError = errors ? Object.values(errors).flat()[0] : null;

      setError(
        firstError ||
          err.response?.data?.message ||
          "Unable to save documentation."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(doc) {
    setError("");
    setMessage("");

    const data = new FormData();
    data.append("_method", "PATCH");
    data.append("is_active", doc.is_active ? "0" : "1");

    try {
      await apiClient.post(`${ENDPOINT}/${doc.id}`, data);
      setMessage(
        doc.is_active ? "Documentation deactivated." : "Documentation activated."
      );
      await loadDocuments();
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to change document status."
      );
    }
  }

  async function deleteDocument(doc) {
    setError("");
    setMessage("");

    try {
      await apiClient.delete(`${ENDPOINT}/${doc.id}`);
      setMessage("Documentation deleted successfully.");

      if (editingId === doc.id) {
        resetForm();
      }

      setConfirmingDeleteId(null);
      await loadDocuments();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete documentation.");
    }
  }

  // ---------- Render ----------

  return (
    <div className="student-page">
    <main className="container admin-page admin-doc">
      <header className="admin-header">
        <div>
          <span className="student-dashboard__eyebrow">Content management</span>
          <h1>Documentation</h1>
        </div>
      </header>

      <section style={styles.card}>
        <h2 style={{ marginTop: 0 }}>
          {editingId ? "Edit Documentation" : "Upload Documentation"}
        </h2>

        {loadingSelectors && (
          <p style={styles.muted}>Loading assignment options...</p>
        )}

        <form onSubmit={handleSubmit}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "18px",
            }}
          >
            <label style={styles.field}>
              <span>Document title *</span>
              <input
                style={styles.input}
                name="title"
                value={form.title}
                onChange={updateField}
                maxLength={255}
                required
              />
            </label>

            <label style={styles.field}>
              <span>College</span>
              <select
                style={styles.input}
                name="college_id"
                value={form.college_id}
                onChange={updateField}
                disabled={loadingSelectors}
              >
                <option value="">All Colleges (Generic)</option>
                {colleges.map((college) => (
                  <option key={college.id} value={String(college.id)}>
                    {college.name}
                  </option>
                ))}
              </select>
            </label>

            <label style={styles.field}>
              <span>Group</span>
              <select
                style={styles.input}
                name="group_id"
                value={form.group_id}
                onChange={updateField}
                disabled={!form.college_id || loadingSelectors}
              >
                <option value="">
                  {form.college_id
                    ? "All Groups in College"
                    : "Select a college first"}
                </option>
                {filteredGroups.map((group) => (
                  <option key={group.id} value={String(group.id)}>
                    {group.name || group.group_name || `Group #${group.id}`}
                  </option>
                ))}
              </select>
              <small style={styles.muted}>
                Leave empty to make the document available to all eligible
                groups in the selected college.
              </small>
            </label>

            <label style={styles.field}>
              <span>Software</span>
              <select
                style={styles.input}
                name="project_id"
                value={form.project_id}
                onChange={updateField}
                disabled={loadingSelectors}
              >
                <option value="">No Software (General Document)</option>
                {projects.map((project) => (
                  <option key={project.id} value={String(project.id)}>
                    {project.title || project.name || `Software #${project.id}`}
                  </option>
                ))}
              </select>
            </label>

            <label style={styles.field}>
              <span>Stage</span>
              <select
                style={styles.input}
                name="stage_percent"
                value={form.stage_percent}
                onChange={updateField}
                disabled={!form.project_id}
              >
                <option value="">All stages / no stage restriction</option>
                {stages.map((stage) => (
                  <option key={stage.id} value={String(stage.stage_percent)}>
                    {stage.label || stage.name || `Stage ${stage.stage_percent}%`}
                  </option>
                ))}
              </select>
              <small style={styles.muted}>
                {form.project_id
                  ? stages.length
                    ? "Choose the minimum unlocked percentage required to download this document."
                    : "No percentage-based stages were returned for this software. Check the stages API response before assigning a restriction."
                  : "Select a software to load its stage restrictions."}
              </small>
            </label>

            <label style={styles.field}>
              <span>Bundle</span>
              <input
                style={styles.input}
                name="bundle"
                value={form.bundle}
                onChange={updateField}
                placeholder="Enter the existing bundle key"
                disabled={!form.project_id}
              />
              <small style={styles.muted}>
                Use the exact bundle key already used by the software. Do not
                enter a display name unless it is the actual key.
              </small>
            </label>

            <label style={styles.field}>
              <span>Document file {editingId ? "(optional)" : "*"}</span>
              <input
                id="documentation-file"
                style={styles.input}
                type="file"
                name="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={updateField}
                required={!editingId}
              />
              <small style={styles.muted}>
                PDF or DOCX, maximum 20 MB.
                {editingId && " Leave empty to keep the existing file."}
              </small>
            </label>
          </div>

          <label style={{ ...styles.field, marginTop: "18px" }}>
            <span>Description</span>
            <textarea
              style={{ ...styles.input, minHeight: "90px" }}
              name="description"
              value={form.description}
              onChange={updateField}
              maxLength={5000}
            />
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "9px",
              marginTop: "16px",
            }}
          >
            <input
              type="checkbox"
              name="is_active"
              checked={form.is_active}
              onChange={updateField}
            />
            Active — available to eligible users
          </label>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              marginTop: "20px",
            }}
          >
            <button
              style={{ ...styles.primary, opacity: saving ? 0.7 : 1 }}
              type="submit"
              disabled={saving || loadingSelectors}
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Save Changes"
                  : "Upload Document"}
            </button>

            {editingId && (
              <button
                style={styles.button}
                type="button"
                onClick={resetForm}
                disabled={saving}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section style={styles.card}>
        <h2 style={{ marginTop: 0 }}>Uploaded Documents</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "12px",
            marginBottom: "18px",
          }}
        >
          <label style={styles.field}>
            <span>Search</span>
            <input
              style={styles.input}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title or description"
            />
          </label>

          <label style={styles.field}>
            <span>College filter</span>
            <select
              style={styles.input}
              value={collegeFilter}
              onChange={(event) => setCollegeFilter(event.target.value)}
            >
              <option value="">All Colleges and Generic</option>
              <option value="generic">Generic Only</option>
              {colleges.map((college) => (
                <option key={college.id} value={String(college.id)}>
                  {college.name}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.field}>
            <span>Status filter</span>
            <select
              style={styles.input}
              value={activeFilter}
              onChange={(event) => setActiveFilter(event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </select>
          </label>
        </div>

        {loading ? (
          <p>Loading documentation...</p>
        ) : documents.length === 0 ? (
          <p style={{ color: "#64748b" }}>No documentation found.</p>
        ) : (
          <div className="admin-doc-table-wrap" style={styles.tableWrap}>
            <table className="admin-doc-table" style={styles.table}>
              <thead>
                <tr>
                  {["Title", "Assignment", "Type", "Status", "Actions"].map(
                    (heading) => (
                      <th
                        key={heading}
                        style={{ ...styles.cell, background: "#f8fafc" }}
                      >
                        {heading}
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td data-label="Title" style={styles.cell}>
                      <strong>{doc.title}</strong>
                      {doc.description && (
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#64748b",
                            marginTop: "4px",
                            maxWidth: "320px",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {doc.description}
                        </div>
                      )}
                    </td>

                    <td data-label="Assignment" style={styles.cell}>
                      <div
                        style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}
                      >
                        {getAssignmentLabels(doc).map((label, index) => (
                          <span
                            key={`${doc.id}-${index}`}
                            style={styles.badge}
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td data-label="Type" style={styles.cell}>
                      {(doc.file_type ?? "unknown").toUpperCase()}
                    </td>

                    <td data-label="Status" style={styles.cell}>
                      <span
                        style={{
                          ...styles.badge,
                          background: doc.is_active ? "#dcfce7" : "#fee2e2",
                          color: doc.is_active ? "#166534" : "#991b1b",
                        }}
                      >
                        {doc.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td data-label="Actions" style={styles.cell}>
                      <div className="admin-doc-actions">
                        <button
                          style={styles.button}
                          type="button"
                          onClick={() => editDocument(doc)}
                        >
                          Edit
                        </button>

                        <button
                          style={styles.button}
                          type="button"
                          onClick={() => toggleActive(doc)}
                        >
                          {doc.is_active ? "Deactivate" : "Activate"}
                        </button>

                        {confirmingDeleteId === doc.id ? (
                          <>
                            <button
                              style={{ ...styles.button, color: "#b91c1c" }}
                              type="button"
                              onClick={() => deleteDocument(doc)}
                            >
                              Confirm Delete
                            </button>
                            <button
                              style={styles.button}
                              type="button"
                              onClick={() => setConfirmingDeleteId(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            style={{ ...styles.button, color: "#b91c1c" }}
                            type="button"
                            onClick={() => setConfirmingDeleteId(doc.id)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
    </div>
  );
}
