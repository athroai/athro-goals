import { PublicFooter } from "@/components/layout/PublicFooter";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">{children}</div>
      <PublicFooter />
    </div>
  );
}
