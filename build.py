#!/usr/bin/env python3
"""Build the static Campus Connect site from the canvas's .dc.html sources.

Usage: python3 build.py <project_dir> <assets_dir> <asset_urls_json> <css_dir> <out_dir>
"""
import json, os, re, shutil, sys, html

project, assets_dir, urls_json, css_dir, out = sys.argv[1:6]
PAGES = ['Main', 'Program', 'Marketplace', 'Academy', 'Universities', 'Contact', 'Demo']

blob_to_file = {v.split('/')[-1]: k for k, v in json.load(open(urls_json)).items()}
blob_to_file['ccb2cf527026a7a29d7f10759b2a8c50'] = 'market-app.css'
blob_to_file['504e0a693c7f162b110b7c810b9a6ba5'] = 'academy-app.css'

def rewrite(text):
    def sub(m):
        bid = m.group(1)
        if bid not in blob_to_file:
            raise SystemExit('No local copy for blob ' + bid)
        return '/assets/' + blob_to_file[bid]
    return re.sub(r'/_blob/([0-9a-f]{32})', sub, text)

os.makedirs(os.path.join(out, 'src'), exist_ok=True)
os.makedirs(os.path.join(out, 'assets'), exist_ok=True)

used = set()
for f in sorted(os.listdir(project)):
    if not f.endswith('.dc.html'):
        continue
    t = rewrite(open(os.path.join(project, f)).read())
    used |= set(re.findall(r'/assets/([^"\')\s]+)', t))
    open(os.path.join(out, 'src', f), 'w').write(t)

for name in ('market-app.css', 'academy-app.css'):
    t = rewrite(open(os.path.join(css_dir, name)).read())
    used |= set(re.findall(r'/assets/([^"\')\s]+)', t))
    open(os.path.join(out, 'assets', name), 'w').write(t)

for name in sorted(used):
    if name.endswith('.css'):
        continue
    shutil.copy(os.path.join(assets_dir, name), os.path.join(out, 'assets', name))

SHELL = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="Campus Connect is a university program for student founders: a founder curriculum, expert office hours, investor access and a verified campus marketplace.">
<link rel="icon" type="image/png" href="/assets/campus-connect-logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<style>body{{margin:0;background:{bg}}}</style>
<script src="/dc-runtime.js" defer></script>
</head>
<body>
<div id="dc-root" data-page="{page}"></div>
<noscript>This site needs JavaScript turned on.</noscript>
</body>
</html>
'''
for page in PAGES:
    src = open(os.path.join(project, page + '.dc.html')).read()
    m = re.search(r'<title>(.*?)</title>', src, re.S)
    title = m.group(1).strip() if m else 'Campus Connect'
    shell = SHELL.format(title=title, page=page, bg='#0E0F12')
    open(os.path.join(out, page + '.dc.html'), 'w').write(shell)
    if page == 'Main':
        open(os.path.join(out, 'index.html'), 'w').write(shell)

print('pages:', len(PAGES), 'assets:', len(os.listdir(os.path.join(out, 'assets'))))
