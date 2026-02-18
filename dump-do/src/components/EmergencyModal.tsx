// src/components/EmergencyModal.tsx
// Emergency modal for crisis situations (CVV referral)
// FIX: Added DOMPurify for XSS protection, accessibility improvements

import React, { useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, Phone, MessageCircle, X, Heart } from 'lucide-react';
import DOMPurify from 'dompurify';

interface EmergencyModalProps {
  show: boolean;
  message: string;
  riskType: string | null;
  onClose: () => void;
}

// Risk type to color theme mapping
const RISK_TYPE_THEMES: Record<string, {
  headerGradient: string;
  borderColor: string;
  bgGradient: string;
}> = {
  suicidal_ideation: {
    headerGradient: 'from-red-600 to-red-700',
    borderColor: 'border-red-500/30',
    bgGradient: 'from-red-900/20 to-red-950/20'
  },
  self_harm: {
    headerGradient: 'from-orange-600 to-red-600',
    borderColor: 'border-orange-500/30',
    bgGradient: 'from-orange-900/20 to-red-950/20'
  },
  violence: {
    headerGradient: 'from-red-700 to-red-800',
    borderColor: 'border-red-600/30',
    bgGradient: 'from-red-950/20 to-black/20'
  },
  panic_attack: {
    headerGradient: 'from-cyan-600 to-blue-600',
    borderColor: 'border-cyan-500/30',
    bgGradient: 'from-cyan-900/20 to-blue-950/20'
  },
  substance_crisis: {
    headerGradient: 'from-amber-600 to-orange-600',
    borderColor: 'border-amber-500/30',
    bgGradient: 'from-amber-900/20 to-orange-950/20'
  },
  severe_distress: {
    headerGradient: 'from-indigo-600 to-purple-600',
    borderColor: 'border-indigo-500/30',
    bgGradient: 'from-indigo-900/20 to-purple-950/20'
  },
  default: {
    headerGradient: 'from-red-600 to-red-700',
    borderColor: 'border-red-500/30',
    bgGradient: 'from-red-900/20 to-red-950/20'
  }
};

/**
 * Sanitize HTML content and convert markdown-style bold to HTML
 */
function sanitizeMessage(message: string): string {
  // Convert **text** to <strong>text</strong>
  const withBold = message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Sanitize with DOMPurify - allow only safe tags
  return DOMPurify.sanitize(withBold, {
    ALLOWED_TAGS: ['strong', 'b', 'em', 'i', 'br', 'p', 'ul', 'li', 'a'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ADD_ATTR: ['target'] // Allow target for links
  });
}

const EmergencyModal: React.FC<EmergencyModalProps> = ({ show, message, riskType, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const firstButtonRef = useRef<HTMLAnchorElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Get theme based on risk type
  const theme = RISK_TYPE_THEMES[riskType || 'default'] || RISK_TYPE_THEMES.default;

  // Handle ESC key to close modal
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }

    // Focus trap: cycle focus within modal
    if (e.key === 'Tab' && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
        'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  }, [onClose]);

  // Set up event listeners and auto-focus
  useEffect(() => {
    if (show) {
      document.addEventListener('keydown', handleKeyDown);
      // Auto-focus first action button for accessibility
      setTimeout(() => firstButtonRef.current?.focus(), 100);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [show, handleKeyDown]);

  if (!show) return null;

  const sanitizedMessage = sanitizeMessage(message);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-labelledby="emergency-modal-title"
      aria-describedby="emergency-modal-description"
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div 
        ref={modalRef}
        className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-br ${theme.bgGradient} border-2 ${theme.borderColor} rounded-3xl shadow-2xl animate-in slide-in-from-bottom duration-500`}
      >
        {/* Header */}
        <div className={`sticky top-0 bg-gradient-to-r ${theme.headerGradient} p-6 rounded-t-3xl`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 rounded-2xl">
                <AlertTriangle className="w-8 h-8 text-white" aria-hidden="true" />
              </div>
              <div>
                <h2 id="emergency-modal-title" className="text-2xl font-bold text-white">
                  Emergência Detectada
                </h2>
                <p className="text-red-100 text-sm mt-1">MIND-SAFE Protocol Ativado</p>
              </div>
            </div>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
              aria-label="Fechar modal de emergência"
            >
              <X className="w-6 h-6 text-white" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          {/* Emergency Message */}
          <div id="emergency-modal-description" className="prose prose-invert max-w-none">
            <div 
              className="text-white leading-relaxed whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: sanitizedMessage }}
            />
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-white/10">
            {/* CVV Call */}
            <a
              ref={firstButtonRef}
              href="tel:188"
              className="flex items-center gap-3 p-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-2xl transition-all shadow-lg hover:shadow-green-500/25 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 focus:ring-offset-black"
            >
              <Phone className="w-6 h-6" aria-hidden="true" />
              <div className="text-left">
                <div className="text-lg">Ligar CVV</div>
                <div className="text-sm text-green-100">188 - Gratuito 24h</div>
              </div>
            </a>

            {/* CVV Chat */}
            <a
              href="https://cvv.org.br"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-2xl transition-all shadow-lg hover:shadow-cyan-500/25 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black"
            >
              <MessageCircle className="w-6 h-6" aria-hidden="true" />
              <div className="text-left">
                <div className="text-lg">Chat CVV</div>
                <div className="text-sm text-cyan-100">Online agora</div>
              </div>
            </a>

            {/* SAMU */}
            <a
              href="tel:192"
              className="flex items-center gap-3 p-4 bg-red-700 hover:bg-red-600 text-white font-bold rounded-2xl transition-all shadow-lg hover:shadow-red-500/25 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-black"
            >
              <AlertTriangle className="w-6 h-6" aria-hidden="true" />
              <div className="text-left">
                <div className="text-lg">SAMU</div>
                <div className="text-sm text-red-100">192 - Emergência Médica</div>
              </div>
            </a>

            {/* CAPS Info */}
            <a
              href="https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/s/saude-mental/caps"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all shadow-lg hover:shadow-indigo-500/25 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-black"
            >
              <Heart className="w-6 h-6" aria-hidden="true" />
              <div className="text-left">
                <div className="text-lg">CAPS</div>
                <div className="text-sm text-indigo-100">Atendimento Gratuito</div>
              </div>
            </a>
          </div>

          {/* Disclaimer */}
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl" role="alert">
            <p className="text-sm text-yellow-200 leading-relaxed">
              ⚠️ <strong>Importante:</strong> O Dump.do NÃO substitui atendimento profissional. 
              Em caso de emergência médica, ligue <strong>192 (SAMU)</strong> imediatamente.
              Este sistema detectou sinais de risco e está te conectando com ajuda especializada.
            </p>
          </div>

          {/* Footer Note */}
          <div className="text-center text-sm text-gray-400">
            <p>Sistema MIND-SAFE desenvolvido para sua segurança</p>
            <p className="mt-2">Detecção pré-LLM • LGPD compliant • Confidencial</p>
          </div>
        </div>

        {/* Close Button */}
        <div className="sticky bottom-0 p-6 bg-gradient-to-t from-black/50 to-transparent rounded-b-3xl">
          <button
            onClick={onClose}
            className="w-full py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl transition-all focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-black"
          >
            Fechar e Continuar no Chat
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmergencyModal;
