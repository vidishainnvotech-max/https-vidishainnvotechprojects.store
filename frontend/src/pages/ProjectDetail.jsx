import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Cpu,
  CreditCard,
  FileText,
  Layers,
  ListChecks,
  LockKeyhole,
  PackageOpen,
  RefreshCw,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { getProjectBySlug } from "../api/projects";
import { getProjectImage } from "../utils/projectImages";
import { softwareLabel } from "../utils/visibleText";
import { getMyProject, isSignedIn } from "../api/student";
import { getPlans } from "../api/plans";
import {
  createOrder,
  getActiveOrder,
  getNextPayment,
  createPayment,
  testPaymentSuccess,
  verifyRazorpayPayment,
} from "../api/orders";
import apiClient from "../api/client";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "../styles/project-detail-polish.css";
import { useToastOn } from "../components/Toast";
const hasValue = (value) =>
  value !== null && value !== undefined && value !== "";
const formatPrice = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return "₹0";
  }
  return `₹${amount.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
};
const getInstallmentAmount = (plan, isIoT = false, installmentNo = 1) => {
  const price = Number(plan?.price || 0);
  const installments = Number(plan?.installments || 1);
  const code = String(plan?.code || "").toUpperCase();
  // Guide v3 IoT B2 assumption: 75% on payment 1, remaining 25% on payment 2.
  if (isIoT && code === "B2" && installments === 2) {
    return installmentNo <= 1 ? price * 0.75 : price * 0.25;
  }
  return installments > 0 ? price / installments : price;
};
const getPlanUnlockMap = (plan) => {
  const unlockMap = plan?.unlock_map;
  if (!unlockMap || typeof unlockMap !== "object") {
    return [];
  }
  if (Array.isArray(unlockMap)) {
    return unlockMap.map((percentage, index) => ({
      installment: index + 1,
      stages: Array.isArray(percentage?.stages)
        ? percentage.stages.map(Number).filter(Number.isFinite)
        : [Number(typeof percentage === "object" ? percentage?.percentage ?? 0 : percentage)].filter(Number.isFinite),
      bundles: Array.isArray(percentage?.bundles) ? percentage.bundles : [],
    }));
  }
  return Object.entries(unlockMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([installment, rule]) => ({
      installment: Number(installment),
      stages: Array.isArray(rule?.stages)
        ? rule.stages.map(Number).filter(Number.isFinite)
        : [Number(typeof rule === "object" ? rule?.percentage ?? 0 : rule)].filter(Number.isFinite),
      bundles: Array.isArray(rule?.bundles) ? rule.bundles : [],
    }));
};
const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message ||
  error?.response?.data?.errors?.order_id?.[0] ||
  error?.response?.data?.errors?.shipping_address?.[0] ||
  error?.message ||
  fallback;

let razorpayScriptPromise;
const loadRazorpayCheckout = () => {
  if (window.Razorpay) return Promise.resolve();
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Unable to load Razorpay checkout."));
    document.head.appendChild(script);
  });

  return razorpayScriptPromise;
};
const SHIPMENT_STATUS_LABELS = {
  pending: "Pending",
  packed: "Packed",
  shipped: "Shipped",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
const getShipmentStatusLabel = (shipment) => shipment?.delivery_method === "pickup"
  ? ({ pending: "Pickup requested", packed: "Ready for pickup", delivered: "Picked up", cancelled: "Pickup cancelled" }[shipment.status] || shipment.status)
  : (SHIPMENT_STATUS_LABELS[shipment?.status] || shipment?.status);
const INITIAL_SHIPPING_FORM = {
  delivery_method: "delivery",
  recipient_name: "",
  recipient_phone: "",
  shipping_address: "",
  city: "",
  state: "",
  postal_code: "",
  country: "India",
  quantity: 1,
};
function ProjectDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [project, setProject] = useState(null);
  const [imageFailed, setImageFailed] = useState(false);
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
  const [checkoutGateway, setCheckoutGateway] = useState(null);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [projectAccess, setProjectAccess] = useState(null);
  const [projectAccessLoading, setProjectAccessLoading] = useState(false);
  const [shipments, setShipments] = useState([]);
  const [shipmentsLoading, setShipmentsLoading] = useState(false);
  const [shipmentSubmitting, setShipmentSubmitting] = useState(false);
  const [shipmentError, setShipmentError] = useState("");
  const [shipmentSuccess, setShipmentSuccess] = useState("");
  const [shippingForm, setShippingForm] = useState(INITIAL_SHIPPING_FORM);
  const [selectedShipmentOrderId, setSelectedShipmentOrderId] = useState("");
  const [pendingIotPlan, setPendingIotPlan] = useState(null);
  useEffect(() => {
    if (!pendingIotPlan) return undefined;

    const scrollPosition = window.scrollY;
    const body = document.body;
    const root = document.documentElement;
    const previous = {
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
      rootOverflow: root.style.overflow,
    };

    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollPosition}px`;
    body.style.width = "100%";

    return () => {
      root.style.overflow = previous.rootOverflow;
      body.style.overflow = previous.bodyOverflow;
      body.style.position = previous.bodyPosition;
      body.style.top = previous.bodyTop;
      body.style.width = previous.bodyWidth;
      window.scrollTo(0, scrollPosition);
    };
  }, [pendingIotPlan]);
  useToastOn(orderError, "error", setOrderError);
  useToastOn(paymentError, "error", setPaymentError);
  useToastOn(paymentSuccess, "success");
  useToastOn(shipmentError, "error", setShipmentError);
  useToastOn(shipmentSuccess, "success", setShipmentSuccess);
  const signedIn = isSignedIn();
  const isMiniProject = project?.project_type === "diploma_mini";
  const miniOfferPrice = Number(project?.offer_price || 0);
  const miniCutPrice = Number(project?.cut_price || 0);
  useEffect(() => {
    let cancelled = false;
    async function loadProject() {
      try {
        const data = await getProjectBySlug(slug);
        if (!cancelled) {
          setProject(data);
          setError("");
        }
      } catch {
        if (!cancelled) {
          setError("Software not found.");
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
    let cancelled = false;
    async function loadAccess() {
      if (!project?.id || !isSignedIn()) {
        setProjectAccess(null);
        return;
      }
      setProjectAccessLoading(true);
      try {
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
    }
    loadAccess();
    return () => {
      cancelled = true;
    };
  }, [project?.id]);
  const loadShipments = async () => {
    if (!isSignedIn()) {
      setShipments([]);
      return [];
    }
    setShipmentsLoading(true);
    try {
      const response = await apiClient.get("/iot-shipments");
      const data = response?.data?.data;
      const items = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
          ? data.data
          : [];
      setShipments(items);
      return items;
    } catch (error) {
      setShipmentError(
        getErrorMessage(error, "Unable to load shipment requests."),
      );
      return [];
    } finally {
      setShipmentsLoading(false);
    }
  };
  useEffect(() => {
    if (!project?.id || !project?.is_iot || !isSignedIn()) {
      setShipments([]);
      return;
    }
    let cancelled = false;
    async function loadProjectShipments() {
      setShipmentsLoading(true);
      try {
        const response = await apiClient.get("/iot-shipments");
        const data = response?.data?.data;
        const items = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
            ? data.data
            : [];
        if (!cancelled) {
          setShipments(
            items.filter(
              (shipment) =>
                Number(shipment.project_id) === Number(project.id),
            ),
          );
        }
      } catch {
        if (!cancelled) {
          setShipmentError("Unable to load shipment requests.");
        }
      } finally {
        if (!cancelled) {
          setShipmentsLoading(false);
        }
      }
    }
    loadProjectShipments();
    return () => {
      cancelled = true;
    };
  }, [project?.id, project?.is_iot, project?.project_type]);
  const loadNextPayment = async (orderId) => {
    try {
      const data = await getNextPayment(orderId);
      setNextPayment(data);
      return data;
    } catch (error) {
      if (error?.response?.status === 401) {
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
      setCheckoutGateway(null);
      const nextPaymentData = await loadNextPayment(activeOrder.id);
      if (nextPaymentData) {
        setNextPayment(nextPaymentData);
      }
      return activeOrder;
    } catch (error) {
      if (error?.response?.status === 401) {
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
  useEffect(() => {
    if (!project?.id || !isSignedIn()) {
      return undefined;
    }
    let cancelled = false;
    async function resumeOrder() {
      try {
        const data = await getActiveOrder(project.id);
        const activeOrder = data?.order ?? data;
        if (!activeOrder?.id || cancelled) {
          return;
        }
        setOrder(activeOrder);
        try {
          const next = await getNextPayment(activeOrder.id);
          if (!cancelled) {
            setNextPayment(next);
          }
        } catch {
          if (!cancelled) {
            setNextPayment(null);
          }
        }
      } catch {
        // No active order: keep plan selection available.
      }
    }
    resumeOrder();
    return () => {
      cancelled = true;
    };
  }, [project?.id]);
  const createPlanOrder = async (plan, shipment = null) => {
    if (
      !project?.id ||
      !plan?.id ||
      plan.demo ||
      orderLoading ||
      order
    ) {
      return;
    }
    if (!isSignedIn()) {
      navigate("/login", {
        state: {
          from: {
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
          },
          returnAction: "select-plan",
          planId: plan.id,
        },
      });
      return;
    }
    setSelectedPlanId(plan.id);
    setOrderLoading(true);
    setOrderError("");
    setPaymentError("");
    setPaymentSuccess("");
    try {
      const data = await createOrder({
        projectId: project.id,
        planId: plan.id,
        shipment,
      });
      const createdOrder = data?.order ?? data;
      if (!createdOrder?.id) {
        throw new Error("Order ID was not returned.");
      }
      setOrder(createdOrder);
      setPendingIotPlan(null);
      setShippingForm(INITIAL_SHIPPING_FORM);
      if (createdOrder.shipment) {
        setShipments((current) => {
          const withoutCurrent = current.filter(
            (item) => Number(item.id) !== Number(createdOrder.shipment.id),
          );
          return [createdOrder.shipment, ...withoutCurrent];
        });
      }
      await loadNextPayment(createdOrder.id);
    } catch (error) {
      if (error?.response?.status === 401) {
        navigate("/login", {
          state: {
            from: {
              pathname: location.pathname,
              search: location.search,
              hash: location.hash,
            },
            returnAction: "select-plan",
            planId: plan.id,
          },
        });
        return;
      }
      if (error?.response?.status === 422) {
        const originalMessage = getErrorMessage(error, "Unable to create the order.");
        if (originalMessage.toLowerCase().includes("active order")) {
          try {
            await loadActiveOrder();
            setPendingIotPlan(null);
            setOrderError("");
            return;
          } catch {
            setOrderError(originalMessage);
            return;
          }
        }
        setOrderError(originalMessage);
        return;
      }
      setOrderError(
        getErrorMessage(error, "Unable to create the order. Please try again."),
      );
    } finally {
      setOrderLoading(false);
      setSelectedPlanId(null);
    }
  };
  const handleSelectPlan = async (plan) => {
    if (
      !project?.id ||
      !plan?.id ||
      plan.demo ||
      orderLoading ||
      order
    ) {
      return;
    }
    if (!isSignedIn()) {
      navigate("/login", {
        state: {
          from: {
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
          },
          returnAction: "select-plan",
          planId: plan.id,
        },
      });
      return;
    }

    if (project.is_iot && project.project_type !== "diploma_mini") {
      setPendingIotPlan(plan);
      setOrderError("");
      return;
    }

    await createPlanOrder(plan);
  };
  const handleIotOrderSubmit = async (event) => {
    event.preventDefault();
    if (!pendingIotPlan || orderLoading) return;
    const delivery = {
      ...shippingForm,
      quantity: Number(shippingForm.quantity || 1),
    };
    if (pendingIotPlan.isMini) {
      await handleBuyMiniProject(delivery);
      return;
    }
    await createPlanOrder(pendingIotPlan, delivery);
  };
  const handleBuyMiniProject = async (shipment = null) => {
    if (!project?.id || orderLoading || order || miniOfferPrice <= 0) return;
    if (!isSignedIn()) {
      navigate("/login", {
        state: {
          from: { pathname: location.pathname, search: location.search, hash: location.hash },
          returnAction: "mini-purchase",
        },
      });
      return;
    }
    if (project.is_iot && !shipment) {
      setPendingIotPlan({ id: "mini", name: "One-time Small Software purchase", isMini: true });
      setOrderError("");
      return;
    }
    setSelectedPlanId("mini");
    setOrderLoading(true);
    setOrderError("");
    setPaymentError("");
    setPaymentSuccess("");
    try {
      const data = await createOrder({ projectId: project.id, shipment });
      const createdOrder = data?.order ?? data;
      if (!createdOrder?.id) throw new Error("Order ID was not returned.");
      setOrder(createdOrder);
      setPendingIotPlan(null);
      setShippingForm(INITIAL_SHIPPING_FORM);
      if (createdOrder.shipment) {
        setShipments((current) => [
          createdOrder.shipment,
          ...current.filter((item) => Number(item.id) !== Number(createdOrder.shipment.id)),
        ]);
      }
      await loadNextPayment(createdOrder.id);
    } catch (error) {
      if (error?.response?.status === 401) {
        navigate("/login", {
          state: {
            from: { pathname: location.pathname, search: location.search, hash: location.hash },
            returnAction: "mini-purchase",
          },
        });
        return;
      }
      if (error?.response?.status === 422) {
        const originalMessage = getErrorMessage(error, "Unable to create the Small Software order.");
        if (originalMessage.toLowerCase().includes("active order")) {
          try {
            await loadActiveOrder();
            setPendingIotPlan(null);
            setOrderError("");
            return;
          } catch {
            setOrderError(originalMessage);
            return;
          }
        }
        setOrderError(originalMessage);
        return;
      }
      setOrderError(getErrorMessage(error, "Unable to create the Small Software order. Please try again."));
    } finally {
      setOrderLoading(false);
      setSelectedPlanId(null);
    }
  };
  const resumedRef = useRef(false);
  useEffect(() => {
    const { returnAction, planId } = location.state || {};
    const isMiniPurchase = returnAction === "mini-purchase";
    if (resumedRef.current || (!isMiniPurchase && (returnAction !== "select-plan" || !planId || plansLoading)) || !project?.id || (isMiniPurchase && !isMiniProject) || !isSignedIn()) return;
    resumedRef.current = true;
    const plan = plans.find((item) => Number(item.id) === Number(planId));
    navigate(location.pathname + location.search, { replace: true, state: null });
    if (isMiniPurchase) window.setTimeout(() => handleBuyMiniProject(), 0);
    else if (plan) window.setTimeout(() => handleSelectPlan(plan), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, plans, plansLoading, isMiniProject]);
  const applyCompletedPayment = async (data) => {
    setPaymentSuccess(data?.message || "Payment successful. Stage unlocked.");
    const updatedOrder = data?.order ?? order;
    setOrder(updatedOrder);
    setPayment(null);
    setCheckoutGateway(null);
    try {
      await loadProjectAccess(project?.id);
    } catch {
      // Payment is already verified; access will refresh on the next page load.
    }
    try {
      const nextPaymentData = await loadNextPayment(updatedOrder.id);
      setNextPayment(nextPaymentData || null);
    } catch {
      setNextPayment(null);
    }
    if (project?.is_iot) await loadShipments();
  };
  const openRazorpayCheckout = async (createdPayment, gateway) => {
    if (!gateway?.key_id || !gateway?.order_id) {
      throw new Error("Razorpay checkout details were not returned.");
    }

    await loadRazorpayCheckout();

    const checkout = new window.Razorpay({
      key: gateway.key_id,
      amount: gateway.amount,
      currency: gateway.currency || "INR",
      name: gateway.name || "Sal Software",
      description: gateway.description,
      order_id: gateway.order_id,
      prefill: gateway.prefill,
      theme: { color: "#2563eb" },
      modal: {
        ondismiss: () => setPaymentError("Payment window closed. You can continue when ready."),
      },
      handler: async (response) => {
        setSuccessLoading(true);
        setPaymentError("");
        try {
          const data = await verifyRazorpayPayment(order.id, createdPayment.id, response);
          await applyCompletedPayment(data);
        } catch (error) {
          setPaymentError(getErrorMessage(error, "Unable to verify the Razorpay payment."));
        } finally {
          setSuccessLoading(false);
        }
      },
    });

    checkout.on("payment.failed", (response) => {
      setPaymentError(response?.error?.description || "Razorpay could not complete the payment.");
    });
    checkout.open();
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
      setCheckoutGateway(data?.gateway || null);
      if (data?.payment_mode === "razorpay" && data?.gateway) {
        await openRazorpayCheckout(createdPayment, data.gateway);
      }
    } catch (error) {
      if (error?.response?.status === 401) {
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
      const existingPayment = error?.response?.data?.payment;
      if (existingPayment?.id) {
        setPayment(existingPayment);
        setPaymentError("");
        setPaymentSuccess("");
        return;
      }
      setPaymentError(
        getErrorMessage(error, "Unable to create the payment."),
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
      await applyCompletedPayment(data);
    } catch (error) {
      if (error?.response?.status === 401) {
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
        getErrorMessage(error, "Unable to complete the test payment."),
      );
    } finally {
      setSuccessLoading(false);
    }
  };
  const handleContinuePayment = async () => {
    if (checkoutGateway) {
      setPaymentError("");
      try {
        await openRazorpayCheckout(payment, checkoutGateway);
      } catch (error) {
        setPaymentError(getErrorMessage(error, "Unable to open Razorpay checkout."));
      }
      return;
    }

    await handleTestPaymentSuccess();
  };
  const handleShippingFieldChange = (event) => {
    const { name, value } = event.target;
    setShippingForm((current) => ({
      ...current,
      [name]: value,
    }));
  };
  const handleShipmentSubmit = async (event) => {
    event.preventDefault();
    if (!project?.id || shipmentSubmitting) {
      return;
    }
    if (!isSignedIn()) {
      navigate("/login", {
        state: {
          from: {
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
          },
          returnAction: "shipment",
        },
      });
      return;
    }
    const shipmentOrderId =
      selectedShipmentOrderId || order?.id || "";
    if (!shipmentOrderId) {
      setShipmentError("Select an eligible order before requesting shipment.");
      return;
    }
    setShipmentSubmitting(true);
    setShipmentError("");
    setShipmentSuccess("");
    try {
      const response = await apiClient.post(
        `/projects/${project.id}/iot-shipments`,
        {
          order_id: Number(shipmentOrderId),
          ...shippingForm,
        },
      );
      setShipmentSuccess(
        response?.data?.message || "Shipment request submitted successfully.",
      );
      setShippingForm(INITIAL_SHIPPING_FORM);
      setSelectedShipmentOrderId("");
      await loadShipments();
    } catch (error) {
      setShipmentError(
        getErrorMessage(error, "Unable to submit the shipment request."),
      );
    } finally {
      setShipmentSubmitting(false);
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
      return order?.plan ?? null;
    }
    return (
      plans.find((plan) => Number(plan.id) === Number(order.plan_id)) ||
      order?.plan ||
      null
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
      getInstallmentAmount(currentPlan, Boolean(project?.is_iot), currentInstallment),
  );
  const currentUnlockRule = currentPlanUnlocks.find(
    (item) => item.installment === currentInstallment,
  );
  const isMiniOrder = Boolean(order && !order.plan_id && isMiniProject);
  const unlockStagesLabel = isMiniOrder
    ? "all software stages and resources"
    : currentUnlockRule?.stages?.length
    ? currentUnlockRule.stages.map((stage) => `${stage}%`).join(" and ")
    : hasValue(nextPayment?.unlock_percent)
      ? `${Number(nextPayment.unlock_percent)}%`
      : "the next stage";
  const isOrderComplete =
    order?.status === "complete" ||
    (!nextPayment &&
      Boolean(paymentSuccess) &&
      currentInstallment >= totalInstallments);
  const completedInstallments = isOrderComplete
    ? totalInstallments
    : Math.max(currentInstallment - 1, 0);
  const progressPercent =
    totalInstallments > 0
      ? Math.min((completedInstallments / totalInstallments) * 100, 100)
      : 0;
  const highestUnlockedStage = Number(projectAccess?.highest_stage ?? 0);
  const hasProjectAccess = Boolean(projectAccess?.id);
  const currentProjectPlanName =
    currentPlan?.name || order?.plan?.name || (isMiniProject ? "Small Software — One-time purchase" : "Selected software plan");
  const fullyUnlocked =
    (isOrderComplete && hasProjectAccess && highestUnlockedStage >= 100) ||
    (!order && hasProjectAccess && highestUnlockedStage >= 100);
  const pageState = !signedIn
    ? "guest"
    : fullyUnlocked
      ? "full"
      : order
        ? "partial"
        : "none";
  const firstLockedStage = stages.find(
    (stage) =>
      !(
        hasProjectAccess &&
        highestUnlockedStage >= (Number(stage.stage_percent) || 0)
      ),
  );
  const getDocumentThreshold = (document) =>
    hasValue(document.stage_percent)
      ? Number(document.stage_percent)
      : null;
  const isDocumentUnlocked = (document) => {
    if (!hasProjectAccess) {
      return false;
    }
    const threshold = getDocumentThreshold(document);
    if (threshold !== null) {
      return highestUnlockedStage >= threshold;
    }
    const unlockedBundles =
      projectAccess?.unlocked_bundles ??
      projectAccess?.bundles ??
      [];
    return (
      Array.isArray(unlockedBundles) &&
      unlockedBundles.includes(document.bundle)
    );
  };
  const existingProjectShipments = shipments.filter(
    (shipment) =>
      Number(shipment.project_id) === Number(project?.id),
  );
  const hasActiveShipment = existingProjectShipments.some(
    (shipment) => shipment.status !== "cancelled",
  );
  const hasReachedIoTShipmentThreshold = (item) => {
    if (!project?.is_iot || !item?.id || !currentPlan) {
      return false;
    }
    const code = String(
      currentPlan?.code ?? order?.plan?.code ?? "",
    ).trim().toUpperCase();

    const orderStatus = String(item?.status ?? "").toLowerCase();

    const nextInstallment = Number(
      nextPayment?.installment_no ??
      nextPayment?.next_installment ??
      nextPayment?.data?.installment_no ??
      nextPayment?.data?.next_installment ??
      0,
    );
    const complete = orderStatus === "complete";
    if (code === "A4") {
      return complete || (orderStatus === "partial" && nextInstallment >= 4);
    }
    if (code === "B2") {
      return complete || (orderStatus === "partial" && nextInstallment >= 2);
    }
    if (code === "C1" || code === "D100") {
      return complete;
    }
    return false;
  };
  const eligibleShipmentOrders = [
    ...(order?.id ? [order] : []),
  ].filter(
    (item) =>
      hasReachedIoTShipmentThreshold(item) &&
      !existingProjectShipments.some(
        (shipment) => Number(shipment.order_id) === Number(item.id),
      ),
  );
  const shipmentPlanCode = String(
    currentPlan?.code ?? order?.plan?.code ?? "",
  ).trim().toUpperCase();
  const shipmentRequiredPayments =
    shipmentPlanCode === "A4" ? 3 : shipmentPlanCode === "B2" ? 1 : totalInstallments;
  const shipmentPaymentsLeft = Math.max(
    shipmentRequiredPayments - completedInstallments,
    0,
  );
  const shipmentLockedMessage = !order
    ? "Select a plan and make your first payment to unlock the kit shipment request."
    : shipmentPaymentsLeft > 0
      ? `Pay ${shipmentPaymentsLeft} more installment${shipmentPaymentsLeft === 1 ? "" : "s"} to unlock your kit shipment request (${completedInstallments} of ${shipmentRequiredPayments} required payments done).`
      : "Your order is not yet eligible for shipment.";
  const isPickupSelected = shippingForm.delivery_method === "pickup";
  if (loading) {
    return (
      <main className="pd" aria-busy="true">
        <div className="container" style={{ paddingTop: 48 }}>
          <div className="skeleton skeleton--text" style={{ width: 160 }} />
          <div
            className="skeleton"
            style={{
              height: 44,
              width: "min(560px, 90%)",
              margin: "12px 0 20px",
            }}
          />
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
            <span className="error-state__icon">
              <AlertTriangle size={24} aria-hidden="true" />
            </span>
            <h3>{error}</h3>
            <p>The software may have moved or the link may be incorrect.</p>
            <Link to="/projects" className="btn btn-secondary btn-sm">
              <RefreshCw size={15} aria-hidden="true" /> Browse all software
            </Link>
          </div>
        </div>
      </main>
    );
  }
  return (
    <>
      <Header />
      <main className="pd page-enter" data-state={pageState}>
        <section className="page-hero project-detail-hero">
          <div className="container project-detail-hero__inner">
            <div className="project-detail-hero__main">
              <div
                className="project-detail-hero__image"
                style={{
                  width: "100%",
                  maxWidth: 560,
                  aspectRatio: "16 / 9",
                  marginBottom: 24,
                  overflow: "hidden",
                  borderRadius: 18,
                  background: "#f1f5f9",
                }}
              >
                <img
                  src={
                    !imageFailed && (project.image_url || project.imageUrl)
                      ? project.image_url || project.imageUrl
                      : getProjectImage()
                  }
                  alt={project.title || "Software image"}
                  onError={() => setImageFailed(true)}
                  style={{
                    display: "block",
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              </div>
              <Link to="/projects" className="back-link">
                ← All software
              </Link>
              {project.category && (
                <p className="section-heading__eyebrow">
                  {softwareLabel(project.category.name, "Software")}
                </p>
              )}
              <h1>{project.title}</h1>
              {hasValue(project.abstract) && (
                <p className="page-hero__description">{project.abstract}</p>
              )}
              <div className="project-detail-hero__badges">
                <span
                  className={
                    project.is_iot
                      ? "badge badge-success"
                      : "badge badge-neutral"
                  }
                >
                  {project.is_iot ? "IoT Software" : "Software Software"}
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
            <aside
              className="project-detail-hero__panel"
              aria-label="Software overview"
            >
              <div className="hero-fact">
                <Layers size={18} />
                <span>Category</span>
                <strong>{softwareLabel(project.category?.name, "Not available")}</strong>
              </div>
              <div className="hero-fact">
                <Cpu size={18} />
                <span>Software type</span>
                <strong>
                  {project.is_iot ? "IoT Software" : "Software Software"}
                </strong>
              </div>
              <div className="hero-fact">
                <ListChecks size={18} />
                <span>Stages</span>
                <strong>{stages.length}</strong>
              </div>
              <div className="hero-fact">
                <FileText size={18} />
                <span>Documents</span>
                <strong>{documents.length}</strong>
              </div>
            </aside>
          </div>
        </section>
        <section className="detail-section">
          <div className="container pd-plans">
            <div className="section-heading">
              <p className="section-heading__eyebrow">{isMiniProject ? "Small Software" : "Plans"}</p>
              <h2>{isMiniProject ? "Get this Small Software" : "Choose your software plan"}</h2>
              <p>{isMiniProject ? "Purchase once to unlock the configured software stages and resources." : "Select a plan to unlock software stages and resources."}</p>
            </div>
            {isMiniProject ? (
              <article className="project-plan-card">
                <div className="project-plan-card__header">
                  <div>
                    <p className="section-heading__eyebrow">{softwareLabel(project.level, "Small Software")}</p>
                    <h3>{project.title}</h3>
                  </div>
                  <div className="project-plan-card__price">
                    {miniCutPrice > miniOfferPrice && <del>{formatPrice(miniCutPrice)}</del>}
                    <strong>{formatPrice(miniOfferPrice)}</strong>
                    <span>One-time payment</span>
                  </div>
                </div>
                {hasValue(project.abstract) && <p className="project-plan-card__description">{project.abstract}</p>}
                <div className="project-plan-card__installment">
                  <span>Pay once</span>
                  <strong>{formatPrice(miniOfferPrice)}</strong>
                  <small>Unlocks the Small Software after successful payment.</small>
                </div>
                <button type="button" className="btn btn-primary" onClick={() => handleBuyMiniProject()} disabled={orderLoading || Boolean(order) || miniOfferPrice <= 0}>
                  {orderLoading && selectedPlanId === "mini" ? "Loading order..." : order ? "Order already started" : miniOfferPrice <= 0 ? "Price unavailable" : "Buy Small Software"}
                  <ArrowRight size={16} />
                </button>
                {miniOfferPrice <= 0 && <p className="state-empty">This Small Software is not available for purchase yet.</p>}
              </article>
            ) : plansLoading ? (
              <div className="project-plan-grid">
                {[0, 1].map((index) => (
                  <div key={index} className="skeleton skeleton--card" />
                ))}
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
                  const installmentAmount = getInstallmentAmount(plan, Boolean(project?.is_iot), 1);
                  const unlockMap = getPlanUnlockMap(plan);
                  const isCurrentPlanLoading =
                    orderLoading && selectedPlanId === plan.id;
                  const isMyPlan =
                    Boolean(order) &&
                    Number(plan.id) === Number(order.plan_id);
                  const lockedByOrder = Boolean(order) && !isMyPlan;
                  return (
                    <article
                      className={`project-plan-card${
                        isMyPlan ? " project-plan-card--mine" : ""
                      }${
                        lockedByOrder ? " project-plan-card--disabled" : ""
                      }`}
                      key={plan.id}
                    >
                      {isMyPlan && (
                        <span className="plan-badge">Your plan</span>
                      )}
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
                        <span>
                          {installments > 1
                            ? "Pay in installments"
                            : "Payment amount"}
                        </span>
                        <strong>{formatPrice(installmentAmount)}</strong>
                        {installments > 1 && (
                          <small>
                            {project?.is_iot && String(plan.code || "").toUpperCase() === "B2" && installments === 2
                              ? `₹${(price * 0.75).toLocaleString("en-IN")} first payment · ₹${(price * 0.25).toLocaleString("en-IN")} second payment · total ${formatPrice(price)}`
                              : `× ${installments} payments · total ${formatPrice(price)}`}
                          </small>
                        )}
                      </div>
                      {unlockMap.length > 0 && (
                        <div className="project-plan-card__unlock">
                          <p>Unlock roadmap</p>
                          <ol className="pd-roadmap">
                            {unlockMap.map(({ installment, stages: unlockStages, bundles }) => (
                              <li key={`${plan.id}-${installment}`}>
                                <span className="pd-roadmap__pct">
                                  {unlockStages.length ? `${unlockStages.join("% + ")}%` : "Resources"}
                                </span>
                                <span className="pd-roadmap__label">
                                  Payment {installment}{bundles.length ? ` · ${bundles.join(", ")}` : ""}
                                </span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => handleSelectPlan(plan)}
                        disabled={
                          orderLoading || Boolean(order) || !plan.is_active
                        }
                      >
                        {isCurrentPlanLoading
                          ? "Loading order..."
                          : isMyPlan
                            ? "Your plan"
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
            {order && (
              <section className="checkout-card">
                <div className="checkout-card__top">
                  <div>
                    <span className="checkout-card__eyebrow">
                      <CreditCard size={15} />
                      Secure checkout
                    </span>
                    <h3>Complete your software payment</h3>
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
                    <strong>
                      {formatPrice(order.total ?? order.amount)}
                    </strong>
                  </div>
                  <div>
                    <span>{isMiniOrder ? "Payment type" : "Installments"}</span>
                    <strong>
                      {isMiniOrder ? "One-time payment" : `${currentInstallment} / ${totalInstallments}`}
                    </strong>
                  </div>
                </div>
                <div className="checkout-progress">
                  <div className="checkout-progress__header">
                    <div>
                      <span>{isMiniOrder ? "Purchase progress" : "Payment progress"}</span>
                      <strong>
                        {isMiniOrder ? (isOrderComplete ? "Completed" : "One payment required") : `${completedInstallments} of ${totalInstallments} completed`}
                      </strong>
                    </div>
                    <span>{Math.round(progressPercent)}%</span>
                  </div>
                  <div className="checkout-progress__bar">
                    <span style={{ width: `${progressPercent}%` }} />
                  </div>
                  <div
                    className="checkout-progress__steps"
                    aria-label="Payment installment progress"
                  >
                    {Array.from(
                      { length: totalInstallments },
                      (_, index) => {
                        const installmentNumber = index + 1;
                        const unlockRule = currentPlanUnlocks.find(
                          (item) => item.installment === installmentNumber,
                        );
                        const unlock = unlockRule?.stages?.length
                          ? `${unlockRule.stages.join("% + ")}%`
                          : "";
                        const completed =
                          installmentNumber <= completedInstallments;
                        const current =
                          installmentNumber === currentInstallment &&
                          !completed;
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
                                <LockKeyhole
                                  size={13}
                                  aria-hidden="true"
                                />
                              )}
                            </span>
                            <span className="checkout-progress__step-label">
                              <strong>Payment {installmentNumber}</strong>
                              <small>
                                {unlock ? `${unlock} unlock · ` : ""}
                                {completed
                                  ? "Paid"
                                  : current
                                    ? "Next"
                                    : "Locked"}
                              </small>
                            </span>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>
                {nextPayment && (
                  <div className="checkout-payment">
                    <div className="checkout-payment__amount">
                      <span>Amount to pay</span>
                      <strong>{formatPrice(paymentAmount)}</strong>
                      <small>
                        {isMiniOrder ? "One-time payment" : `Installment ${currentInstallment} of ${totalInstallments}`}
                      </small>
                    </div>
                    <div className="checkout-payment__unlock">
                      <div className="checkout-payment__unlock-icon">
                        <LockKeyhole size={20} />
                      </div>
                      <div>
                        <strong>Unlocks {currentUnlockRule?.stages?.length > 1 ? "Stages" : "Stage"} {unlockStagesLabel}</strong>
                        <span>
                          {isMiniOrder ? "Complete this one-time payment to unlock all configured software stages and resources." : "Complete this payment to unlock the configured stage access and available resources."}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                {!nextPayment && !isOrderComplete && (
                  <div className="project-plan-card__note">
                    Your order is saved, but the next installment details are not available.
                    Please refresh the page to try loading them again.
                  </div>
                )}
                {!payment && !isOrderComplete && nextPayment && (
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
                      <span>
                        {nextPayment?.payment_mode === "razorpay"
                          ? "Secure payment powered by Razorpay"
                          : "Development test mode · No real payment is charged"}
                      </span>
                    </div>
                  </div>
                )}
                {payment && (
                  <div className="checkout-payment-created">
                    <div className="checkout-payment-created__icon">
                      <CheckCircle2 size={22} />
                    </div>
                    <div className="checkout-payment-created__content">
                      <span>{checkoutGateway ? "Razorpay checkout ready" : "Payment ready to complete"}</span>
                      <strong>
                        Payment #{payment.id} · {formatPrice(payment.amount)}
                      </strong>
                      <small>
                        {checkoutGateway
                          ? `${checkoutGateway.mode === "live" ? "Live" : "Test"} mode · Payment is verified securely before access is unlocked.`
                          : isMiniOrder
                            ? "Complete the test payment below to unlock all configured Small Software stages and resources."
                            : "Complete the test payment below to apply the configured stage and bundle access."}
                      </small>
                    </div>
                    <button
                      type="button"
                      className="checkout-pay-button"
                      onClick={handleContinuePayment}
                      disabled={successLoading}
                    >
                      <span>
                        {successLoading
                          ? "Processing..."
                          : checkoutGateway
                            ? "Continue with Razorpay"
                            : "Complete Test Payment"}
                      </span>
                      <ArrowRight size={19} />
                    </button>
                  </div>
                )}
              </section>
            )}
            {fullyUnlocked && (
              <section className="checkout-complete-card">
                <div className="checkout-complete-card__icon">
                  <CheckCircle2 size={28} />
                </div>
                <div>
                  <span className="checkout-card__eyebrow">
                    Payment completed
                  </span>
                  <h3>Software fully unlocked</h3>
                  <p>
                    Every stage is unlocked. Open your software workspace to
                    continue.
                  </p>
                </div>
                <Link
                  to={`/student/projects/${project.id}`}
                  className="btn btn-primary"
                >
                  View My Software
                  <ArrowRight size={16} />
                </Link>
              </section>
            )}
          </div>
        </section>
        {project.is_iot && !isMiniProject && (
          <section className="detail-section detail-section--white">
            <div className="container">
              <div className="section-heading">
                <p className="section-heading__eyebrow">IoT Kit</p>
                <h2>Request kit shipment</h2>
                <p>
                  Submit your delivery details. Shipment eligibility and
                  approval are verified by the server.
                </p>
              </div>
              <div className="checkout-card">
                <div className="checkout-card__top">
                  <div>
                    <span className="checkout-card__eyebrow">
                      <Truck size={16} />
                      Physical kit delivery
                    </span>
                    <h3>{project.title}</h3>
                    {Number(project.kit_price) > 0 ? (
                      <p>Kit price: {formatPrice(project.kit_price)}</p>
                    ) : (
                      <p>
                        Kit pricing has not been configured yet. Shipment
                        requests cannot be submitted until the price is set.
                      </p>
                    )}
                  </div>
                </div>
                {shipmentsLoading && (
                  <p role="status">Loading your shipment requests...</p>
                )}
                {existingProjectShipments.length > 0 && (
                  <div className="document-grid">
                    {existingProjectShipments.map((shipment) => (
                      <article
                        className="document-card"
                        key={shipment.id}
                      >
                        <span className="document-card__icon">
                          <Truck size={18} aria-hidden="true" />
                        </span>
                        <p className="document-card__type">
                          Shipment #{shipment.id}
                        </p>
                        <p className="document-card__meta">
                          Status:{" "}
                          {getShipmentStatusLabel(shipment)}
                        </p>
                        {shipment.tracking_number && (
                          <p className="document-card__meta">
                            Tracking: {shipment.tracking_number}
                          </p>
                        )}
                        {shipment.courier_name && (
                          <p className="document-card__meta">
                            Courier: {shipment.courier_name}
                          </p>
                        )}
                      </article>
                    ))}
                  </div>
                )}
                {!signedIn ? (
                  <Link
                    to="/login"
                    state={{
                      from: {
                        pathname: location.pathname,
                        search: location.search,
                        hash: location.hash,
                      },
                      returnAction: "shipment",
                    }}
                    className="btn btn-primary"
                  >
                    Sign in to request shipment
                    <ArrowRight size={16} />
                  </Link>
                ) : hasActiveShipment ? (
                  <p className="state-empty">
                    A shipment request already exists for this software. Check
                    the status above for updates.
                  </p>
                ) : eligibleShipmentOrders.length === 0 ? (
                  <div className="state-empty">
                    <p>{shipmentLockedMessage}</p>
                    {order && shipmentPaymentsLeft > 0 && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() =>
                          document
                            .querySelector(".checkout-card")
                            ?.scrollIntoView({ behavior: "smooth", block: "center" })
                        }
                      >
                        Pay remaining installment
                      </button>
                    )}
                  </div>
                ) : Number(project.kit_price) <= 0 ? (
                  <p className="state-empty">
                    Shipment requests will be available once the kit price is
                    configured.
                  </p>
                ) : (
                  <form onSubmit={handleShipmentSubmit}>
                    <div className="checkout-card__summary">
                      <div>
                        <span>Software</span>
                        <strong>{project.title}</strong>
                      </div>
                      <div>
                        <span>Kit price</span>
                        <strong>{formatPrice(project.kit_price)}</strong>
                      </div>
                    </div>
                    <div className="form-grid">
                      <label>
                        Recipient name
                        <input
                          name="recipient_name"
                          value={shippingForm.recipient_name}
                          onChange={handleShippingFieldChange}
                          maxLength={150}
                          autoComplete="name"
                          required
                        />
                      </label>
                      <label>
                        Phone number
                        <input
                          name="recipient_phone"
                          value={shippingForm.recipient_phone}
                          onChange={handleShippingFieldChange}
                          maxLength={20}
                          autoComplete="tel"
                          required
                        />
                      </label>
                      <label className="form-grid__full">
                        Shipping address
                        <textarea
                          name="shipping_address"
                          value={shippingForm.shipping_address}
                          onChange={handleShippingFieldChange}
                          maxLength={2000}
                          autoComplete="street-address"
                          rows={3}
                          required
                        />
                      </label>
                      <label>
                        City
                        <input
                          name="city"
                          value={shippingForm.city}
                          onChange={handleShippingFieldChange}
                          maxLength={100}
                          autoComplete="address-level2"
                          required
                        />
                      </label>
                      <label>
                        State
                        <input
                          name="state"
                          value={shippingForm.state}
                          onChange={handleShippingFieldChange}
                          maxLength={100}
                          autoComplete="address-level1"
                          required
                        />
                      </label>
                      <label>
                        Postal code
                        <input
                          name="postal_code"
                          value={shippingForm.postal_code}
                          onChange={handleShippingFieldChange}
                          maxLength={20}
                          autoComplete="postal-code"
                          required
                        />
                      </label>
                      <label>
                        Country
                        <input
                          name="country"
                          value={shippingForm.country}
                          onChange={handleShippingFieldChange}
                          maxLength={100}
                          autoComplete="country-name"
                          required
                        />
                      </label>
                      <label className="form-grid__full">
                        Eligible order
                        <select
                          value={selectedShipmentOrderId || eligibleShipmentOrders[0]?.id || ""}
                          onChange={(event) =>
                            setSelectedShipmentOrderId(event.target.value)
                          }
                          required
                        >
                          {eligibleShipmentOrders.map((eligibleOrder) => (
                            <option
                              key={eligibleOrder.id}
                              value={eligibleOrder.id}
                            >
                              Order #{eligibleOrder.id} —{" "}
                              {eligibleOrder.status}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="checkout-action">
                      <button
                        type="submit"
                        className="checkout-pay-button"
                        disabled={
                          shipmentSubmitting ||
                          Number(project.kit_price) <= 0
                        }
                      >
                        <span>
                          {shipmentSubmitting
                            ? "Submitting request..."
                            : "Request IoT Kit Shipment"}
                        </span>
                        <Truck size={19} />
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </section>
        )}
        <section className="detail-section">
          <div className="container">
            <div className="section-heading">
              <p className="section-heading__eyebrow">Progress</p>
              <h2>Software stages</h2>
              <p>Track how this software has progressed stage by stage.</p>
            </div>
            {stages.length > 0 ? (
              <ol className="stage-items">
                {stages.map((stage, index) => {
                  const stagePercent = Number(stage.stage_percent) || 0;
                  const isUnlocked =
                    hasProjectAccess &&
                    highestUnlockedStage >= stagePercent;
                  const showPayNext =
                    Boolean(order) &&
                    !isOrderComplete &&
                    firstLockedStage?.id === stage.id;
                  return (
                    <li
                      className={`stage-item ${
                        isUnlocked
                          ? "stage-item--unlocked"
                          : "stage-item--locked"
                      }`}
                      key={stage.id}
                      aria-label={`Stage ${stagePercent} percent${
                        isUnlocked ? ", unlocked" : ", locked"
                      }`}
                    >
                      <span className="stage-item__marker" aria-hidden="true">
                        {isUnlocked ? (
                          <Check size={14} />
                        ) : (
                          <LockKeyhole size={13} />
                        )}
                      </span>
                      <div className="stage-item__body">
                        <div className="stage-item__title-row">
                          <h3 className="stage-item__percent">
                            Stage {stagePercent}%
                          </h3>
                          <span className="stage-item__status">
                            {isUnlocked ? "Unlocked" : "Locked"}
                          </span>
                          {showPayNext && (
                            <span className="stage-item__hint">Pay next</span>
                          )}
                        </div>
                        <p className="stage-item__meta">
                          Step {index + 1} of {stages.length}
                          {hasValue(stage.semester)
                            ? ` · ${stage.semester}`
                            : ""}
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
              <h2>Software documents</h2>
              <p>Documents and resources associated with this software.</p>
            </div>
            {documents.length > 0 ? (
              <div className="document-grid">
                {documents.map((document) => {
                  const docUnlocked = isDocumentUnlocked(document);
                  return (
                    <article
                      className={`document-card${
                        docUnlocked ? "" : " document-card--locked"
                      }`}
                      key={document.id}
                    >
                      <span className="document-card__icon">
                        {docUnlocked ? (
                          <FileText size={18} aria-hidden="true" />
                        ) : (
                          <LockKeyhole size={18} aria-hidden="true" />
                        )}
                      </span>
                      <p className="document-card__type">
                        {document.bundle || "Software document"}
                      </p>
                      {hasValue(document.stage_percent) && (
                        <p className="document-card__meta">
                          Stage {document.stage_percent}%
                        </p>
                      )}
                      {hasValue(document.semester) && (
                        <p className="document-card__meta">
                          {document.semester}
                        </p>
                      )}
                      <p className="document-card__meta">
                        {docUnlocked ? "Unlocked" : "Locked"}
                      </p>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="state-empty">No documents available.</p>
            )}
          </div>
        </section>
      </main>
      {pendingIotPlan && (
        <div
          className="iot-checkout-modal"
          role="presentation"
          onWheel={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
        >
          <section
            className="iot-checkout-modal__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="iot-delivery-title"
          >
            <div className="iot-checkout-modal__head">
              <div>
                <span className="checkout-card__eyebrow"><Truck size={16} /> Physical IoT delivery</span>
                <h2 id="iot-delivery-title">How would you like to receive your kit?</h2>
                <p>
                  {isPickupSelected
                    ? "Choose office pickup and we will contact you when the kit is ready."
                    : "A delivery shipment will be created automatically with your order."}
                </p>
              </div>
              <button
                type="button"
                className="iot-checkout-modal__close"
                onClick={() => setPendingIotPlan(null)}
                aria-label="Close delivery details"
                disabled={orderLoading}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleIotOrderSubmit}>
              <div className="iot-checkout-modal__summary">
                <div><span>Software</span><strong>{project.title}</strong></div>
                <div><span>Plan</span><strong>{pendingIotPlan.name}</strong></div>
              </div>
              <fieldset className="iot-fulfillment-options">
                <legend>Receiving method</legend>
                <label className={shippingForm.delivery_method === "delivery" ? "is-selected" : ""}>
                  <input
                    type="radio"
                    name="delivery_method"
                    value="delivery"
                    checked={shippingForm.delivery_method === "delivery"}
                    onChange={handleShippingFieldChange}
                  />
                  <span><Truck size={19} /><strong>Home delivery</strong><small>Ship the kit to your address</small></span>
                </label>
                <label className={shippingForm.delivery_method === "pickup" ? "is-selected" : ""}>
                  <input
                    type="radio"
                    name="delivery_method"
                    value="pickup"
                    checked={shippingForm.delivery_method === "pickup"}
                    onChange={handleShippingFieldChange}
                  />
                  <span><PackageOpen size={19} /><strong>Office pickup</strong><small>Collect after our team confirms it is ready</small></span>
                </label>
              </fieldset>
              <div className="form-grid">
                <label>
                  Recipient name
                  <input name="recipient_name" value={shippingForm.recipient_name} onChange={handleShippingFieldChange} maxLength={150} autoComplete="name" required />
                </label>
                <label>
                  Phone number
                  <input name="recipient_phone" value={shippingForm.recipient_phone} onChange={handleShippingFieldChange} maxLength={20} autoComplete="tel" required />
                </label>
                {!isPickupSelected && (
                  <>
                    <label className="form-grid__full">
                      Delivery address
                      <textarea name="shipping_address" value={shippingForm.shipping_address} onChange={handleShippingFieldChange} maxLength={2000} autoComplete="street-address" rows={3} required />
                    </label>
                    <label>
                      City
                      <input name="city" value={shippingForm.city} onChange={handleShippingFieldChange} maxLength={100} autoComplete="address-level2" required />
                    </label>
                    <label>
                      State
                      <input name="state" value={shippingForm.state} onChange={handleShippingFieldChange} maxLength={100} autoComplete="address-level1" required />
                    </label>
                    <label>
                      Postal code
                      <input name="postal_code" value={shippingForm.postal_code} onChange={handleShippingFieldChange} maxLength={20} autoComplete="postal-code" required />
                    </label>
                    <label>
                      Country
                      <input name="country" value={shippingForm.country} onChange={handleShippingFieldChange} maxLength={100} autoComplete="country-name" required />
                    </label>
                  </>
                )}
                <label>
                  Quantity
                  <input name="quantity" type="number" min="1" max="10" value={shippingForm.quantity} onChange={handleShippingFieldChange} required />
                </label>
              </div>
              {orderError && <p className="iot-checkout-modal__error" role="alert">{orderError}</p>}
              <div className="iot-checkout-modal__actions">
                <button type="button" className="btn btn-secondary" onClick={() => setPendingIotPlan(null)} disabled={orderLoading}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={orderLoading}>
                  {orderLoading ? "Creating order..." : "Confirm order & create shipment"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      <Footer />
    </>
  );
}
export default ProjectDetail;
