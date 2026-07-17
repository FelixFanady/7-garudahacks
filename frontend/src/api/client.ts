import axios from "axios";
import { getGlobalLogout } from "../context/AuthContext";
import { globalToast } from "./toast";

const API_BASE_URL = "http://localhost:8080";

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const isLoginRequest = error?.config?.url?.endsWith("/login");

    if (status === 401 && !isLoginRequest) {
      // JWT expired or invalid — force logout
      const logout = getGlobalLogout();
      if (logout) logout();

      globalToast.error(
        "Sesi Anda telah berakhir. Silakan masuk kembali.",
        5000,
      );

      // Redirect to login page
      window.location.href = "/login";
    }

    return Promise.reject(error);
  },
);

export default client;
