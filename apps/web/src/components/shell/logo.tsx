/** MeetMind brand mark: eight rounded petals around a core — a "mind" radiating notes. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden fill="currentColor">
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x="13.5" y="2" width="5" height="12" rx="2.5" transform={`rotate(${i * 45} 16 16)`} />
      ))}
      <circle cx="16" cy="16" r="3.2" fill="var(--bg)" />
    </svg>
  );
}
