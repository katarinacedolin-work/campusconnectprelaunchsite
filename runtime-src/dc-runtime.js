// Static runtime for Campus Connect's .dc.html pages.
// Fetches a page's .dc.html source, compiles its <x-dc> template and logic
// class, and renders it with React. <dc-import> children are fetched from /src.
import React from 'react';
import { createRoot } from 'react-dom/client';

const SRC_DIR = '/src/';
const sources = new Map(); // name -> parsed component definition

const EVENTS = [
  'Click', 'DoubleClick', 'ContextMenu', 'Change', 'Input', 'Submit', 'Reset', 'Invalid',
  'Focus', 'Blur', 'KeyDown', 'KeyUp', 'KeyPress',
  'MouseDown', 'MouseUp', 'MouseMove', 'MouseEnter', 'MouseLeave', 'MouseOver', 'MouseOut',
  'PointerDown', 'PointerUp', 'PointerMove', 'PointerEnter', 'PointerLeave', 'PointerOver', 'PointerOut', 'PointerCancel',
  'TouchStart', 'TouchEnd', 'TouchMove', 'TouchCancel', 'Scroll', 'Wheel',
  'DragStart', 'Drag', 'DragEnd', 'DragEnter', 'DragLeave', 'DragOver', 'Drop',
  'Load', 'Error', 'AnimationEnd', 'AnimationStart', 'TransitionEnd', 'Copy', 'Cut', 'Paste'
];
const EVENT_MAP = {};
for (const e of EVENTS) EVENT_MAP['on' + e.toLowerCase()] = 'on' + e;

const ATTR_MAP = {
  class: 'className', for: 'htmlFor', tabindex: 'tabIndex', readonly: 'readOnly',
  maxlength: 'maxLength', minlength: 'minLength', autocomplete: 'autoComplete',
  autofocus: 'autoFocus', inputmode: 'inputMode', enterkeyhint: 'enterKeyHint',
  colspan: 'colSpan', rowspan: 'rowSpan', crossorigin: 'crossOrigin', srcset: 'srcSet',
  contenteditable: 'contentEditable', spellcheck: 'spellCheck', novalidate: 'noValidate',
  accesskey: 'accessKey', datetime: 'dateTime', referrerpolicy: 'referrerPolicy',
  fetchpriority: 'fetchPriority', playsinline: 'playsInline', autoplay: 'autoPlay',
  allowfullscreen: 'allowFullScreen', 'xlink:href': 'xlinkHref', 'xml:space': 'xmlSpace'
};
const BOOL_ATTRS = new Set(['required', 'disabled', 'checked', 'selected', 'readOnly', 'hidden',
  'multiple', 'autoFocus', 'noValidate', 'open', 'playsInline', 'autoPlay', 'muted', 'loop', 'controls', 'allowFullScreen']);

const HOLE = /\{\{\s*([^}]*?)\s*\}\}/g;
const WHOLE = /^\s*\{\{\s*([^}]*?)\s*\}\}\s*$/;

function camel(s) { return s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase()); }

