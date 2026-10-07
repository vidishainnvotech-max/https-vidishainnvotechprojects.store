import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

/* Base design system */
import "./styles/reference.css";
import "./styles/tokens.css";
import "./styles/global.css";

/* Website UI styles */
import "./index.css";
import "./styles/system.css";
import "./styles/header.css";
import "./styles/home.css";
import "./styles/detail.css";
import "./styles/student.css";
import "./styles/admin.css";
import "./App.css";

import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
