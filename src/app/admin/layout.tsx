import { AreaLayout } from "@/components/layout/area-layout";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AreaLayout area="admin" role="admin">
      {children}
    </AreaLayout>
  );
}
