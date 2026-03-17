import re

file_path = "src/features/dashboard/model/pliego-vm.ts"
with open(file_path, "r") as f:
    content = f.read()

pattern = "const chapters: ChapterStatus\[\] = \["
replacement = """const chapters: ChapterStatus[] = [
        ...(content.plantilla_personalizada ? [{
            id: 'plantilla',
            label: 'Extracción Personalizada',
            status: 'COMPLETO' as const
        }] : []),"""

content = re.sub(pattern, replacement, content)

with open(file_path, "w") as f:
    f.write(content)
