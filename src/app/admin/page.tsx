import { AdminDashboard } from "@/components/admin-dashboard";
import { getMailboxService } from "@/lib/server/service-provider";

export default async function AdminPage() {
  const metrics = await getMailboxService().adminMetrics();
  return <AdminDashboard metrics={metrics} />;
}
