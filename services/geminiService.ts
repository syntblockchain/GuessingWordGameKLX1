/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Type, Schema, LiveServerMessage, Modality } from "../genaiProxy";
import { GameCard, Language } from "../types";
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from "../utils/audioUtils";

const apiKey = "server-side" || '';
const genAI = new GoogleGenAI({ apiKey });

type LiveSession = Awaited<ReturnType<typeof genAI.live.connect>>;

// --- Card Generation ---

export const generateGameCard = async (difficulty: 'easy' | 'hard' = 'easy', previousWords: string[] = [], language: Language): Promise<GameCard> => {
  const model = "gemini-2.5-flash";
  
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      targetWord: { type: Type.STRING, description: "The word the player must describe." },
      tabooWords: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "5 words that are strictly forbidden to say." 
      }
    },
    required: ["targetWord", "tabooWords"]
  };

  const prompt = `Generate a card for the game Taboo.
  Language: ${language.name} (${language.code}).
  Difficulty: ${difficulty}.
  Target word must be a common noun or verb in ${language.name}.
  Taboo words must be the most obvious clues associated with the target word, also in ${language.name}.
  Do not use these words: ${previousWords.join(', ')}.
  Return JSON.`;

  try {
    const result = await genAI.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 1.2 // High variance for fun
      }
    });

    if (result.text) {
      return JSON.parse(result.text) as GameCard;
    }
    throw new Error("No text returned");
  } catch (e) {
    console.error("Failed to generate card", e);
    // Fallback card
    return {
      targetWord: "Pizza",
      tabooWords: ["Cheese", "Pepperoni", "Italy", "Dough", "Food"]
    };
  }
};

// --- Live Session Wrapper ---

interface LiveSessionCallbacks {
  onAudioData: (buffer: AudioBuffer) => void;
  onTranscription: (text: string, isUser: boolean) => void;
  onClose: () => void;
  onError: (e: Error) => void;
}

export class GameLiveSession {
  private sessionPromise: Promise<LiveSession> | null = null;
  private inputContext: AudioContext | null = null;
  private outputContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private nextStartTime = 0;
  
  constructor(private callbacks: LiveSessionCallbacks) {}

  async connect(targetWord: string, language: Language) {
    this.inputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    this.outputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    // System instruction to make Gemini a guesser
    const systemInstruction = `
    You are playing the game Taboo in ${language.name}.
    You are the GUESSER. The user is the DESCRIBER.
    You do NOT know the word, but you must try to guess it based on their description.
    Speak in ${language.name}.
    Be enthusiastic, fast-paced, and make many guesses. 
    Keep your responses short (under 5 words usually). 
    If you think you know it, shout it out!
    Do not be polite, just play the game.
    `;

    try {
      this.sessionPromise = genAI.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          systemInstruction: systemInstruction,
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } 
          },
          inputAudioTranscription: {}, 
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: this.handleOpen.bind(this),
          onmessage: this.handleMessage.bind(this),
          onclose: () => this.callbacks.onClose(),
          onerror: (e: any) => this.callbacks.onError(new Error(e.message || "Session Error")),
        }
      });

      await this.sessionPromise;
    } catch (e) {
      this.callbacks.onError(e as Error);
      throw e;
    }
  }

  private async handleOpen() {
    if (!this.inputContext) return;
    this.sessionPromise?.then((session) => {
        session.sendClientContent({ turns: [{ role: 'user', parts: [{ text: "Ready?" }] }], turnComplete: true });
    });

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.source = this.inputContext.createMediaStreamSource(this.stream);
      this.processor = this.inputContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmBlob = createPcmBlob(inputData);
        
        // Use the promise to ensure session is ready
        if (this.sessionPromise) {
          this.sessionPromise.then(session => {
             session.sendRealtimeInput({ media: pcmBlob });
          });
        }
      };

      this.source.connect(this.processor);
      this.processor.connect(this.inputContext.destination);
    } catch (err) {
      console.error("Mic Error", err);
      this.callbacks.onError(new Error("Microphone access denied"));
    }
  }

  private async handleMessage(message: LiveServerMessage) {
    // Handle Audio Output
    const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (audioData && this.outputContext) {
      this.nextStartTime = Math.max(this.nextStartTime, this.outputContext.currentTime);
      const audioBuffer = await decodeAudioData(
        base64ToUint8Array(audioData),
        this.outputContext
      );
      
      const source = this.outputContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputContext.destination); // Play directly to speakers
      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
      
      this.callbacks.onAudioData(audioBuffer);
    }

    // Handle Transcription (User Input)
    const userTranscript = message.serverContent?.inputTranscription?.text;
    if (userTranscript) {
      this.callbacks.onTranscription(userTranscript, true);
    }

    // Handle Transcription (Model Output)
    const modelTranscript = message.serverContent?.outputTranscription?.text;
    if (modelTranscript) {
      this.callbacks.onTranscription(modelTranscript, false);
    }
  }

  // Allow sending text triggers (e.g., "Round Over")
  sendText(text: string) {
    if (this.sessionPromise) {
      this.sessionPromise.then(session => {
        session.sendClientContent({ turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true });
      });
    }
  }

  async disconnect() {
    // If the session is active, we can't explicitly close the socket via SDK yet in all versions,
    // but stopping audio contexts and streams is critical.
    
    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null;
    }
    if (this.source) {
      this.source.disconnect();
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    if (this.inputContext) {
      await this.inputContext.close();
    }
    if (this.outputContext) {
      await this.outputContext.close();
    }
    
    this.sessionPromise = null;
    this.inputContext = null;
    this.outputContext = null;
    this.stream = null;
    this.processor = null;
  }
}