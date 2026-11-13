/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export enum GamePhase {
  SETUP = 'SETUP',
  LOADING_CARD = 'LOADING_CARD',
  PRE_ROUND = 'PRE_ROUND',
  PLAYING = 'PLAYING',
  ROUND_RESULT = 'ROUND_RESULT',
  GAME_OVER = 'GAME_OVER'
}

export interface Player {
  id: string;
  name: string;
  score: number;
  avatarColor: string;
}

export interface GameCard {
  targetWord: string;
  tabooWords: string[];
}

export interface RoundResult {
  success: boolean;
  reason: 'TIME_UP' | 'TABOO_VIOLATION' | 'GUESS_CORRECT' | 'SKIPPED' | 'ERROR';
  pointsEarned: number;
  word: string;
  violationWord?: string;
}

export interface AudioVisualizerData {
  volume: number;
}

export interface Language {
  code: string;
  name: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en-US', name: 'English (US)' },
  { code: 'de-DE', name: 'German (Germany)' },
  { code: 'fr-FR', name: 'French (France)' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)' },
  { code: 'id-ID', name: 'Indonesian (Indonesia)' },
  { code: 'ja-JP', name: 'Japanese (Japan)' },
  { code: 'vi-VN', name: 'Vietnamese (Vietnam)' },
  { code: 'ta-IN', name: 'Tamil (India)' },
  { code: 'nl-NL', name: 'Dutch (Netherlands)' },
  { code: 'ru-RU', name: 'Russian (Russia)' },
  { code: 'es-US', name: 'Spanish (US)' },
  { code: 'hi-IN', name: 'Hindi (India)' },
  { code: 'it-IT', name: 'Italian (Italy)' },
  { code: 'tr-TR', name: 'Turkish (Turkey)' },
  { code: 'ko-KR', name: 'Korean (South Korea)' },
  { code: 'pl-PL', name: 'Polish (Poland)' },
  { code: 'th-TH', name: 'Thai (Thailand)' },
];