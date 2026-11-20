import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Cpu,
  FileArchive,
  LoaderCircle,
  Presentation,
  ShieldCheck,
  Unlock,
  XCircle,
} from "lucide-react";

import BrandLogo from "../components/common/BrandLogo";
import apiClient from "../api/client";

import "../styles/login.css";
import "../styles/verify-email.css";

const STAGES = [
  { pct: 20, title: "Foundation & setup" },
  { pct: 50, title: "Core modules" },
  { pct: 75, title: "Integration & testing" },
  { pct: 100, title: "Final build & report" },
];

function VerifyEmail() {
  const navigate = useNavigate();
  const { id, hash } = useParams();
  const [searchParams] = useSearchParams();

  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState(
    "Verifying your email address. Please wait...",
  );

  useEffect(() => {
    let cancelled = false;

    const verifyEmail = async () => {
      if (!id || !hash) {
        setStatus("error");
        setMessage("This verification link is invalid or incomplete.");
        return;
      }

      const queryString = searchParams.toString();

      try {
        const url = `/email/verify/${id}/${hash}${
          queryString ? `?${queryString}` : ""
        }`;

        const response = await apiClient.get(url);

        if (cancelled) {
          return;
        }

        if (response?.data?.verified === true) {
          setStatus("success");
          setMessage(
            response?.data?.message ||
              "Your email has been verified successfully.",
          );
        } else {
          setStatus("error");
          setMessage(
            response?.data?.message ||
              "We could not verify your email address.",
          );
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        setStatus("error");

        const responseMessage =
          error?.response?.data?.message ||
          error?.message ||
          "This verification link is invalid, expired, or no longer available.";

        setMessage(responseMessage);
      }
    };

    verifyEmail();

    return () => {
      cancelled = true;
    };
  }, [id, hash, searchParams]);

  const handleLogin = () => {
    navigate("/login", {
      replace: true,
    });
  };

  return (
    <main className="lg lg--verify">
      <aside className="lg-hero" aria-hidden="true">
        <span className="lg-blob lg-blob--a" />
        <span className="lg-blob lg-blob--b" />

        <div className="lg-hero__inner">
          <span className="lg-pill">
            <ShieldCheck size={14} />
            User portal
          </span>

          <h2>
            Software,
            <br />
            ready to build and present.
          </h2>

          <p>
            AI, ML, IoT and embedded software with source code, documents,
            videos and presentations. Unlock each stage as you progress.
          </p>

          <div className="lg-showcase">
            <div className="lg-showcase__head">
              <span className="lg-showcase__icon">
                <Cpu size={18} />
              </span>

              <div>
                <strong>Every software has 4 stages</strong>
                <small>Unlock resources as you progress</small>
              </div>
            </div>

            <ol className="lg-stages">
              {STAGES.map((stage, index) => (
                <li key={stage.pct} style={{ "--i": index }}>
                  <span className="lg-stages__pct">{stage.pct}%</span>

                  <div className="lg-stages__body">
                    <b>{stage.title}</b>

                    <div className="lg-files">
                      <span>
                        <FileArchive size={12} />
                        Code ZIP
                      </span>

                      <span>
                        <BookOpen size={12} />
                        Resources
                      </span>

                      <span>
                        <Presentation size={12} />
                        PPT
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <ul className="lg-points">
            <li>
              <BookOpen size={16} />
              Black book and semester reports
            </li>

            <li>
              <Unlock size={16} />
              Pay in installments, unlock as you go
            </li>

            <li>
              <ShieldCheck size={16} />
              Secure, access-checked downloads
            </li>
          </ul>
        </div>
      </aside>

      <section className="lg-panel">
        <div className="lg-card lg-card--verify">
          <Link to="/" className="lg-brand" aria-label="Back to home">
            <BrandLogo markClassName="lg-brand__icon" />
          </Link>

          {status === "loading" && (
            <div className="lg-verify-state">
              <div className="lg-verify-icon lg-verify-icon--loading">
                <LoaderCircle size={34} />
              </div>

              <h1>Verifying your email</h1>

              <p className="lg-lead">
                We are securely checking your verification link.
              </p>

              <div className="lg-verify-message lg-verify-message--loading">
                <LoaderCircle size={17} />
                <span>{message}</span>
              </div>
            </div>
          )}

          {status === "success" && (
            <div className="lg-verify-state">
              <div className="lg-verify-icon lg-verify-icon--success">
                <CheckCircle2 size={36} />
              </div>

              <h1>Email verified!</h1>

              <p className="lg-lead">
                Your user account is now ready to use.
              </p>

              <div
                className="lg-verify-message lg-verify-message--success"
                role="status"
              >
                <CheckCircle2 size={17} />
                <span>{message}</span>
              </div>

              <button
                type="button"
                className="lg-submit lg-verify-button"
                onClick={handleLogin}
              >
                <span>Continue to sign in</span>
                <ArrowRight size={18} />
              </button>

              <div className="lg-verify-footer">
                <span>Already verified?</span>
                <Link to="/login">Sign in</Link>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="lg-verify-state">
              <div className="lg-verify-icon lg-verify-icon--error">
                <XCircle size={36} />
              </div>

              <h1>Verification failed</h1>

              <p className="lg-lead">We could not verify your email address.</p>

              <div
                className="lg-verify-message lg-verify-message--error"
                role="alert"
              >
                <XCircle size={17} />
                <span>{message}</span>
              </div>

              <button
                type="button"
                className="lg-submit lg-verify-button"
                onClick={handleLogin}
              >
                <span>Go to sign in</span>
                <ArrowRight size={18} />
              </button>

              <div className="lg-verify-footer">
                <span>Need another verification email?</span>
                <Link to="/login">Go to login</Link>
              </div>
            </div>
          )}

          <div className="lg-verify-home">
            <Link to="/">← Back to home</Link>
            <span>·</span>
            <Link to="/projects">Browse software</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default VerifyEmail;
