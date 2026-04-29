import { redirect } from "next/navigation";

import { SimpleNavbar } from "@/components/simple-navbar";
import { SiteFooter } from "@/components/site-footer";
import { getCurrentUserProfile } from "@/lib/auth";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check if user is admin and redirect to admin panel
  const profile = await getCurrentUserProfile();

  if (profile && profile.role === "admin") {
    redirect("/admin");
  }

  return (
    <div className="relative flex flex-col min-h-screen">
      <SimpleNavbar />
      <main className="flex flex-1 flex-col">{children}</main>
      <SiteFooter />
    </div>
  );
}
