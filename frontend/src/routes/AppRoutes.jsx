import { Navigate, Route, Routes } from "react-router-dom";

import Home from "../pages/Home";
import Pricing from "../pages/Pricing";
import Projects from "../pages/Projects";
import ProjectDetail from "../pages/ProjectDetail";
import Login from "../pages/Login";

import StudentDashboard from "../pages/StudentDashboard";
import MyProject from "../pages/MyProject";

import AdminUsers from "../pages/admin/AdminUsers";
import AdminUserDetails from "../pages/admin/AdminUserDetails";

import ProtectedRoute from "./ProtectedRoute";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />

      <Route path="/projects" element={<Projects />} />

      <Route path="/projects/:slug" element={<ProjectDetail />} />

      <Route path="/pricing" element={<Pricing />} />

      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/student" element={<StudentDashboard />} />

        <Route path="/student/projects/:id" element={<MyProject />} />

        <Route path="/admin/users" element={<AdminUsers />} />

        <Route path="/admin/users/:id" element={<AdminUserDetails />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRoutes;
