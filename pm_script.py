import re

with open('SPEC.md', 'r', encoding='utf-8') as f:
    content = f.read()

spec_update_2 = """
### [2026-03-30] Definición de Cobertura QA
- **Acción:** Se ha generado una nueva tarea de QA en el backlog ("Incrementar cobertura de tests unitarios a 80% (Statements) y 70% (Branches)") para cumplir el objetivo actual de iteración. La auditoría actual reveló que el coverage general se encuentra al 66% statements y 53% branches. Se enfocará en servicios (`db.service.ts`, `ai.service.ts`), componentes interactivos de UI (ej. `UploadStep.tsx`, `TemplateList.tsx`, `pliego-vm.ts`) y utilidades.
"""
content = content + "\n" + spec_update_2

with open('SPEC.md', 'w', encoding='utf-8') as f:
    f.write(content)
