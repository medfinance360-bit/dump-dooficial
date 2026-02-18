// src/components/Dump.tsx
// Chat principal com integração AMIE completa

import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, AlertTriangle, MessageCircle, Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { assessRisk } from '../services/mindSafe';
import { generateAMIEResponse } from '../services/amieCore';
import type { DumpMessage, AMIEResponse } from '../types';
import EmergencyModal from './EmergencyModal';
import InsightPanel from './InsightPanel';

interface DumpProps {
  onNavigateToDo?: () => void;
}

const Dump: React.FC<DumpProps> = ({ onNavigateToDo }) => {
  const [messages, setMessages] = useState<DumpMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionId] = useState(crypto.randomUUID());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // AMIE state
  const [currentInsights, setCurrentInsights] = useState<AMIEResponse['insights'] | null>(null);
  const [showInsights, setShowInsights] = useState(true);
  const [showHiddenReasoning, setShowHiddenReasoning] = useState(false); // Dev mode
  const [hiddenReasoning, setHiddenReasoning] = useState<AMIEResponse['hiddenReasoning'] | null>(null);
  const [userId, setUserId] = useState('');
  
  const [emergencyModal, setEmergencyModal] = useState({
    show: false,
    message: '',
    riskType: null as string | null
  });

  useEffect(() => {
    loadMessages();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    const { data: user } = await supabase.auth.getUser();
    const fetchedUserId = user.user?.id ?? '';
    setUserId(fetchedUserId);

    const { data, error } = await supabase
      .from('dump_messages')
      .select('*')
      .eq('user_id', fetchedUserId)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    
    if (!error && data) setMessages(data);
  };

  const handleSendDump = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || isProcessing) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setIsProcessing(true);

    try {
      // 🛡️ MIND-SAFE Check (pre-LLM)
      const riskAssessment = assessRisk(userMessage);

      const { data: user } = await supabase.auth.getUser();

      // Save user message
      const { data: savedMessage } = await supabase
        .from('dump_messages')
        .insert({
          user_id: user.user?.id,
          session_id: sessionId,
          role: 'user',
          content: userMessage,
          risk_level: riskAssessment.riskLevel,
          risk_indicators: riskAssessment.indicators,
          is_emergency: riskAssessment.requiresEmergencyResponse
        })
        .select()
        .single();

      if (savedMessage) {
        setMessages(prev => [...prev, savedMessage]);
      }

      // Emergency bypass
      if (riskAssessment.requiresEmergencyResponse) {
        await supabase.from('risk_events').insert({
          user_id: user.user?.id,
          risk_level: riskAssessment.riskLevel,
          risk_type: riskAssessment.riskType,
          detected_indicators: riskAssessment.indicators,
          source_type: 'dump',
          time_of_day: new Date().getHours() < 12 ? 'morning' : 'afternoon',
          day_of_week: new Date().getDay(),
          emergency_response_sent: true
        });

        setEmergencyModal({
          show: true,
          message: riskAssessment.emergencyResponse!,
          riskType: riskAssessment.riskType
        });

        setIsProcessing(false);
        return;
      }

      // 🧠 AMIE PROCESSING (Normal flow)
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const amieResponse = await generateAMIEResponse(userMessage, conversationHistory);

      // Update insights panel
      setCurrentInsights(amieResponse.insights);
      setHiddenReasoning(amieResponse.hiddenReasoning);

      // Save VALIDATION message
      if (amieResponse.validation) {
        const { data: validationMsg } = await supabase
          .from('dump_messages')
          .insert({
            user_id: user.user?.id,
            session_id: sessionId,
            role: 'assistant',
            content: amieResponse.validation,
            message_type: 'validation',
            category: 'emotion'
          })
          .select()
          .single();

        if (validationMsg) {
          setMessages(prev => [...prev, validationMsg]);
        }
      }

      // Save QUESTION message
      const { data: questionMsg } = await supabase
        .from('dump_messages')
        .insert({
          user_id: user.user?.id,
          session_id: sessionId,
          role: 'assistant',
          content: amieResponse.question,
          message_type: 'question',
          category: 'followup'
        })
        .select()
        .single();

      if (questionMsg) {
        setMessages(prev => [...prev, questionMsg]);
      }

    } catch (error) {
      console.error('Dump processing failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const hasUserMessages = messages.some(m => m.role === 'user');

  return (
    <div className="h-full flex gap-6 max-w-7xl mx-auto">
      <EmergencyModal {...emergencyModal} onClose={() => setEmergencyModal({ show: false, message: '', riskType: null })} />

      {/* Main Chat Column */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="py-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white flex items-center gap-3">
                <MessageCircle className="w-9 h-9 text-cyan-500" />
                Dump
              </h1>
              <p className="text-gray-400 mt-2 text-lg">
                Sistema AMIE - Clareza via State-Awareness
              </p>
            </div>
            
            {hasUserMessages && (
              <button
                onClick={onNavigateToDo}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-indigo-500 text-black font-bold rounded-2xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
              >
                Gerar Plano de Ação →
              </button>
            )}
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-8 space-y-6">
          {messages.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-cyan-500/10 flex items-center justify-center">
                <Brain className="w-10 h-10 text-cyan-500" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">
                Sistema AMIE Ativado
              </h2>
              <p className="text-gray-400 max-w-md mx-auto leading-relaxed">
                Raciocínio científico baseado em State-Awareness, Chain-of-Reasoning e Auto-Crítica.
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom duration-300`}
              >
                <div
                  className={`max-w-[85%] ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-cyan-500 to-cyan-600 text-black'
                      : msg.message_type === 'validation'
                        ? 'glass border border-cyan-500/30 bg-cyan-500/5'
                        : 'glass border border-white/10'
                  }`}
                  style={{
                    padding: '1.5rem',
                    borderRadius: msg.role === 'user' ? '1.5rem 1.5rem 0.5rem 1.5rem' : '1.5rem 1.5rem 1.5rem 0.5rem'
                  }}
                >
                  {/* Type badge for assistant */}
                  {msg.role === 'assistant' && msg.message_type && (
                    <div className="flex items-center gap-2 mb-3">
                      <div className="px-3 py-1 bg-white/10 rounded-full">
                        <span className="text-[10px] text-cyan-400 font-mono uppercase tracking-wider">
                          {msg.message_type === 'validation' && '💙 Validação'}
                          {msg.message_type === 'question' && '❓ Wayfinding'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Message content */}
                  <p className={`text-lg leading-relaxed ${
                    msg.role === 'user' 
                      ? 'text-black font-medium' 
                      : msg.message_type === 'validation' 
                        ? 'text-cyan-100 font-semibold' 
                        : 'text-white'
                  }`}>
                    {msg.content}
                  </p>

                  {/* Timestamp */}
                  <div className={`text-xs mt-2 ${msg.role === 'user' ? 'text-black/50' : 'text-gray-500'}`}>
                    {new Date(msg.created_at).toLocaleTimeString('pt-BR', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="py-6 border-t border-white/10">
          <form onSubmit={handleSendDump} className="relative">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendDump();
                }
              }}
              placeholder="Despeje tudo aqui... (Enter para enviar)"
              className="w-full h-32 bg-white/5 border border-white/10 rounded-3xl px-6 py-4 text-white placeholder-gray-600 focus:border-cyan-500 focus:bg-white/[0.07] outline-none resize-none transition-all"
            />
            
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <AlertTriangle className="w-4 h-4" />
                <span>MIND-SAFE ativo</span>
              </div>
              
              <button
                type="submit"
                disabled={isProcessing || !inputValue.trim()}
                className="px-8 py-4 bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-700 disabled:cursor-not-allowed text-black font-bold rounded-2xl transition-all flex items-center gap-3"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processando AMIE...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Enviar
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Insight Panel Column */}
      {currentInsights && (
        <div className="w-96 flex-shrink-0 space-y-4">
          <InsightPanel insights={currentInsights} show={showInsights} userId={userId} />
          
          {/* Hidden Reasoning (Dev Mode) */}
          {hiddenReasoning && (
            <div className="glass p-4 rounded-2xl border border-white/10">
              <button
                onClick={() => setShowHiddenReasoning(!showHiddenReasoning)}
                className="w-full flex items-center justify-between text-sm text-gray-400 hover:text-white transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Brain className="w-4 h-4" />
                  Chain-of-Reasoning (Dev)
                </span>
                {showHiddenReasoning ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              {showHiddenReasoning && (
                <div className="mt-4 space-y-3 text-xs">
                  <div>
                    <p className="text-gray-500 font-mono mb-1">State Analysis:</p>
                    <p className="text-gray-300">{hiddenReasoning.stateAnalysis}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 font-mono mb-1">Emotional Diagnosis:</p>
                    <p className="text-gray-300">{hiddenReasoning.emotionalDiagnosis}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 font-mono mb-1">Draft Response:</p>
                    <p className="text-gray-300">{hiddenReasoning.draftResponse}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 font-mono mb-1">Self-Critique:</p>
                    <p className="text-yellow-300">{hiddenReasoning.critique}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 font-mono mb-1">Refinement:</p>
                    <p className="text-green-300">{hiddenReasoning.refinementNotes}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Dump;
