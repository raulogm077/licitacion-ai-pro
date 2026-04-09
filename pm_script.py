import re

with open("BACKLOG.md", "r", encoding="utf-8") as f:
    backlog = f.read()

todo_section = re.search(r"## To Do \(Iteración Actual\)(.*?)(?=## |\Z)", backlog, re.DOTALL)
if todo_section:
    todos = todo_section.group(1).strip()
    print("CURRENT TO DOS:")
    print(todos)
