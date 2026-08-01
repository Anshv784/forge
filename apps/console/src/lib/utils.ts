import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortenAddress(address: string, chars = 4) {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

export function formatLamports(lamports: number | bigint) {
  const sol = Number(lamports) / 1_000_000_000;
  return `${sol.toLocaleString(undefined, { maximumFractionDigits: sol < 1 ? 4 : 2 })} SOL`;
}

export function formatTokenAmount(amount: number | bigint, decimals: number, symbol = "") {
  const value = Number(amount) / 10 ** decimals;
  const formatted = value.toLocaleString(undefined, { maximumFractionDigits: value < 1 ? 4 : 2 });
  return symbol ? `${formatted} ${symbol}` : formatted;
}

export function formatRelativeTime(unixSeconds: number) {
  const deltaMs = unixSeconds * 1000 - Date.now();
  const deltaSeconds = Math.round(deltaMs / 1000);
  const abs = Math.abs(deltaSeconds);

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
  ];

  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const [unit, secondsInUnit] of units) {
    if (abs >= secondsInUnit || unit === "second") {
      return rtf.format(Math.round(deltaSeconds / secondsInUnit), unit);
    }
  }
  return rtf.format(0, "second");
}

export function formatAbsoluteTime(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
