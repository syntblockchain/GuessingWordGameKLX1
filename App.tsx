/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { SetupScreen } from './components/SetupScreen';
import { Scoreboard } from './components/Scoreboard';
import { GameScreen } from './components/GameScreen';
import { RoundResultScreen } from './components/RoundResultScreen';
import { GamePhase, Player, GameCard, RoundResult, SUPPORTED_LANGUAGES, Language } from './types';
import { generateGameCard } from './services/geminiService';
import { Loader2, Moon, Sun } from 'lucide-react';

export default function App() {
  const [phase, setPhase] = useState<GamePhase>(GamePhase.SETUP);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(0);
  const [currentCard, setCurrentCard] = useState<GameCard | null>(null);
  const [lastRoundResult, setLastRoundResult] = useState<RoundResult | null>(null);
  const [usedWords, setUsedWords] = useState<string[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [language, setLanguage] = useState<Language>(SUPPORTED_LANGUAGES[0]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // --- Handlers ---

  const handleStartGame = (initialPlayers: Player[], selectedLanguage: Language) => {
    setPlayers(initialPlayers);
    setLanguage(selectedLanguage);
    setPhase(GamePhase.PRE_ROUND);
  };

  const handleBackToSetup = () => {
    setPhase(GamePhase.SETUP);
  };

  const startRound = async () => {
    setPhase(GamePhase.LOADING_CARD);
    try {
      const card = await generateGameCard('easy', usedWords, language);
      setCurrentCard(card);
      setUsedWords(prev => [...prev, card.targetWord]);
      setPhase(GamePhase.PLAYING);
    } catch (error) {
      console.error("Failed to start round", error);
      setPhase(GamePhase.PRE_ROUND); // Go back if error
    }
  };

  const handleRoundEnd = (result: RoundResult) => {
    setLastRoundResult(result);
    
    // Update score
    if (result.success) {
      setPlayers(prev => prev.map((p, i) => 
        i === currentPlayerIdx ? { ...p, score: p.score + result.pointsEarned } : p
      ));
    }

    setPhase(GamePhase.ROUND_RESULT);
  };

  const handleNextRound = () => {
    setCurrentPlayerIdx(prev => (prev + 1) % players.length);
    setPhase(GamePhase.PRE_ROUND);
  };

  // --- Render ---

  const renderContent = () => {
    if (phase === GamePhase.SETUP) {
      return (
        <SetupScreen 
          onStartGame={handleStartGame} 
          initialPlayers={players} 
          initialLanguage={language}
        />
      );
    }

    if (phase === GamePhase.PRE_ROUND) {
      return (
        <Scoreboard 
          players={players} 
          nextPlayerId={players[currentPlayerIdx].id}
          onReady={startRound}
          onBack={handleBackToSetup}
        />
      );
    }

    if (phase === GamePhase.LOADING_CARD) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center dark:text-white text-gray-900">
          <Loader2 className="w-16 h-16 animate-spin text-pink-500 mb-4" />
          <h2 className="text-2xl font-bold">Generating Word...</h2>
          <p className="text-gray-500 dark:text-gray-400">Gemini is thinking of a challenge in {language.name}.</p>
        </div>
      );
    }

    if (phase === GamePhase.PLAYING && currentCard) {
      return (
        <GameScreen 
          player={players[currentPlayerIdx]}
          card={currentCard}
          onRoundEnd={handleRoundEnd}
          language={language}
        />
      );
    }

    if (phase === GamePhase.ROUND_RESULT && lastRoundResult) {
      return (
        <RoundResultScreen 
          result={lastRoundResult}
          player={players[currentPlayerIdx]}
          onNext={handleNextRound}
        />
      );
    }

    return <div>Unknown State</div>;
  };

  return (
    <div className="relative min-h-screen flex flex-col">
       <button 
         onClick={toggleTheme}
         className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
         aria-label="Toggle Theme"
       >
         {isDarkMode ? <Moon className="text-yellow-300" size={20} /> : <Sun className="text-orange-500" size={20} />}
       </button>
       
       <main className="flex-grow">
        {renderContent()}
       </main>
    </div>
  );
}