import os, hashlib
paths = [
    'public/wasm/web-ifc.wasm',
    'node_modules/web-ifc/web-ifc.wasm',
    'node_modules/web-ifc-three/node_modules/web-ifc/web-ifc.wasm'
]
print('cwd', os.getcwd())
for p in paths:
    if os.path.exists(p):
        s = os.path.getsize(p)
        h = hashlib.sha256(open(p, 'rb').read()).hexdigest()
        print(p, s, h)
    else:
        print(p, 'MISSING')
