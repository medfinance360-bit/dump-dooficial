/**
 * Dump.do v1.2 - DumpInput
 * Design system: Dump.do / Plantão 360
 * Textarea auto-grow, Enter sends, Shift+Enter newline.
 */

import { useState, useRef, useCallback } from 'react';

interface DumpInputProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function DumpInput({
  onSubmit,
  disabled = false,
  placeholder = 'Despeje aqui... (Enter para enviar)',
}: DumpInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    adjustHeight();
  };

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="space-y-3">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={2}
        className="w-full min-h-[120px] max-h-[200px] resize-none rounded-lg border px-6 py-4 text-base leading-relaxed focus:outline-none transition-[box-shadow] duration-150 disabled:opacity-50 ds-font-serif"
        style={{
          background: 'var(--secondary)',
          borderColor: 'var(--border)',
          color: 'var(--foreground)',
        }}
        onFocus={(e) => {
          e.target.style.boxShadow = '0 0 0 1px var(--ring)';
        }}
        onBlur={(e) => {
          e.target.style.boxShadow = 'none';
        }}
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
        className="ds-btn-primary"
      >
        Enviar
      </button>
    </div>
  );
}
