import re

with open("BACKLOG.md", "r", encoding="utf-8") as f:
    backlog = f.read()

todo_section = re.search(r"## To Do \(Iteración Actual\)(.*?)(?=## |\Z)", backlog, re.DOTALL)
if todo_section:
    todos = todo_section.group(1).strip().split("\n\n")
    todos = [t for t in todos if t.strip() and t.startswith("- [ ]")]
    print(f"Active tasks in To Do: {len(todos)}")
    for i, t in enumerate(todos):
        print(f"{i+1}. {t.split('\n')[0]}")
else:
    print("Could not find To Do section")
