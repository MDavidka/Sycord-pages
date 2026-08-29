"use client";

import { Streamdown, type Components } from "streamdown";
import { createCodePlugin } from "@streamdown/code";
import { cn } from "./utils/cn";

function fixNumberedListBreaks(text: string): string {
  return text.replace(/^(\d+)\.\s*\n+\s*\n*/gm, "$1. ");
}

const CODE_FENCE_LANGS = new Set([
  "bash",
  "diff",
  "html",
  "js",
  "json",
  "jsx",
  "md",
  "markdown",
  "sh",
  "shell",
  "text",
  "ts",
  "tsx",
  "yml",
  "yaml",
]);

function normalizeCodeFenceLanguages(text: string): string {
  return text.replace(/```([^\n]*)/g, (_match, langRaw) => {
    const lang = String(langRaw || "")
      .trim()
      .toLowerCase();
    if (!lang) return "```";
    const normalized = lang.split(/\s+/)[0];
    return CODE_FENCE_LANGS.has(normalized) ? `\`\`\`${normalized}` : "```text";
  });
}

export type MarkdownProps = {
  content: string;
  className?: string;
  textContrast?: "normal" | "high";
};

const code = createCodePlugin({
  themes: ["github-light", "github-dark"],
});

export function Markdown({ content, className }: MarkdownProps) {
  const safeContent = normalizeCodeFenceLanguages(
    fixNumberedListBreaks(content),
  );
  const components: Components = {
    h1: ({ children, ...props }) => (
      <h1 className="an-md-h1 text-[18px] leading-7 font-semibold mt-4 mb-2" {...props}>
        {children}
      </h1>
    ),
    h2: ({ children, ...props }) => (
      <h2 className="an-md-h2 text-[17px] leading-7 font-semibold mt-4 mb-2" {...props}>
        {children}
      </h2>
    ),
    h3: ({ children, ...props }) => (
      <h3 className="an-md-h3 text-[16px] leading-6 font-semibold mt-3 mb-1.5" {...props}>
        {children}
      </h3>
    ),
    h4: ({ children, ...props }) => (
      <h4 className="an-md-h4 text-[15px] leading-6 font-medium mt-3 mb-1.5" {...props}>
        {children}
      </h4>
    ),
    p: ({ children, ...props }) => (
      <p
        className="an-md-p text-[15px] leading-7 text-an-foreground/85 sm:text-[16px]"
        {...props}
      >
        {children}
      </p>
    ),
    ul: ({ children, ...props }) => (
      <ul
        className="an-md-ul list-disc list-outside space-y-1 text-[15px] leading-7 mb-3 pl-5 text-an-foreground/85 sm:text-[16px]"
        {...props}
      >
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol
        className="an-md-ol list-decimal list-outside space-y-1 text-[15px] leading-7 mb-3 pl-5 text-an-foreground/85 sm:text-[16px]"
        {...props}
      >
        {children}
      </ol>
    ),
    li: ({ children, ...props }) => (
      <li className="an-md-li pl-0.5 text-an-foreground/85" {...props}>
        {children}
      </li>
    ),
    strong: ({ children, ...props }) => (
      <strong className="font-medium text-an-foreground" {...props}>
        {children}
      </strong>
    ),
    a: ({ href, children, ...props }) => {
      if (!href) return <span>{children}</span>;
      const isExternal = href.startsWith("http") || href.startsWith("mailto:");
      return (
        <a
          {...props}
          href={href}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
          className="an-md-link hover:underline underline-offset-2 text-an-primary-color"
        >
          {children}
        </a>
      );
    },
    blockquote: ({ children, ...props }) => (
      <blockquote
        className="an-md-blockquote pl-3 italic mb-3 text-[15px] leading-7 border-l-2 border-an-border-color text-an-foreground/75 sm:text-[16px]"
        {...props}
      >
        {children}
      </blockquote>
    ),
    hr: ({ ...props }) => (
      <hr className="an-md-hr my-4 border-an-border-color" {...props} />
    ),
    table: ({ children, ...props }) => (
      <div className="overflow-x-auto my-3 border border-an-border-color rounded-an-tool-border-radius">
        <table
          className="an-md-table w-full text-[15px] sm:text-[16px] [&>thead]:bg-an-tool-background [&>thead>tr>th]:bg-an-tool-background"
          {...props}
        >
          {children}
        </table>
      </div>
    ),
    th: ({ children, ...props }) => (
      <th
        className="text-left font-medium px-3 py-2 bg-an-background-secondary"
        {...props}
      >
        {children}
      </th>
    ),
    td: ({ children, ...props }) => (
      <td
        className="px-3 py-2 border-t border-an-border-color text-an-foreground/80"
        {...props}
      >
        {children}
      </td>
    ),
  };

  return (
    <div
      className={cn(
        "an-markdown",
        "overflow-hidden wrap-break-word",
        "[&_li>p]:inline [&_li>p]:mb-0",
        className,
      )}
    >
      <Streamdown components={components} plugins={{ code }}>
        {safeContent}
      </Streamdown>
    </div>
  );
}
