import { useCallback, useEffect, useState } from "react";
import {
  Edit,
  Layers,
  LoaderCircle,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import apiClient from "../../api/client";
import { useToastOn } from "../../components/Toast";
import ProjectZipManager from "./ProjectZipManager";
import "./admin-catalog-tables.css";

const STAGE_PERCENTAGES = [20, 50, 75, 100];

const EMPTY_FORM = {
  project_id: "",
  stage_percent: "20",
  semester: "",
  video_url: "",
  ppt_path: "",
};

function collectionFrom(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  return [];
}

function AdminStages() {
  const [stages, setStages] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [withZip, setWithZip] = useState(false);
  const [zipFile, setZipFile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [validationErrors, setValidationErrors] = useState({});

  useToastOn(error, "error", setError);
  useToastOn(success, "success", setSuccess);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [stagesResponse, projectsResponse] = await Promise.all([
        apiClient.get("/admin/stages"),
        apiClient.get("/admin/projects"),
      ]);

      const stagesData = collectionFrom(stagesResponse?.data);
      const projectsData = collectionFrom(projectsResponse?.data);

      setStages(stagesData);
      setProjects(projectsData);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Unable to load software stages. Please refresh and try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setWithZip(false);
    setZipFile(null);
    setValidationErrors({});
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setValidationErrors((current) => ({
      ...current,
      [name]: undefined,
    }));

    setError("");
    setSuccess("");
  };

  const handleEdit = (stage) => {
    setEditingId(stage.id);
    setWithZip(false);
    setZipFile(null);

    setForm({
      project_id: String(stage.project_id ?? ""),
      stage_percent: String(stage.stage_percent ?? "20"),
      semester: stage.semester ?? "",
      video_url: stage.video_url ?? "",
      ppt_path: stage.ppt_path ?? "",
    });

    setValidationErrors({});
    setError("");
    setSuccess("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");
    setValidationErrors({});

    if (!form.project_id) {
      setValidationErrors({
        project_id: ["Please select a software."],
      });
      return;
    }

    setSaving(true);

    const payload = {
      project_id: Number(form.project_id),
      stage_percent: Number(form.stage_percent),
      semester: form.semester.trim(),
      video_url: form.video_url.trim() || null,
      ppt_path: form.ppt_path.trim() || null,
    };

    try {
      if (editingId) {
        await apiClient.put(`/admin/stages/${editingId}`, payload);

        resetForm();
        await loadData();
        setSuccess("Software stage updated successfully.");
      } else {
        const response = await apiClient.post("/admin/stages", payload);
        const newStage = response?.data?.data ?? response?.data;
        const uploadZip = withZip;
        const selectedZip = zipFile;
        let uploadFailure = null;

        if (uploadZip && selectedZip && newStage?.id) {
          try {
            const formData = new FormData();
            formData.append("stage_id", String(newStage.id));
            formData.append("file", selectedZip);

            await apiClient.post(
              `/admin/projects/${payload.project_id}/stage-files`,
              formData,
            );
          } catch (uploadError) {
            uploadFailure = uploadError;
          }
        }

        resetForm();
        await loadData();

        if (!uploadZip) {
          setSuccess("Software stage created successfully.");
        } else if (!selectedZip) {
          setError(
            "Stage created, but no ZIP was selected. You can upload it below.",
          );
        } else if (uploadFailure) {
          const uploadResponse = uploadFailure?.response?.data;
          const uploadMessage =
            Object.values(uploadResponse?.errors ?? {})
              .flat()
              .find((message) => typeof message === "string") ||
            uploadResponse?.message;

          setError(
            uploadMessage
              ? `Stage created, but the source ZIP upload failed: ${uploadMessage}`
              : "Stage created, but the source ZIP upload failed. You can upload it below.",
          );
        } else if (!newStage?.id) {
          setError(
            "Stage created, but the source ZIP could not be uploaded. You can upload it below.",
          );
        } else {
          setSuccess("Software stage and source ZIP created successfully.");
        }
      }
    } catch (err) {
      const response = err?.response?.data;

      if (response?.errors) {
        setValidationErrors(response.errors);
      }

      setError(
        response?.message ||
          "Unable to save the stage. Check the fields and try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (stage) => {
    setDeletingId(stage.id);
    setError("");
    setSuccess("");

    try {
      await apiClient.delete(`/admin/stages/${stage.id}`);

      setStages((current) =>
        current.filter((item) => item.id !== stage.id),
      );

      if (editingId === stage.id) {
        resetForm();
      }

      setConfirmingDeleteId(null);
      setSuccess("Software stage deleted successfully.");
      await loadData();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Unable to delete this stage.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const getFieldError = (field) => {
    const message = validationErrors[field];
    return Array.isArray(message) ? message[0] : message;
  };

  return (
    <div className="student-page">
      <main className="container admin-page admin-stages-page">
        <header className="admin-header">
          <div>
            <span className="student-dashboard__eyebrow">Content management</span>
            <h1>Software Stages</h1>
          </div>
        </header>

        <section className="admin-summary-grid" aria-label="Summary">
          <article className="admin-summary-card">
            <div className="admin-summary-card__icon">
              <Layers size={20} aria-hidden="true" />
            </div>
            <div className="admin-summary-card__content">
              <span>Total stages</span>
              <strong>{stages.length}</strong>
            </div>
          </article>

          <article className="admin-summary-card">
            <div className="admin-summary-card__icon">
              <Layers size={20} aria-hidden="true" />
            </div>
            <div className="admin-summary-card__content">
              <span>Software with stages</span>
              <strong>{new Set(stages.map((s) => s.project_id)).size}</strong>
            </div>
          </article>
        </section>

        <section className="admin-panel" style={{ marginBottom: 22 }}>
          <h3>
            {editingId ? (
              <Edit size={19} aria-hidden="true" />
            ) : (
              <Plus size={19} aria-hidden="true" />
            )}
            {editingId ? "Edit software stage" : "Create software stage"}
          </h3>

          <form onSubmit={handleSubmit} className="admin-project-form admin-stage-form">
            <div className="admin-form-field">
              <label htmlFor="stage-project">Software *</label>
              <select
                id="stage-project"
                name="project_id"
                value={form.project_id}
                onChange={handleChange}
                required
              >
                <option value="">Select a software</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
              {getFieldError("project_id") && (
                <small className="admin-form-error">{getFieldError("project_id")}</small>
              )}
            </div>

            <div className="admin-form-field">
              <label htmlFor="stage-percent">Stage percentage *</label>
              <select
                id="stage-percent"
                name="stage_percent"
                value={form.stage_percent}
                onChange={handleChange}
                required
              >
                {STAGE_PERCENTAGES.map((percent) => (
                  <option key={percent} value={percent}>
                    {percent}%
                  </option>
                ))}
              </select>
              {getFieldError("stage_percent") && (
                <small className="admin-form-error">{getFieldError("stage_percent")}</small>
              )}
            </div>

            <div className="admin-form-field">
              <label htmlFor="stage-semester">Semester *</label>
              <input
                id="stage-semester"
                name="semester"
                value={form.semester}
                onChange={handleChange}
                placeholder="Enter semester"
                required
              />
              {getFieldError("semester") && (
                <small className="admin-form-error">{getFieldError("semester")}</small>
              )}
            </div>

            <div className="admin-form-field">
              <label htmlFor="stage-video">Video URL</label>
              <input
                id="stage-video"
                name="video_url"
                type="url"
                value={form.video_url}
                onChange={handleChange}
                placeholder="https://example.com/video"
              />
              {getFieldError("video_url") && (
                <small className="admin-form-error">{getFieldError("video_url")}</small>
              )}
            </div>

            <div className="admin-form-field">
              <label htmlFor="stage-ppt">PPT path</label>
              <input
                id="stage-ppt"
                name="ppt_path"
                value={form.ppt_path}
                onChange={handleChange}
                placeholder="Optional presentation path"
              />
              {getFieldError("ppt_path") && (
                <small className="admin-form-error">{getFieldError("ppt_path")}</small>
              )}
            </div>

            <p className="admin-form-hint admin-form-field--full">
              The same software cannot have duplicate stage percentages. Only
              create stages that are missing.
            </p>

            {!editingId && (
              <>
                <label className="admin-form-check admin-form-field--full">
                  <input
                    type="checkbox"
                    checked={withZip}
                    onChange={(event) => {
                      setWithZip(event.target.checked);

                      if (!event.target.checked) {
                        setZipFile(null);
                      }
                    }}
                  />
                  Add source ZIP for this stage
                </label>

                {withZip && (
                  <div className="admin-form-field admin-form-field--full">
                    <label htmlFor="stage-zip-file">Source ZIP</label>
                    <input
                      id="stage-zip-file"
                      type="file"
                      accept=".zip,application/zip,application/x-zip-compressed"
                      onChange={(event) =>
                        setZipFile(event.target.files?.[0] || null)
                      }
                    />
                    <p className="admin-form-hint">
                      ZIP only, maximum 500 MB. You can also upload it later
                      from Software source ZIPs.
                    </p>
                  </div>
                )}
              </>
            )}

            <div className="admin-form-actions admin-form-field--full">
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? (
                  <LoaderCircle size={16} className="admin-stages-spin" aria-hidden="true" />
                ) : (
                  <Plus size={16} aria-hidden="true" />
                )}
                {saving ? "Saving..." : editingId ? "Update stage" : "Create stage"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn btn-secondary"
                >
                  <X size={16} aria-hidden="true" />
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <ProjectZipManager
          projects={projects}
          stages={stages}
          confirmingStageDeleteId={confirmingDeleteId}
          deletingStageId={deletingId}
          onDeleteStage={handleDelete}
          onStageDeleteRequest={setConfirmingDeleteId}
          onStageDeleteCancel={() => setConfirmingDeleteId(null)}
        />

        {loading && (
          <div aria-busy="true" style={{ display: "grid", gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton" style={{ height: 52 }} />
            ))}
          </div>
        )}

        {!loading && stages.length === 0 && (
          <div className="empty-state">
            <span className="empty-state__icon">
              <Layers size={24} aria-hidden="true" />
            </span>
            <h3>No software stages yet</h3>
            <p>Create your first stage above.</p>
          </div>
        )}

        {!loading && stages.length > 0 && (
          <>
            <div className="admin-result-count" role="status">
              {stages.length} {stages.length === 1 ? "stage" : "stages"}
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table admin-users-table">
                <thead>
                  <tr>
                    <th>Software</th>
                    <th>Percentage</th>
                    <th>Semester</th>
                    <th>
                      <span className="admin-visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {stages.map((stage) => (
                    <tr key={stage.id}>
                      <td data-label="Software" className="cell-name cell-project">
                        {stage.project?.title ||
                          projects.find((project) => project.id === stage.project_id)
                            ?.title ||
                          `Software #${stage.project_id}`}
                      </td>

                      <td data-label="Percentage">
                        <span className="group-chip">
                          <span className="group-chip__id">{stage.stage_percent}%</span>
                        </span>
                      </td>

                      <td data-label="Semester">{stage.semester || "—"}</td>

                      <td data-label="Actions" className="admin-table__action">
                        <div className="admin-row-actions">
                          <button
                            type="button"
                            onClick={() => handleEdit(stage)}
                            className="btn btn-secondary btn-sm"
                          >
                            <Edit size={14} aria-hidden="true" />
                            Edit
                          </button>

                          {confirmingDeleteId === stage.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleDelete(stage)}
                                disabled={deletingId === stage.id}
                                className="btn btn-secondary btn-sm btn-danger-outline"
                              >
                                {deletingId === stage.id ? (
                                  <LoaderCircle size={14} className="admin-stages-spin" aria-hidden="true" />
                                ) : (
                                  <Trash2 size={14} aria-hidden="true" />
                                )}
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmingDeleteId(null)}
                                className="btn btn-secondary btn-sm"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmingDeleteId(stage.id)}
                              disabled={deletingId === stage.id}
                              className="btn btn-secondary btn-sm btn-danger-outline"
                            >
                              <Trash2 size={14} aria-hidden="true" />
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
          </>
        )}

        <style>{`
          .admin-stages-spin { animation: adminStagesSpin 1s linear infinite; }
          @keyframes adminStagesSpin { to { transform: rotate(360deg); } }
        `}</style>
      </main>
    </div>
  );
}

export default AdminStages;
