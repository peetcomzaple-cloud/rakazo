import os

path = r'C:\Users\User\.gemini\antigravity\scratch\rakazo\apps\web\src\pages\Shell.tsx'
with open(path, 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace(
    'const embeddedScreenUrl = embeddableScreenUrl(screenUrl);', 
    'const embeddedScreenUrl = "http://127.0.0.1:16080/vnc.html";'
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(code)

print('Patched Shell.tsx screen url')
