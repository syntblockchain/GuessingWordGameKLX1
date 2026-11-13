/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { WebSocketServer, WebSocket } from "ws";

function isAllowedWsOrigin(req: any): boolean {
  const origin = req?.headers?.origin;
  if (!origin || typeof origin !== "string") return false;
  try {
    const parsed = new URL(origin);
    const h = parsed.hostname.toLowerCase();
    const appUrl = (process.env.APP_URL || "").trim();
    if (appUrl) {
      try {
        if (parsed.origin === new URL(appUrl).origin) return true;
      } catch {}
    }
    const xfh = String(req?.headers?.["x-forwarded-host"] || "").split(",")[0].trim().toLowerCase();
    if (xfh && parsed.host.toLowerCase() === xfh) return true;
    const isCloudRun = Boolean(process.env.K_SERVICE || appUrl);
    if (!isCloudRun && (h === "localhost" || h === "127.0.0.1")) return true;
    if (!isCloudRun) {
      const hostHeader = String(req?.headers?.host || "").split(",")[0].trim().toLowerCase();
      if (hostHeader && parsed.host.toLowerCase() === hostHeader) return true;
    }
    return h === "ai.studio" || h.endsWith(".ai.studio") || h === "aistudio.google.com";
  } catch {
    return false;
  }
}


class BoundedMap<K, V> extends Map<K, V> {
  maxEntries: number;
  constructor(maxEntries: number) {
    super();
    this.maxEntries = maxEntries;
  }
  set(key: K, value: V): this {
    if (this.has(key)) {
      this.delete(key);
    } else if (this.size >= this.maxEntries) {
      const oldest = this.keys().next().value;
      if (oldest !== undefined) this.delete(oldest);
    }
    return super.set(key, value);
  }
}


function stripHttpOptions(val: any): any {
  if (!val || typeof val !== "object") return val;
  if (Array.isArray(val)) return val.map(stripHttpOptions);
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(val)) {
    if (
      k === "httpOptions" ||
      k === "http_options" ||
      k === "__proto__" ||
      k === "constructor" ||
      k === "prototype" ||
      k === "cachedContent" ||
      k === "cached_content" ||
      k === "fileSearch" ||
      k === "file_search" ||
      k === "corpora" ||
      k === "semanticRetriever" ||
      k === "semantic_retriever"
    ) continue;
    if ((k === "fileData" || k === "file_data") && v && typeof v === "object") {
      const rawU = (v as any).fileUri ?? (v as any).file_uri;
      const u = typeof rawU === "string" ? rawU.trim() : "";
      if (!/^https:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i.test(u)) continue;
    }
    out[k] = stripHttpOptions(v);
  }
  return out;
}

const LIVE_MODEL_RE = /^(?!.*\.\.)(?:models\/)?(?:gemini-|lyria-)[a-zA-Z0-9._-]{1,64}$/;
function safeLiveModel(model: unknown, fallback: string): string {
  if (typeof model !== "string" || !model) return fallback;
  if (!LIVE_MODEL_RE.test(model)) throw new Error("Invalid model name.");
  return model;
}


const MODEL_UPGRADES: Record<string, string> = {
  "gemini-2.5-flash": "gemini-3-flash-preview",
  "gemini-2.5-pro": "gemini-3.1-pro-preview",
  "gemini-3-pro-preview": "gemini-3.1-pro-preview",
  "gemini-2.0-flash": "gemini-3-flash-preview",
  "gemini-2.0-flash-exp": "gemini-3-flash-preview",
  "gemini-3.5-flash": "gemini-2.5-flash-lite",
  "gemini-2.5-flash-preview-native-audio-dialog": "gemini-2.5-flash-native-audio-preview-12-2025",
  "gemini-2.5-flash-exp-native-audio-thinking-dialog": "gemini-2.5-flash-native-audio-preview-12-2025",
};

const ALLOWED_MODEL_RE = /^(?!.*\.\.)(?:models\/)?(?:gemini-|imagen-|veo-|lyria-|learnlm-|text-embedding-|gemini-embedding-)[a-zA-Z0-9._-]+$/;

