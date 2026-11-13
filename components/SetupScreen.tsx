/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Player, SUPPORTED_LANGUAGES, Language } from '../types';
import { Plus, X, User, Globe } from 'lucide-react';

interface SetupScreenProps {
  onStartGame: (players: Player[], language: Language) => void;
  initialPlayers: Player[];
  initialLanguage: Language;
}

const AVATAR_COLORS = [
  'bg-pink-500', 'bg-purple-500', 'bg-indigo-500', 
  'bg-blue-500', 'bg-teal-500', 'bg-emerald-500'
];

export const SetupScreen: React.FC<SetupScreenProps> = ({ onStartGame, initialPlayers, initialLanguage }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [newName, setNewName] = useState('');
  const [language, setLanguage] = useState<Language>(initialLanguage);

  useEffect(() => {
    if (initialPlayers.length > 0) {
      setPlayers(initialPlayers);
    }
  }, [initialPlayers]);

  const addPlayer = () => {
    if (!newName.trim()) return;
    if (players.length >= 4) return;
    
    // Find first unused color
    const usedColors = new Set(players.map(p => p.avatarColor));
    const nextColor = AVATAR_COLORS.find(c => !usedColors.has(c)) || AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    setPlayers([
      ...players, 
      { 
        id: Date.now().toString(), 
        name: newName.trim(), 
        score: 0, 
        avatarColor: nextColor 
      }
    ]);
    setNewName('');
  };

  const removePlayer = (id: string) => {
    setPlayers(players.filter(p => p.id !== id));
  };

  const handleStart = () => {
    if (players.length >= 1) {
      onStartGame(players, language);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 max-w-lg mx-auto w-full">
      <h1 className="text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-orange-400 dark:from-pink-400 dark:to-yellow-400 text-center">
        GUESSING GAME
      </h1>
      <p className="text-gray-500 dark:text-gray-300 mb-8 text-center font-medium">AI-Powered Party Game</p>

      {/* Language Selector */}
      <div className="w-full bg-white dark:bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-gray-200 dark:border-white/10 shadow-sm mb-4 transition-colors flex items-center justify-between">
         <div className="flex items-center gap-2 text-gray-800 dark:text-white font-bold">
           <Globe size={20} className="text-pink-500" />
           <span>Language</span>
         </div>
         <select 
           value={language.code}
           onChange={(e) => {
             const selected = SUPPORTED_LANGUAGES.find(l => l.code === e.target.value);
             if (selected) setLanguage(selected);
           }}
           className="bg-gray-100 dark:bg-black/20 border-none rounded-lg py-2 px-3 text-sm font-semibold text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-pink-500 outline-none cursor-pointer"
         >
           {SUPPORTED_LANGUAGES.map(lang => (
             <option key={lang.code} value={lang.code}>
               {lang.name}
             </option>
           ))}
         </select>
      </div>

      <div className="w-full bg-white dark:bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-gray-200 dark:border-white/10 shadow-xl mb-8 transition-colors">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800 dark:text-white">
          <User className="text-pink-500 dark:text-pink-400" /> Players ({players.length}/4)
        </h2>
        
        {players.length === 0 ? (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500 italic border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl mb-6">
            No players added yet.<br/>Enter a name below to join!
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {players.map((player) => (
              <div key={player.id} className="flex items-center justify-between bg-gray-50 dark:bg-white/5 p-3 rounded-xl border border-gray-100 dark:border-white/5">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${player.avatarColor} text-white flex items-center justify-center font-bold text-lg shadow-sm`}>
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-semibold text-lg text-gray-800 dark:text-gray-100">{player.name}</span>
                </div>
                <button 
                  onClick={() => removePlayer(player.id)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            ))}
          </div>
        )}

        {players.length < 4 && (
          <div className="flex gap-2">
            <input 
              type="text" 
              maxLength={12}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
              placeholder="Enter player name..."
              className="flex-1 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-pink-500 dark:focus:border-pink-500 transition-colors text-gray-900 dark:text-white placeholder-gray-400"
              autoFocus
            />
            <button 
              onClick={addPlayer}
              disabled={!newName.trim()}
              className="p-3 bg-pink-600 hover:bg-pink-500 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              <Plus />
            </button>
          </div>
        )}
      </div>

      <Button 
        size="lg" 
        className="w-full"
        onClick={handleStart}
        disabled={players.length < 1}
      >
        {initialPlayers.length > 0 ? 'Resume Game' : 'Start Game'}
      </Button>
      
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center leading-relaxed max-w-md">
        As a reminder, recordings of your interactions with the Live API and content you share with it are processed per the <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-800 dark:hover:text-gray-200 transition-colors">Gemini API Additional Terms</a>. 
        Respect others’ privacy and ask permission before recording or including them in a Live chat.
      </p>
    </div>
  );
};