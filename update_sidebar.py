import re

file_path = "src/features/dashboard/components/layout/Sidebar.tsx"
with open(file_path, "r") as f:
    content = f.read()

# Make navItems dynamic based on vm.chapters
pattern = r"const navItems = \[\s*\{[\s\S]*?\}\s*\];"
replacement = """
interface NavItem {
    id: string;
    label: string;
    icon: any;
    badge: string | null;
}

const baseNavItems: Omit<NavItem, 'badge'>[] = [
  {
    id: "plantilla",
    label: "Extracción Personalizada",
    icon: FileText,
  },
  {
    id: "resumen",
    label: "Resumen Ejecutivo",
    icon: LayoutDashboard,
  },
  {
    id: "datos",
    label: "Datos Generales",
    icon: FileText,
  },
  {
    id: "criterios",
    label: "Criterios de Adjudicación",
    icon: Award,
  },
  {
    id: "solvencia",
    label: "Solvencia",
    icon: Shield,
  },
  {
    id: "tecnicos",
    label: "Requisitos Técnicos",
    icon: Wrench,
  },
  {
    id: "riesgos",
    label: "Análisis de Riesgos",
    icon: AlertTriangle,
  },
  {
    id: "modelo",
    label: "Modelo de Servicio",
    icon: Settings,
  },
];
"""

content = re.sub(pattern, replacement, content)

# update Sidebar component to accept chapters or just filter navItems
pattern_sidebar = r"export function Sidebar\(\{\s*activeSection,\s*onSectionChange,\s*alertCount\s*=\s*0\s*\}\s*:\s*SidebarProps\)\s*\{"
replacement_sidebar = """export function Sidebar({ activeSection, onSectionChange, alertCount = 0, availableSections = [] }: SidebarProps & { availableSections?: string[] }) {
  const navItems = baseNavItems.filter(item => availableSections.length === 0 || availableSections.includes(item.id)).map(item => ({
      ...item,
      badge: item.id === 'riesgos' ? "3" : null
  }));"""

content = re.sub(pattern_sidebar, replacement_sidebar, content)

with open(file_path, "w") as f:
    f.write(content)