function resolveModel(model?: string): string {
  const candidate = !model ? "gemini-3-flash-preview" : MODEL_UPGRADES[model] || model;
  if (!ALLOWED_MODEL_RE.test(candidate)) {
    throw new Error(`Disallowed model: ${candidate}`);
  }
  return candidate;
}

function serializeGenerateContentResponse(r: any) {
  return {
    candidates: r?.candidates,
    promptFeedback: r?.promptFeedback,
    usageMetadata: r?.usageMetadata,
    modelVersion: r?.modelVersion,
    responseId: r?.responseId,
    text: r?.text,
    functionCalls: r?.functionCalls,
    data: r?.data,
    executableCode: r?.executableCode,
    codeExecutionResult: r?.codeExecutionResult,
  };
}

const chats = new BoundedMap<string, any>(200);
const videoOps = new BoundedMap<string, { op: any; ownerKey: string }>(100);

function getClientKey(req: any): string {
  const raw = req?.headers?.["x-client-id"];
  if (typeof raw === "string" && /^[a-zA-Z0-9_-]{8,128}$/.test(raw.trim())) {
    return `cid:${raw.trim()}`;
  }
  const xffParts = String(req?.headers?.["x-forwarded-for"] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const xff = xffParts.length >= 2 ? xffParts[xffParts.length - 2] : (xffParts[0] || "");
  return `ip:${xff || req?.ip || req?.socket?.remoteAddress || "unknown"}`;
}

async function startServer() {
  const app = express();
  app.set("trust proxy", 2);
  const server = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use((req, _res, next) => {
    if (req.body && typeof req.body === "object") {
      req.body = stripHttpOptions(req.body);
    }
    next();
  });

  for (const dir of ["examples", "assets", "public"]) {
    const dirPath = path.join(process.cwd(), dir);
    if (fs.existsSync(dirPath)) {
      app.use(`/${dir}`, express.static(dirPath));
    }
  }

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", hasKey: Boolean(process.env.GEMINI_API_KEY || process.env.API_KEY) });
  });

  app.post("/api/generate-content", async (req, res): Promise<any> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: "API key is not configured. Please add your GEMINI_API_KEY in Settings > Secrets.",
        });
      }
      const ai = new GoogleGenAI({ apiKey });
      const params = { ...req.body, model: resolveModel(req.body?.model) };
      const response = await ai.models.generateContent(params);
      return res.json(serializeGenerateContentResponse(response));
    } catch (error: any) {
      console.error("[Backend] /api/generate-content error:", error);
      return res.status(500).json({ error: error.message || "Failed to generate content." });
    }
  });

  app.post("/api/generate-content-stream", async (req, res): Promise<any> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: "API key is not configured. Please add your GEMINI_API_KEY in Settings > Secrets.",
        });
      }
      const ai = new GoogleGenAI({ apiKey });
      const params = { ...req.body, model: resolveModel(req.body?.model) };
      const stream = await ai.models.generateContentStream(params);
      res.setHeader("Content-Type", "application/x-ndjson");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      for await (const chunk of stream) {
        res.write(JSON.stringify(serializeGenerateContentResponse(chunk)) + "\n");
      }
      res.end();
    } catch (error: any) {
      console.error("[Backend] /api/generate-content-stream error:", error);
      if (!res.headersSent) {
        return res.status(500).json({ error: error.message || "Failed to stream content." });
      }
      res.end();
    }
  });

  app.post("/api/chat-message", async (req, res): Promise<any> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: "API key is not configured. Please add your GEMINI_API_KEY in Settings > Secrets.",
        });
      }
      const { sessionId, model, config, history, message, msgConfig } = req.body || {};
      const ai = new GoogleGenAI({ apiKey });
      const chatKey = sessionId ? `${getClientKey(req)}:${String(sessionId).slice(0, 128)}` : "";
      let chat = chatKey ? chats.get(chatKey) : undefined;
      if (!chat) {
        chat = ai.chats.create({
          model: resolveModel(model),
          config,
          history,
        });
        if (chatKey) chats.set(chatKey, chat);
      }
      const response = await chat.sendMessage({ message, config: msgConfig });
      return res.json(serializeGenerateContentResponse(response));
    } catch (error: any) {
      console.error("[Backend] /api/chat-message error:", error);
      return res.status(500).json({ error: error.message || "Failed to send chat message." });
    }
  });

  app.post("/api/chat-stream", async (req, res): Promise<any> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: "API key is not configured. Please add your GEMINI_API_KEY in Settings > Secrets.",
        });
      }
      const { sessionId, model, config, history, message, msgConfig } = req.body || {};
      const ai = new GoogleGenAI({ apiKey });
      const chatKey = sessionId ? `${getClientKey(req)}:${String(sessionId).slice(0, 128)}` : "";
      let chat = chatKey ? chats.get(chatKey) : undefined;
      if (!chat) {
        chat = ai.chats.create({
          model: resolveModel(model),
          config,
          history,
        });
        if (chatKey) chats.set(chatKey, chat);
      }
      const stream = await chat.sendMessageStream({ message, config: msgConfig });
      res.setHeader("Content-Type", "application/x-ndjson");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      for await (const chunk of stream) {
        res.write(JSON.stringify(serializeGenerateContentResponse(chunk)) + "\n");
      }
      res.end();
    } catch (error: any) {
      console.error("[Backend] /api/chat-stream error:", error);
      if (!res.headersSent) {
        return res.status(500).json({ error: error.message || "Failed to stream chat message." });
      }
      res.end();
    }
  });

  app.post("/api/embed-content", async (req, res): Promise<any> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: "API key is not configured. Please add your GEMINI_API_KEY in Settings > Secrets.",
        });
      }
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.embedContent({ ...req.body, model: resolveModel(req.body?.model || "gemini-embedding-2-preview") });
      return res.json(response);
    } catch (error: any) {
      console.error("[Backend] /api/embed-content error:", error);
      return res.status(500).json({ error: error.message || "Failed to embed content." });
    }
  });

  app.post("/api/generate-images", async (req, res): Promise<any> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: "API key is not configured. Please add your GEMINI_API_KEY in Settings > Secrets.",
        });
      }
      const ai = new GoogleGenAI({ apiKey });
      const resolvedImgModel = resolveModel(req.body?.model || "imagen-3.0-generate-002");
      try {
        const response = await ai.models.generateImages({ ...req.body, model: resolvedImgModel });
        return res.json(response);
      } catch (imgErr: any) {
        console.warn("[Backend] generateImages failed, falling back to gemini-2.5-flash-image:", imgErr?.message);
        const fallbackResp = await ai.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: req.body?.prompt || "Generate image",
          config: {
            responseModalities: ["IMAGE", "TEXT"],
          },
        });
        const parts = fallbackResp?.candidates?.[0]?.content?.parts || [];
        const imgPart = parts.find((p: any) => p?.inlineData?.data);
        if (imgPart?.inlineData?.data) {
          return res.json({
            generatedImages: [
              {
                image: {
                  imageBytes: imgPart.inlineData.data,
                  mimeType: imgPart.inlineData.mimeType || "image/png",
                },
              },
            ],
          });
        }
        throw imgErr;
      }
    } catch (error: any) {
      console.error("[Backend] /api/generate-images error:", error);
      return res.status(500).json({ error: error.message || "Failed to generate images." });
    }
  });

  app.post("/api/generate-videos", async (req, res): Promise<any> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: "API key is not configured. Please add your GEMINI_API_KEY in Settings > Secrets.",
        });
      }
      const ai = new GoogleGenAI({ apiKey });
      const body = { ...req.body };
      delete body.video;
      if (body.video && typeof body.video === 'object') { const c = { ...body.video }; delete c.uri; delete c.videoUri; body.video = Object.keys(c).length ? c : undefined; }
      delete body.source;
      body.model = resolveModel(body.model || "veo-3.1-fast-generate-preview");
      const op = await ai.models.generateVideos(body);
      if (op.name) {
        videoOps.set(op.name, { op, ownerKey: getClientKey(req) });
      }
      return res.json({
        name: op.name,
        done: op.done,
        metadata: op.metadata,
        error: op.error,
        response: op.response,
      });
    } catch (error: any) {
      console.error("[Backend] /api/generate-videos error:", error);
      return res.status(500).json({ error: error.message || "Failed to start video generation." });
    }
  });

  app.post("/api/videos-operation", async (req, res): Promise<any> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: "API key is not configured. Please add your GEMINI_API_KEY in Settings > Secrets.",
        });
      }
      const ai = new GoogleGenAI({ apiKey });
      const opName = req.body?.operation?.name;
      const storedOp = opName ? videoOps.get(opName) : undefined;
      if (!storedOp) {
        return res.status(404).json({ error: "Video operation not found on server." });
      }
      const op = await ai.operations.getVideosOperation({ operation: storedOp });
      if (op.name) {
        videoOps.set(op.name, { op, ownerKey: getClientKey(req) });
      }
      const responseCopy = op.response ? JSON.parse(JSON.stringify(op.response)) : undefined;
      if (op.done && responseCopy?.generatedVideos) {
        for (const gv of responseCopy.generatedVideos) {
          if (gv.video?.uri) {
            const b64 = Buffer.from(gv.video.uri, "utf-8").toString("base64url");
            gv.video.uri = `/api/video-download?b64=${b64}`;
          }
        }
      }
      return res.json({
        name: op.name,
        done: op.done,
        metadata: op.metadata,
        error: op.error,
        response: responseCopy,
      });
    } catch (error: any) {
      console.error("[Backend] /api/videos-operation error:", error);
      return res.status(500).json({ error: error.message || "Failed to poll video operation." });
    }
  });

  app.get("/api/video-download", (_req, res) => {
    res.status(404).json({ error: "Video download is not enabled for this applet." });
  });

  app.post("/api/maps-grounding", async (req, res): Promise<any> => {
    try {
      const apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || "").trim();
      if (!apiKey) {
        return res.status(503).json({ error: "GEMINI_API_KEY is not configured on the server." });
      }
      const rawBody = stripHttpOptions({ ...(req.body?.requestBody || req.body || {}) });
      delete rawBody.model;
      rawBody.tools = [{ google_maps: {} }];
      const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";
      const apiResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(rawBody),
      });
      const data = await apiResponse.json().catch(() => ({}));
      return res.status(apiResponse.status).json(data);
    } catch (error: any) {
      console.error("[Backend] /api/maps-grounding error:", error);
      return res.status(500).json({ error: error.message || "Failed to execute maps grounding." });
    }
  });

  // WebSocket Relay for ai.live.connect & ai.live.music.connect
  const wss = new WebSocketServer({ server, path: "/api/live-ws", maxPayload: 16 * 1024 * 1024 });

  wss.on("connection", (ws: WebSocket, req: any) => {
    if (!isAllowedWsOrigin(req)) {
      ws.close(1008, "Origin not allowed");
      return;
    }
    let liveSession: any = null;
    let musicSession: any = null;
    let sessionReady = false;
    const pendingClientMessages: any[] = [];

    const safeSend = (payload: any) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
      }
    };

    const handleClientCommand = async (msg: any) => {
      try {
        const safeParams = stripHttpOptions(msg?.params);
        if (liveSession) {
          if (msg.type === "sendRealtimeInput") {
            liveSession.sendRealtimeInput(safeParams);
          } else if (msg.type === "sendClientContent") {
            liveSession.sendClientContent(safeParams);
          } else if (msg.type === "sendToolResponse") {
            liveSession.sendToolResponse(safeParams);
          } else if (msg.type === "close") {
            liveSession.close();
          }
        } else if (musicSession) {
          if (msg.type === "setWeightedPrompts") {
            await musicSession.setWeightedPrompts(safeParams);
          } else if (msg.type === "setMusicGenerationConfig") {
            await musicSession.setMusicGenerationConfig(safeParams);
          } else if (msg.type === "play") {
            musicSession.play();
          } else if (msg.type === "pause") {
            musicSession.pause();
          } else if (msg.type === "stop") {
            musicSession.stop();
          } else if (msg.type === "resetContext") {
            musicSession.resetContext();
          } else if (msg.type === "close") {
            musicSession.close();
          }
        }
      } catch (err: any) {
        console.error("[Backend WS] Command error:", err);
        safeSend({ type: "error", message: err?.message || String(err) });
      }
    };

    ws.on("message", async (rawData) => {
      try {
        const msg = JSON.parse(rawData.toString());
        if (msg.type === "connect_live") {
          const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
          if (!apiKey) {
            safeSend({ type: "error", message: "GEMINI_API_KEY is not configured on the server." });
            ws.close(1011, "Missing GEMINI_API_KEY");
            return;
          }
          const opts: any = { apiKey };
          const safeApiVersion = msg.apiVersion === "v1alpha" || msg.apiVersion === "v1beta" ? msg.apiVersion : undefined;
          if (safeApiVersion) {
            opts.apiVersion = safeApiVersion;
            opts.httpOptions = { apiVersion: safeApiVersion };
          }
          const ai = new GoogleGenAI(opts);
          const bufferedServerEvents: any[] = [];
          let connectedSent = false;

          const emitOrBuffer = (ev: any) => {
            if (connectedSent) {
              safeSend(ev);
            } else {
              bufferedServerEvents.push(ev);
            }
          };

          liveSession = await ai.live.connect({
            model: resolveModel(safeLiveModel(msg.model, "") || undefined),
            config: stripHttpOptions(msg.config),
            callbacks: {
              onopen: () => {},
              onmessage: (serverMsg: any) => {
                emitOrBuffer({ type: "message", data: serverMsg });
              },
              onerror: (err: any) => {
                emitOrBuffer({ type: "error", message: err?.message || err?.error?.message || String(err) });
              },
              onclose: (ev: any) => {
                emitOrBuffer({ type: "close", code: ev?.code || 1000, reason: ev?.reason || "" });
              },
            },
          });

          connectedSent = true;
          sessionReady = true;
          safeSend({ type: "connected", setupComplete: liveSession?.setupComplete || {} });
          for (const ev of bufferedServerEvents) {
            safeSend(ev);
          }
          while (pendingClientMessages.length > 0) {
            const nextMsg = pendingClientMessages.shift();
            await handleClientCommand(nextMsg);
          }
        } else if (msg.type === "connect_music") {
          const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
          if (!apiKey) {
            safeSend({ type: "error", message: "GEMINI_API_KEY is not configured on the server." });
            ws.close(1011, "Missing GEMINI_API_KEY");
            return;
          }
          const apiVersion = msg.apiVersion === "v1alpha" || msg.apiVersion === "v1beta" ? msg.apiVersion : "v1alpha";
          const ai = new GoogleGenAI({ apiKey, apiVersion, httpOptions: { apiVersion } });
          const bufferedServerEvents: any[] = [];
          let connectedSent = false;

          const emitOrBuffer = (ev: any) => {
            if (connectedSent) {
              safeSend(ev);
            } else {
              bufferedServerEvents.push(ev);
            }
          };

          musicSession = await (ai.live as any).music.connect({
            model: safeLiveModel(msg.model, "models/lyria-realtime-exp"),
            callbacks: {
              onopen: () => {},
              onmessage: (serverMsg: any) => {
                emitOrBuffer({ type: "message", data: serverMsg });
              },
              onerror: (err: any) => {
                emitOrBuffer({ type: "error", message: err?.message || err?.error?.message || String(err) });
              },
              onclose: (ev: any) => {
                emitOrBuffer({ type: "close", code: ev?.code || 1000, reason: ev?.reason || "" });
              },
            },
          });

          connectedSent = true;
          sessionReady = true;
          safeSend({ type: "connected" });
          for (const ev of bufferedServerEvents) {
            safeSend(ev);
          }
          while (pendingClientMessages.length > 0) {
            const nextMsg = pendingClientMessages.shift();
            await handleClientCommand(nextMsg);
          }
        } else {
          if (!sessionReady) {
            pendingClientMessages.push(msg);
          } else {
            await handleClientCommand(msg);
          }
        }
      } catch (err: any) {
        console.error("[Backend WS] Error:", err);
        safeSend({ type: "error", message: err?.message || String(err) });
      }
    });

    ws.on("close", () => {
      try {
        if (liveSession) liveSession.close();
      } catch (_e) {}
      try {
        if (musicSession) musicSession.close();
      } catch (_e) {}
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(["/server.cjs", "/server.cjs.map"], (_req: any, res: any) => res.status(404).end());
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[Backend] Server running on http://localhost:${PORT}`);
  });
}

startServer();