function lookup(path, scope) {
  if (path === '') return undefined;
  if (path === 'true') return true;
  if (path === 'false') return false;
  if (path === 'null') return null;
  if (path === 'undefined') return undefined;
  if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
  const q = path.match(/^(['"])(.*)\1$/);
  if (q) return q[2];
  const parts = path.split('.');
  let v = scope;
  for (const p of parts) {
    if (v == null) return undefined;
    v = v[p];
  }
  return v;
}

function interp(str, scope) {
  return str.replace(HOLE, (_, p) => {
    const v = lookup(p, scope);
    return v == null || v === false ? '' : String(v);
  });
}

function resolveAttr(raw, scope) {
  const m = raw.match(WHOLE);
  if (m) return lookup(m[1], scope);
  if (raw.indexOf('{{') >= 0) return interp(raw, scope);
  return raw;
}

function parseStyle(str) {
  const out = {};
  let depth = 0, cur = '';
  const decls = [];
  for (const ch of str) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ';' && depth === 0) { decls.push(cur); cur = ''; } else cur += ch;
  }
  decls.push(cur);
  for (const d of decls) {
    const i = d.indexOf(':');
    if (i < 0) continue;
    const k = d.slice(0, i).trim();
    const v = d.slice(i + 1).trim();
    if (!k || v === '') continue;
    if (k.startsWith('--')) out[k] = v;
    else {
      let key = camel(k);
      if (key.startsWith('Webkit') || key.startsWith('Moz') || key.startsWith('Ms')) { /* keep */ }
      else if (k.startsWith('-webkit-')) key = 'Webkit' + camel(k.slice(8)).replace(/^./, (c) => c.toUpperCase());
      out[key] = v;
    }
  }
  return out;
}

function propName(attr) {
  if (EVENT_MAP[attr]) return EVENT_MAP[attr];
  if (ATTR_MAP[attr]) return ATTR_MAP[attr];
  if (attr.startsWith('aria-') || attr.startsWith('data-')) return attr;
  if (attr.indexOf('-') >= 0 || attr.indexOf(':') >= 0) return camel(attr.replace(':', '-'));
  return attr;
}

let keySeq = 0;

function renderNodes(nodes, scope) {
  const out = [];
  for (let i = 0; i < nodes.length; i++) {
    const r = renderNode(nodes[i], scope, i);
    if (r === null || r === undefined) continue;
    if (Array.isArray(r)) out.push(...r); else out.push(r);
  }
  return out;
}

function textValue(v) {
  if (v == null || typeof v === 'boolean') return null;
  if (typeof v === 'string' || typeof v === 'number') return v;
  return null;
}

function renderNode(node, scope, idx) {
  if (node.nodeType === 3) {
    const t = node.nodeValue;
    if (t.indexOf('{{') < 0) return t;
    const m = t.match(WHOLE);
    if (m) {
      const lead = t.slice(0, t.indexOf('{{'));
      const trail = t.slice(t.lastIndexOf('}}') + 2);
      const v = textValue(lookup(m[1], scope));
      return [lead, v, trail].filter((x) => x !== null && x !== '');
    }
    return interp(t, scope);
  }
  if (node.nodeType !== 1) return null;
  const tag = node.localName;
  if (tag === 'helmet' || tag === 'script') return null;

  if (tag === 'sc-if') {
    const v = resolveAttr(node.getAttribute('value') || '', scope);
    if (!v) return null;
    return React.createElement(React.Fragment, { key: 'if' + idx }, ...renderNodes(node.childNodes, scope));
  }
  if (tag === 'sc-for') {
    const list = resolveAttr(node.getAttribute('list') || '', scope);
    const as = node.getAttribute('as') || 'item';
    if (!list || typeof list.length !== 'number') return null;
    const items = [];
    for (let i = 0; i < list.length; i++) {
      const s = Object.create(scope);
      s[as] = list[i];
      s.$index = i;
      items.push(React.createElement(React.Fragment, { key: i }, ...renderNodes(node.childNodes, s)));
    }
    return React.createElement(React.Fragment, { key: 'for' + idx }, ...items);
  }
  if (tag === 'dc-import') {
    const name = node.getAttribute('name');
    const def = sources.get(name);
    if (!def) return null;
    const props = { key: 'imp' + idx };
    for (const a of Array.from(node.attributes)) {
      if (a.name === 'name' || a.name.startsWith('hint-')) continue;
      props[camel(a.name)] = resolveAttr(a.value, scope);
    }
    return React.createElement(def.Component, props);
  }

  const props = { key: idx };
  for (const a of Array.from(node.attributes)) {
    const name = propName(a.name);
    if (name === 'style') {
      const s = resolveAttr(a.value, scope);
      if (typeof s === 'string') props.style = parseStyle(s);
      else if (s && typeof s === 'object') props.style = s;
      continue;
    }
    const isWhole = WHOLE.test(a.value);
    let v = resolveAttr(a.value, scope);
    if (name.startsWith('on') && EVENTS.indexOf(name.slice(2)) >= 0) {
      if (typeof v === 'function') props[name] = v;
      continue;
    }
    if (BOOL_ATTRS.has(name) && !isWhole) v = true;
    if (v === undefined) continue;
    props[name] = v;
  }
  let children = renderNodes(node.childNodes, scope);
  if (tag === 'textarea') {
    const text = children.filter((c) => typeof c === 'string').join('');
    if (text.trim() && props.value === undefined) props.defaultValue = text;
    children = [];
  }
  if (tag === 'select' && props.value === undefined) {
    // let the selected <option> attribute drive an uncontrolled select
  }
  if ('value' in props && !props.onChange && !props.onInput && !props.readOnly &&
      (tag === 'input' || tag === 'textarea' || tag === 'select')) {
    props.defaultValue = props.value;
    delete props.value;
  }
  if (tag === 'option' && props.selected !== undefined) delete props.selected;
  const VOID = { area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1, input: 1, link: 1, meta: 1, source: 1, track: 1, wbr: 1 };
  if (VOID[tag]) return React.createElement(tag, props);
  return React.createElement(tag, props, ...children);
}

const appliedHead = new Set();
function applyHead(nodes) {
  for (const n of nodes) {
    if (n.nodeType !== 1) continue;
    const t = n.localName;
    if (t !== 'link' && t !== 'style' && t !== 'meta') continue;
    if (t === 'link' && n.getAttribute('rel') !== 'stylesheet' && n.getAttribute('rel') !== 'preconnect') continue;
    const sig = n.outerHTML;
    if (appliedHead.has(sig)) continue;
    appliedHead.add(sig);
    const el = document.createElement(t);
    for (const a of Array.from(n.attributes)) el.setAttribute(a.name, a.value);
    if (t === 'style') el.textContent = n.textContent;
    document.head.appendChild(el);
  }
}

function compile(name, html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const xdc = doc.querySelector('x-dc');
  if (!xdc) throw new Error('No <x-dc> in ' + name);
  const headLinks = Array.from(doc.head.querySelectorAll('link[rel="stylesheet"]'));
  const helmet = xdc.querySelector(':scope > helmet');
  const templateNodes = Array.from(xdc.childNodes).filter((n) => !(n.nodeType === 1 && n.localName === 'helmet'));
  const scriptEl = doc.querySelector('script[data-dc-script]');
  const title = doc.querySelector('title');

  class DCLogic extends React.Component {
    renderVals() { return {}; }
    render() {
      const vals = this.renderVals() || {};
      return React.createElement(React.Fragment, null, ...renderNodes(templateNodes, vals));
    }
  }
  let Component = DCLogic;
  if (scriptEl) {
    const code = scriptEl.textContent;
    // eslint-disable-next-line no-new-func
    Component = new Function('DCLogic', 'React', code + '\n;return typeof Component !== "undefined" ? Component : DCLogic;')(DCLogic, React);
  }
  const imports = Array.from(xdc.querySelectorAll('dc-import')).map((n) => n.getAttribute('name')).filter(Boolean);
  return {
    name, Component, imports, title: title ? title.textContent : '',
    head: () => { applyHead(headLinks); if (helmet) applyHead(Array.from(helmet.childNodes)); }
  };
}

async function load(name) {
  if (sources.has(name)) return sources.get(name);
  const res = await fetch(SRC_DIR + name + '.dc.html');
  if (!res.ok) throw new Error('Could not load ' + name + ' (' + res.status + ')');
  const def = compile(name, await res.text());
  sources.set(name, def);
  await Promise.all(def.imports.map(load));
  return def;
}

function headAll(def, seen = new Set()) {
  if (seen.has(def.name)) return;
  seen.add(def.name);
  def.head();
  for (const n of def.imports) { const d = sources.get(n); if (d) headAll(d, seen); }
}

async function boot() {
  const root = document.getElementById('dc-root');
  const page = root.getAttribute('data-page');
  try {
    const def = await load(page);
    headAll(def);
    createRoot(root).render(React.createElement(def.Component, {}));
  } catch (err) {
    console.error(err);
    root.textContent = 'Sorry, this page could not load.';
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
