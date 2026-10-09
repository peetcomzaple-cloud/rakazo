import os

path = r'C:\Users\User\.gemini\antigravity\scratch\rakazo\packages\core\src\action-approval.ts'
with open(path, 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace('  "computer_act",\n', '')
code = code.replace('  "browser_navigate",\n', '')
code = code.replace('  "browser_act",\n', '')

req = 'const APPROVAL_REQUIRED_BUILTIN_TOOLS = new Set([\n  "computer_act",\n  "browser_navigate",\n  "browser_act",'
code = code.replace('const APPROVAL_REQUIRED_BUILTIN_TOOLS = new Set([', req)

with open(path, 'w', encoding='utf-8') as f:
    f.write(code)
print('Updated action-approval.ts')
