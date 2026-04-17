import re

with open('SPEC.md', 'r', encoding='utf-8') as f:
    content = f.read()

# Add a refinement note
refinement = """### Auditoría PM: Tests bloqueados por fallo de Vitest
- **Contexto:** Durante la auditoría del PM, se verificó el registro técnico en SPEC.md sobre un "Bloqueo Global de la Suite de Tests (Vitest)". El bloqueo persiste en la máquina y en el pipeline de CI/CD.
- **Acción PM:** La tarea de "Aumentar cobertura de tests a 80%" se mantiene condicionada. Se añade al backlog la dependencia para no expandir test si las pre-condiciones no corren. Se restauró el repositorio al commit inicial de auditoría.
"""

if "Auditoría PM: Tests bloqueados por fallo de Vitest" not in content:
    content += "\n\n" + refinement

with open('SPEC.md', 'w', encoding='utf-8') as f:
    f.write(content)
