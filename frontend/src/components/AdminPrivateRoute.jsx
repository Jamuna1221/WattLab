import { Navigate } from 'react-router-dom';

export default function AdminPrivateRoute({ children }) {
  const adminToken = localStorage.getItem('adminToken');
  const adminUser = localStorage.getItem('adminUser');

  if (!adminToken || !adminUser) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}