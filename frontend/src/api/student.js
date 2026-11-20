import apiClient, { getToken } from "./client";

export const STAGE_STEPS = [20, 50, 75, 100];

export const isSignedIn = () => Boolean(getToken());

export const getMyProjects = async () => {
  const response = await apiClient.get("/my-projects");
  return response.data;
};

export const getMyProject = async (projectId) => {
  const response = await apiClient.get(`/my-projects/${projectId}`);
  return response.data;
};

export const downloadResource = async (type, id) => {
  const response = await apiClient.get(`/download/${type}/${id}`, {
    responseType: "blob",
  });
  return response.data;
};

export const downloadProjectFile = async (downloadUrl) => {
  const response = await apiClient.get(downloadUrl, { responseType: "blob" });
  return response.data;
};

export const getStageVideo = async (stageId) => {
  const response = await apiClient.get(`/stage/${stageId}/video`);
  return response.data;
};

export const login = async (credentials) => {
  const response = await apiClient.post("/login", credentials);
  return response.data;
};

export const logout = async () => {
  const response = await apiClient.post("/logout");
  return response.data;
};

export const me = async () => {
  const response = await apiClient.get("/me");
  return response.data;
};

export const highestUnlockedStage = (userAccess = []) => {
  if (!userAccess.length) return 0;

  return Math.max(
    ...userAccess.map((access) => Number(access.stage_percent) || 0),
  );
};

export const isStageUnlocked = (userAccess = [], stagePercent) => {
  return userAccess.some(
    (access) => Number(access.stage_percent) === Number(stagePercent),
  );
};

export const isDocumentUnlocked = (userAccess = [], stagePercent) => {
  if (stagePercent === null || stagePercent === undefined) return true;

  return isStageUnlocked(userAccess, stagePercent);
};

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename || "download";

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
