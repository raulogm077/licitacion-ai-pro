import re

file_path = "src/features/dashboard/components/layout/Sidebar.tsx"
with open(file_path, "r") as f:
    content = f.read()

# Replace the array definition
# Find the start of the array and the end
start_idx = content.find("const navItems = [")
if start_idx != -1:
    end_idx = content.find("];", start_idx)

    if end_idx != -1:
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
  }"""
        content = content[:start_idx] + replacement + content[end_idx:]


with open(file_path, "w") as f:
    f.write(content)
