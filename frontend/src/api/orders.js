import apiClient from "./client";

export const createOrder = async ({ projectId, planId, shipment }) => {
  const response = await apiClient.post("/orders", {
    project_id: projectId,
    plan_id: planId,
    ...(shipment ? { shipment } : {}),
  });

  return response.data;
};

export const getActiveOrder = async (projectId) => {
  const response = await apiClient.get(`/orders/active/${projectId}`);

  return response.data;
};

export const getNextPayment = async (orderId) => {
  const response = await apiClient.get(`/orders/${orderId}/next-payment`);

  return response.data;
};

export const createPayment = async (orderId) => {
  const response = await apiClient.post(`/orders/${orderId}/payments`);

  return response.data;
};

export const testPaymentSuccess = async (orderId, paymentId) => {
  const response = await apiClient.post(
    `/orders/${orderId}/payments/${paymentId}/test-success`,
  );

  return response.data;
};

export const verifyRazorpayPayment = async (orderId, paymentId, payload) => {
  const response = await apiClient.post(
    `/orders/${orderId}/payments/${paymentId}/verify-razorpay`,
    payload,
  );

  return response.data;
};

export const getAdminOrderDetails = async (orderId) => {
  const response = await apiClient.get(`/admin/orders/${orderId}`);
  return response.data;
};

export const downloadAdminInvoice = async (orderId) => {
  const response = await apiClient.get(`/admin/orders/${orderId}/invoice`, {
    responseType: "blob",
  });
  return response.data;
};
