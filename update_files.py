import re

with open('BACKLOG.md', 'r', encoding='utf-8', errors='ignore') as f:
    backlog_content = f.read()

# 1. Move "Resolver Bloqueo Global de Vitest" and "Configurar Dependabot" to Done
vitest_task_pattern = r"- \[ \] \[Tipo: Infra\] \[Área: Infra\] Resolver Bloqueo Global de Vitest\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n"
vitest_match = re.search(vitest_task_pattern, backlog_content, re.DOTALL)
vitest_task = vitest_match.group(0).replace('- [ ]', '- [x]') if vitest_match else ""
backlog_content = re.sub(vitest_task_pattern, '', backlog_content, flags=re.DOTALL)

dependabot_task_pattern = r"- \[ \] \[Tipo: Backend\] \[Área: Infra\] Configurar Dependabot para actualizaciones automáticas\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n"
dependabot_match = re.search(dependabot_task_pattern, backlog_content, re.DOTALL)
dependabot_task = dependabot_match.group(0).replace('- [ ]', '- [x]') if dependabot_match else ""
backlog_content = re.sub(dependabot_task_pattern, '', backlog_content, flags=re.DOTALL)

done_section_pattern = r"(## Done\n)"
backlog_content = re.sub(done_section_pattern, r"\1" + vitest_task + dependabot_task, backlog_content, count=1)

# 2. Fix the original coverage task to clarify we only need to increase branch coverage
coverage_task_pattern = r"- \[ \] \[Tipo: QA\] \[Área: Analysis\] Aumentar cobertura de tests a 80%\n  - Objetivo: Cumplir con la meta de calidad de código de la iteración D\.\n  - Alcance: Escribir pruebas unitarias adicionales para componentes críticos y subrepresentados en la cobertura, especialmente en src/components y src/features/dashboard\.\n  - Criterios de aceptación:\n    - Ejecutar `pnpm exec vitest run --coverage` debe reportar al menos 80% en statements y 70% en branches\.\n  - Archivos probables: `src/components/\*\*/\*\.test\.tsx`, `src/features/dashboard/\*\*/\*\.test\.tsx`, `src/services/__tests__/`\n  - Dependencias: Tarea \"Resolver Bloqueo Global de Vitest\" debe estar completada\."

refined_coverage_task = """- [ ] [Tipo: QA] [Área: Analysis] Aumentar cobertura de tests a 80% (Statements) y 70% (Branches)
  - Objetivo: Cumplir con la meta de calidad de código de la iteración D.
  - Alcance: La cobertura de statements ha alcanzado el 80%, pero las branches (65.91%) no llegan al 70%. Escribir pruebas unitarias adicionales para componentes críticos y subrepresentados en la cobertura, especialmente en src/components y src/features/dashboard.
  - Criterios de aceptación:
    - Ejecutar `pnpm exec vitest run --coverage` debe reportar al menos 80% en statements y 70% en branches.
  - Archivos probables: `src/components/**/*.test.tsx`, `src/features/dashboard/**/*.test.tsx`, `src/services/__tests__/`
  - Dependencias: Ninguna."""

backlog_content = re.sub(coverage_task_pattern, refined_coverage_task, backlog_content, flags=re.DOTALL)

# 3. Add the new performance metrics task at the end of the To Do section
new_task = """
- [ ] [Tipo: Infra] [Área: Infra] Automatizar métricas de rendimiento en CI
  - Objetivo: Detectar regresiones de rendimiento y bundle size de forma temprana.
  - Alcance: Configurar Lighthouse CI o similar en Github Actions para ejecutarse en cada PR.
  - Criterios de aceptación:
    - Las PRs incluyen un reporte automático con el score de performance.
  - Archivos probables: `.github/workflows/lighthouse.yml` o similar.
  - Dependencias: Ninguna.
"""
todo_end_pattern = r"(\n## Deuda Técnica)"
backlog_content = re.sub(todo_end_pattern, new_task + r"\1", backlog_content, count=1)

with open('BACKLOG.md', 'w', encoding='utf-8') as f:
    f.write(backlog_content)
