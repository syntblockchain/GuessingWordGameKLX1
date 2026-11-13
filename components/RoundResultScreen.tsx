/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { RoundResult, Player } from '../types';
import { Button } from './Button';
import { Trophy, Ban, AlertTriangle, CheckCircle } from 'lucide-react';

interface RoundResultScreenProps {
  result: RoundResult;
  player: Player;
  onNext: () => void;
}

export const RoundResultScreen: React.FC<RoundResultScreenProps> = ({ result, player, onNext }) => {
  const getIcon = () => {
    switch (result.reason) {
      case 'GUESS_CORRECT': return <CheckCircle className="w-20 h-20 text-green-500 dark:text-green-400 mb-4" />;
      case 'TABOO_VIOLATION': return <Ban className="w-20 h-20 text-red-500 mb-4" />;
      case 'TIME_UP': return <AlertTriangle className="w-20 h-20 text-orange-500 dark:text-orange-400 mb-4" />;
      default: return <Ban className="w-20 h-20 text-gray-400 mb-4" />;
    }
  };

  const getTitle = () => {
    switch (result.reason) {
      case 'GUESS_CORRECT': return "Gemini Guessed It!";
      case 'TABOO_VIOLATION': return "Taboo Violation!";
      case 'TIME_UP': return "Time's Up!";
      case 'SKIPPED': return "Skipped";
      default: return "Round Ended";
    }
  };

  const getDescription = () => {
    switch (result.reason) {
      case 'GUESS_CORRECT': return `Great describing! You earned ${result.pointsEarned} points.`;
      case 'TABOO_VIOLATION': return `Oops! You said the forbidden word: "${result.violationWord?.toUpperCase()}".`;
      case 'TIME_UP': return "You ran out of time before Gemini could guess.";
      default: return "Better luck next time.";
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center animate-fadeIn text-gray-900 dark:text-white">
      <div className="bg-white/80 dark:bg-white/10 backdrop-blur-lg rounded-3xl p-8 md:p-12 w-full max-w-lg border border-gray-200 dark:border-white/20 shadow-2xl">
        <div className="flex justify-center animate-bounce-short">
          {getIcon()}
        </div>
        
        <h2 className="text-4xl font-black mb-4">{getTitle()}</h2>
        <p className="text-xl text-gray-600 dark:text-gray-200 mb-8">{getDescription()}</p>
        
        <div className="bg-gray-100 dark:bg-black/30 rounded-xl p-6 mb-8 border border-gray-200 dark:border-none">
           <div className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">Target Word</div>
           <div className="text-3xl font-bold text-gray-900 dark:text-white">{result.word}</div>
        </div>

        {result.pointsEarned > 0 && (
           <div className="flex items-center justify-center gap-2 text-yellow-500 dark:text-yellow-400 text-2xl font-bold mb-8">
             <Trophy /> +{result.pointsEarned} Points
           </div>
        )}

        <Button size="lg" onClick={onNext} className="w-full">
          Next Round
        </Button>
      </div>
    </div>
  );
};