import { SimpleNavbar } from "@/components/simple-navbar";
import { getCurrentUserProfile } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check if user is admin and redirect to admin panel
  const profile = await getCurrentUserProfile();
  
  if (profile && profile.role === 'admin') {
    redirect('/admin');
  }

  return (
    <div className="relative flex flex-col min-h-screen">
      <SimpleNavbar />
      <main className="flex-grow">
        {children}
      </main>
    </div>
  );
}
