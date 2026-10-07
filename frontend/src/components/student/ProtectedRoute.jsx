import { Navigate, Outlet, useLocation } from "react-router-dom";

import { isSignedIn } from "../../api/student";

function ProtectedRoute() {
  const location = useLocation();

  if (!isSignedIn()) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
