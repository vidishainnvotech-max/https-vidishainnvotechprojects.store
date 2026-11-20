import axios from "axios";

const TOKEN_KEY = "vidisha_auth_token";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Storage may be unavailable.
  }
}

const apiClient = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? "http://127.0.0.1:8000/api" : "/api"),
  headers: {
    Accept: "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = getToken();

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  } else if (config.data != null) {
    config.headers["Content-Type"] = "application/json";
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      setToken(null);
    }

    return Promise.reject(error);
  },
);

export default apiClient;
