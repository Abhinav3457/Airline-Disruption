import { Route, Routes } from 'react-router-dom';

import { MainLayout } from '@/layouts/MainLayout';
import { AgentPage } from '@/pages/AgentPage';
import { AuditLogsPage } from '@/pages/AuditLogsPage';
import { BookingsPage } from '@/pages/BookingsPage';
import { CustomerDetailPage } from '@/pages/CustomerDetailPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PoliciesPage } from '@/pages/PoliciesPage';

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="agent" element={<AgentPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/:pnr" element={<CustomerDetailPage />} />
        <Route path="bookings" element={<BookingsPage />} />
        <Route path="policies" element={<PoliciesPage />} />
        <Route path="audit" element={<AuditLogsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
