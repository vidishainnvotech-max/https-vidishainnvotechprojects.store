import { Routes, Route } from "react-router-dom";

function AppRoutes({ brand }) {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <main
            style={{
              minHeight: "calc(100vh - 45px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <h1>{brand.name}</h1>
          </main>
        }
      />
    </Routes>
  );
}

export default AppRoutes;
