import re, sys
vals = dict(a.split('=') for a in sys.argv[1:])
s = open('seeds.js').read()
def fix(m):
    line = m.group(0)
    name = re.search(r'id: "(\w+)"', line).group(1)
    line = re.sub(r', neutral: \d+(?: \d+)*', '', line)
    line = re.sub(r'\s*\}$', ' }', line)
    if name in vals and vals[name] != '0':
        line = line[:-2] + ', neutral: ' + vals[name] + ' }'
    return line
s = re.sub(r'\{ id: "\w+", name: [^\n]*?\}(?=,?\n)', fix, s)
open('seeds.js', 'w').write(s)
