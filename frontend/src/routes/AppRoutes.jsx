import { Navigate, Route, Routes } from "react-router-dom";

import Home from "../pages/Home";
import Pricing from "../pages/Pricing";
import Projects from "../pages/Projects";
import ProjectDetail from "../pages/ProjectDetail";
import Login from "../pages/Login";
import Register from "../pages/Register";
import VerifyEmail from "../pages/VerifyEmail";

import StudentDashboard from "../pages/StudentDashboard";
import MyProject from "../pages/MyProject";
import StudentDocumentation from "../pages/StudentDocumentation";
import StudentReferrals from "../pages/StudentReferrals";
import StudentIdeas from "../pages/StudentIdeas";
import StudentOrders from "../pages/StudentOrders";
import StudentOrderDetails from "../pages/StudentOrderDetails";

import AdminDashboard from "../pages/admin/AdminDashboard";
import AdminOrders from "../pages/admin/AdminOrders";
import AdminUsersGroups from "../pages/admin/AdminUsersGroups";
import AdminUserDetails from "../pages/admin/AdminUserDetails";
import AdminCategories from "../pages/admin/AdminCategories";
import AdminProjects from "../pages/admin/AdminProjects";
import AdminDocumentation from "../pages/admin/AdminDocumentation";
import AdminStages from "../pages/admin/AdminStages";
import AdminCoupons from "../pages/admin/AdminCoupons";
import AdminReferrals from "../pages/admin/AdminReferrals";
import AdminIdeas from "../pages/admin/AdminIdeas";
import AdminShipments from "../pages/admin/AdminShipments";
import AdminApiKeys from "../pages/admin/AdminApiKeys";

import AdminLayout from "../layouts/AdminLayout";
import ProtectedRoute from "./ProtectedRoute";

function AppRoutes() {
  return (
    <Routes>
      {/* Public pages */}
      <Route path="/" element={<Home />} />
      <Route path="/projects" element={<Projects />} />
      <Route path="/projects/:slug" element={<ProjectDetail />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/email/verify/:id/:hash"
        element={<VerifyEmail />}
      />

      {/* Authenticated student pages */}
      <Route element={<ProtectedRoute />}>
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/student/projects/:id" element={<MyProject />} />
        <Route
          path="/student/documentation"
          element={<StudentDocumentation />}
        />
        <Route
          path="/student/referrals"
          element={<StudentReferrals />}
        />
        <Route path="/student/ideas" element={<StudentIdeas />} />
        <Route path="/student/orders" element={<StudentOrders />} />
        <Route path="/student/orders/:id" element={<StudentOrderDetails />} />

        {/* Admin pages */}
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/orders" element={<AdminOrders />} />
          <Route path="/admin/users" element={<AdminUsersGroups />} />
          <Route path="/admin/groups" element={<Navigate to="/admin/users" replace />} />
          <Route
            path="/admin/users/:id"
            element={<AdminUserDetails />}
          />
          <Route
            path="/admin/categories"
            element={<AdminCategories />}
          />
          <Route
            path="/admin/projects"
            element={<AdminProjects />}
          />
          <Route
            path="/admin/documentation"
            element={<AdminDocumentation />}
          />
          <Route path="/admin/stages" element={<AdminStages />} />
          <Route path="/admin/coupons" element={<AdminCoupons />} />
          <Route path="/admin/referrals" element={<AdminReferrals />} />
          <Route path="/admin/ideas" element={<AdminIdeas />} />
          <Route path="/admin/shipments" element={<AdminShipments />} />
          <Route path="/admin/api-keys" element={<AdminApiKeys />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRoutes;
