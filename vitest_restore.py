import re

with open('vitest.config.ts', 'r') as f:
    content = f.read()

content = re.sub(r'statements: \d+', 'statements: 79', content)
content = re.sub(r'branches: \d+', 'branches: 65', content)
content = re.sub(r'functions: \d+', 'functions: 72', content)
content = re.sub(r'lines: \d+', 'lines: 80', content)

with open('vitest.config.ts', 'w') as f:
    f.write(content)
