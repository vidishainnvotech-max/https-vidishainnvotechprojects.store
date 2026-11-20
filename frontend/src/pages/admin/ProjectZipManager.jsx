import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  CheckCircle2,
  FileArchive,
  LoaderCircle,
  Trash2,
  Upload,
} from "lucide-react";

import apiClient from "../../api/client";
import { useToastOn } from "../../components/Toast";
import "./project-zip-manager.css";

const EMPTY_FILES = {
  stage_files: [],
  complete_file: null,
};

const MAX_ZIP_BYTES = 500 * 1024 * 1024;

function formatFileSize(bytes) {
  const size = Number(bytes);

  if (!Number.isFinite(size) || size <= 0) {
    return "Size unavailable";
  }

  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function responseMessage(error, fallback) {
  const errors = error?.response?.data?.errors;

  if (errors && typeof errors === "object") {
    const firstMessage = Object.values(errors)
      .flat()
      .find((message) => typeof message === "string");

    if (firstMessage) {
      return firstMessage;
    }
  }

  return error?.response?.data?.message || fallback;
}

function ZipResourceCard({
  actionKey,
  busyAction,
  confirmingFileId,
  confirmingStageDelete = false,
  deletingStage = false,
  description,
  file,
  inputId,
  onCancelStageDelete,
  onConfirmRemove,
  onConfirmStageDelete,
  onFileChange,
  onRemove,
  onRequestStageDelete,
  setConfirmingFileId,
  title,
  tone = "stage",
}) {
  const uploading = busyAction === actionKey;
  const removing = file && busyAction === `remove-${file.id}`;
  const busy = uploading || removing || deletingStage;

  return (
    <article className={`admin-zip-card admin-zip-card--${tone}`}>
      <div className="admin-zip-card__head">
        <span className="admin-zip-card__icon" aria-hidden="true">
          {tone === "complete" ? <Archive size={20} /> : <FileArchive size={20} />}
        </span>
        <div>
          <h4>{title}</h4>
          <p>{description}</p>
        </div>
      </div>

      {file ? (
        <div className="admin-zip-file" aria-live="polite">
          <span className="admin-zip-file__status">
            <CheckCircle2 size={16} aria-hidden="true" />
            Uploaded
          </span>
          <strong title={file.original_name}>{file.original_name}</strong>
          <span>
            {formatFileSize(file.size)}
            {file.uploader?.name ? ` · ${file.uploader.name}` : ""}
          </span>
        </div>
      ) : (
        <div className="admin-zip-file admin-zip-file--empty">
          <strong>No ZIP uploaded</strong>
          <span>Users will see this resource as coming soon.</span>
        </div>
      )}

      <div className="admin-zip-card__actions">
        <label
          className={`btn btn-secondary btn-sm admin-zip-upload${busy ? " is-disabled" : ""}`}
          htmlFor={inputId}
          aria-disabled={busy}
        >
          {uploading ? (
            <LoaderCircle size={15} className="admin-stages-spin" aria-hidden="true" />
          ) : (
            <Upload size={15} aria-hidden="true" />
          )}
          {uploading ? "Uploading..." : file ? "Replace ZIP" : "Upload ZIP"}
        </label>
        <input
          id={inputId}
          className="admin-zip-input"
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          disabled={busy}
          onClick={(event) => {
            event.currentTarget.value = "";
          }}
          onChange={onFileChange}
        />

        {file && confirmingFileId === file.id ? (
          <div className="admin-zip-confirm" role="group" aria-label="Confirm ZIP removal">
            <button
              type="button"
              className="btn btn-secondary btn-sm btn-danger-outline"
              disabled={busy}
              onClick={() => onConfirmRemove(file)}
            >
              {removing ? (
                <LoaderCircle size={14} className="admin-stages-spin" aria-hidden="true" />
              ) : (
                <Trash2 size={14} aria-hidden="true" />
              )}
              {removing ? "Removing..." : "Confirm"}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy}
              onClick={() => setConfirmingFileId(null)}
            >
              Cancel
            </button>
          </div>
        ) : file ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm btn-danger-outline"
            disabled={busy}
            onClick={() => onRemove(file.id)}
          >
            <Trash2 size={14} aria-hidden="true" />
            Remove
          </button>
        ) : null}
      </div>

      {onRequestStageDelete && (
        <div className="admin-zip-stage-delete">
          {confirmingStageDelete ? (
            <div className="admin-zip-confirm" role="group" aria-label="Confirm stage deletion">
              <button
                type="button"
                className="btn btn-secondary btn-sm btn-danger-outline"
                disabled={deletingStage}
                onClick={onConfirmStageDelete}
              >
                {deletingStage ? (
                  <LoaderCircle size={14} className="admin-stages-spin" aria-hidden="true" />
                ) : (
                  <Trash2 size={14} aria-hidden="true" />
                )}
                Confirm
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={deletingStage}
                onClick={onCancelStageDelete}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-secondary btn-sm btn-danger-outline"
              disabled={busy}
              onClick={onRequestStageDelete}
            >
              <Trash2 size={14} aria-hidden="true" />
              Delete stage
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function ProjectZipManager({
  projects,
  stages,
  confirmingStageDeleteId = null,
  deletingStageId = null,
  onDeleteStage,
  onStageDeleteCancel,
  onStageDeleteRequest,
}) {
  const [selectedProjectChoice, setSelectedProjectChoice] = useState("");
  const [projectFiles, setProjectFiles] = useState(EMPTY_FILES);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [confirmingFileId, setConfirmingFileId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const requestSequence = useRef(0);

  useToastOn(error, "error", setError);
  useToastOn(success, "success", setSuccess);

  const selectedProjectId = projects.some(
    (project) => String(project.id) === selectedProjectChoice,
  )
    ? selectedProjectChoice
    : projects[0]?.id
      ? String(projects[0].id)
      : "";

  const selectedStages = useMemo(
    () =>
      stages
        .filter((stage) => String(stage.project_id) === selectedProjectId)
        .sort((first, second) => first.stage_percent - second.stage_percent),
    [selectedProjectId, stages],
  );

  const stageSignature = selectedStages.map((stage) => stage.id).join(",");
  const canDeleteStages = Boolean(
    onDeleteStage && onStageDeleteCancel && onStageDeleteRequest,
  );

  const loadProjectFiles = useCallback(async (projectId) => {
    const requestId = ++requestSequence.current;

    if (!projectId) {
      setProjectFiles(EMPTY_FILES);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const response = await apiClient.get(`/admin/projects/${projectId}/files`);

      if (requestId !== requestSequence.current) {
        return;
      }

      const data = response?.data?.data;
      setProjectFiles({
        stage_files: Array.isArray(data?.stage_files) ? data.stage_files : [],
        complete_file: data?.complete_file ?? null,
      });
    } catch (loadError) {
      if (requestId === requestSequence.current) {
        setProjectFiles(EMPTY_FILES);
        setError(responseMessage(loadError, "Unable to load software ZIP files."));
      }
    } finally {
      if (requestId === requestSequence.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadProjectFiles(selectedProjectId);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadProjectFiles, selectedProjectId, stageSignature]);

  const filesByStageId = useMemo(
    () =>
      new Map(
        projectFiles.stage_files.map((file) => [
          Number(file.stage?.id),
          file,
        ]),
      ),
    [projectFiles.stage_files],
  );

  const uploadZip = async (event, stageId = null) => {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file || !selectedProjectId) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".zip")) {
      setError("Choose a ZIP file ending in .zip.");
      input.value = "";
      return;
    }

    if (file.size > MAX_ZIP_BYTES) {
      setError("The ZIP file must not exceed 500 MB.");
      input.value = "";
      return;
    }

    const actionKey = stageId ? `stage-${stageId}` : "complete";
    const formData = new FormData();
    formData.append("file", file);

    if (stageId) {
      formData.append("stage_id", String(stageId));
    }

    setBusyAction(actionKey);
    setError("");
    setSuccess("");

    try {
      const endpoint = stageId
        ? `/admin/projects/${selectedProjectId}/stage-files`
        : `/admin/projects/${selectedProjectId}/complete-file`;
      const response = await apiClient.post(endpoint, formData);

      setSuccess(response?.data?.message || "Software ZIP uploaded successfully.");
      await loadProjectFiles(selectedProjectId);
    } catch (uploadError) {
      setError(responseMessage(uploadError, "Unable to upload the software ZIP."));
    } finally {
      input.value = "";
      setBusyAction("");
    }
  };

  const removeZip = async (projectFile) => {
    setBusyAction(`remove-${projectFile.id}`);
    setError("");
    setSuccess("");

    try {
      const response = await apiClient.delete(
        `/admin/project-files/${projectFile.id}`,
      );

      setConfirmingFileId(null);
      setSuccess(response?.data?.message || "Software ZIP removed successfully.");
      await loadProjectFiles(selectedProjectId);
    } catch (removeError) {
      setError(responseMessage(removeError, "Unable to remove the software ZIP."));
    } finally {
      setBusyAction("");
    }
  };

  return (
    <section className="admin-panel admin-zip-manager">
      <div className="admin-zip-manager__header">
        <div>
          <h3>
            <Archive size={19} aria-hidden="true" />
            Software source ZIPs
          </h3>
          <p>
            Upload stage packages separately. The complete-software ZIP is reserved
            for customers with that bundle entitlement.
          </p>
        </div>

        <div className="admin-form-field admin-zip-manager__project">
          <label htmlFor="zip-project">Software</label>
          <select
            id="zip-project"
            value={selectedProjectId}
            disabled={projects.length === 0 || Boolean(busyAction)}
            onChange={(event) => {
              setSelectedProjectChoice(event.target.value);
              setConfirmingFileId(null);
              setProjectFiles(EMPTY_FILES);
            }}
          >
            {projects.length === 0 ? (
              <option value="">No software available</option>
            ) : (
              projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="admin-zip-grid" aria-busy="true">
          {[20, 50, 75, 100].map((percent) => (
            <div key={percent} className="skeleton admin-zip-skeleton" />
          ))}
        </div>
      ) : selectedProjectId ? (
        <>
          <div className="admin-zip-section-heading">
            <div>
              <span>Stage delivery</span>
              <strong>Source packages linked to exact stage access</strong>
            </div>
            <small>{selectedStages.length} configured stages</small>
          </div>

          {selectedStages.length > 0 ? (
            <div className="admin-zip-grid">
              {selectedStages.map((stage) => {
                const file = filesByStageId.get(Number(stage.id)) ?? null;

                return (
                  <ZipResourceCard
                    key={stage.id}
                    actionKey={`stage-${stage.id}`}
                    busyAction={busyAction}
                    confirmingFileId={confirmingFileId}
                    confirmingStageDelete={confirmingStageDeleteId === stage.id}
                    deletingStage={deletingStageId === stage.id}
                    description={stage.semester || "Stage source package"}
                    file={file}
                    inputId={`stage-zip-${stage.id}`}
                    onCancelStageDelete={onStageDeleteCancel}
                    onConfirmRemove={removeZip}
                    onConfirmStageDelete={
                      canDeleteStages ? () => onDeleteStage(stage) : undefined
                    }
                    onFileChange={(event) => uploadZip(event, stage.id)}
                    onRemove={setConfirmingFileId}
                    onRequestStageDelete={
                      canDeleteStages
                        ? () => onStageDeleteRequest(stage.id)
                        : undefined
                    }
                    setConfirmingFileId={setConfirmingFileId}
                    title={`Stage ${stage.stage_percent}%`}
                  />
                );
              })}
            </div>
          ) : (
            <div className="admin-zip-empty">
              <FileArchive size={22} aria-hidden="true" />
              <div>
                <strong>No stages configured for this software</strong>
                <span>Create a software stage above before uploading its ZIP.</span>
              </div>
            </div>
          )}

          <div className="admin-zip-section-heading admin-zip-section-heading--complete">
            <div>
              <span>Full-software delivery</span>
              <strong>Complete source package</strong>
            </div>
            <small>Separate from all percentage stages</small>
          </div>

          <ZipResourceCard
            actionKey="complete"
            busyAction={busyAction}
            confirmingFileId={confirmingFileId}
            description="Complete working source code for entitled one-time customers"
            file={projectFiles.complete_file}
            inputId="complete-software-zip"
            onConfirmRemove={removeZip}
            onFileChange={(event) => uploadZip(event)}
            onRemove={setConfirmingFileId}
            setConfirmingFileId={setConfirmingFileId}
            title="Complete Software ZIP"
            tone="complete"
          />
        </>
      ) : (
        <div className="admin-zip-empty">
          <Archive size={22} aria-hidden="true" />
          <div>
            <strong>No software selected</strong>
            <span>Create a software before uploading source packages.</span>
          </div>
        </div>
      )}
    </section>
  );
}

export default ProjectZipManager;
