import { useEffect, useState } from "react";

import { Link, useLocation, useNavigate } from "react-router-dom";

import {
  ArrowRight,
  BookOpen,
  Cpu,
  Eye,
  EyeOff,
  FileArchive,
  Lock,
  Mail,
  PlayCircle,
  Presentation,
  ShieldCheck,
  Unlock,
} from "lucide-react";

import BrandLogo from "../components/common/BrandLogo";

import { login } from "../api/student";

import { setToken } from "../api/client";

import "../styles/login.css";
import { useToastOn } from "../components/Toast";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STAGES = [
  { pct: 20, title: "Foundation & setup" },
  { pct: 50, title: "Core modules" },
  { pct: 75, title: "Integration & testing" },
  { pct: 100, title: "Final build & report" },
];

const CATEGORIES = ["AI & ML", "Deep Learning", "IoT", "Embedded"];

function Login() {
  const navigate = useNavigate();

  const location = useLocation();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [fieldErrors, setFieldErrors] = useState({});

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  useToastOn(error, "error", setError);

  const registrationSuccess = location.state?.registrationSuccess;

  const fromLocation = location.state?.from;

  useEffect(() => {
    if (location.state?.email) {
      setForm((current) => ({
        ...current,
        email: location.state.email,
      }));
    }
  }, [location.state?.email]);

  const getReturnPath = () => {
    const path =
      typeof fromLocation === "string" ? fromLocation : fromLocation?.pathname;

    const useful =
      path && path !== "/" && path !== "/login" && path !== "/register";

    if (!useful) {
      return "/student";
    }

    if (typeof fromLocation === "string") {
      return fromLocation;
    }

    return `${fromLocation.pathname}${fromLocation.search || ""}${
      fromLocation.hash || ""
    }`;
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    if (fieldErrors[name]) {
      setFieldErrors((current) => ({
        ...current,
        [name]: "",
      }));
    }

    if (error) {
      setError("");
    }
  };

  const validate = () => {
    const email = form.email.trim();

    const errors = {};

    if (!email) {
      errors.email = "Email is required.";
    } else if (!EMAIL_PATTERN.test(email)) {
      errors.email = "Enter a valid email address.";
    }

    if (!form.password) {
      errors.password = "Password is required.";
    }

    setFieldErrors(errors);

    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading) return;

    if (!validate()) return;

    try {
      setLoading(true);

      setError("");

      const response = await login({
        email: form.email.trim(),
        password: form.password,
      });

      const token =
        response?.token || response?.data?.token || response?.access_token;

      if (!token) {
        throw new Error("Login token was not returned.");
      }

      setToken(token);

      sessionStorage.setItem(
        "auth:backGuard",
        String(window.history.state?.idx ?? 0),
      );

      if (response?.user?.role === "admin") {
        navigate("/admin/users", { replace: true });
      } else {
        navigate(getReturnPath(), {
          replace: true,
          state: {
            returnAction: location.state?.returnAction,
            planId: location.state?.planId,
          },
        });
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Invalid email or password.",
      );
    } finally {
      setLoading(false);
    }
  };

  const emailError = fieldErrors.email;

  const passwordError = fieldErrors.password;

  return (
    <main className="lg">
      <aside className="lg-hero" aria-hidden="true">
        <span className="lg-blob lg-blob--a" />

        <span className="lg-blob lg-blob--b" />

        <div className="lg-hero__inner">
          <span className="lg-pill">
            <ShieldCheck size={14} /> User portal
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

                <small>Files unlock after each verified payment</small>
              </div>
            </div>

            <ol className="lg-stages">
              {STAGES.map((s, i) => (
                <li key={s.pct} style={{ "--i": i }}>
                  <span className="lg-stages__pct">{s.pct}%</span>

                  <div className="lg-stages__body">
                    <b>{s.title}</b>

                    <div className="lg-files">
                      <span>
                        <FileArchive size={12} /> Code ZIP
                      </span>

                      <span>
                        <PlayCircle size={12} /> Video
                      </span>

                      <span>
                        <Presentation size={12} /> PPT
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <ul className="lg-points">
            <li>
              <BookOpen size={16} /> Black book and semester reports
            </li>

            <li>
              <Unlock size={16} /> Pay in installments, unlock as you go
            </li>

            <li>
              <ShieldCheck size={16} /> Secure, access-checked downloads
            </li>
          </ul>
        </div>
      </aside>

      <section className="lg-panel">
        <div className="lg-card">
          <Link to="/" className="lg-brand" aria-label="Back to home">
            <BrandLogo markClassName="lg-brand__icon" />
          </Link>

          <h1>Welcome back</h1>

          <p className="lg-lead">
            Sign in to access your software and unlocked resources.
          </p>

          {registrationSuccess && (
            <div className="lg-success" role="status">
              {registrationSuccess}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="lg-form">
            <div className="lg-field">
              <label htmlFor="login-email">Email</label>

              <div className="lg-input">
                <Mail size={18} className="lg-input__icon" aria-hidden="true" />

                <input
                  id="login-email"
                  type="email"
                  name="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                  aria-required="true"
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={
                    emailError ? "login-email-error" : undefined
                  }
                />
              </div>

              {emailError && (
                <p
                  className="lg-field__error"
                  id="login-email-error"
                  role="alert"
                >
                  {emailError}
                </p>
              )}
            </div>

            <div className="lg-field">
              <label htmlFor="login-password">Password</label>

              <div className="lg-input">
                <Lock size={18} className="lg-input__icon" aria-hidden="true" />

                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  autoComplete="current-password"
                  aria-required="true"
                  aria-invalid={Boolean(passwordError)}
                  aria-describedby={
                    passwordError ? "login-password-error" : undefined
                  }
                />

                <button
                  type="button"
                  className="lg-input__toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <EyeOff size={18} aria-hidden="true" />
                  ) : (
                    <Eye size={18} aria-hidden="true" />
                  )}
                </button>
              </div>

              {passwordError && (
                <p
                  className="lg-field__error"
                  id="login-password-error"
                  role="alert"
                >
                  {passwordError}
                </p>
              )}
            </div>

            <button type="submit" className="lg-submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="lg-spinner" aria-hidden="true" /> Signing
                  in...
                </>
              ) : (
                <>
                  Sign in <ArrowRight size={18} aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          <div className="lg-divider">
            <span>New here?</span>
          </div>

          <div className="lg-actions">
            <Link
              to="/register"
              className="lg-btn lg-btn--outline"
              state={{
                from: location.state?.from,
                returnAction: location.state?.returnAction,
                planId: location.state?.planId,
              }}
            >
              Create account
            </Link>

            <Link to="/projects" className="lg-btn lg-btn--ghost">
              Browse software
            </Link>
          </div>

          <p className="lg-note">
            <Link to="/">&larr; Back to home</Link>
          </p>
        </div>
      </section>
    </main>
  );
}

export default Login;
