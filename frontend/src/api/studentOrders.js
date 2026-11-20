import apiClient from "./client";

export async function getStudentOrders() {
  const response = await apiClient.get("/student/orders");
  return response.data;
}

export async function getStudentOrder(orderId) {
  const response = await apiClient.get(`/student/orders/${orderId}`);
  return response.data;
}

export async function downloadStudentInvoice(orderId) {
  const response = await apiClient.get(`/student/orders/${orderId}/invoice`, {
    responseType: "blob",
  });
  return response.data;
}
