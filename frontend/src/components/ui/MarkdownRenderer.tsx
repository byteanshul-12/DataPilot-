import React from "react";
import { ExternalLink } from "lucide-react";

interface MarkdownRendererProps {
  content?: string | null;
  className?: string;
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  if (!content) return null;

  // Helper to parse inline markdown (bold, links, code, italic)
  const renderInline = (text: string): React.ReactNode => {
    // Regex for [link](url), **bold**, `code`, *italic*
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let keyIdx = 0;

    while (remaining.length > 0) {
      // Bold **text**
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      // Link [text](url)
      const linkMatch = remaining.match(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/);
      // Inline code `code`
      const codeMatch = remaining.match(/`([^`]+)`/);

      // Find earliest match
      let firstMatch: { type: "bold" | "link" | "code"; index: number; length: number; match: RegExpMatchArray } | null = null;

      if (boldMatch && boldMatch.index !== undefined) {
        firstMatch = { type: "bold", index: boldMatch.index, length: boldMatch[0].length, match: boldMatch };
      }
      if (linkMatch && linkMatch.index !== undefined) {
        if (!firstMatch || linkMatch.index < firstMatch.index) {
          firstMatch = { type: "link", index: linkMatch.index, length: linkMatch[0].length, match: linkMatch };
        }
      }
      if (codeMatch && codeMatch.index !== undefined) {
        if (!firstMatch || codeMatch.index < firstMatch.index) {
          firstMatch = { type: "code", index: codeMatch.index, length: codeMatch[0].length, match: codeMatch };
        }
      }

      if (!firstMatch) {
        parts.push(remaining);
        break;
      }

      // Add text before match
      if (firstMatch.index > 0) {
        parts.push(remaining.substring(0, firstMatch.index));
      }

      // Add styled element
      if (firstMatch.type === "bold") {
        parts.push(
          <strong key={keyIdx++} className="font-semibold text-white">
            {firstMatch.match[1]}
          </strong>
        );
      } else if (firstMatch.type === "link") {
        parts.push(
          <a
            key={keyIdx++}
            href={firstMatch.match[2]}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            <span>{firstMatch.match[1]}</span>
            <ExternalLink className="inline h-3 w-3" />
          </a>
        );
      } else if (firstMatch.type === "code") {
        parts.push(
          <code
            key={keyIdx++}
            className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 font-mono text-[11px] text-emerald-400"
          >
            {firstMatch.match[1]}
          </code>
        );
      }

      remaining = remaining.substring(firstMatch.index + firstMatch.length);
    }

    return parts;
  };

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let currentList: { type: "ul" | "ol"; items: string[] } | null = null;
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];

  const flushList = () => {
    if (currentList) {
      if (currentList.type === "ul") {
        elements.push(
          <ul key={`ul-${elements.length}`} className="my-2.5 space-y-1.5 pl-1 text-zinc-300">
            {currentList.items.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm leading-relaxed">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                <span className="flex-1">{renderInline(item)}</span>
              </li>
            ))}
          </ul>
        );
      } else {
        elements.push(
          <ol key={`ol-${elements.length}`} className="my-2.5 list-decimal space-y-1.5 pl-5 text-sm text-zinc-300 leading-relaxed">
            {currentList.items.map((item, idx) => (
              <li key={idx} className="pl-1">
                {renderInline(item)}
              </li>
            ))}
          </ol>
        );
      }
      currentList = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Code block toggle
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${elements.length}`}
            className="my-3 overflow-x-auto rounded-lg border border-zinc-800 bg-black/80 p-4 font-mono text-xs leading-5 text-zinc-300"
          >
            <code>{codeBlockLines.join("\n")}</code>
          </pre>
        );
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        flushList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      continue;
    }

    // Empty line
    if (!trimmed) {
      flushList();
      continue;
    }

    // Headings
    if (trimmed.startsWith("### ")) {
      flushList();
      elements.push(
        <h3 key={`h3-${elements.length}`} className="mt-5 mb-2.5 flex items-center gap-2 text-base font-semibold text-white">
          {renderInline(trimmed.replace(/^###\s+/, ""))}
        </h3>
      );
      continue;
    }

    if (trimmed.startsWith("#### ")) {
      flushList();
      elements.push(
        <h4 key={`h4-${elements.length}`} className="mt-4 mb-2 text-sm font-semibold tracking-wide text-zinc-200">
          {renderInline(trimmed.replace(/^####\s+/, ""))}
        </h4>
      );
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushList();
      elements.push(
        <h2 key={`h2-${elements.length}`} className="mt-6 mb-3 text-lg font-bold text-white border-b border-zinc-800 pb-1.5">
          {renderInline(trimmed.replace(/^##\s+/, ""))}
        </h2>
      );
      continue;
    }

    // Bullet lists (- or *)
    const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      if (!currentList || currentList.type !== "ul") {
        flushList();
        currentList = { type: "ul", items: [] };
      }
      currentList.items.push(bulletMatch[1]);
      continue;
    }

    // Numbered lists (1. or 2.)
    const numberMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (numberMatch) {
      if (!currentList || currentList.type !== "ol") {
        flushList();
        currentList = { type: "ol", items: [] };
      }
      currentList.items.push(numberMatch[1]);
      continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      flushList();
      elements.push(
        <blockquote
          key={`quote-${elements.length}`}
          className="my-3 border-l-2 border-emerald-500 bg-zinc-900/40 px-4 py-2 text-sm italic text-zinc-300 rounded-r"
        >
          {renderInline(trimmed.substring(2))}
        </blockquote>
      );
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p key={`p-${elements.length}`} className="my-1.5 text-sm leading-relaxed text-zinc-300">
        {renderInline(trimmed)}
      </p>
    );
  }

  flushList();

  return <div className={`space-y-1 ${className}`}>{elements}</div>;
}
