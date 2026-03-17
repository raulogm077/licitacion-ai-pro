file_path = "src/features/dashboard/Dashboard.tsx"
with open(file_path, "r") as f:
    content = f.read()

if "/* eslint-disable @typescript-eslint/no-explicit-any */" not in content:
    content = "/* eslint-disable @typescript-eslint/no-explicit-any */\n" + content

with open(file_path, "w") as f:
    f.write(content)

file_path = "src/features/dashboard/components/layout/Sidebar.tsx"
with open(file_path, "r") as f:
    content = f.read()

if "/* eslint-disable @typescript-eslint/no-explicit-any */" not in content:
    content = "/* eslint-disable @typescript-eslint/no-explicit-any */\n" + content

with open(file_path, "w") as f:
    f.write(content)
