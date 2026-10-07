import apiClient from "./client";

export const getPlans = async () => {
  const response = await apiClient.get("/plans");

  return response.data;
};

export const getPlanById = async (planId) => {
  const response = await apiClient.get(`/plans/${planId}`);

  return response.data;
};
