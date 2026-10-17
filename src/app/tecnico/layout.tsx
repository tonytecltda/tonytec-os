import { AreaLayout } from "@/components/layout/area-layout";

export default function TecnicoLayout({ children }: LayoutProps<"/tecnico">) {
  return (
    <AreaLayout area="tecnico" role="tecnico">
      {children}
    </AreaLayout>
  );
}
