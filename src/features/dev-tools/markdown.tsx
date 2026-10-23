import { Fragment, type ReactNode } from "react";

/**
 * Small, safe Markdown renderer. Produces React elements directly (never raw
 * HTML), so embedded HTML is shown as text and only http(s)/mailto links are
 * rendered as links.
 *
 * Supported: headings, paragraphs, **bold**, *italic*, `code`, fenced code
 * blocks, blockquotes, ordered/unordered lists, task lists, horizontal rules,
 * links [text](url).
 */

export type Block =
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; text: string }
  | { type: "paragraph"; text: string }
  | { type: "code"; language: string; code: string }
  | { type: "quote"; blocks: Block[] }
  | { type: "list"; ordered: boolean; start: number; items: { text: string; checked: boolean | null }[] }
  | { type: "rule" };

const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

export function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] as string;
    if (line.trim() === "") {
      i++;
      continue;
    }
    const fence = /^\s*(```|~~~)\s*([\w+-]*)\s*$/.exec(line);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] as string).trim().startsWith(fence[1] as string)) code.push(lines[i++] as string);
      i++;
      blocks.push({ type: "code", language: fence[2] ?? "", code: code.join("\n") });
      continue;
    }
    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: (heading[1] as string).length as 1, text: heading[2] ?? "" });
      i++;
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      blocks.push({ type: "rule" });
      i++;
      continue;
    }
    if (/^\s*>/.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i] as string)) quoted.push((lines[i++] as string).replace(/^\s*>\s?/, ""));
      blocks.push({ type: "quote", blocks: parseBlocks(quoted.join("\n")) });
      continue;
    }
    const listMatch = LIST_ITEM.exec(line);
    if (listMatch) {
      const ordered = /\d/.test(listMatch[2] as string);
      const items: { text: string; checked: boolean | null }[] = [];
      while (i < lines.length) {
        const m = LIST_ITEM.exec(lines[i] as string);
        if (!m || /\d/.test(m[2] as string) !== ordered) break;
        const task = /^\[([ xX])\]\s+(.*)$/.exec(m[3] ?? "");
        items.push(task ? { text: task[2] ?? "", checked: task[1] !== " " } : { text: m[3] ?? "", checked: null });
        i++;
      }
      blocks.push({ type: "list", ordered, start: ordered ? Number.parseInt(listMatch[2] as string, 10) : 1, items });
      continue;
    }
    const paragraph: string[] = [];
    while (
      i < lines.length &&
      (lines[i] as string).trim() !== "" &&
      !/^(#{1,6}\s|\s*>|\s*(```|~~~))/.test(lines[i] as string) &&
      !LIST_ITEM.test(lines[i] as string)
    ) {
      paragraph.push((lines[i++] as string).trim());
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }
  return blocks;
}

export function safeUrl(url: string): string | null {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    return ["http:", "https:", "mailto:"].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

const INLINE = /(`+)([^`]+?)\1|\*\*(.+?)\*\*|__(.+?)__|\*(?!\s)(.+?)\*|_(?!\s)(.+?)_|\[([^\]]+)\]\(([^)\s]+)\)/;

export function renderInline(text: string, keyPrefix = "i"): ReactNode[] {
  const nodes: ReactNode[] = [];
  let rest = text;
  let key = 0;
  while (rest.length > 0) {
    const match = INLINE.exec(rest);
    if (!match) {
      nodes.push(rest);
      break;
    }
    if (match.index > 0) nodes.push(rest.slice(0, match.index));
    const k = `${keyPrefix}-${key++}`;
    if (match[2] !== undefined) nodes.push(<code key={k}>{match[2]}</code>);
    else if (match[3] !== undefined || match[4] !== undefined)
      nodes.push(<strong key={k}>{renderInline((match[3] ?? match[4]) as string, k)}</strong>);
    else if (match[5] !== undefined || match[6] !== undefined)
      nodes.push(<em key={k}>{renderInline((match[5] ?? match[6]) as string, k)}</em>);
    else if (match[7] !== undefined) {
      const href = safeUrl(match[8] as string);
      nodes.push(
        href ? (
          <a key={k} href={href} target="_blank" rel="noopener noreferrer nofollow">
            {renderInline(match[7], k)}
          </a>
        ) : (
          <Fragment key={k}>{match[0]}</Fragment>
        ),
      );
    }
    rest = rest.slice(match.index + match[0].length);
  }
  return nodes;
}

function renderBlock(block: Block, key: number): ReactNode {
  switch (block.type) {
    case "heading": {
      const Tag = `h${block.level}` as const;
      return <Tag key={key}>{renderInline(block.text, `h${key}`)}</Tag>;
    }
    case "paragraph":
      return <p key={key}>{renderInline(block.text, `p${key}`)}</p>;
    case "code":
      return (
        <pre key={key} data-language={block.language || undefined}>
          <code>{block.code}</code>
        </pre>
      );
    case "quote":
      return <blockquote key={key}>{block.blocks.map(renderBlock)}</blockquote>;
    case "rule":
      return <hr key={key} />;
    case "list": {
      const items = block.items.map((item, i) => (
        <li key={i}>
          {item.checked !== null && <input type="checkbox" checked={item.checked} readOnly disabled aria-label={item.checked ? "เสร็จ" : "ยังไม่เสร็จ"} />}{" "}
          {renderInline(item.text, `l${key}-${i}`)}
        </li>
      ));
      return block.ordered ? (
        <ol key={key} start={block.start}>
          {items}
        </ol>
      ) : (
        <ul key={key}>{items}</ul>
      );
    }
  }
}

export function MarkdownView({ source }: { source: string }) {
  return <div className="markdown-body">{parseBlocks(source).map(renderBlock)}</div>;
}
