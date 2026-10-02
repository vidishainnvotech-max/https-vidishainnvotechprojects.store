import { useEffect, useState } from "react";
import { checkBackendHealth } from "./api/health";
import AppRoutes from "./routes/AppRoutes";
import { brand } from "./config/brand";

function App() {
  const [backendStatus, setBackendStatus] = useState("Checking...");

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const data = await checkBackendHealth();
        setBackendStatus(
          data.status === "ok"
            ? "Backend Connected ✓"
            : "Backend Response Error",
        );
      } catch (error) {
        console.error(error);
        setBackendStatus("Backend Connection Failed");
      }
    };

    checkHealth();
  }, []);

  return (
    <>
      <div
        style={{
          padding: "12px 40px",
          background: "var(--color-muted)",
          borderBottom: "1px solid #e2e8f0",
          fontSize: "14px",
        }}
      >
        API Status: {backendStatus}
      </div>

      <AppRoutes brand={brand} />
    </>
  );
}

export default App;
