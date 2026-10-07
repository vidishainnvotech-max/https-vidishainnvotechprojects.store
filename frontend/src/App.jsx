import { useEffect } from "react";
import { checkBackendHealth } from "./api/health";
import AppRoutes from "./routes/AppRoutes";

function App() {
  useEffect(() => {
    checkBackendHealth().catch(() => {});
  }, []);

  return <AppRoutes />;
}

export default App;
