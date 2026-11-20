import apiClient from "./client";

export async function getPaymentGatewaySettings() {
  const response = await apiClient.get("/admin/payment-gateway");
  return response.data;
}

export async function updatePaymentGatewaySettings(payload) {
  const response = await apiClient.put("/admin/payment-gateway", payload);
  return response.data;
}
