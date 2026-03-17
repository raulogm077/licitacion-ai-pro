import os
import json

def count_lines(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return sum(1 for line in f)
    except Exception:
        return 0

def get_dir_size(start_path):
    total_size = 0
    total_lines = 0
    file_count = 0
    for dirpath, _, filenames in os.walk(start_path):
        if 'node_modules' in dirpath or '.git' in dirpath or 'dist' in dirpath or '.jules' in dirpath:
            continue
        for f in filenames:
            fp = os.path.join(dirpath, f)
            if not os.path.islink(fp):
                total_size += os.path.getsize(fp)
                if f.endswith(('.ts', '.tsx', '.js', '.jsx', '.css', '.html')):
                    total_lines += count_lines(fp)
                    file_count += 1
    return total_size, total_lines, file_count

src_size, src_lines, src_files = get_dir_size('src')
sb_size, sb_lines, sb_files = get_dir_size('supabase')

print("=== AUDITORIA DE CODIGO ===")
print(f"Directorio src/ : {src_files} archivos, {src_lines} lineas de codigo, {src_size / 1024:.2f} KB")
print(f"Directorio supabase/ : {sb_files} archivos, {sb_lines} lineas de codigo, {sb_size / 1024:.2f} KB")

# Buscando TODOs
print("\n=== TODOs y FIXMEs ===")
os.system('grep -r -i -n "TODO\|FIXME" src supabase')

print("\n=== TS Config ===")
os.system('cat tsconfig.json | grep -i "strict"')

print("\n=== ESLint Config ===")
os.system('cat .eslintrc.cjs | grep -i "rules" -A 10')

print("\n=== Vitest Tests ===")
os.system('find src -name "*.test.ts" -o -name "*.test.tsx" | wc -l')

print("\n=== Playwright Tests ===")
os.system('find e2e -name "*.spec.ts" | wc -l')
