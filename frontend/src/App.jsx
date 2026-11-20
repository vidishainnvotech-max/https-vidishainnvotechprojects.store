import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import Lenis from "lenis";
import { checkBackendHealth } from "./api/health";
import AppRoutes from "./routes/AppRoutes";
import RequiredFieldMarkers from "./components/RequiredFieldMarkers";

function App() {
  const { pathname } = useLocation();

  useEffect(() => {
    checkBackendHealth().catch(() => {});
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({
      duration: 1.1,
      smoothWheel: true,
      prevent: (node) =>
        node.hasAttribute?.("data-scroll-lock-allow") ||
        !!node.closest?.("[data-scroll-lock-allow], .ui-overlay"),
    });
    let id;
    const raf = (t) => {
      lenis.raf(t);
      id = requestAnimationFrame(raf);
    };
    id = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(id);
      lenis.destroy();
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <MotionConfig reducedMotion="user">
      <RequiredFieldMarkers />
      <AppRoutes />
    </MotionConfig>
  );
}

export default App;
