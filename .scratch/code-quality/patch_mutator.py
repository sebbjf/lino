# Windows without Developer Mode cannot create symlinks (WinError 1314).
# Patch mutator's worker overlay: directories become junctions (no privilege needed),
# files are COPIED (never hard-linked: a mutated write would go through to the real file),
# and every link check also recognises junctions so cleanup never recurses into the real tree.
import pathlib, sys

path = pathlib.Path(sys.argv[1])
src = path.read_text(encoding='utf8')
assert '_is_link' not in src, 'already patched'

old_fn = '''def symlink(link: Path, target: Path) -> None:
    link.parent.mkdir(parents=True, exist_ok=True)
    if link.is_symlink() or link.exists():
        link.unlink()
    link.symlink_to(target.resolve())
'''
new_fn = '''def _is_link(path: Path) -> bool:
    return path.is_symlink() or path.is_junction()


def symlink(link: Path, target: Path) -> None:
    link.parent.mkdir(parents=True, exist_ok=True)
    if _is_link(link) or link.exists():
        link.unlink()
    real = target.resolve()
    if real.is_dir():
        import _winapi
        _winapi.CreateJunction(str(real), str(link))
    else:
        import shutil
        shutil.copyfile(real, link)
'''
assert src.count(old_fn) == 1
src = src.replace(old_fn, '@@SYMLINK_FN@@')
before = src.count('.is_symlink()')
for name in ('path', 'destination', 'current'):
    src = src.replace(f'{name}.is_symlink()', f'_is_link({name})')
src = src.replace('@@SYMLINK_FN@@', new_fn)
left = [l for l in src.splitlines() if '.is_symlink()' in l]
assert left == ['    return path.is_symlink() or path.is_junction()'], left
path.write_text(src, encoding='utf8')
print('patched; is_symlink checks before:', before, 'remaining outside _is_link:', len(left) - 1)
