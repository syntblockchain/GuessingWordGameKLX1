/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const Type = {
  TYPE_UNSPECIFIED: "TYPE_UNSPECIFIED",
  STRING: "STRING",
  NUMBER: "NUMBER",
  INTEGER: "INTEGER",
  BOOLEAN: "BOOLEAN",
  ARRAY: "ARRAY",
  OBJECT: "OBJECT",
  NULL: "NULL",
} as const;
export type Type = (typeof Type)[keyof typeof Type];

export const Modality = {
  MODALITY_UNSPECIFIED: "MODALITY_UNSPECIFIED",
  TEXT: "TEXT",
  IMAGE: "IMAGE",
  VIDEO: "VIDEO",
  AUDIO: "AUDIO",
  DOCUMENT: "DOCUMENT",
} as const;
export type Modality = (typeof Modality)[keyof typeof Modality];

export const ThinkingLevel = {
  THINKING_LEVEL_UNSPECIFIED: "THINKING_LEVEL_UNSPECIFIED",
  MINIMAL: "MINIMAL",
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
} as const;
export type ThinkingLevel = (typeof ThinkingLevel)[keyof typeof ThinkingLevel];

export const HarmCategory = {
  HARM_CATEGORY_UNSPECIFIED: "HARM_CATEGORY_UNSPECIFIED",
  HARM_CATEGORY_HATE_SPEECH: "HARM_CATEGORY_HATE_SPEECH",
  HARM_CATEGORY_DANGEROUS_CONTENT: "HARM_CATEGORY_DANGEROUS_CONTENT",
  HARM_CATEGORY_HARASSMENT: "HARM_CATEGORY_HARASSMENT",
  HARM_CATEGORY_SEXUALLY_EXPLICIT: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  HARM_CATEGORY_CIVIC_INTEGRITY: "HARM_CATEGORY_CIVIC_INTEGRITY",
} as const;
export type HarmCategory = (typeof HarmCategory)[keyof typeof HarmCategory];

export const HarmBlockThreshold = {
  HARM_BLOCK_THRESHOLD_UNSPECIFIED: "HARM_BLOCK_THRESHOLD_UNSPECIFIED",
  BLOCK_LOW_AND_ABOVE: "BLOCK_LOW_AND_ABOVE",
  BLOCK_MEDIUM_AND_ABOVE: "BLOCK_MEDIUM_AND_ABOVE",
  BLOCK_ONLY_HIGH: "BLOCK_ONLY_HIGH",
  BLOCK_NONE: "BLOCK_NONE",
  OFF: "OFF",
} as const;
export type HarmBlockThreshold = (typeof HarmBlockThreshold)[keyof typeof HarmBlockThreshold];

export const VideoGenerationReferenceType = {
  ASSET: "ASSET",
  STYLE: "STYLE",
} as const;
export type VideoGenerationReferenceType =
  (typeof VideoGenerationReferenceType)[keyof typeof VideoGenerationReferenceType];

export const Behavior = {
  UNSPECIFIED: "UNSPECIFIED",
  BLOCKING: "BLOCKING",
  NON_BLOCKING: "NON_BLOCKING",
} as const;
export type Behavior = (typeof Behavior)[keyof typeof Behavior];

export const FunctionResponseScheduling = {
  SCHEDULING_UNSPECIFIED: "SCHEDULING_UNSPECIFIED",
  SILENT: "SILENT",
  WHEN_IDLE: "WHEN_IDLE",
  INTERRUPT: "INTERRUPT",
} as const;
export type FunctionResponseScheduling =
  (typeof FunctionResponseScheduling)[keyof typeof FunctionResponseScheduling];

export const MusicGenerationMode = {
  MUSIC_GENERATION_MODE_UNSPECIFIED: "MUSIC_GENERATION_MODE_UNSPECIFIED",
  QUALITY: "QUALITY",
  DIVERSITY: "DIVERSITY",
  VOCALIZATION: "VOCALIZATION",
} as const;
export type MusicGenerationMode =
  (typeof MusicGenerationMode)[keyof typeof MusicGenerationMode];

export class LiveServerMessage {
  setupComplete?: any;
  serverContent?: any;
  toolCall?: any;
  toolCallCancellation?: any;
  usageMetadata?: any;
  goAway?: any;
  sessionResumptionUpdate?: any;

  get text(): string | undefined {
    const parts = this.serverContent?.modelTurn?.parts;
    if (!parts?.length) return undefined;
    const textParts = parts
      .map((p: any) => (typeof p?.text === "string" && !p?.thought ? p.text : ""))
      .filter(Boolean);
    return textParts.length > 0 ? textParts.join("") : undefined;
  }

  get data(): string | undefined {
    const parts = this.serverContent?.modelTurn?.parts;
    if (!parts?.length) return undefined;
    const inlineParts = parts
      .map((p: any) => p?.inlineData?.data || "")
      .filter(Boolean);
    return inlineParts.length > 0 ? inlineParts.join("") : undefined;
  }

