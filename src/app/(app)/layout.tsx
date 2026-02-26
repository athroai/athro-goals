import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--darker-bg)] md:flex-row">
      <Sidebar />
      <div className="flex min-h-0 flex-1 flex-col">
        <Header />
        <main className="min-h-0 flex-1 overflow-y-auto bg-[var(--dark-bg)] pb-20 md:pb-0">{children}</main>
      </div>
    </div>
  );
}
