import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileSignature,
  FileText,
  History,
  LayoutDashboard,
  PenLine,
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
      { href: "/admin/chamados", label: "Chamados", icon: ClipboardList },
      { href: "/admin/os", label: "Ordens de Serviço", icon: FileSignature },
      { href: "/admin/agenda", label: "Agenda", icon: CalendarDays, fase: 5 },
      { href: "/admin/clientes", label: "Clientes", icon: Users },
      { href: "/admin/contratos", label: "Contratos", icon: ScrollText },
      { href: "/admin/cobranca", label: "Cobrança de visitas", icon: Receipt },
      { href: "/admin/tecnicos", label: "Técnicos", icon: Wrench },
      { href: "/admin/relatorios", label: "Relatórios", icon: BarChart3, fase: 5 },
      { href: "/admin/catalogos", label: "Catálogos", icon: BookOpen },
      { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
      { href: "/admin/auditoria", label: "Auditoria", icon: ShieldCheck, fase: 6 },
    ],
  },
  tecnico: {
    titulo: "Técnico",
    itens: [
      { href: "/tecnico", label: "Meu dia", icon: Sun },
      { href: "/tecnico/historico", label: "Histórico", icon: History },
      { href: "/tecnico/assinatura", label: "Minha assinatura", icon: PenLine },
    ],
  },
  portal: {
    titulo: "Portal do Cliente",
    itens: [
      { href: "/portal", label: "Início", icon: LayoutDashboard },
      { href: "/portal/chamados/novo", label: "Abrir chamado", icon: PlusCircle },
      { href: "/portal/chamados", label: "Meus chamados", icon: ClipboardList },
      { href: "/portal/os", label: "Ordens de Serviço", icon: FileText },
      { href: "/portal/contrato", label: "Contrato", icon: ScrollText },
    ],
  },
};
