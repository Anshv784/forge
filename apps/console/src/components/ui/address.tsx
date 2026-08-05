"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { cn, shortenAddress } from "@/lib/utils";

export function Address({
  value,
  href,
  chars = 4,
  className,
}: {
  value: string;
  href?: string;
  chars?: number;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <span
      className={cn(
        "group inline-flex items-center gap-1.5 font-mono text-[12.5px] text-foreground-muted",
        className
      )}
    >
      <span title={value}>{shortenAddress(value, chars)}</span>
      <button
        onClick={handleCopy}
        className="rounded text-foreground-subtle opacity-0 transition-[opacity,color] duration-150 group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
        aria-label="Copy to clipboard"
      >
        {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
      </button>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="rounded text-foreground-subtle opacity-0 transition-[opacity,color] duration-150 group-hover:opacity-100 hover:text-accent focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
          aria-label="View on explorer"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </span>
  );
}
