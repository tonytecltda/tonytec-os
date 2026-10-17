import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileSignature,
  FileText,
  History,
  LayoutDashboard,
  PlusCircle,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  Sun,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Fase em que a tela será entregue; enquanto isso o item fica desabilitado. */
  fase?: number;
};

export type Area = "admin" | "tecnico" | "portal";

export const NAV: Record<Area, { titulo: string; itens: NavItem[] }> = {
  admin: {
    titulo: "Administração",
    itens: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/chamados", label: "Chamados", icon: ClipboardList, fase: 2 },
      { href: "/admin/os", label: "Ordens de Serviço", icon: FileSignature, fase: 3 },
      { href: "/admin/agenda", label: "Agenda", icon: CalendarDays, fase: 5 },
      { href: "/admin/clientes", label: "Clientes", icon: Users, fase: 1 },
      { href: "/admin/contratos", label: "Contratos", icon: ScrollText, fase: 1 },
      { href: "/admin/cobranca", label: "Cobrança de visitas", icon: Receipt, fase: 4 },
      { href: "/admin/tecnicos", label: "Técnicos", icon: Wrench, fase: 1 },
      { href: "/admin/relatorios", label: "Relatórios", icon: BarChart3, fase: 5 },
      { href: "/admin/catalogos", label: "Catálogos", icon: BookOpen, fase: 1 },
      { href: "/admin/configuracoes", label: "Configurações", icon: Settings, fase: 1 },
      { href: "/admin/auditoria", label: "Auditoria", icon: ShieldCheck, fase: 6 },
    ],
  },
  tecnico: {
    titulo: "Técnico",
    itens: [
      { href: "/tecnico", label: "Meu dia", icon: Sun },
      { href: "/tecnico/historico", label: "Histórico", icon: History, fase: 3 },
    ],
  },
  portal: {
    titulo: "Portal do Cliente",
    itens: [
      { href: "/portal", label: "Início", icon: LayoutDashboard },
      { href: "/portal/chamados/novo", label: "Abrir chamado", icon: PlusCircle, fase: 2 },
      { href: "/portal/chamados", label: "Meus chamados", icon: ClipboardList, fase: 2 },
      { href: "/portal/os", label: "Ordens de Serviço", icon: FileText, fase: 3 },
      { href: "/portal/contrato", label: "Contrato", icon: ScrollText, fase: 1 },
    ],
  },
};
