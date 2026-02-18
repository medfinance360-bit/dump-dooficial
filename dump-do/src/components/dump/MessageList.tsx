/**
 * Dump.do v1.2 - MessageList
 * Design system: Dump.do / Plantão 360
 * User on right (muted), assistant on left.
 */

import { useEffect, useRef } from 'react';
import type { DumpMessage } from '../../types/dump';
import { ResponseCard } from './ResponseCard';

interface MessageListProps {
  messages: DumpMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto space-y-4 py-4">
      {messages.map((msg) =>
        msg.role === 'user' ? (
          <div key={msg.id} className="flex justify-end">
            <div
              className="max-w-[85%] rounded-lg rounded-br-md px-4 py-3 ds-font-serif text-sm leading-relaxed whitespace-pre-wrap"
              style={{
                background: 'var(--secondary)',
                border: '1px solid var(--border)',
                color: 'var(--foreground)',
              }}
            >
              {msg.content}
            </div>
          </div>
        ) : (
          <ResponseCard
            key={msg.id}
            content={msg.ai_response?.response ?? msg.content}
            shouldEnd={msg.ai_response?.should_end}
          />
        )
      )}
      <div ref={endRef} />
    </div>
  );
}
