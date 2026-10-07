import apiClient from "./client";

export const createOrder = async ({ projectId, planId }) => {
  const response = await apiClient.post("/orders", {
    project_id: projectId,
    plan_id: planId,
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
