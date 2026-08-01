/** Carapace's mark: three layered plates, like a segmented shell — the
 * visual idea being "armor built from stacked, independent layers," which
 * is also literally the product's architecture (chain, plugin, human). */
export function ShellMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M16 2.5 28.5 9v6.2C28.5 23.6 23.2 29.4 16 31.5 8.8 29.4 3.5 23.6 3.5 15.2V9L16 2.5Z"
        fill="currentColor"
        fillOpacity="0.12"
      />
      <path
        d="M16 2.5 28.5 9v3.4L16 6.1 3.5 12.4V9L16 2.5Z"
        fill="currentColor"
        fillOpacity="0.9"
      />
      <path
        d="M16 10.4 25.8 15.3v2.9C25.8 24.4 21.7 29 16 31.5 10.3 29 6.2 24.4 6.2 18.2v-2.9L16 10.4Z"
        fill="currentColor"
        fillOpacity="0.55"
      />
      <path
        d="M16 17 21.9 19.9v1.6C21.9 25.6 19.4 28.3 16 29.8c-3.4-1.5-5.9-4.2-5.9-8.3v-1.6L16 17Z"
        fill="currentColor"
      />
    </svg>
  );
}
