import re

file_path = "src/features/dashboard/components/layout/Sidebar.tsx"
with open(file_path, "r") as f:
    content = f.read()

# Replace the array definition
pattern = r"const navItems = \[\s*\{[\s\S]*?\}\s*\];"
replacement = """interface NavItem {
    id: string;
    label: string;
    icon: any;
    badge?: string | null;
}

const baseNavItems: NavItem[] = [
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
];"""

content = re.sub(pattern, replacement, content)

with open(file_path, "w") as f:
    f.write(content)
