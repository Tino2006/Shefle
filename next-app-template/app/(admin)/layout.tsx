import { AdminNavbar } from "@/components/admin-navbar";
import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side role check - defense in depth
  try {
    await requireAdmin();
  } catch (error) {
    // If requireAdmin throws, user is not authorized
    redirect('/?error=unauthorized');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNavbar />
      {children}
    </div>
  );
}
