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
        "group inline-flex items-center gap-1.5 font-mono text-[13px] text-foreground-muted",
        className
      )}
    >
      <span title={value}>{shortenAddress(value, chars)}</span>
      <button
        onClick={handleCopy}
        className="text-foreground-subtle opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
        aria-label="Copy to clipboard"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </button>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-foreground-subtle opacity-0 transition-opacity group-hover:opacity-100 hover:text-accent"
          aria-label="View on explorer"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </span>
  );
}
