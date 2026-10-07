import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { login } from "../api/student";

import { setToken } from "../api/client";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  const fromLocation = location.state?.from;

  const getReturnPath = () => {
    if (!fromLocation) {
      return "/student";
    }

    if (typeof fromLocation === "string") {
      return fromLocation;
    }

    return `${fromLocation.pathname || "/student"}${
      fromLocation.search || ""
    }${fromLocation.hash || ""}`;
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

      if (response?.user?.role === "admin") {
        navigate("/admin/users", { replace: true });
      } else {
        navigate(getReturnPath(), { replace: true });
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
    <main className="student-page">
      <section className="student-auth-page">
        <div className="student-auth-card">
          <span className="student-dashboard__eyebrow">Student Access</span>

          <h1>Sign in</h1>

          <p>Sign in to access your projects and unlocked resources.</p>

          <form onSubmit={handleSubmit} noValidate>
            <label htmlFor="login-email">Email</label>

            <input
              id="login-email"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              autoComplete="email"
              aria-required="true"
              aria-invalid={Boolean(emailError)}
              aria-describedby={emailError ? "login-email-error" : undefined}
            />

            {emailError && (
              <p className="student-field-error" id="login-email-error">
                {emailError}
              </p>
            )}

            <label htmlFor="login-password">Password</label>

            <input
              id="login-password"
              type="password"
              name="password"
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

            {passwordError && (
              <p className="student-field-error" id="login-password-error">
                {passwordError}
              </p>
            )}

            {error && (
              <div className="student-state student-state--error">{error}</div>
            )}

            <button type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

export default Login;
