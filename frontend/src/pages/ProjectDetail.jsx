import { useEffect, useMemo, useState } from "react";

import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  CreditCard,
  FileText,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { getProjectBySlug } from "../api/projects";
import { getMyProject, isSignedIn } from "../api/student";

import { getPlans } from "../api/plans";

import {
  createOrder,
  getActiveOrder,
  getNextPayment,
  createPayment,
  testPaymentSuccess,
} from "../api/orders";

const hasValue = (value) =>
  value !== null && value !== undefined && value !== "";

const formatPrice = (value) => {
  const amount = Number(value);

  if (Number.isNaN(amount)) {
    return "₹0";
  }

  return `₹${amount.toLocaleString("en-IN")}`;
};

const getInstallmentAmount = (plan) => {
  const price = Number(plan?.price || 0);

  const installments = Number(plan?.installments || 1);

  return installments > 0 ? price / installments : price;
};

const getPlanUnlockMap = (plan) => {
  if (!plan?.unlock_map || typeof plan.unlock_map !== "object") {
    return [];
  }

  return Object.entries(plan.unlock_map)

    .sort(([a], [b]) => Number(a) - Number(b))

    .map(([installment, percentage]) => ({
      installment: Number(installment),

      percentage: Number(percentage),
    }));
};

function ProjectDetail() {
  const { slug } = useParams();

  const navigate = useNavigate();

  const location = useLocation();

  const [project, setProject] = useState(null);

  const [plans, setPlans] = useState([]);

  const [loading, setLoading] = useState(true);

  const [plansLoading, setPlansLoading] = useState(true);

  const [orderLoading, setOrderLoading] = useState(false);

  const [paymentLoading, setPaymentLoading] = useState(false);

  const [successLoading, setSuccessLoading] = useState(false);

  const [error, setError] = useState("");

  const [plansError, setPlansError] = useState("");

  const [orderError, setOrderError] = useState("");

  const [paymentError, setPaymentError] = useState("");

  const [paymentSuccess, setPaymentSuccess] = useState("");

  const [order, setOrder] = useState(null);

  const [nextPayment, setNextPayment] = useState(null);

  const [payment, setPayment] = useState(null);

  const [selectedPlanId, setSelectedPlanId] = useState(null);

  /*
   * Payment progress and actual project access are separate.
   * Payment progress comes from the order/payments.
   * Project access comes from /my-projects/{id}.
   */
  const [projectAccess, setProjectAccess] = useState(null);
  const [projectAccessLoading, setProjectAccessLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProject() {
      try {
        const data = await getProjectBySlug(slug);

        if (!cancelled) {
          setProject(data);
        }
      } catch {
        if (!cancelled) {
          setError("Project not found.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProject();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    let cancelled = false;

    async function loadPlans() {
      try {
        const data = await getPlans();

        if (!cancelled) {
          const activePlans = Array.isArray(data)
            ? data.filter((plan) => plan.is_active !== false)
            : [];

          setPlans(activePlans);
        }
      } catch {
        if (!cancelled) {
          setPlansError("Plans are currently unavailable.");
        }
      } finally {
        if (!cancelled) {
          setPlansLoading(false);
        }
      }
    }

    loadPlans();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadProjectAccess = async (projectId) => {
    if (!projectId || !isSignedIn()) {
      setProjectAccess(null);
      return null;
    }

    setProjectAccessLoading(true);

    try {
      const data = await getMyProject(projectId);
      const accessProject = data?.data ?? data;

      setProjectAccess(accessProject ?? null);

      return accessProject ?? null;
    } catch {
      setProjectAccess(null);
      return null;
    } finally {
      setProjectAccessLoading(false);
    }
  };

  useEffect(() => {
    if (!project?.id) {
      setProjectAccess(null);
      return undefined;
    }

    let cancelled = false;

    const loadAccess = async () => {
      if (!isSignedIn()) {
        if (!cancelled) {
          setProjectAccess(null);
        }
        return;
      }

      try {
        setProjectAccessLoading(true);

        const data = await getMyProject(project.id);
        const accessProject = data?.data ?? data;

        if (!cancelled) {
          setProjectAccess(accessProject ?? null);
        }
      } catch {
        if (!cancelled) {
          setProjectAccess(null);
        }
      } finally {
        if (!cancelled) {
          setProjectAccessLoading(false);
        }
      }
    };

    loadAccess();

    return () => {
      cancelled = true;
    };
  }, [project?.id]);

  const loadNextPayment = async (orderId) => {
    try {
      const data = await getNextPayment(orderId);

      setNextPayment(data);

      return data;
    } catch (error) {
      const status = error?.response?.status;

      if (status === 401) {
        navigate("/login", {
          state: {
            from: {
              pathname: location.pathname,

              search: location.search,

              hash: location.hash,
            },

            returnAction: "payment",
          },
        });

        return null;
      }

      throw error;
    }
  };

  const loadActiveOrder = async () => {
    if (!project?.id) {
      return null;
    }

    try {
      const data = await getActiveOrder(project.id);

      const activeOrder = data?.order ?? data;

      if (!activeOrder?.id) {
        throw new Error("Active order was not returned.");
      }

      setOrder(activeOrder);

      setPayment(null);

      const nextPaymentData = await loadNextPayment(activeOrder.id);

      if (nextPaymentData) {
        setNextPayment(nextPaymentData);
      }

      return activeOrder;
    } catch (error) {
      const status = error?.response?.status;

      if (status === 401) {
        navigate("/login", {
          state: {
            from: {
              pathname: location.pathname,

              search: location.search,

              hash: location.hash,
            },

            returnAction: "payment",
          },
        });

        return null;
      }

      throw error;
    }
  };

  const handleSelectPlan = async (plan) => {
    if (!project?.id || !plan?.id || orderLoading) {
      return;
    }

    setSelectedPlanId(plan.id);

    setOrderLoading(true);

    setOrderError("");

    setPaymentError("");

    setPaymentSuccess("");

    setOrder(null);

    setNextPayment(null);

    setPayment(null);

    try {
      const data = await createOrder({
        projectId: project.id,

        planId: plan.id,
      });

      const createdOrder = data?.order ?? data;

      if (!createdOrder?.id) {
        throw new Error("Order ID was not returned.");
      }

      setOrder(createdOrder);

      await loadNextPayment(createdOrder.id);
    } catch (error) {
      const status = error?.response?.status;

      if (status === 401) {
        navigate("/login", {
          state: {
            from: {
              pathname: location.pathname,

              search: location.search,

              hash: location.hash,
            },

            returnAction: "select-plan",
          },
        });

        return;
      }

      if (status === 422) {
        try {
          const activeOrder = await loadActiveOrder();

          const isActiveOrder =
            activeOrder?.status === "pending" ||
            activeOrder?.status === "partial";

          if (isActiveOrder) {
            setOrderError(
              "You already have an active order. Continuing with your existing order.",
            );
          } else {
            setOrderError("");
          }

          return;
        } catch (activeOrderError) {
          const activeStatus = activeOrderError?.response?.status;

          if (activeStatus === 401) {
            navigate("/login", {
              state: {
                from: {
                  pathname: location.pathname,

                  search: location.search,

                  hash: location.hash,
                },

                returnAction: "select-plan",
              },
            });

            return;
          }

          setOrderError(
            activeOrderError?.response?.data?.message ||
              error?.response?.data?.message ||
              "Unable to load your active order.",
          );

          return;
        }
      }

      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Unable to create the order. Please try again.";

      setOrderError(message);
    } finally {
      setOrderLoading(false);

      setSelectedPlanId(null);
    }
  };

  const handleCreatePayment = async () => {
    if (!order?.id || paymentLoading) {
      return;
    }

    setPaymentLoading(true);

    setPaymentError("");

    setPaymentSuccess("");

    try {
      const data = await createPayment(order.id);

      const createdPayment = data?.payment ?? data;

      if (!createdPayment?.id) {
        throw new Error("Payment ID was not returned.");
      }

      setPayment(createdPayment);
    } catch (error) {
      const status = error?.response?.status;

      if (status === 401) {
        navigate("/login", {
          state: {
            from: {
              pathname: location.pathname,

              search: location.search,

              hash: location.hash,
            },

            returnAction: "payment",
          },
        });

        return;
      }

      /*

       * Important:

       * The backend intentionally returns 422 when a payment for the

       * current installment already exists.

       *

       * That response also contains:

       *

       * {

       *   message: "...",

       *   payment: {...}

       * }

       *

       * Instead of showing an error, resume that existing payment.

       */

      const existingPayment = error?.response?.data?.payment;

      if (existingPayment?.id) {
        setPayment(existingPayment);

        setPaymentError("");

        setPaymentSuccess("");

        return;
      }

      setPaymentError(
        error?.response?.data?.message ||
          error?.message ||
          "Unable to create the payment.",
      );
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleTestPaymentSuccess = async () => {
    if (!order?.id || !payment?.id || successLoading) {
      return;
    }

    setSuccessLoading(true);

    setPaymentError("");

    setPaymentSuccess("");

    try {
      const data = await testPaymentSuccess(order.id, payment.id);

      setPaymentSuccess(data?.message || "Payment successful. Stage unlocked.");

      const updatedOrder = data?.order ?? order;

      setOrder(updatedOrder);

      /*
       * Refresh actual user_access after the payment succeeds.
       * The backend updates user_access during testSuccess.
       */
      await loadProjectAccess(project?.id);

      /*

       * Remove the completed payment from the temporary UI state.

       * The next installment will now be loaded from the backend.

       */

      setPayment(null);

      try {
        const nextPaymentData = await loadNextPayment(updatedOrder.id);

        if (nextPaymentData) {
          setNextPayment(nextPaymentData);
        } else {
          setNextPayment(null);
        }
      } catch {
        setNextPayment(null);
      }
    } catch (error) {
      const status = error?.response?.status;

      if (status === 401) {
        navigate("/login", {
          state: {
            from: {
              pathname: location.pathname,

              search: location.search,

              hash: location.hash,
            },

            returnAction: "payment",
          },
        });

        return;
      }

      setPaymentError(
        error?.response?.data?.message ||
          error?.message ||
          "Unable to complete the test payment.",
      );
    } finally {
      setSuccessLoading(false);
    }
  };

  const stages = useMemo(
    () =>
      [...(project?.stages ?? [])].sort(
        (a, b) => (a.stage_percent ?? 0) - (b.stage_percent ?? 0),
      ),

    [project],
  );

  const documents = project?.documents ?? [];

  const currentPlan = useMemo(() => {
    if (!order?.plan_id) {
      return null;
    }

    return (
      plans.find((plan) => Number(plan.id) === Number(order.plan_id)) || null
    );
  }, [plans, order]);

  const currentPlanUnlocks = useMemo(
    () => getPlanUnlockMap(currentPlan),

    [currentPlan],
  );

  const currentInstallment = Number(
    nextPayment?.installment_no ??
      nextPayment?.next_installment ??
      payment?.installment_no ??
      1,
  );

  const totalInstallments = Number(
    nextPayment?.total_installments ??
      currentPlan?.installments ??
      order?.installments ??
      1,
  );

  const paymentAmount = Number(
    nextPayment?.amount ??
      nextPayment?.installment_amount ??
      nextPayment?.payment?.amount ??
      payment?.amount ??
      getInstallmentAmount(currentPlan),
  );

  const unlockPercent = Number(
    nextPayment?.unlock_percent ??
      currentPlanUnlocks.find((item) => item.installment === currentInstallment)
        ?.percentage ??
      0,
  );

  const isOrderComplete =
    order?.status === "complete" ||
    (!nextPayment && paymentSuccess && currentInstallment >= totalInstallments);

  /*

   * Number of successfully completed installments.

   *

   * This is derived from the backend's next installment number,

   * instead of using temporary React state.

   *

   * Therefore it also works after browser refresh.

   */

  const completedInstallments = isOrderComplete
    ? totalInstallments
    : Math.max(currentInstallment - 1, 0);

  const progressPercent =
    totalInstallments > 0
      ? Math.min((completedInstallments / totalInstallments) * 100, 100)
      : 0;

  /*
   * IMPORTANT:
   * Payment progress and actual project access are different.
   *
   * Payment progress tells us how much of the order has been paid.
   * Actual stage access must always come from user_access returned
   * by the authenticated Student API.
   *
   * Therefore an admin revoke wins over an old order that may
   * already contain successful payments.
   */
  const highestUnlockedStage = Number(projectAccess?.highest_stage ?? 0);

  const hasProjectAccess = Boolean(projectAccess?.id);

  const currentProjectPlanName =
    currentPlan?.name || order?.plan?.name || "Selected project plan";

  if (loading) {
    return (
      <main className="pd" aria-busy="true">
        <div className="container" style={{ paddingTop: 48 }}>
          <div className="skeleton skeleton--text" style={{ width: 160 }} />
          <div className="skeleton" style={{ height: 44, width: "min(560px, 90%)", margin: "12px 0 20px" }} />
          <div className="skeleton skeleton--card" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="pd">
        <div className="container">
          <div className="error-state" role="alert">
            <span className="error-state__icon"><AlertTriangle size={24} aria-hidden="true" /></span>
            <h3>{error}</h3>
            <p>The project may have moved or the link may be incorrect.</p>
            <Link to="/projects" className="btn btn-secondary btn-sm">
              <RefreshCw size={15} aria-hidden="true" /> Browse all projects
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="pd">
      <section className="page-hero project-detail-hero">
        <div className="container">
          <Link to="/projects" className="back-link">
            &larr; All projects
          </Link>

          {project.category && (
            <p className="section-heading__eyebrow">{project.category.name}</p>
          )}

          <h1>{project.title}</h1>

          {hasValue(project.abstract) && (
            <p className="page-hero__description">{project.abstract}</p>
          )}

          <div className="project-detail-hero__badges">
            <span
              className={
                project.is_iot ? "badge badge-success" : "badge badge-neutral"
              }
            >
              {project.is_iot ? "IoT Project" : "Software Project"}
            </span>

            {project.is_iot && hasValue(project.iot_kit_link) && (
              <a
                href={project.iot_kit_link}
                className="btn btn-primary btn-sm"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`IoT kit guide for ${project.title}`}
              >
                IoT kit guide
                <ArrowRight size={16} />
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="detail-section detail-section--white">
        <div className="container">
          <div className="section-heading">
            <p className="section-heading__eyebrow">Overview</p>

            <h2>Project information</h2>

            <p>Key public information about this project.</p>
          </div>

          <div className="project-info-grid">
            <article className="project-info-card">
              <span>Category</span>

              <strong>{project.category?.name || "Not available"}</strong>
            </article>

            <article className="project-info-card">
              <span>Project type</span>

              <strong>
                {project.is_iot ? "IoT Project" : "Software Project"}
              </strong>
            </article>

            <article className="project-info-card">
              <span>Stages</span>

              <strong>{stages.length}</strong>
            </article>

            <article className="project-info-card">
              <span>Documents</span>

              <strong>{documents.length}</strong>
            </article>
          </div>
        </div>
      </section>

      <section className="detail-section">
        <div className="container">
          <div className="section-heading">
            <p className="section-heading__eyebrow">Plans</p>

            <h2>Choose your project plan</h2>

            <p>Select a plan to unlock project stages and resources.</p>
          </div>

          {plansLoading ? (
            <div className="project-plan-grid">
              {[0, 1].map((i) => <div key={i} className="skeleton skeleton--card" />)}
            </div>
          ) : plansError ? (
            <p className="state state-error">{plansError}</p>
          ) : plans.length === 0 ? (
            <p className="state-empty">No plans are currently available.</p>
          ) : (
            <div className="project-plan-grid">
              {plans.map((plan) => {
                const installments = Number(plan.installments || 1);

                const price = Number(plan.price || 0);

                const installmentAmount =
                  installments > 0 ? price / installments : price;

                const unlockMap = getPlanUnlockMap(plan);

                const isCurrentPlanLoading =
                  orderLoading && selectedPlanId === plan.id;

                return (
                  <article className="project-plan-card" key={plan.id}>
                    <div className="project-plan-card__header">
                      <div>
                        <p className="section-heading__eyebrow">
                          {plan.code || "PLAN"}
                        </p>

                        <h3>{plan.name}</h3>
                      </div>

                      <div className="project-plan-card__price">
                        <strong>{formatPrice(price)}</strong>

                        <span>
                          {installments > 1
                            ? `${installments} installments`
                            : "One-time payment"}
                        </span>
                      </div>
                    </div>

                    {hasValue(plan.description) && (
                      <p className="project-plan-card__description">
                        {plan.description}
                      </p>
                    )}

                    <div className="project-plan-card__installment">
                      <span>{installments > 1 ? "Pay in installments" : "Payment amount"}</span>
                      <strong>{formatPrice(installmentAmount)}</strong>
                      {installments > 1 && (
                        <small>× {installments} payments · total {formatPrice(price)}</small>
                      )}
                    </div>

                    {unlockMap.length > 0 && (
                      <div className="project-plan-card__unlock">
                        <p>Unlock roadmap</p>
                        <ol className="pd-roadmap">
                          {unlockMap.map(({ installment, percentage }) => (
                            <li key={`${plan.id}-${installment}`}>
                              <span className="pd-roadmap__pct">{percentage}%</span>
                              <span className="pd-roadmap__label">Payment {installment}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleSelectPlan(plan)}
                      disabled={orderLoading}
                    >
                      {isCurrentPlanLoading
                        ? "Loading order..."
                        : "Select plan"}

                      <ArrowRight size={16} />
                    </button>
                  </article>
                );
              })}
            </div>
          )}

          {orderError && (
            <div className="project-plan-card__note state-error">
              {orderError}
            </div>
          )}

          {order && nextPayment && (
            <section className="checkout-card">
              <div className="checkout-card__top">
                <div>
                  <span className="checkout-card__eyebrow">
                    <CreditCard size={15} />
                    Secure checkout
                  </span>

                  <h3>Complete your project payment</h3>

                  <p>
                    {project.title} · {currentProjectPlanName}
                  </p>
                </div>

                <span className="checkout-card__test-badge">Test Mode</span>
              </div>

              <div className="checkout-card__summary">
                <div>
                  <span>Order</span>

                  <strong>#{order.id}</strong>
                </div>

                <div>
                  <span>Total order</span>

                  <strong>{formatPrice(order.total ?? order.amount)}</strong>
                </div>

                <div>
                  <span>Installments</span>

                  <strong>
                    {currentInstallment} / {totalInstallments}
                  </strong>
                </div>
              </div>

              <div className="checkout-progress">
                <div className="checkout-progress__header">
                  <div>
                    <span>Payment progress</span>

                    <strong>
                      {completedInstallments} of {totalInstallments} completed
                    </strong>
                  </div>

                  <span>{Math.round(progressPercent)}%</span>
                </div>

                <div className="checkout-progress__bar">
                  <span
                    style={{
                      width: `${progressPercent}%`,
                    }}
                  />
                </div>

                <div
                  className="checkout-progress__steps"
                  aria-label="Payment installment progress"
                >
                  {Array.from({ length: totalInstallments }, (_, index) => {
                    const installmentNumber = index + 1;

                    const unlock =
                      currentPlanUnlocks.find(
                        (item) => item.installment === installmentNumber,
                      )?.percentage ?? null;

                    const completed =
                      installmentNumber <= completedInstallments;

                    const current =
                      installmentNumber === currentInstallment && !completed;

                    return (
                      <div
                        key={installmentNumber}
                        className={`checkout-progress__step ${
                          completed
                            ? "is-complete"
                            : current
                              ? "is-current"
                              : ""
                        }`}
                      >
                        <span className="checkout-progress__step-marker">
                          {completed ? (
                            <Check size={14} aria-hidden="true" />
                          ) : current ? (
                            installmentNumber
                          ) : (
                            <LockKeyhole size={13} aria-hidden="true" />
                          )}
                        </span>

                        <span className="checkout-progress__step-label">
                          <strong>Payment {installmentNumber}</strong>
                          <small>
                            {unlock !== null ? `${unlock}% unlock · ` : ""}
                            {completed ? "Paid" : current ? "Next" : "Locked"}
                          </small>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="checkout-payment">
                <div className="checkout-payment__amount">
                  <span>Amount to pay</span>

                  <strong>{formatPrice(paymentAmount)}</strong>

                  <small>
                    Installment {currentInstallment} of {totalInstallments}
                  </small>
                </div>

                <div className="checkout-payment__unlock">
                  <div className="checkout-payment__unlock-icon">
                    <LockKeyhole size={20} />
                  </div>

                  <div>
                    <strong>Unlocks Stage {unlockPercent}%</strong>

                    <span>
                      Complete this payment to unlock the next project stage and
                      its available resources.
                    </span>
                  </div>
                </div>
              </div>

              {!payment && !isOrderComplete && (
                <div className="checkout-action">
                  <button
                    type="button"
                    className="checkout-pay-button"
                    onClick={handleCreatePayment}
                    disabled={paymentLoading}
                  >
                    <span>
                      {paymentLoading
                        ? "Creating payment..."
                        : `Pay ${formatPrice(paymentAmount)}`}
                    </span>

                    <ArrowRight size={19} />
                  </button>

                  <div className="checkout-security-note">
                    <ShieldCheck size={15} />

                    <span>Test mode · No real payment is charged</span>
                  </div>
                </div>
              )}

              {payment && (
                <div className="checkout-payment-created">
                  <div className="checkout-payment-created__icon">
                    <CheckCircle2 size={22} />
                  </div>

                  <div className="checkout-payment-created__content">
                    <span>Payment ready to complete</span>

                    <strong>
                      Payment #{payment.id} · {formatPrice(payment.amount)}
                    </strong>

                    <small>
                      Complete the test payment below to unlock Stage{" "}
                      {unlockPercent}%.
                    </small>
                  </div>

                  <button
                    type="button"
                    className="checkout-pay-button"
                    onClick={handleTestPaymentSuccess}
                    disabled={successLoading}
                  >
                    <span>
                      {successLoading
                        ? "Processing..."
                        : "Complete Test Payment"}
                    </span>

                    <ArrowRight size={19} />
                  </button>
                </div>
              )}

              {paymentError && (
                <div className="checkout-message checkout-message--error">
                  {paymentError}
                </div>
              )}

              {paymentSuccess && (
                <div className="checkout-message checkout-message--success">
                  <CheckCircle2 size={18} />

                  <span>{paymentSuccess}</span>
                </div>
              )}
            </section>
          )}

          {order && isOrderComplete && (
            <section className="checkout-complete-card">
              <div className="checkout-complete-card__icon">
                <CheckCircle2 size={28} />
              </div>

              <div>
                <span className="checkout-card__eyebrow">
                  Payment completed
                </span>

                <h3>Project fully unlocked</h3>

                <p>
                  {totalInstallments}/{totalInstallments} installments
                  completed. Open your project workspace to continue.
                </p>
              </div>

              <Link to={`/student/projects/${project.id}`} className="btn btn-primary">
                View My Project
                <ArrowRight size={16} />
              </Link>
            </section>
          )}
        </div>
      </section>

      <section className="detail-section">
        <div className="container">
          <div className="section-heading">
            <p className="section-heading__eyebrow">Progress</p>

            <h2>Project stages</h2>

            <p>Track how this project has progressed stage by stage.</p>
          </div>

          {stages.length > 0 ? (
            <ol className="stage-items">
              {stages.map((stage, index) => {
                const stagePercent = Number(stage.stage_percent) || 0;

                const isUnlocked =
                  hasProjectAccess && highestUnlockedStage >= stagePercent;

                return (
                  <li
                    className={`stage-item ${
                      isUnlocked ? "stage-item--unlocked" : "stage-item--locked"
                    }`}
                    key={stage.id}
                    aria-label={`Stage ${stagePercent} percent${
                      isUnlocked ? ", unlocked" : ", locked"
                    }`}
                  >
                    <span className="stage-item__marker" aria-hidden="true">
                      {isUnlocked ? <Check size={14} /> : <LockKeyhole size={13} />}
                    </span>

                    <div className="stage-item__body">
                      <div className="stage-item__title-row">
                        <h3 className="stage-item__percent">
                          Stage {stagePercent}%
                        </h3>

                        <span className="stage-item__status">
                          {isUnlocked ? "Unlocked" : "Locked"}
                        </span>
                      </div>

                      <p className="stage-item__meta">
                        Step {index + 1} of {stages.length}
                        {hasValue(stage.semester) ? ` · ${stage.semester}` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="state-empty">No stages available.</p>
          )}
        </div>
      </section>

      <section className="detail-section detail-section--white">
        <div className="container">
          <div className="section-heading">
            <p className="section-heading__eyebrow">Resources</p>

            <h2>Project documents</h2>

            <p>Documents and resources associated with this project.</p>
          </div>

          {documents.length > 0 ? (
            <div className="document-grid">
              {documents.map((document) => (
                <article className="document-card" key={document.id}>
                  <span className="document-card__icon"><FileText size={18} aria-hidden="true" /></span>

                  <p className="document-card__type">{document.bundle}</p>

                  {hasValue(document.stage_percent) && (
                    <p className="document-card__meta">
                      Stage {document.stage_percent}%
                    </p>
                  )}

                  {hasValue(document.semester) && (
                    <p className="document-card__meta">{document.semester}</p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="state-empty">No documents available.</p>
          )}
        </div>
      </section>
    </main>
  );
}

export default ProjectDetail;