  static fromRaw(raw: any): LiveServerMessage {
    return Object.assign(new LiveServerMessage(), raw);
  }
}

export class LiveMusicServerMessage {
  setupComplete?: any;
  serverContent?: any;
  filteredPrompt?: any;
  warning?: any;

  get audioChunk(): any {
    return this.serverContent?.audioChunks?.[0];
  }

  static fromRaw(raw: any): LiveMusicServerMessage {
    return Object.assign(new LiveMusicServerMessage(), raw);
  }
}

export type AudioChunk = any;
export type Blob = any;
export type Chat = any;
export type Content = any;
export type ContentUnion = any;
export type CreateChatParameters = any;
export type FunctionCall = any;
export type FunctionDeclaration = any;
export type FunctionResponse = any;
export type GenerateContentConfig = any;
export type GenerateContentParameters = any;
export type GenerateContentResponse = any;
export type GenerateImagesResponse = any;
export type GenerateVideosParameters = any;
export type GeneratedImage = any;
export type GeneratedVideo = any;
export type GoogleGenAIOptions = any;
export type GroundingChunk = any;
export type LiveCallbacks = any;
export type LiveClientToolResponse = any;
export type LiveConnectConfig = any;
export type LiveMusicFilteredPrompt = any;
export type LiveMusicGenerationConfig = any;
export type LiveMusicSession = any;
export type LiveServerContent = any;
export type LiveServerToolCall = any;
export type LiveServerToolCallCancellation = any;
export type Part = any;
export type SafetySetting = any;
export type Schema = any;
export type SendMessageParameters = any;
export type Session = any;
export type Tool = any;
export type Video = any;
export type VideoGenerationReferenceImage = any;
export type WeightedPrompt = any;

export function createPartFromText(text: string): Part {
  return { text };
}

export function createPartFromFunctionResponse(
  id: string,
  name: string,
  response: Record<string, unknown>
): Part {
  return {
    functionResponse: {
      id,
      name,
      response,
    },
  };
}

function __getAppletClientId(): string {
  try {
    if (typeof sessionStorage !== "undefined") {
      let id = sessionStorage.getItem("__ais_cid");
      if (!id || !/^[a-zA-Z0-9_-]{8,128}$/.test(id)) {
        id =
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
        sessionStorage.setItem("__ais_cid", id);
      }
      return id;
    }
  } catch {}
  return "anonclient0001";
}

async function postJson(url: string, body: any) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-client-id": __getAppletClientId() },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }
  return data;
}

async function createNdjsonStream(url: string, body: any) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-client-id": __getAppletClientId() },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }
  async function* generator() {
    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.trim()) {
          yield JSON.parse(line);
        }
      }
    }
    if (buffer.trim()) {
      yield JSON.parse(buffer);
    }
  }
  return generator();
}

function getLiveWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/api/live-ws`;
}

export class GoogleGenAI {
  private apiVersion?: string;

  constructor(options?: any) {
    this.apiVersion = options?.apiVersion || options?.httpOptions?.apiVersion;
  }

  models = {
    generateContent: async (params: any): Promise<any> => {
      return await postJson("/api/generate-content", params);
    },
    generateContentStream: async (params: any): Promise<AsyncGenerator<any, void, unknown>> => {
      return await createNdjsonStream("/api/generate-content-stream", params);
    },
    generateImages: async (params: any): Promise<any> => {
      return await postJson("/api/generate-images", params);
    },
    generateVideos: async (params: any): Promise<any> => {
      return await postJson("/api/generate-videos", params);
    },
    embedContent: async (params: any): Promise<any> => {
      return await postJson("/api/embed-content", params);
    },
  };

  operations = {
    getVideosOperation: async (params: any): Promise<any> => {
      return await postJson("/api/videos-operation", params);
    },
  };

  chats = {
    create: (chatParams: any) => {
      const sessionId =
        Math.random().toString(36).slice(2) + "_" + Date.now().toString(36);
      const { model, config, history } = chatParams || {};
      return {
        sendMessage: async (msgParams: any): Promise<any> => {
          return await postJson("/api/chat-message", {
            sessionId,
            model,
            config,
            history,
            message: msgParams?.message,
            msgConfig: msgParams?.config,
          });
        },
        sendMessageStream: async (
          msgParams: any
        ): Promise<AsyncGenerator<any, void, unknown>> => {
          return await createNdjsonStream("/api/chat-stream", {
            sessionId,
            model,
            config,
            history,
            message: msgParams?.message,
            msgConfig: msgParams?.config,
          });
        },
      };
    },
  };

  live = {
    connect: (params: any): Promise<any> => {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(getLiveWsUrl());
        let resolved = false;
        let readyForMessages = false;
        const queuedMessages: any[] = [];

        const sendCmd = (payload: any) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(payload));
          }
        };

        const session: any = {
          setupComplete: {},
          sendRealtimeInput: (inputParams: any) => {
            sendCmd({ type: "sendRealtimeInput", params: inputParams });
          },
          sendClientContent: (contentParams: any) => {
            sendCmd({ type: "sendClientContent", params: contentParams });
          },
          sendToolResponse: (toolParams: any) => {
            sendCmd({ type: "sendToolResponse", params: toolParams });
          },
          close: () => {
            sendCmd({ type: "close" });
            ws.close();
          },
          conn: {
            close: () => ws.close(),
          },
        };

        ws.onopen = () => {
          sendCmd({
            type: "connect_live",
            model: params?.model,
            config: params?.config,
            apiVersion: this.apiVersion,
          });
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(String(event.data));
            if (msg.type === "connected") {
              session.setupComplete = msg.setupComplete || {};
              resolved = true;
              resolve(session);
              queueMicrotask(() => {
                params?.callbacks?.onopen?.();
                readyForMessages = true;
                while (queuedMessages.length > 0) {
                  const m = queuedMessages.shift();
                  params?.callbacks?.onmessage?.(LiveServerMessage.fromRaw(m));
                }
              });
            } else if (msg.type === "message") {
              if (!readyForMessages) {
                queuedMessages.push(msg.data);
              } else {
                params?.callbacks?.onmessage?.(LiveServerMessage.fromRaw(msg.data));
              }
            } else if (msg.type === "error") {
              const err = new Error(msg.message || "Live WebSocket error");
              (err as any).error = err;
              if (!resolved) {
                resolved = true;
                reject(err);
              }
              params?.callbacks?.onerror?.(err as any);
            } else if (msg.type === "close") {
              params?.callbacks?.onclose?.({
                code: msg.code || 1000,
                reason: msg.reason || "",
              } as any);
            }
          } catch (e) {
            console.error("[genaiProxy] Failed to parse WS message:", e);
          }
        };

        ws.onerror = (err) => {
          if (!resolved) {
            resolved = true;
            reject(err);
          }
          params?.callbacks?.onerror?.(err as any);
        };

        ws.onclose = (ev) => {
          if (!resolved) {
            resolved = true;
            reject(new Error(`WebSocket closed before connect (${ev.code})`));
          }
          params?.callbacks?.onclose?.(ev);
        };
      });
    },

    music: {
      connect: (params: any): Promise<any> => {
        return new Promise((resolve, reject) => {
          const ws = new WebSocket(getLiveWsUrl());
          let resolved = false;
          let readyForMessages = false;
          const queuedMessages: any[] = [];

          const sendCmd = (payload: any) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(payload));
            }
          };

          const musicSession: any = {
            setWeightedPrompts: async (p: any) => {
              sendCmd({ type: "setWeightedPrompts", params: p });
            },
            setMusicGenerationConfig: async (p: any) => {
              sendCmd({ type: "setMusicGenerationConfig", params: p });
            },
            play: () => {
              sendCmd({ type: "play" });
            },
            pause: () => {
              sendCmd({ type: "pause" });
            },
            stop: () => {
              sendCmd({ type: "stop" });
            },
            resetContext: () => {
              sendCmd({ type: "resetContext" });
            },
            close: () => {
              sendCmd({ type: "close" });
              ws.close();
            },
            conn: {
              close: () => ws.close(),
            },
          };

          ws.onopen = () => {
            sendCmd({
              type: "connect_music",
              model: params?.model,
              apiVersion: this.apiVersion || "v1alpha",
            });
          };

          ws.onmessage = (event) => {
            try {
              const msg = JSON.parse(String(event.data));
              if (msg.type === "connected") {
                resolved = true;
                resolve(musicSession);
                queueMicrotask(() => {
                  params?.callbacks?.onopen?.();
                  readyForMessages = true;
                  while (queuedMessages.length > 0) {
                    const m = queuedMessages.shift();
                    params?.callbacks?.onmessage?.(LiveMusicServerMessage.fromRaw(m));
                  }
                });
              } else if (msg.type === "message") {
                if (!readyForMessages) {
                  queuedMessages.push(msg.data);
                } else {
                  params?.callbacks?.onmessage?.(LiveMusicServerMessage.fromRaw(msg.data));
                }
              } else if (msg.type === "error") {
                const err = new Error(msg.message || "Live Music WebSocket error");
                if (!resolved) {
                  resolved = true;
                  reject(err);
                }
                params?.callbacks?.onerror?.(err as any);
              } else if (msg.type === "close") {
                params?.callbacks?.onclose?.({
                  code: msg.code || 1000,
                  reason: msg.reason || "",
                } as any);
              }
            } catch (e) {
              console.error("[genaiProxy] Failed to parse Music WS message:", e);
            }
          };

          ws.onerror = (err) => {
            if (!resolved) {
              resolved = true;
              reject(err);
            }
            params?.callbacks?.onerror?.(err as any);
          };

          ws.onclose = (ev) => {
            if (!resolved) {
              resolved = true;
              reject(new Error(`Music WebSocket closed before connect (${ev.code})`));
            }
            params?.callbacks?.onclose?.(ev);
          };
        });
      },
    },
  };
}
