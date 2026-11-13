/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useState, useRef } from 'react';
import { GameCard, Player, RoundResult, Language } from '../types';
import { GameLiveSession } from '../services/geminiService';
import { Button } from './Button';
import { Mic, Clock, AlertTriangle, ArrowRight, MicOff, Check } from 'lucide-react';

interface GameScreenProps {
  player: Player;
  card: GameCard;
  onRoundEnd: (result: RoundResult) => void;
  language: Language;
}

export const GameScreen: React.FC<GameScreenProps> = ({ player, card, onRoundEnd, language }) => {
  const [timeLeft, setTimeLeft] = useState(60);
  const timeLeftRef = useRef(60); 

  const [status, setStatus] = useState<'CONNECTING' | 'PLAYING' | 'ROUND_OVER' | 'ENDING' | 'ERROR' | 'PERMISSION_DENIED'>('CONNECTING');
  const statusRef = useRef(status);

  const [transcript, setTranscript] = useState<{text: string, isUser: boolean}[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);

  // Track taboo words spoken by Gemini
  const [clearedTaboos, setClearedTaboos] = useState<string[]>([]);
  const clearedTaboosRef = useRef<string[]>([]);
  
  const sessionRef = useRef<GameLiveSession | null>(null);
  const timerRef = useRef<number | null>(null);
  const roundResultRef = useRef<RoundResult | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync refs & scroll
  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const updateStatus = (newStatus: typeof status) => {
    setStatus(newStatus);
  };

  // --- Game Logic ---
  const checkTabooViolation = (text: string) => {
    const normalizedText = text.toLowerCase();
    if (normalizedText.includes(card.targetWord.toLowerCase())) return card.targetWord;
    
    for (const taboo of card.tabooWords) {
      // If Gemini said the word already, it is no longer taboo for the user
      if (clearedTaboosRef.current.includes(taboo)) continue;

      if (normalizedText.includes(taboo.toLowerCase())) return taboo;
    }
    return null;
  };

  const checkWinCondition = (text: string) => {
    return text.toLowerCase().includes(card.targetWord.toLowerCase());
  };

  const triggerRoundEndPhase = (result: RoundResult) => {
    if (statusRef.current !== 'PLAYING') return;
    
    updateStatus('ROUND_OVER');
    stopTimer();
    roundResultRef.current = result;

    let prompt = "";
    if (result.reason === 'GUESS_CORRECT') {
      prompt = `[SYSTEM] Correct! You guessed the word "${result.word}". The round is over. Congratulate the player enthusiastically in ${language.name} and ask if they are ready for the scoreboard.`;
    } else if (result.reason === 'TABOO_VIOLATION') {
      prompt = `[SYSTEM] The player said the forbidden taboo word "${result.violationWord}". The round is over. React with a funny scolding or disappointment in ${language.name} and ask if they are ready for the scoreboard.`;
    } else if (result.reason === 'TIME_UP') {
      prompt = `[SYSTEM] Time is up! You didn't guess it. The word was "${result.word}". React with shock that you missed it in ${language.name} and ask if they are ready for the scoreboard.`;
    } else if (result.reason === 'SKIPPED') {
      prompt = `[SYSTEM] The player gave up and skipped the word "${result.word}". Tease them slightly in ${language.name} and ask if they are ready for the scoreboard.`;
    }

    sessionRef.current?.sendText(prompt);
  };

  const finalizeRound = () => {
    if (statusRef.current === 'ENDING') return;
    updateStatus('ENDING');
    sessionRef.current?.disconnect();
    if (roundResultRef.current) {
        onRoundEnd(roundResultRef.current);
    }
  };

  // --- Lifecycle ---
  useEffect(() => {
    let mounted = true;

    // Reset cleared taboos for new round
    setClearedTaboos([]);
    clearedTaboosRef.current = [];

    const startSession = async () => {
      const session = new GameLiveSession({
        onAudioData: (buffer) => {
           if (!mounted) return;
           const data = buffer.getChannelData(0);
           let sum = 0;
           for(let i=0; i<data.length; i+=10) sum += Math.abs(data[i]);
           setAudioLevel(Math.min(100, (sum / (data.length/10)) * 500));
        },
        onTranscription: (text, isUser) => {
           if (!mounted) return;
           if (statusRef.current === 'ENDING') return;

           setTranscript(prev => {
             const last = prev[prev.length - 1];
             if (last && last.isUser === isUser) {
               return [...prev.slice(0, -1), { ...last, text: last.text + text }];
             }
             return [...prev, { text, isUser }];
           });

           if (statusRef.current === 'PLAYING') {
              const lowerText = text.toLowerCase();

              if (isUser) {
                const violation = checkTabooViolation(text);
                if (violation) {
                  triggerRoundEndPhase({ 
                    success: false, reason: 'TABOO_VIOLATION', pointsEarned: 0, word: card.targetWord, violationWord: violation
                  });
                }
              } else {
                // If Model speaks, check if it said any taboo words
                let newCleared: string[] = [];
                for (const taboo of card.tabooWords) {
                   if (lowerText.includes(taboo.toLowerCase()) && !clearedTaboosRef.current.includes(taboo)) {
                       newCleared.push(taboo);
                   }
                }
                
                if (newCleared.length > 0) {
                    clearedTaboosRef.current = [...clearedTaboosRef.current, ...newCleared];
                    setClearedTaboos([...clearedTaboosRef.current]);
                }

                if (checkWinCondition(text)) {
                  triggerRoundEndPhase({ 
                    success: true, reason: 'GUESS_CORRECT', pointsEarned: timeLeftRef.current, word: card.targetWord
                  });
                }
              }
           }
        },
        onClose: () => {
          console.log('Session closed');
        },
        onError: (e) => {
          console.error('Session error', e);
          if (!mounted) return;
          
          if (e.message.toLowerCase().includes('denied') || e.message.toLowerCase().includes('microphone')) {
            updateStatus('PERMISSION_DENIED');
          } else if (statusRef.current !== 'ENDING' && statusRef.current !== 'ROUND_OVER') {
             triggerRoundEndPhase({ 
                 success: false, reason: 'ERROR', pointsEarned: 0, word: card.targetWord 
             });
          }
        },
      });

      sessionRef.current = session;
      
      try {
        await session.connect(card.targetWord, language);
        if (mounted) {
          updateStatus('PLAYING');
          startTimer();
        }
      } catch (e: any) {
        if (mounted) {
          if (e.message.toLowerCase().includes('denied') || e.message.toLowerCase().includes('microphone')) {
            updateStatus('PERMISSION_DENIED');
          } else {
            updateStatus('ERROR');
          }
        }
      }
    };

    startSession();

    return () => {
      mounted = false;
      stopTimer();
      sessionRef.current?.disconnect();
    };
  }, [card]);

  // --- Timer ---
  const startTimer = () => {
    if (timerRef.current) return;
    timerRef.current = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          triggerRoundEndPhase({ 
            success: false, reason: 'TIME_UP', pointsEarned: 0, word: card.targetWord 
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // --- Error States ---
  if (status === 'PERMISSION_DENIED') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center text-gray-900 dark:text-white">
        <MicOff className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">Microphone Access Denied</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Please allow microphone access in your browser settings to play.</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  if (status === 'ERROR') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center text-gray-900 dark:text-white">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">Connection Error</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Could not connect to Gemini Live.</p>
        <Button onClick={() => onRoundEnd({ success: false, reason: 'ERROR', pointsEarned: 0, word: card.targetWord })}>Return to Menu</Button>
      </div>
    );
  }

  if (status === 'CONNECTING') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-gray-900 dark:text-white">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-pink-500 mb-4"></div>
        <h2 className="text-xl font-bold animate-pulse">Connecting to Gemini...</h2>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] max-w-2xl mx-auto p-4 relative overflow-hidden bg-gray-50 dark:bg-[#1a0b2e] transition-colors">
      {/* Top Bar */}
      <div className="flex-none flex justify-between items-center mb-4 bg-white/80 dark:bg-black/20 p-4 rounded-2xl backdrop-blur-md shadow-sm dark:shadow-none z-10">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${player.avatarColor} text-white flex items-center justify-center font-bold shadow-md`}>
            {player.name.charAt(0)}
          </div>
          <span className="font-bold hidden sm:block text-gray-800 dark:text-white">{player.name} is describing</span>
        </div>
        <div className={`flex items-center gap-2 text-2xl font-black font-mono ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-gray-800 dark:text-white'}`}>
          <Clock size={28} />
          {timeLeft}s
        </div>
      </div>

      {/* Card */}
      <div className="flex-none flex flex-col items-center justify-center mb-4 z-10">
        <div className="bg-white text-gray-900 rounded-3xl p-6 shadow-xl dark:shadow-[0_0_50px_rgba(236,72,153,0.3)] w-full max-w-md border border-gray-100 dark:border-none">
          <div className="bg-pink-100 text-pink-600 text-xs font-bold uppercase tracking-wider py-1 px-3 rounded-full w-fit mb-2 mx-auto">
            Target Word
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-center mb-6 tracking-tight text-gray-800 break-words">
            {card.targetWord}
          </h1>
          
          <div className="bg-gray-100 rounded-xl p-4 border-2 border-dashed border-gray-300">
             <div className="text-center text-gray-400 font-bold uppercase text-xs mb-3 tracking-widest">
               Taboo Words
             </div>
             <ul className="space-y-2">
               {card.tabooWords.map((word, idx) => {
                 const isCleared = clearedTaboos.includes(word);
                 return (
                   <li key={idx} className={`text-lg md:text-xl font-bold text-center flex items-center justify-center gap-2 transition-all duration-300 ${isCleared ? 'text-green-600 line-through opacity-70' : 'text-red-500'}`}>
                     {isCleared ? <Check className="w-5 h-5" /> : <XOctagonIcon className="w-4 h-4" />} 
                     {word}
                   </li>
                 );
               })}
             </ul>
          </div>
        </div>
      </div>

      {/* Live Interaction Area - Flex Grow to fill space */}
      <div className="flex-1 min-h-0 bg-white/60 dark:bg-black/40 rounded-2xl p-4 backdrop-blur-md border border-gray-200 dark:border-white/10 mb-24 relative flex flex-col">
        <div className="absolute top-0 right-0 p-2 z-10">
           <div className="flex items-center gap-2 text-xs font-mono text-green-600 dark:text-green-400">
             <span className="relative flex h-3 w-3">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
               <span className={`relative inline-flex rounded-full h-3 w-3 ${status === 'ROUND_OVER' ? 'bg-yellow-500' : 'bg-green-500'}`}></span>
             </span>
             {status === 'ROUND_OVER' ? 'LISTENING' : 'LIVE'}
           </div>
        </div>
        
        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-3 p-2">
          {transcript.length === 0 && (
             <div className="text-center text-gray-400 dark:text-gray-500 italic mt-10">Waiting for speech...</div>
          )}
          {transcript.map((t, i) => (
            <div key={i} className={`flex ${t.isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm shadow-sm ${
                t.isUser 
                  ? 'bg-indigo-600 text-white rounded-br-none' 
                  : 'bg-white dark:bg-pink-600 text-gray-800 dark:text-white border border-gray-200 dark:border-none rounded-bl-none'
              }`}>
                <span className="opacity-70 text-xs block mb-1">{t.isUser ? 'You' : 'Gemini'}</span>
                {t.text}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Round Over Overlay */}
      {status === 'ROUND_OVER' && (
        <div className="absolute inset-x-0 bottom-32 z-30 flex justify-center animate-in fade-in slide-in-from-bottom-5 duration-300">
           <div className="bg-white/95 dark:bg-black/80 backdrop-blur-xl border border-pink-500/30 text-gray-900 dark:text-white px-8 py-6 rounded-2xl shadow-2xl max-w-sm text-center">
              <h3 className="text-2xl font-bold mb-2 text-pink-500 dark:text-pink-400">
                {roundResultRef.current?.reason === 'GUESS_CORRECT' ? 'Round Won!' : 'Round Over'}
              </h3>
              <p className="mb-6 text-gray-600 dark:text-gray-300">Gemini is reacting...</p>
              <Button onClick={finalizeRound} className="w-full flex items-center justify-center gap-2">
                See Scoreboard <ArrowRight size={18}/>
              </Button>
           </div>
        </div>
      )}

      {/* Controls - Fixed to bottom, z-index high */}
      <div className="fixed bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-gray-100 via-gray-100/90 to-transparent dark:from-[#1a0b2e] dark:via-[#1a0b2e]/90 z-50">
        <div className="max-w-2xl mx-auto flex gap-4">
           {status !== 'ROUND_OVER' && (
             <Button 
               variant="danger" 
               className="w-full shadow-lg"
               onClick={() => triggerRoundEndPhase({ success: false, reason: 'SKIPPED', pointsEarned: 0, word: card.targetWord })}
             >
               Skip
             </Button>
           )}
           
           <div className="flex-1 bg-white dark:bg-white/10 rounded-full flex items-center justify-center gap-2 overflow-hidden relative shadow-lg border border-gray-200 dark:border-none h-12 md:h-auto">
              <div 
                className="absolute inset-0 bg-green-500/10 dark:bg-green-500/20 transition-transform duration-75 origin-left"
                style={{ transform: `scaleX(${audioLevel / 100})` }}
              />
              <Mic className="w-5 h-5 text-gray-500 dark:text-gray-300 relative z-10" />
              <span className="text-sm font-bold text-gray-600 dark:text-gray-300 relative z-10 whitespace-nowrap">Microphone Active</span>
           </div>
        </div>
      </div>
    </div>
  );
};

const XOctagonIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
);