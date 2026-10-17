import { AreaLayout } from "@/components/layout/area-layout";

export default function PortalLayout({ children }: LayoutProps<"/portal">) {
  return (
    <AreaLayout area="portal" role="cliente">
      {children}
    </AreaLayout>
  );
}
