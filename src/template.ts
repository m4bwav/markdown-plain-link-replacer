/*
The link templates. 1.1.16 compiled them with hogan.js 3.0.2 (mustache); 2.x renders the part of mustache a link template
uses, with hogan's output for it (test/unit/template.test.js checks it against answers recorded from hogan.js 3.0.2):
- {{name}} with the value HTML-escaped as hogan escapes (& < > ' "), {{{name}}} and {{&name}} unescaped;
- {{#name}}...{{/name}} and {{^name}}...{{/name}}: shown when the value is non-empty, or empty;
- {{! comment}}; whitespace inside a tag; a section tag alone on its line removes that line, as the mustache spec says.
The names are title, url and source; any other name, `.` and dotted names are empty, as in hogan. Partials, delimiter changes and anything unclosed throw a
TypeError when the template is compiled, before any request.
*/

export type TemplateValues = {title: string; url: string; source: string};

type Node =
  | {kind: 'text'; text: string}
  | {kind: 'value'; name: string; escape: boolean}
  | {kind: 'section'; name: string; inverted: boolean; children: Node[]};

/**
A compiled template: call it with the values of one link.
*/
export type Template = (values: TemplateValues) => string;

const ESCAPES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '\'': '&#39;', '"': '&quot;',
};

function escapeHtml(text: string): string {
  return text.replaceAll(/["&'<>]/gu, character => ESCAPES[character]!);
}

type Tag = {start: number; end: number; type: string; name: string};

function readTags(template: string): Tag[] {
  const tags: Tag[] = [];
  let position = 0;
  for (;;) {
    const start = template.indexOf('{{', position);
    if (start === -1) {
      return tags;
    }

    // The sigil after the braces; an ordinary {{name}} has none.
    const sigil = template[start + 2] ?? '';
    const type = ['{', '#', '^', '/', '!', '&', '>', '=', '<', '$'].includes(sigil) ? sigil : '';
    if (['>', '=', '<', '$'].includes(type)) {
      throw new TypeError(`template: {{${type}...}} tags (partials, delimiters, blocks) are not supported`);
    }

    const close = type === '{' ? '}}}' : '}}';
    const contentStart = start + 2 + type.length;
    const closeAt = template.indexOf(close, contentStart);
    if (closeAt === -1) {
      throw new TypeError(`template: the tag at position ${start} is not closed with ${close}`);
    }

    tags.push({
      start,
      end: closeAt + close.length,
      type,
      name: template.slice(contentStart, closeAt).trim(),
    });
    position = closeAt + close.length;
  }
}

// A section, inverted-section, closing or comment tag alone on its line takes the whole line with it (mustache "standalone").
function standalone(template: string, tag: Tag): {start: number; end: number} {
  if (!['#', '^', '/', '!'].includes(tag.type)) {
    return tag;
  }

  const isBlank = (character: string | undefined) => character === ' ' || character === '\t';
  let lineStart = tag.start;
  while (lineStart > 0 && isBlank(template[lineStart - 1])) {
    lineStart--;
  }

  if (lineStart > 0 && template[lineStart - 1] !== '\n') {
    return tag;
  }

  let lineEnd = tag.end;
  while (isBlank(template[lineEnd])) {
    lineEnd++;
  }

  if (template.startsWith('\r\n', lineEnd)) {
    return {start: lineStart, end: lineEnd + 2};
  }

  if (template[lineEnd] === '\n') {
    return {start: lineStart, end: lineEnd + 1};
  }

  return lineEnd === template.length ? {start: lineStart, end: lineEnd} : tag;
}

/**
Compiles a template; throws a TypeError for anything the renderer does not support.
*/
export function compileTemplate(template: string): Template {
  const root: Node[] = [];
  const stack: Array<{name: string; children: Node[]}> = [{name: '', children: root}];
  let position = 0;
  for (const tag of readTags(template)) {
    const {start, end} = standalone(template, tag);
    const {children} = stack.at(-1)!;
    if (start > position) {
      children.push({kind: 'text', text: template.slice(position, start)});
    }

    position = end;
    if (tag.type === '#' || tag.type === '^') {
      const section: Node = {
        kind: 'section',
        name: tag.name,
        inverted: tag.type === '^',
        children: [],
      };
      children.push(section);
      stack.push({name: tag.name, children: section.children});
    } else if (tag.type === '/') {
      const open = stack.pop()!;
      if (stack.length === 0 || open.name !== tag.name) {
        throw new TypeError(`template: {{/${tag.name}}} does not close an open section`);
      }
    } else if (tag.type !== '!') {
      // {{name}} escapes; {{{name}}} and {{&name}} do not.
      children.push({kind: 'value', name: tag.name, escape: tag.type === ''});
    }
  }

  if (stack.length > 1) {
    throw new TypeError(`template: the section {{#${stack.at(-1)!.name}}} is not closed`);
  }

  if (position < template.length) {
    root.push({kind: 'text', text: template.slice(position)});
  }

  return values => render(root, values);
}

const NAMES = new Set(['title', 'url', 'source']);

function lookup(name: string, values: TemplateValues): string {
  return NAMES.has(name) ? values[name as keyof TemplateValues] : '';
}

function render(nodes: Node[], values: TemplateValues): string {
  let output = '';
  for (const node of nodes) {
    if (node.kind === 'text') {
      output += node.text;
    } else if (node.kind === 'value') {
      const value = lookup(node.name, values);
      output += node.escape ? escapeHtml(value) : value;
    } else {
      const value = lookup(node.name, values);
      if (node.inverted ? value === '' : value !== '') {
        output += render(node.children, values);
      }
    }
  }

  return output;
}

// Markdown's special characters in a page title, escaped so the title stays text inside the link: \ ` * _ [ ] < > and an
// ampersand that would start a character reference (plan E6).
function escapeMarkdown(title: string): string {
  return title
    .replaceAll(/[*<>[\\\]_`]/gu, String.raw`\$&`)
    .replaceAll(/&(?=#?\w+;)/gu, String.raw`\&`);
}

/**
The default: `"[<title>](<url>)", *<source>*`, as 1.1.16 wrote it, without its HTML escaping, with the title's markdown
characters escaped (plan E6).
*/
export const defaultTemplate: Template = ({title, url, source}) => `"[${escapeMarkdown(title)}](${url})", *${source}*`;
