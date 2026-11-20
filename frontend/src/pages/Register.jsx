import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import {
  ArrowRight,
  BookOpen,
  Building2,
  Cpu,
  Eye,
  EyeOff,
  FileArchive,
  GraduationCap,
  Lock,
  Mail,
  Phone,
  Presentation,
  ShieldCheck,
  Unlock,
  User,
} from "lucide-react";

import BrandLogo from "../components/common/BrandLogo";
import apiClient from "../api/client";

import "../styles/login.css";
import { useToastOn } from "../components/Toast";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MOBILE_PATTERN = /^[6-9]\d{9}$/;
const PINCODE_PATTERN = /^\d{6}$/;
const DIGIT_FIELDS = { pincode: 6, whatsapp: 10, guide_mobile: 10, second_guide_mobile: 10 };

const STAGES = [
  { pct: 20, title: "Foundation & setup" },
  { pct: 50, title: "Core modules" },
  { pct: 75, title: "Integration & testing" },
  { pct: 100, title: "Final build & report" },
];

const createMember = (isLeader = false) => ({
  name: "",
  email: "",
  student_id: "",
  mobile: "",
  is_leader: isLeader,
});

function Register() {
  const navigate = useNavigate();
  const location = useLocation();

  const [memberCount, setMemberCount] = useState(1);

  const [members, setMembers] = useState([createMember(true)]);

  const [collegeSearch, setCollegeSearch] = useState("");
  const [colleges, setColleges] = useState([]);
  const [selectedCollege, setSelectedCollege] = useState(null);
  const [collegeLoading, setCollegeLoading] = useState(false);
  const [showCollegeResults, setShowCollegeResults] = useState(false);

  const [form, setForm] = useState({
    pincode: "",
    whatsapp: "",
    guide_name: "",
    guide_mobile: "",
    second_guide_name: "",
    second_guide_mobile: "",
    referral_code: "",
    password: "",
    password_confirmation: "",
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useToastOn(error, "error", setError);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        setCollegeLoading(true);

        const response = await apiClient.get("/colleges", {
          params: {
            search: collegeSearch.trim(),
          },
        });

        setColleges(response?.data?.data || []);
      } catch {
        setColleges([]);
      } finally {
        setCollegeLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [collegeSearch]);

  const handleMemberCountChange = (event) => {
    const count = Number(event.target.value);

    if (count < 1 || count > 5) {
      return;
    }

    setMemberCount(count);

    setMembers((current) => {
      if (count > current.length) {
        return [
          ...current,
          ...Array.from({ length: count - current.length }, () =>
            createMember(false),
          ),
        ];
      }

      return current.slice(0, count);
    });

    setFieldErrors({});
    setError("");
  };

  const handleMemberChange = (index, field, value) => {
    if (field === "mobile") value = value.replace(/\D/g, "").slice(0, 10);

    setMembers((current) =>
      current.map((member, memberIndex) =>
        memberIndex === index
          ? {
              ...member,
              [field]: value,
            }
          : member,
      ),
    );

    const errorKey = `members.${index}.${field}`;

    if (fieldErrors[errorKey]) {
      setFieldErrors((current) => ({
        ...current,
        [errorKey]: "",
      }));
    }

    if (error) {
      setError("");
    }
  };

  const handleChange = (event) => {
    let { name, value } = event.target;
    if (DIGIT_FIELDS[name]) value = value.replace(/\D/g, "").slice(0, DIGIT_FIELDS[name]);

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

  const handleCollegeSearchChange = (event) => {
    const value = event.target.value;

    setCollegeSearch(value);
    setSelectedCollege(null);
    setShowCollegeResults(true);

    if (fieldErrors.college_id) {
      setFieldErrors((current) => ({
        ...current,
        college_id: "",
      }));
    }

    if (error) {
      setError("");
    }
  };

  const handleCollegeSelect = (college) => {
    setSelectedCollege(college);
    setCollegeSearch(college.name);
    setShowCollegeResults(false);

    setFieldErrors((current) => ({
      ...current,
      college_id: "",
    }));
  };

  const validate = () => {
    const errors = {};

    if (memberCount < 1 || memberCount > 5) {
      errors.member_count = "Group size must be between 1 and 5 members.";
    }

    members.forEach((member, index) => {
      const name = member.name.trim();
      const email = member.email.trim();
      const studentId = member.student_id.trim();
      const mobile = member.mobile.trim();

      if (!name) {
        errors[`members.${index}.name`] = "Member name is required.";
      } else if (name.length > 255) {
        errors[`members.${index}.name`] =
          "Name must be 255 characters or less.";
      }

      if (!email) {
        errors[`members.${index}.email`] = "Email is required.";
      } else if (!EMAIL_PATTERN.test(email)) {
        errors[`members.${index}.email`] = "Enter a valid email address.";
      }

      if (!studentId) {
        errors[`members.${index}.student_id`] = "User ID is required.";
      }

      if (!mobile) {
        errors[`members.${index}.mobile`] = "Mobile number is required.";
      } else if (!MOBILE_PATTERN.test(mobile)) {
        errors[`members.${index}.mobile`] = "Enter a valid 10-digit mobile number.";
      }
    });

    const emails = members.map((member) => member.email.trim().toLowerCase());

    members.forEach((member, index) => {
      const email = member.email.trim().toLowerCase();

      if (email && emails.indexOf(email) !== emails.lastIndexOf(email)) {
        errors[`members.${index}.email`] =
          "Each member must have a different email.";
      }
    });

    const studentIds = members.map((member) =>
      member.student_id.trim().toLowerCase(),
    );

    members.forEach((member, index) => {
      const studentId = member.student_id.trim().toLowerCase();

      if (
        studentId &&
        studentIds.indexOf(studentId) !== studentIds.lastIndexOf(studentId)
      ) {
        errors[`members.${index}.student_id`] =
          "Each member must have a different user ID.";
      }
    });

    const mobileNumbers = members.map((member) => member.mobile.trim());

    members.forEach((member, index) => {
      const mobile = member.mobile.trim();

      if (
        mobile &&
        mobileNumbers.indexOf(mobile) !== mobileNumbers.lastIndexOf(mobile)
      ) {
        errors[`members.${index}.mobile`] =
          "Each member must have a different mobile number.";
      }
    });

    if (!selectedCollege) {
      errors.college_id = "Please select your college from the list.";
    }

    if (!form.pincode.trim()) {
      errors.pincode = "Pincode is required.";
    } else if (!PINCODE_PATTERN.test(form.pincode.trim())) {
      errors.pincode = "Pincode must be 6 digits.";
    }

    if (!form.whatsapp.trim()) {
      errors.whatsapp = "WhatsApp number is required.";
    } else if (!MOBILE_PATTERN.test(form.whatsapp.trim())) {
      errors.whatsapp = "Enter a valid 10-digit WhatsApp number.";
    }

    if (!form.guide_name.trim()) {
      errors.guide_name = "Guide name is required.";
    }

    if (!form.guide_mobile.trim()) {
      errors.guide_mobile = "Guide mobile number is required.";
    } else if (!MOBILE_PATTERN.test(form.guide_mobile.trim())) {
      errors.guide_mobile = "Enter a valid 10-digit mobile number.";
    }

    if (form.second_guide_name.trim() && !form.second_guide_mobile.trim()) {
      errors.second_guide_mobile = "Second guide mobile number is required.";
    } else if (form.second_guide_mobile.trim() && !MOBILE_PATTERN.test(form.second_guide_mobile.trim())) {
      errors.second_guide_mobile = "Enter a valid 10-digit mobile number.";
    }

    if (form.second_guide_mobile.trim() && !form.second_guide_name.trim()) {
      errors.second_guide_name = "Second guide name is required.";
    }

    if (!form.password) {
      errors.password = "Password is required.";
    } else if (form.password.length < 8) {
      errors.password = "Password must be at least 8 characters.";
    }

    if (!form.password_confirmation) {
      errors.password_confirmation = "Please confirm your password.";
    } else if (form.password !== form.password_confirmation) {
      errors.password_confirmation = "Passwords do not match.";
    }

    setFieldErrors(errors);

    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading || !validate()) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await apiClient.post("/register", {
        members: members.map((member) => ({
          name: member.name.trim(),
          email: member.email.trim().toLowerCase(),
          student_id: member.student_id.trim(),
          mobile: member.mobile.trim(),
          is_leader: member.is_leader,
        })),
        college_id: selectedCollege.id,
        pincode: form.pincode.trim(),
        whatsapp: form.whatsapp.trim(),
        guide_name: form.guide_name.trim(),
        guide_mobile: form.guide_mobile.trim(),
        second_guide_name: form.second_guide_name.trim() || null,
        second_guide_mobile: form.second_guide_mobile.trim() || null,
        referral_code: form.referral_code.trim().toUpperCase() || null,
        password: form.password,
        password_confirmation: form.password_confirmation,
      });

      if (!response?.data?.user) {
        throw new Error("Registration was not completed.");
      }

      navigate("/login", {
        replace: true,
        state: {
          registrationSuccess:
            "Group registered successfully. Please check your email and verify your account before signing in.",
          email: members[0].email.trim(),
          from: location.state?.from,
          returnAction: location.state?.returnAction,
          planId: location.state?.planId,
        },
      });
    } catch (err) {
      const responseErrors = err?.response?.data?.errors;

      if (responseErrors && typeof responseErrors === "object") {
        const mappedErrors = {};

        Object.entries(responseErrors).forEach(([field, messages]) => {
          mappedErrors[field] = Array.isArray(messages)
            ? messages[0]
            : String(messages);
        });

        setFieldErrors(mappedErrors);
      }

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to complete registration. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="lg lg--register">
      <aside className="lg-hero" aria-hidden="true">
        <span className="lg-blob lg-blob--a" />
        <span className="lg-blob lg-blob--b" />

        <div className="lg-hero__inner">
          <span className="lg-pill">
            <ShieldCheck size={14} />
            User portal
          </span>

          <h2>
            Start your Software
            <br />
            software journey.
          </h2>

          <p>
            Create your user account and access AI, ML, IoT and embedded
            software with source code, documents, videos and presentations.
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

      <section className="lg-panel lg-panel--register">
        <div className="lg-card lg-card--register">
          <Link to="/" className="lg-brand" aria-label="Back to home">
            <BrandLogo markClassName="lg-brand__icon" />
          </Link>

          <h1>Create your group account</h1>

          <p className="lg-lead">
            Register your software group to access software and resources.
          </p>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="lg-form lg-form--register"
          >
            <div className="lg-register-top">
              <div className="lg-field">
                <label htmlFor="register-member-count">Group size</label>

                <div className="lg-input">
                  <User
                    size={17}
                    className="lg-input__icon"
                    aria-hidden="true"
                  />

                  <select
                    id="register-member-count"
                    value={memberCount}
                    onChange={handleMemberCountChange}
                    required
                  >
                    <option value={1}>1 Member</option>
                    <option value={2}>2 Members</option>
                    <option value={3}>3 Members</option>
                    <option value={4}>4 Members</option>
                    <option value={5}>5 Members</option>
                  </select>
                </div>
              </div>

              <div className="lg-field">
                <label htmlFor="register-college">College</label>

                <div className="lg-input">
                  <Building2
                    size={17}
                    className="lg-input__icon"
                    aria-hidden="true"
                  />

                  <input
                    id="register-college"
                    type="text"
                    placeholder="Search college"
                    value={collegeSearch}
                    onChange={handleCollegeSearchChange}
                    onFocus={() => setShowCollegeResults(true)}
                    autoComplete="off"
                    required
                  />
                </div>

                {showCollegeResults && (
                  <div className="lg-college-results">
                    {collegeLoading && (
                      <div className="lg-college-result">Searching...</div>
                    )}

                    {!collegeLoading &&
                      colleges.length === 0 &&
                      collegeSearch.trim() && (
                        <div className="lg-college-result">
                          No colleges found.
                        </div>
                      )}

                    {!collegeLoading &&
                      colleges.map((college) => (
                        <button
                          type="button"
                          className="lg-college-result"
                          key={college.id}
                          onClick={() => handleCollegeSelect(college)}
                        >
                          <Building2 size={15} />
                          <span>{college.name}</span>
                        </button>
                      ))}
                  </div>
                )}

                {selectedCollege && (
                  <p className="lg-field__hint">{selectedCollege.name}</p>
                )}

                {fieldErrors.college_id && (
                  <p className="lg-field__error" role="alert">
                    {fieldErrors.college_id}
                  </p>
                )}
              </div>

              <div className="lg-field">
                <label htmlFor="register-pincode">Pincode</label>

                <div className="lg-input">
                  <Building2
                    size={17}
                    className="lg-input__icon"
                    aria-hidden="true"
                  />

                  <input
                    id="register-pincode"
                    type="text"
                    name="pincode"
                    placeholder="Pincode"
                    value={form.pincode}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>

            {members.map((member, index) => (
              <div className="lg-member" key={index}>
                <div className="lg-member__title">
                  <div>
                    <strong>
                      Member {index + 1}
                      {member.is_leader ? " — Team Lead" : ""}
                    </strong>

                    {member.is_leader && (
                      <span>Login account & verification email</span>
                    )}
                  </div>
                </div>

                <div className="lg-member__grid">
                  <div className="lg-field">
                    <label htmlFor={`member-${index}-name`}>Full name</label>

                    <div className="lg-input">
                      <User
                        size={16}
                        className="lg-input__icon"
                        aria-hidden="true"
                      />

                      <input
                        id={`member-${index}-name`}
                        type="text"
                        placeholder="Full name"
                        value={member.name}
                        onChange={(event) =>
                          handleMemberChange(index, "name", event.target.value)
                        }
                        required
                      />
                    </div>

                    {fieldErrors[`members.${index}.name`] && (
                      <p className="lg-field__error" role="alert">
                        {fieldErrors[`members.${index}.name`]}
                      </p>
                    )}
                  </div>

                  <div className="lg-field">
                    <label htmlFor={`member-${index}-email`}>Email</label>

                    <div className="lg-input">
                      <Mail
                        size={16}
                        className="lg-input__icon"
                        aria-hidden="true"
                      />

                      <input
                        id={`member-${index}-email`}
                        type="email"
                        placeholder="Email"
                        value={member.email}
                        onChange={(event) =>
                          handleMemberChange(index, "email", event.target.value)
                        }
                        required
                      />
                    </div>

                    {fieldErrors[`members.${index}.email`] && (
                      <p className="lg-field__error" role="alert">
                        {fieldErrors[`members.${index}.email`]}
                      </p>
                    )}
                  </div>

                  <div className="lg-field">
                    <label htmlFor={`member-${index}-student-id`}>
                      User ID
                    </label>

                    <div className="lg-input">
                      <GraduationCap
                        size={16}
                        className="lg-input__icon"
                        aria-hidden="true"
                      />

                      <input
                        id={`member-${index}-student-id`}
                        type="text"
                        placeholder="User ID"
                        value={member.student_id}
                        onChange={(event) =>
                          handleMemberChange(
                            index,
                            "student_id",
                            event.target.value,
                          )
                        }
                        required
                      />
                    </div>

                    {fieldErrors[`members.${index}.student_id`] && (
                      <p className="lg-field__error" role="alert">
                        {fieldErrors[`members.${index}.student_id`]}
                      </p>
                    )}
                  </div>

                  <div className="lg-field">
                    <label htmlFor={`member-${index}-mobile`}>Mobile</label>

                    <div className="lg-input">
                      <Phone
                        size={16}
                        className="lg-input__icon"
                        aria-hidden="true"
                      />

                      <input
                        id={`member-${index}-mobile`}
                        type="tel"
                        placeholder="Mobile number"
                        value={member.mobile}
                        onChange={(event) =>
                          handleMemberChange(
                            index,
                            "mobile",
                            event.target.value,
                          )
                        }
                        required
                      />
                    </div>

                    {fieldErrors[`members.${index}.mobile`] && (
                      <p className="lg-field__error" role="alert">
                        {fieldErrors[`members.${index}.mobile`]}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <div className="lg-register-grid">
              <div className="lg-field">
                <label htmlFor="register-whatsapp">WhatsApp</label>

                <div className="lg-input">
                  <Phone
                    size={16}
                    className="lg-input__icon"
                    aria-hidden="true"
                  />

                  <input
                    id="register-whatsapp"
                    type="tel"
                    name="whatsapp"
                    placeholder="WhatsApp number"
                    value={form.whatsapp}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="lg-field">
                <label htmlFor="register-guide-name">Main guide</label>

                <div className="lg-input">
                  <User
                    size={16}
                    className="lg-input__icon"
                    aria-hidden="true"
                  />

                  <input
                    id="register-guide-name"
                    type="text"
                    name="guide_name"
                    placeholder="Guide name"
                    value={form.guide_name}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="lg-field">
                <label htmlFor="register-guide-mobile">Guide mobile</label>

                <div className="lg-input">
                  <Phone
                    size={16}
                    className="lg-input__icon"
                    aria-hidden="true"
                  />

                  <input
                    id="register-guide-mobile"
                    type="tel"
                    name="guide_mobile"
                    placeholder="Guide mobile"
                    value={form.guide_mobile}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="lg-field">
                <label htmlFor="register-second-guide-name">Second guide</label>

                <div className="lg-input">
                  <User
                    size={16}
                    className="lg-input__icon"
                    aria-hidden="true"
                  />

                  <input
                    id="register-second-guide-name"
                    type="text"
                    name="second_guide_name"
                    placeholder="Optional"
                    value={form.second_guide_name}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="lg-field">
                <label htmlFor="register-second-guide-mobile">
                  Second guide mobile
                </label>

                <div className="lg-input">
                  <Phone
                    size={16}
                    className="lg-input__icon"
                    aria-hidden="true"
                  />

                  <input
                    id="register-second-guide-mobile"
                    type="tel"
                    name="second_guide_mobile"
                    placeholder="Optional"
                    value={form.second_guide_mobile}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="lg-field">
                <label htmlFor="register-referral-code">
                  Referral Code (Optional)
                </label>

                <div className="lg-input">
                  <ShieldCheck
                    size={16}
                    className="lg-input__icon"
                    aria-hidden="true"
                  />

                  <input
                    id="register-referral-code"
                    type="text"
                    name="referral_code"
                    placeholder="Enter referral code"
                    value={form.referral_code}
                    onChange={(event) =>
                      handleChange(event)
                    }
                    maxLength={32}
                    autoComplete="off"
                  />
                </div>

                {fieldErrors.referral_code && (
                  <p className="lg-field__error" role="alert">
                    {fieldErrors.referral_code}
                  </p>
                )}
              </div>

              <div className="lg-field">
                <label htmlFor="register-password">Password</label>

                <div className="lg-input">
                  <Lock
                    size={16}
                    className="lg-input__icon"
                    aria-hidden="true"
                  />

                  <input
                    id="register-password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="Create password"
                    value={form.password}
                    onChange={handleChange}
                    required
                    autoComplete="new-password"
                  />

                  <button
                    type="button"
                    className="lg-input__toggle"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={17} aria-hidden="true" />
                    ) : (
                      <Eye size={17} aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <div className="lg-field">
                <label htmlFor="register-password-confirmation">
                  Confirm password
                </label>

                <div className="lg-input">
                  <Lock
                    size={16}
                    className="lg-input__icon"
                    aria-hidden="true"
                  />

                  <input
                    id="register-password-confirmation"
                    type={showConfirmPassword ? "text" : "password"}
                    name="password_confirmation"
                    placeholder="Confirm password"
                    value={form.password_confirmation}
                    onChange={handleChange}
                    required
                    autoComplete="new-password"
                  />

                  <button
                    type="button"
                    className="lg-input__toggle"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    aria-label={
                      showConfirmPassword
                        ? "Hide confirm password"
                        : "Show confirm password"
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={17} aria-hidden="true" />
                    ) : (
                      <Eye size={17} aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <button type="submit" className="lg-submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="lg-spinner" aria-hidden="true" />
                  Creating group...
                </>
              ) : (
                <>
                  Create group account
                  <ArrowRight size={18} aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          <p className="lg-note">
            Already have an account?
            <Link
              to="/login"
              state={{
                from: location.state?.from,
                returnAction: location.state?.returnAction,
                planId: location.state?.planId,
              }}
            >
              Sign in
            </Link>
            <span aria-hidden="true">·</span>
            <Link to="/projects">Browse software</Link>
          </p>
        </div>
      </section>
    </main>
  );
}

export default Register;
