import re

with open('vitest.config.ts', 'r') as f:
    content = f.read()

# Change statement, branch, functions coverage to 80, 70, 80 respectively based on the BACKLOG.md objective
content = re.sub(r'statements: \d+', 'statements: 80', content)
content = re.sub(r'branches: \d+', 'branches: 70', content)
content = re.sub(r'functions: \d+', 'functions: 80', content)
content = re.sub(r'lines: \d+', 'lines: 80', content)

with open('vitest.config.ts', 'w') as f:
    f.write(content)
