"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { JsonView, darkStyles } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";
import { nanoid } from "nanoid";

interface Message {
  id: number;
  type: "sent" | "received";
  content: string;
  rawData: unknown;
  rawString: string;
  dataType: string;
  previewUrl?: string;
  timestamp: Date;
}

interface SessionData {
  id: string;
  createdAt: string;
  updatedAt: string;
  messages: Omit<Message, "rawData" | "previewUrl" | "timestamp">[];
  metadata?: {
    imageUrls?: string[];
    photopeaSrc?: string;
  };
}

interface SessionListItem {
  id: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export default function PhotopeaPlayground() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [photopeaSrc, setPhotopeaSrc] = useState("https://www.photopea.com");
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageIdRef = useRef(0);

  // Session management
  const [sessionId, setSessionId] = useState<string>("");
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // Initialize or load session
  useEffect(() => {
    const stored = localStorage.getItem("currentSessionId");
    if (stored) {
      setSessionId(stored);
      loadSessionData(stored);
    } else {
      const newId = nanoid(16);
      setSessionId(newId);
      localStorage.setItem("currentSessionId", newId);
    }
    loadSessionsList();
  }, []);

  // Auto-save session (debounced)
  useEffect(() => {
    if (!sessionId || messages.length === 0) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveSession();
    }, 2000); // Save 2s after last change

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [messages, imageUrls, photopeaSrc, sessionId]);

  const saveSession = async () => {
    if (!sessionId) return;

    setIsSaving(true);
    const session: SessionData = {
      id: sessionId,
      createdAt: localStorage.getItem(`session_${sessionId}_created`) || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: messages.map((msg) => ({
        id: msg.id,
        type: msg.type,
        content: msg.content,
        rawString: msg.rawString,
        dataType: msg.dataType,
      })),
      metadata: {
        imageUrls,
        photopeaSrc,
      },
    };

    if (!localStorage.getItem(`session_${sessionId}_created`)) {
      localStorage.setItem(`session_${sessionId}_created`, session.createdAt);
    }

    try {
      await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(session),
      });
      await loadSessionsList();
    } catch (error) {
      console.error("Failed to save session:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const loadSessionData = async (id: string) => {
    try {
      const res = await fetch(`/api/sessions/${id}`);
      if (res.ok) {
        const session: SessionData = await res.json();
        setMessages(
          session.messages.map((msg) => ({
            ...msg,
            rawData: msg.rawString,
            timestamp: new Date(),
          }))
        );
        if (session.metadata?.imageUrls) {
          setImageUrls(session.metadata.imageUrls);
        }
        if (session.metadata?.photopeaSrc) {
          setPhotopeaSrc(session.metadata.photopeaSrc);
        }
        messageIdRef.current = Math.max(0, ...session.messages.map((m) => m.id));
      }
    } catch (error) {
      console.error("Failed to load session:", error);
    }
  };

  const loadSessionsList = async () => {
    try {
      const res = await fetch("/api/sessions");
      const allSessions: SessionData[] = await res.json();
      setSessions(
        allSessions.map((s) => ({
          id: s.id,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          messageCount: s.messages.length,
        }))
      );
    } catch (error) {
      console.error("Failed to load sessions list:", error);
    }
  };

  const createNewSession = () => {
    const newId = nanoid(16);
    setSessionId(newId);
    localStorage.setItem("currentSessionId", newId);
    localStorage.removeItem(`session_${newId}_created`);
    setMessages([]);
    messageIdRef.current = 0;
    setImageUrls([]);
    setPhotopeaSrc("https://www.photopea.com");
  };

  const switchSession = async (id: string) => {
    setSessionId(id);
    localStorage.setItem("currentSessionId", id);
    await loadSessionData(id);
    setShowSessions(false);
  };

  const deleteSessionById = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this session?")) return;

    try {
      await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      await loadSessionsList();
      if (id === sessionId) {
        createNewSession();
      }
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleMessage = useCallback((e: MessageEvent) => {
    // Only accept messages from Photopea
    if (!e.origin.includes("photopea.com")) {
      return;
    }

    const data = e.data;

    // Create raw string representation
    let rawString: string;
    try {
      if (data instanceof ArrayBuffer) {
        const bytes = new Uint8Array(data);
        rawString = `[ArrayBuffer(${data.byteLength})] ${Array.from(bytes.slice(0, 50)).map(b => b.toString(16).padStart(2, '0')).join(' ')}${bytes.length > 50 ? '...' : ''}`;
      } else if (data instanceof Uint8Array || ArrayBuffer.isView(data)) {
        const arr = data as Uint8Array;
        rawString = `[${data.constructor.name}(${arr.length})] ${Array.from(arr.slice(0, 50)).map(b => b.toString(16).padStart(2, '0')).join(' ')}${arr.length > 50 ? '...' : ''}`;
      } else if (data instanceof Blob) {
        rawString = `[Blob(${data.size}, ${data.type || 'unknown'})]`;
      } else if (typeof data === 'object' && data !== null) {
        rawString = JSON.stringify(data, null, 2);
      } else {
        rawString = String(data);
      }
    } catch {
      rawString = String(data);
    }

    // Log for debugging
    console.log("Photopea raw:", rawString);

    let content: string;
    let dataType: string;
    let previewUrl: string | undefined;

    if (data === "done") {
      content = "✓ done";
      dataType = "done";
    } else if (typeof data === "string") {
      content = data;
      dataType = "string";
    } else if (data instanceof ArrayBuffer) {
      const bytes = new Uint8Array(data);
      const preview = Array.from(bytes.slice(0, 20))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ");
      content = `ArrayBuffer (${data.byteLength} bytes)\nHex: ${preview}${bytes.length > 20 ? "..." : ""}`;
      dataType = "ArrayBuffer";

      // Try to create image preview
      const blob = new Blob([data]);
      previewUrl = URL.createObjectURL(blob);
    } else if (data instanceof Uint8Array) {
      const preview = Array.from(data.slice(0, 20))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ");
      content = `Uint8Array (${data.length} bytes)\nHex: ${preview}${data.length > 20 ? "..." : ""}`;
      dataType = "Uint8Array";

      const blob = new Blob([data]);
      previewUrl = URL.createObjectURL(blob);
    } else if (data instanceof Blob) {
      content = `Blob (${data.size} bytes, type: ${data.type || "unknown"})`;
      dataType = "Blob";
      previewUrl = URL.createObjectURL(data);
    } else if (ArrayBuffer.isView(data)) {
      // Handle other TypedArrays
      const arr = data as Uint8Array;
      const preview = Array.from(arr.slice(0, 20))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ");
      content = `${data.constructor.name} (${arr.length} bytes)\nHex: ${preview}${arr.length > 20 ? "..." : ""}`;
      dataType = data.constructor.name;

      const blob = new Blob([data]);
      previewUrl = URL.createObjectURL(blob);
    } else if (typeof data === "object" && data !== null) {
      try {
        content = JSON.stringify(data, null, 2);
        dataType = "object";
      } catch {
        content = String(data);
        dataType = "unknown";
      }
    } else if (typeof data === "number") {
      content = String(data);
      dataType = "number";
    } else if (typeof data === "boolean") {
      content = String(data);
      dataType = "boolean";
    } else {
      content = String(data);
      dataType = typeof data;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: ++messageIdRef.current,
        type: "received",
        content,
        rawData: data,
        rawString,
        dataType,
        previewUrl,
        timestamp: new Date(),
      },
    ]);
  }, []);

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  const sendMessage = () => {
    if (!input.trim() || !iframeRef.current?.contentWindow) return;

    const script = input.trim();
    iframeRef.current.contentWindow.postMessage(script, "*");

    setMessages((prev) => [
      ...prev,
      {
        id: ++messageIdRef.current,
        type: "sent",
        content: script,
        rawData: script,
        rawString: script,
        dataType: "script",
        timestamp: new Date(),
      },
    ]);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      sendMessage();
    }
  };

  const addImageUrl = () => {
    if (!urlInput.trim()) return;
    setImageUrls((prev) => [...prev, urlInput.trim()]);
    setUrlInput("");
  };

  const removeImageUrl = (index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const loadPhotopea = () => {
    setIsLoaded(false);
    if (imageUrls.length > 0) {
      const config = { files: imageUrls };
      const encoded = encodeURIComponent(JSON.stringify(config));
      setPhotopeaSrc(`https://www.photopea.com#${encoded}`);
    } else {
      setPhotopeaSrc("https://www.photopea.com");
    }
  };

  const clearMessages = () => {
    messages.forEach((msg) => {
      if (msg.previewUrl) URL.revokeObjectURL(msg.previewUrl);
    });
    setMessages([]);
  };

  const downloadBlob = (msg: Message) => {
    if (!msg.previewUrl) return;
    const a = document.createElement("a");
    a.href = msg.previewUrl;
    a.download = `photopea-export-${msg.id}.png`;
    a.click();
  };

  const formatRawData = (data: unknown): unknown => {
    if (data instanceof ArrayBuffer) {
      const bytes = new Uint8Array(data);
      return {
        type: "ArrayBuffer",
        byteLength: data.byteLength,
        hexPreview: Array.from(bytes.slice(0, 100))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(" "),
      };
    }
    if (data instanceof Uint8Array || ArrayBuffer.isView(data)) {
      const arr = data as Uint8Array;
      return {
        type: data.constructor.name,
        length: arr.length,
        hexPreview: Array.from(arr.slice(0, 100))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(" "),
      };
    }
    if (data instanceof Blob) {
      return { type: "Blob", size: data.size, mimeType: data.type };
    }
    return data;
  };

  const exampleScripts = [
    { label: "Get doc name", script: "app.activeDocument.name" },
    { label: "List layers", script: "app.activeDocument.layers.length" },
    { label: "Move layer", script: "app.activeDocument.activeLayer.translate(10, 10)" },
    { label: "New doc", script: 'app.documents.add(800, 600, 72, "Untitled")' },
    { label: "Export PNG", script: 'app.activeDocument.saveToOE("png")' },
  ];

  const sampleImages = [
    "https://www.photopea.com/api/img2/pug.png",
    "https://www.photopea.com/api/img2/lena.png",
  ];

  const getDataTypeBadgeColor = (dataType: string) => {
    switch (dataType) {
      case "done":
        return "bg-green-600";
      case "string":
        return "bg-purple-600";
      case "ArrayBuffer":
      case "Uint8Array":
        return "bg-orange-600";
      case "Blob":
        return "bg-pink-600";
      case "object":
        return "bg-cyan-600";
      case "number":
        return "bg-yellow-600";
      default:
        return "bg-zinc-600";
    }
  };

  return (
    <div className="flex h-screen bg-zinc-900">
      {/* Photopea iframe */}
      <div className="flex-1 relative">
        <iframe
          ref={iframeRef}
          key={photopeaSrc}
          src={photopeaSrc}
          className="w-full h-full border-0"
          onLoad={() => setIsLoaded(true)}
          allow="cross-origin-isolated"
        />
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
            <div className="text-zinc-400">Loading Photopea...</div>
          </div>
        )}
      </div>

      {/* Chat interface */}
      <div className="w-[500px] flex flex-col border-l border-zinc-700 bg-zinc-800">
        <div className="p-4 border-b border-zinc-700">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">Photopea Console</h2>
              <p className="text-sm text-zinc-400">postMessage API</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowRaw(!showRaw)}
                className={`px-2 py-1 text-xs rounded ${showRaw ? 'bg-orange-600 text-white' : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'}`}
              >
                {showRaw ? 'Raw ON' : 'Raw'}
              </button>
              <button
                onClick={clearMessages}
                className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Session controls */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex-1 flex items-center gap-2 bg-zinc-900 px-2 py-1.5 rounded">
              <span className="text-zinc-500">Session:</span>
              <code className="text-blue-400 font-mono">{sessionId.slice(0, 8)}</code>
              {isSaving && <span className="text-green-400 animate-pulse">●</span>}
            </div>
            <button
              onClick={() => setShowSessions(!showSessions)}
              className="px-2 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded"
            >
              {sessions.length} sessions
            </button>
            <button
              onClick={createNewSession}
              className="px-2 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded"
            >
              New
            </button>
          </div>
        </div>

        {/* Sessions list panel */}
        {showSessions && (
          <div className="border-b border-zinc-700 bg-zinc-900 max-h-64 overflow-y-auto">
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-zinc-100">All Sessions</h3>
                <button
                  onClick={() => setShowSessions(false)}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-1">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => switchSession(session.id)}
                    className={`p-2 rounded cursor-pointer transition-colors ${
                      session.id === sessionId
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <code className="text-xs font-mono block truncate">
                          {session.id}
                        </code>
                        <div className="text-xs opacity-70 mt-0.5">
                          {session.messageCount} msg · {new Date(session.updatedAt).toLocaleString()}
                        </div>
                      </div>
                      <button
                        onClick={(e) => deleteSessionById(session.id, e)}
                        className="ml-2 px-2 py-1 text-xs bg-red-600/20 hover:bg-red-600 rounded"
                      >
                        Del
                      </button>
                    </div>
                  </div>
                ))}
                {sessions.length === 0 && (
                  <div className="text-center text-zinc-500 py-4 text-xs">
                    No saved sessions yet
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Image URLs section */}
        <div className="p-3 border-b border-zinc-700">
          <div className="text-xs font-medium text-zinc-400 mb-2">Load Images</div>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addImageUrl()}
              placeholder="https://example.com/image.png"
              className="flex-1 bg-zinc-700 text-zinc-100 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={addImageUrl}
              className="px-2 py-1 text-xs bg-zinc-600 hover:bg-zinc-500 text-zinc-200 rounded"
            >
              Add
            </button>
          </div>

          <div className="flex gap-1 mb-2">
            {sampleImages.map((url, i) => (
              <button
                key={i}
                onClick={() => setImageUrls((prev) => [...prev, url])}
                className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-400 rounded"
              >
                Sample {i + 1}
              </button>
            ))}
          </div>

          {imageUrls.length > 0 && (
            <div className="space-y-1 mb-2 max-h-24 overflow-y-auto">
              {imageUrls.map((url, i) => (
                <div key={i} className="flex items-center gap-1 text-xs bg-zinc-700 rounded px-2 py-1">
                  <span className="flex-1 truncate text-zinc-300">{url}</span>
                  <button
                    onClick={() => removeImageUrl(i)}
                    className="text-zinc-500 hover:text-red-400"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={loadPhotopea}
            className="w-full px-2 py-1.5 text-xs bg-green-600 hover:bg-green-500 text-white rounded font-medium"
          >
            {imageUrls.length > 0 ? `Load Photopea with ${imageUrls.length} image(s)` : "Reload Photopea"}
          </button>
        </div>

        {/* Quick actions */}
        <div className="p-3 border-b border-zinc-700 flex flex-wrap gap-2">
          {exampleScripts.map((ex) => (
            <button
              key={ex.label}
              onClick={() => setInput(ex.script)}
              className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors"
            >
              {ex.label}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {messages.length === 0 && (
            <div className="text-zinc-500 text-sm text-center py-8">
              No messages yet. Send a command to interact with Photopea.
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              onClick={() => setSelectedMessage(msg)}
              className={`p-3 rounded-lg text-sm cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all ${
                msg.type === "sent"
                  ? "bg-blue-600 text-white ml-8"
                  : "bg-zinc-700 text-zinc-100 mr-4"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs opacity-70">
                  {msg.type === "sent" ? "→ Sent" : "← Received"}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${getDataTypeBadgeColor(msg.dataType)}`}>
                  {msg.dataType}
                </span>
                <span className="text-xs opacity-50 ml-auto">
                  {msg.timestamp.toLocaleTimeString()}
                </span>
              </div>
              <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                {showRaw
                  ? (msg.rawString.length > 500 ? msg.rawString.slice(0, 500) + "..." : msg.rawString)
                  : (msg.content.length > 200 ? msg.content.slice(0, 200) + "..." : msg.content)
                }
              </pre>

              {/* Image preview for binary data */}
              {msg.previewUrl && (
                <div className="mt-2 p-2 bg-zinc-800 rounded">
                  <img
                    src={msg.previewUrl}
                    alt="Preview"
                    className="max-h-32 rounded"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadBlob(msg);
                    }}
                    className="mt-2 px-2 py-1 text-xs bg-blue-500 hover:bg-blue-400 rounded"
                  >
                    Download
                  </button>
                </div>
              )}

              <div className="text-xs opacity-50 mt-2">Click to view full</div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-zinc-700">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="app.activeDocument.name&#10;&#10;// Multi-line scripts supported"
            className="w-full bg-zinc-700 text-zinc-100 rounded-lg px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            rows={8}
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-zinc-500">⌘/Ctrl + Enter to send</span>
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white py-2 px-6 rounded-lg text-sm font-medium transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* JSON Viewer Modal */}
      {selectedMessage && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-8"
          onClick={() => setSelectedMessage(null)}
        >
          <div
            className="bg-zinc-800 rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-zinc-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100">
                    {selectedMessage.type === "sent" ? "Sent Message" : "Received Message"}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {selectedMessage.timestamp.toLocaleString()}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${getDataTypeBadgeColor(selectedMessage.dataType)}`}>
                  {selectedMessage.dataType}
                </span>
              </div>
              <button
                onClick={() => setSelectedMessage(null)}
                className="text-zinc-400 hover:text-zinc-100 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {/* Raw output section */}
              <div className="mb-4 p-3 bg-zinc-900 rounded-lg border border-zinc-700">
                <div className="text-xs text-orange-400 font-medium mb-2">Raw Response:</div>
                <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap break-all max-h-48 overflow-auto">
                  {selectedMessage.rawString}
                </pre>
              </div>

              {/* Formatted output */}
              <div className="mb-4">
                <div className="text-xs text-blue-400 font-medium mb-2">Formatted:</div>
                {typeof selectedMessage.rawData === "string" ? (
                  <pre className="text-sm text-zinc-100 font-mono whitespace-pre-wrap break-words">
                    {selectedMessage.rawData}
                  </pre>
                ) : (
                  <JsonView
                    data={formatRawData(selectedMessage.rawData)}
                    style={{
                      ...darkStyles,
                      container: "bg-transparent",
                    }}
                  />
                )}
              </div>

              {/* Large image preview in modal */}
              {selectedMessage.previewUrl && (
                <div className="mt-4 p-4 bg-zinc-900 rounded-lg">
                  <p className="text-xs text-zinc-400 mb-2">Image Preview:</p>
                  <img
                    src={selectedMessage.previewUrl}
                    alt="Full Preview"
                    className="max-w-full max-h-96 rounded"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>
            <div className="p-4 border-t border-zinc-700 flex justify-end gap-2">
              {selectedMessage.previewUrl && (
                <button
                  onClick={() => downloadBlob(selectedMessage)}
                  className="px-4 py-2 text-sm bg-green-600 hover:bg-green-500 text-white rounded-lg"
                >
                  Download File
                </button>
              )}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedMessage.rawString);
                }}
                className="px-4 py-2 text-sm bg-orange-600 hover:bg-orange-500 text-white rounded-lg"
              >
                Copy Raw
              </button>
              <button
                onClick={() => {
                  const text = typeof selectedMessage.rawData === "string"
                    ? selectedMessage.rawData
                    : JSON.stringify(formatRawData(selectedMessage.rawData), null, 2);
                  navigator.clipboard.writeText(text);
                }}
                className="px-4 py-2 text-sm bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg"
              >
                Copy Formatted
              </button>
              <button
                onClick={() => setSelectedMessage(null)}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
