import apiClient from "./client";

export const getPlans = async () => {
  const response = await apiClient.get("/plans");
  return response.data;
};

export const getPlanById = async (planId) => {
  if (!planId) {
    throw new Error("Plan ID is required.");
  }

  const response = await apiClient.get(`/plans/${planId}`);
  return response.data;
};
