/**
 * Dump.do v1.2 - ResponseCard
 * Design system: Dump.do / Plantão 360
 * Assistant response. Extra spacing if should_end.
 */

interface ResponseCardProps {
  content: string;
  shouldEnd?: boolean;
}

export function ResponseCard({ content, shouldEnd }: ResponseCardProps) {
  return (
    <div className={`flex justify-start ${shouldEnd ? 'mb-8' : ''}`}>
      <div
        className="max-w-[85%] rounded-lg rounded-bl-md px-4 py-3 ds-font-serif text-sm leading-relaxed whitespace-pre-wrap"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          color: 'var(--card-foreground)',
        }}
      >
        {content}
      </div>
    </div>
  );
}
