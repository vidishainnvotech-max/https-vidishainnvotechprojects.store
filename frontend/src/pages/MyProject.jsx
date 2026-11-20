import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { downloadProjectFile, downloadResource, getMyProject, getStageVideo } from "../api/student";

import StudentHeader from "../components/student/StudentHeader";
import StageStepper from "../components/student/StageStepper";
import ResourceCard from "../components/student/ResourceCard";
import { softwareLabel } from "../utils/visibleText";
import Reveal from "../components/Reveal";
import { useToastOn } from "../components/Toast";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CreditCard, ExternalLink, LockKeyhole } from "lucide-react";

const isValidLink = (value) => /^https?:\/\/.+/i.test(value ?? "");

function MyProject() {
  const { id } = useParams();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resourceLoading, setResourceLoading] = useState("");

  useToastOn(project ? error : "", "error", setError);
  useToastOn(notice, "info", setNotice);

  useEffect(() => {
    let mounted = true;

    const loadProject = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await getMyProject(id);

        if (mounted) {
          setProject(response?.data || null);
        }
      } catch (err) {
        if (mounted) {
          const status = err?.response?.status;

          setError(
            status === 404
              ? "Software not found."
              : status === 403
                ? "You do not have access to this software."
                : err?.response?.data?.message ||
                  "Unable to load this software.",
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadProject();

    return () => {
      mounted = false;
    };
  }, [id]);

  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(url);
  };

  const resetFeedback = () => {
    setError("");
    setNotice("");
  };

  const handleVideo = async (stage) => {
    try {
      resetFeedback();
      setResourceLoading(`video-${stage.id}`);

      const response = await getStageVideo(stage.id);
      const videoUrl = response?.data?.video_url;

      if (!videoUrl) {
        throw new Error("Video is not available.");
      }

      window.open(videoUrl, "_blank", "noopener,noreferrer");

      setNotice("Opening your stage video...");
    } catch (err) {
      const status = err?.response?.status;

      setError(
        status === 403
          ? "You do not have access to this stage video."
          : status === 404
            ? "Video is not available."
            : err?.response?.data?.message ||
              err?.message ||
              "Unable to open the video.",
      );
    } finally {
      setResourceLoading("");
    }
  };

  const handlePpt = async (stage) => {
    try {
      resetFeedback();
      setResourceLoading(`ppt-${stage.id}`);

      const blob = await downloadResource("ppt", stage.id);

      downloadBlob(
        blob,
        `${project?.title || "project"}-stage-${stage.stage_percent}.pptx`,
      );

      setNotice("Presentation download started.");
    } catch (err) {
      const status = err?.response?.status;

      setError(
        status === 403
          ? "You do not have access to this stage."
          : status === 404
            ? "Presentation is not available."
            : err?.response?.data?.message ||
              "Unable to download the presentation.",
      );
    } finally {
      setResourceLoading("");
    }
  };

  const handleDocument = async (document) => {
    try {
      resetFeedback();
      setResourceLoading(`document-${document.id}`);

      const blob = await downloadResource("document", document.id);

      downloadBlob(blob, document.bundle || `document-${document.id}`);

      setNotice("Document download started.");
    } catch (err) {
      const status = err?.response?.status;

      setError(
        status === 403
          ? "You do not have access to this document."
          : status === 404
            ? "Document is not available."
            : err?.response?.data?.message ||
              "Unable to download the document.",
      );
    } finally {
      setResourceLoading("");
    }
  };

  const handleZip = async (file, fallbackName, key) => {
    try {
      resetFeedback();
      setResourceLoading(key);

      const blob = await downloadProjectFile(file.download_url);
      downloadBlob(blob, file.original_name || fallbackName);

      setNotice("Source code download started.");
    } catch (err) {
      const status = err?.response?.status;

      setError(
        status === 403
          ? "You do not have access to this file."
          : status === 404
            ? "Source code is not available yet."
            : err?.response?.data?.message || "Unable to download the source code.",
      );
    } finally {
      setResourceLoading("");
    }
  };

  if (loading) {
    return (
      <div className="student-page">
        <StudentHeader />

        <main className="container student-dashboard" aria-busy="true">
          <div className="skeleton" style={{ height: 150, borderRadius: 16, marginBottom: 24 }} />
          <div className="skeleton skeleton--card" />
        </main>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="student-page">
        <StudentHeader />

        <main className="container student-dashboard">
          <div className="error-state" role="alert">
            <span className="error-state__icon"><AlertTriangle size={24} aria-hidden="true" /></span>
            <h3>{error}</h3>
            <p>If you think this is a mistake, return to your dashboard and try again.</p>
            <Link to="/student" className="btn btn-secondary btn-sm">
              <ArrowLeft size={15} aria-hidden="true" /> Back to Dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const userAccess = (project.access_stages || []).map((stagePercent) => ({
    stage_percent: stagePercent,
  }));

  const highestStage = Number(project.highest_stage) || 0;

  const fullyUnlocked = highestStage >= 100;

  const stages = (project.stages || [])
    .slice()
    .sort((a, b) => a.stage_percent - b.stage_percent);

  return (
    <div className="student-page">
      <StudentHeader />

      <main className="container student-dashboard page-enter">
        <Link to="/student" className="student-back-link">
          <ArrowLeft size={15} aria-hidden="true" /> Back to Dashboard
        </Link>

        <section className="student-project-hero">
          <span className="student-dashboard__eyebrow">
            {softwareLabel(project.category?.name, "Software")}
          </span>

          <h1>{project.title}</h1>

          {project.abstract && <p>{project.abstract}</p>}

          <span className={`badge ${fullyUnlocked ? "badge-success" : "badge-info"}`}>
            {fullyUnlocked ? <Check size={14} aria-hidden="true" /> : <LockKeyhole size={14} aria-hidden="true" />}
            {fullyUnlocked ? "Software fully unlocked" : `Unlocked up to ${highestStage}%`}
          </span>

          <div className="student-project-hero__progress">
            <div><span>Access progress</span><strong>{highestStage}%</strong></div>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${highestStage}%` }} /></div>
          </div>

          {!fullyUnlocked && project.slug && (
            <Link
              to={`/projects/${project.slug}`}
              className="btn btn-primary student-project-hero__pay"
            >
              <CreditCard size={16} aria-hidden="true" />
              Pay remaining amount to unlock full access
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          )}
        </section>

        <section className="student-section">
          <h2>Software Progress</h2>

          <StageStepper userAccess={userAccess} currentStage={highestStage} />
        </section>

        {project.complete_project?.is_unlocked && project.complete_project?.has_zip && project.complete_project?.source_zip && (
          <section className="student-section">
            <h2>Complete Software</h2>

            <div className="student-stage-card is-unlocked">
              <div className="student-stage-card__head">
                <div>
                  <span className="student-stage-card__label">Full Source Code</span>
                  <h3>Complete working software</h3>
                </div>
                <span className="badge badge-success">
                  <Check size={13} aria-hidden="true" /> Unlocked
                </span>
              </div>

              {project.complete_project.has_zip && project.complete_project.source_zip ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={resourceLoading === "zip-complete"}
                  onClick={() =>
                    handleZip(
                      project.complete_project.source_zip,
                      `${project.title || "project"}-complete.zip`,
                      "zip-complete",
                    )
                  }
                >
                  {resourceLoading === "zip-complete" ? "Preparing..." : "Download Complete Software ZIP"}
                </button>
              ) : (
                <p className="state-empty">Complete software source: coming soon.</p>
              )}
            </div>
          </section>
        )}

        <section className="student-section">
          <h2>Stages</h2>

          <div className="student-resource-grid">
            {stages.map((stage, index) => (
              <Reveal key={stage.id} className={`student-stage-card ${stage.is_unlocked ? "is-unlocked" : "is-locked"}`} delay={Math.min(index, 3) * 0.08}>
                <div className="student-stage-card__head">
                  <div>
                    <span className="student-stage-card__label">Stage {stage.stage_percent}%</span>
                    <h3>{stage.semester || `Stage ${stage.stage_percent}%`}</h3>
                  </div>

                  <span className={`badge ${stage.is_unlocked ? "badge-success" : "badge-locked"}`}>
                    {stage.is_unlocked ? <Check size={13} aria-hidden="true" /> : <LockKeyhole size={13} aria-hidden="true" />}
                    {stage.is_unlocked ? "Unlocked" : "Locked"}
                  </span>
                </div>

                {!stage.is_unlocked && (
                  <p className="student-stage-card__locked-note">
                    Locked — not included in your current payment or plan.
                  </p>
                )}

                <div className="student-stage-card__resources">
                  <ResourceCard
                    title="Stage Video"
                    type="video"
                    unlocked={Boolean(stage.is_unlocked)}
                    loading={resourceLoading === `video-${stage.id}`}
                    onAction={() => handleVideo(stage)}
                  />

                  <ResourceCard
                    title="Presentation"
                    type="ppt"
                    unlocked={Boolean(stage.is_unlocked)}
                    loading={resourceLoading === `ppt-${stage.id}`}
                    onAction={() => handlePpt(stage)}
                  />

                  {stage.is_unlocked && stage.has_zip && stage.source_zip && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={resourceLoading === `zip-${stage.id}`}
                      onClick={() =>
                        handleZip(
                          stage.source_zip,
                          `${project.title || "project"}-stage-${stage.stage_percent}.zip`,
                          `zip-${stage.id}`,
                        )
                      }
                    >
                      {resourceLoading === `zip-${stage.id}` ? "Preparing..." : "Download Source ZIP"}
                    </button>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="student-section">
          <h2>Documents</h2>

          <div className="student-resource-grid">
            {(project.documents || []).map((document) => (
              <Reveal key={document.id} className="reveal-fill">
                <ResourceCard
                  title={document.bundle || `Document ${document.id}`}
                  type="document"
                  unlocked={Boolean(document.is_unlocked)}
                  loading={resourceLoading === `document-${document.id}`}
                  onAction={() => handleDocument(document)}
                />
              </Reveal>
            ))}
          </div>

          {(project.documents || []).length === 0 && (
            <p className="state-empty">No documents are available for this software yet.</p>
          )}
        </section>

        {project.iot_kit_link && isValidLink(project.iot_kit_link) && (
          <section className="student-section">
            <h2>IoT Kit</h2>

            <a
              href={project.iot_kit_link}
              target="_blank"
              rel="noopener noreferrer"
              className="student-iot-link"
              aria-label={`Open the IoT kit guide for ${project.title}`}
            >
              Open IoT Kit <ExternalLink size={15} aria-hidden="true" />
            </a>
          </section>
        )}
      </main>
    </div>
  );
}

export default MyProject;
