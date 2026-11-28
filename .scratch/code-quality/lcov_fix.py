# Copy each app's LCOV to target/coverage/typescript/apps__<app>/ with SF paths
# rewritten to repo-relative forward-slash paths, so crapper can match them.
import pathlib, sys

root = pathlib.Path(sys.argv[1])
for app in ('web', 'api'):
    src = (root / 'apps' / app / 'coverage' / 'lcov.info').read_text(encoding='utf8')
    out = []
    for line in src.splitlines():
        if line.startswith('SF:'):
            line = 'SF:apps/' + app + '/' + line[3:].replace(chr(92), '/')
        out.append(line)
    dest = root / 'target' / 'coverage' / 'typescript' / ('apps__' + app)
    dest.mkdir(parents=True, exist_ok=True)
    (dest / 'lcov.info').write_text('\n'.join(out) + '\n', encoding='utf8')
    print(app, next(l for l in out if l.startswith('SF:')))
