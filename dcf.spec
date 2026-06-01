# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec — builds a fully self-contained macOS .app for
DCF Valuation Studio (embedded Python + all libraries + the React build +
a native WKWebView window).  Build from the project root:

    backend/venv/bin/pyinstaller --noconfirm --clean dcf.spec
"""
import re
from PyInstaller.utils.hooks import collect_all, collect_submodules

# Read the app version from backend/version.py so the bundle's Info.plist matches.
_VERSION = "1.0.0"
try:
    with open('backend/version.py') as _vf:
        _m = re.search(r'__version__\s*=\s*"([^"]+)"', _vf.read())
        if _m:
            _VERSION = _m.group(1)
except Exception:
    pass

datas = [('frontend/dist', 'webapp')]   # the built React app -> bundled as "webapp"
binaries = []
hiddenimports = ['main', 'data_provider', 'version', 'update_config', 'updater',
                 'webview.platforms.cocoa']

# Packages that ship compiled extensions and/or data files PyInstaller can miss.
_collect = [
    'yfinance', 'curl_cffi', 'webview', 'pydantic', 'pydantic_core',
    'fastapi', 'starlette', 'uvicorn', 'h11', 'anyio', 'sniffio', 'click',
    'frozendict', 'multitasking', 'peewee', 'platformdirs', 'pytz', 'bs4',
    'certifi', 'charset_normalizer', 'idna', 'requests', 'urllib3',
    # pyobjc frameworks the pywebview Cocoa backend needs:
    'objc', 'Foundation', 'AppKit', 'WebKit', 'Quartz', 'CoreFoundation',
    'PyObjCTools', 'Security', 'Cocoa',
]
for pkg in _collect:
    try:
        d, b, h = collect_all(pkg)
        datas += d
        binaries += b
        hiddenimports += h
    except Exception:
        pass

# uvicorn + pandas load implementations dynamically.
hiddenimports += collect_submodules('uvicorn')
hiddenimports += collect_submodules('pandas')
try:
    hiddenimports += collect_submodules('google.protobuf')
except Exception:
    pass
hiddenimports += [
    'uvicorn.loops.asyncio', 'uvicorn.protocols.http.h11_impl',
    'uvicorn.lifespan.on',
]

a = Analysis(
    ['backend/desktop.py'],
    pathex=['backend'],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=[
        'tkinter', 'matplotlib', 'scipy', 'IPython', 'jupyter', 'notebook',
        'PyQt5', 'PyQt6', 'PySide2', 'PySide6', 'gtk', 'gi',
    ],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='DCF Valuation Studio',
    debug=False,
    strip=False,
    upx=False,
    console=False,            # windowed app (no terminal)
    argv_emulation=False,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name='DCF Valuation Studio',
)
app = BUNDLE(
    coll,
    name='DCF Valuation Studio.app',
    icon='build_assets/icon.icns',
    bundle_identifier='com.dcfstudio.app',
    info_plist={
        'NSHighResolutionCapable': True,
        'LSApplicationCategoryType': 'public.app-category.finance',
        'CFBundleShortVersionString': _VERSION,
        'CFBundleVersion': _VERSION,
        'NSRequiresAquaSystemAppearance': False,
    },
)
