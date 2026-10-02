import apiClient from "./client";

export const checkBackendHealth = async () => {
  const response = await apiClient.get("/health");

  return response.data;
};
