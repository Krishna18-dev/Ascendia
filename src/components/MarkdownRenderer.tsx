import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const CopyButton = ({ code }: { code: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-muted/80 hover:bg-muted transition-colors"
      aria-label="Copy code"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
    </button>
  );
};

const MarkdownRenderer = ({ content, className }: MarkdownRendererProps) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-2xl font-bold mt-6 mb-3 text-foreground">{children}</h1>,
          h2: ({ children }) => <h2 className="text-xl font-semibold mt-5 mb-2 text-foreground">{children}</h2>,
          h3: ({ children }) => <h3 className="text-lg font-semibold mt-4 mb-2 text-foreground">{children}</h3>,
          h4: ({ children }) => <h4 className="text-base font-semibold mt-3 mb-1 text-foreground">{children}</h4>,
          p: ({ children }) => <p className="mb-3 leading-relaxed text-foreground/90">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-foreground/90">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/50 pl-4 py-1 my-3 italic text-muted-foreground bg-muted/30 rounded-r-md">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {children}
            </a>
          ),
          hr: () => <hr className="my-4 border-border" />,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 rounded-lg border border-border">
              <table className="min-w-full text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
          th: ({ children }) => <th className="px-3 py-2 text-left font-semibold text-foreground border-b border-border">{children}</th>,
          td: ({ children }) => <td className="px-3 py-2 border-b border-border text-foreground/90">{children}</td>,
          code: ({ className: codeClassName, children, ...props }) => {
            const match = /language-(\w+)/.exec(codeClassName || "");
            const codeString = String(children).replace(/\n$/, "");
            if (match) {
              return (
                <div className="relative my-3 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-1.5 bg-muted/80 text-xs text-muted-foreground font-mono">
                    <span>{match[1]}</span>
                  </div>
                  <CopyButton code={codeString} />
                  <SyntaxHighlighter
                    style={isDark ? oneDark : oneLight}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{ margin: 0, borderRadius: 0, fontSize: "0.8125rem" }}
                  >
                    {codeString}
                  </SyntaxHighlighter>
                </div>
              );
            }
            return (
              <code className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono text-primary" {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
