import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { GoogleGenAI } from "@google/genai";
import {
  Send,
  Image as ImageIcon,
  Sparkles,
  Bot,
  User,
  RefreshCw,
  AlertCircle,
  Trash2,
  Maximize2,
  ChevronDown,
  Download,
  Copy,
  Check,
  Plus,
  Moon,
  Sun,
  X,
  Atom,
  Feather,
  Apple,
  Home,
  Compass,
  Sliders,
} from "lucide-react";
import { Message, AspectRatio, ImageStyle } from "./types";
import { ASPECT_RATIOS, STYLE_OPTIONS, TEXT_SUGGESTIONS, IMAGE_SUGGESTIONS } from "./data";

export default function App() {
  // State
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem("gemini_chat_messages");
    if (saved) {
      try {
        // Parse dates correctly
        return JSON.parse(saved).map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"text" | "image">("text");
  const [selectedRatio, setSelectedRatio] = useState<AspectRatio>("1:1");
  const [selectedStyle, setSelectedStyle] = useState<ImageStyle>("none");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Persistence
  useEffect(() => {
    localStorage.setItem("gemini_chat_messages", JSON.stringify(messages));
  }, [messages]);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  // Monitor input to auto-switch to image mode if user types /image
  useEffect(() => {
    if (input.trim().startsWith("/image ")) {
      if (mode !== "image") {
        setMode("image");
      }
    }
  }, [input, mode]);

  // Map suggestion icons
  const renderSuggestionIcon = (iconName: string) => {
    switch (iconName) {
      case "Atom":
        return <Atom className="w-4 h-4 text-emerald-500" />;
      case "Feather":
        return <Feather className="w-4 h-4 text-purple-500" />;
      case "Apple":
        return <Apple className="w-4 h-4 text-rose-500" />;
      case "Sparkles":
        return <Sparkles className="w-4 h-4 text-amber-500" />;
      case "Home":
        return <Home className="w-4 h-4 text-blue-500" />;
      case "Compass":
        return <Compass className="w-4 h-4 text-indigo-500" />;
      default:
        return <Sparkles className="w-4 h-4 text-neutral-500" />;
    }
  };

  // Handlers
  const handleSend = async (textToSend?: string) => {
    const rawPrompt = textToSend || input;
    if (!rawPrompt.trim() || isGenerating) return;

    setError(null);
    setInput("");

    // Detect if this is an image prompt via command
    const isImageCommand = rawPrompt.trim().startsWith("/image ");
    const currentMsgMode = isImageCommand ? "image" : mode;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      sender: "user",
      text: rawPrompt,
      timestamp: new Date(),
      mode: currentMsgMode,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsGenerating(true);

    const botMessageId = crypto.randomUUID();
    const botMessagePlaceholder: Message = {
      id: botMessageId,
      sender: "bot",
      text: "",
      timestamp: new Date(),
      mode: currentMsgMode,
      isGenerating: true,
    };

    setMessages((prev) => [...prev, botMessagePlaceholder]);

    try {
      let data: any = null;
      let isServiceAvailable = true;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: rawPrompt,
            history: messages.slice(-10), // Send last 10 messages for conversation context
            generateImage: currentMsgMode === "image",
            aspectRatio: selectedRatio,
            style: selectedStyle,
          }),
        });

        const contentType = response.headers.get("content-type");
        if (response.ok && contentType && contentType.includes("application/json")) {
          data = await response.json();
        } else {
          // If we got non-JSON (e.g. HTML from static hosts like Netlify), trigger fallback
          isServiceAvailable = false;
        }
      } catch (fetchErr) {
        // Network/connection errors also trigger fallback
        isServiceAvailable = false;
      }

      // If Express backend is unreachable (e.g. static hosting on Netlify), run directly on client-side
      if (!isServiceAvailable) {
        const clientApiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;

        if (!clientApiKey) {
          throw new Error(
            "API Service Unreachable (Static Host / Netlify detected). To run this chatbot on Netlify, please add your Gemini API key as an environment variable named 'VITE_GEMINI_API_KEY' in your Netlify dashboard and redeploy."
          );
        }

        console.log("Static environment detected. Running Gemini AI directly in browser via client-side fallback...");
        
        const ai = new GoogleGenAI({ apiKey: clientApiKey });
        const cleanedMessage = rawPrompt.trim().startsWith("/image ")
          ? rawPrompt.trim().substring(7).trim()
          : rawPrompt;

        const shouldGenerateImage = currentMsgMode === "image" || rawPrompt.trim().startsWith("/image ");

        if (shouldGenerateImage) {
          let imagePrompt = cleanedMessage;
          if (selectedStyle && selectedStyle !== "none") {
            imagePrompt = `${cleanedMessage}, in ${selectedStyle} style`;
          }

          try {
            const response = await ai.models.generateContent({
              model: "gemini-3.1-flash-lite-image",
              contents: {
                parts: [{ text: imagePrompt }],
              },
              config: {
                imageConfig: {
                  aspectRatio: selectedRatio || "1:1",
                },
              },
            });

            let imageUrl = "";
            let textResponse = "";

            if (response.candidates?.[0]?.content?.parts) {
              for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                  imageUrl = `data:image/png;base64,${part.inlineData.data}`;
                } else if (part.text) {
                  textResponse += part.text;
                }
              }
            }

            if (!imageUrl) {
              throw new Error("No image data returned from model.");
            }

            data = {
              success: true,
              text: textResponse || `Here is your generated image for: "${cleanedMessage}"`,
              imageUrl,
              isFallback: false,
            };
          } catch (imageErr: any) {
            console.warn("Client Gemini image generation quota limit. Activating Pollinations fallback.", imageErr);
            const seed = Math.floor(Math.random() * 1000000);
            const encodedPrompt = encodeURIComponent(imagePrompt);
            const imageUrl = `https://image.pollinations.ai/p/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${seed}`;
            const fallbackExplanation = `🎨 **Creative Fallback Activated**\n\nYour Gemini API key is on the Free Tier, which has a 0-quota limit on Google's proprietary Imagen models. To deliver a seamless experience, the system has activated our **Creative Fallback Engine** to render your requested scene:`;

            data = {
              success: true,
              text: fallbackExplanation,
              imageUrl,
              isFallback: true,
              errorDetails: imageErr.message || "Quota limit or model access restriction.",
            };
          }
        } else {
          // Text generation
          const formattedHistory = messages.slice(-10).map((msg) => ({
            role: msg.sender === "user" ? "user" : "model",
            parts: [{ text: msg.text }],
          }));

          const chat = ai.chats.create({
            model: "gemini-3.5-flash",
            config: {
              systemInstruction:
                "You are a helpful, creative and beautiful AI Chatbot named The Master's Mind. You can generate text responses and answer questions. If the user wants an image, politely remind them that they can switch to 'Image Mode' or use the '/image [prompt]' command to directly generate images.",
            },
            history: formattedHistory as any,
          });

          const response = await chat.sendMessage({
            message: cleanedMessage,
          });

          data = {
            success: true,
            text: response.text || "I'm sorry, I couldn't generate a response.",
          };
        }
      }

      if (!data || !data.success) {
        throw new Error(data?.error || "An error occurred during generation.");
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMessageId
            ? {
                ...msg,
                text: data.text,
                imageUrl: data.imageUrl,
                isGenerating: false,
                isFallback: data.isFallback,
                errorDetails: data.errorDetails,
              }
            : msg
        )
      );
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || "Failed to contact Gemini service.";
      setError(errMsg);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMessageId
            ? {
                ...msg,
                text: "Unable to complete request.",
                error: errMsg,
                isGenerating: false,
              }
            : msg
        )
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSuggestionClick = (suggestionText: string, suggestionMode: "text" | "image") => {
    setMode(suggestionMode);
    handleSend(suggestionText);
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadImage = (imageUrl: string, promptText: string) => {
    const link = document.createElement("a");
    link.href = imageUrl;
    // Clean filename
    const cleanName = promptText
      .slice(0, 30)
      .replace(/[^a-zA-Z0-9]/g, "_")
      .toLowerCase();
    link.download = `gemini_${cleanName || "image"}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearHistory = () => {
    if (window.confirm("Are you sure you want to clear your chat history?")) {
      setMessages([]);
      setError(null);
    }
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-[#fafafa] font-sans overflow-hidden">
      {/* Lightbox / Full-screen Image Viewer */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxImage(null)}
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 cursor-zoom-out"
          >
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-white/10 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <motion.img
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 150 }}
              src={lightboxImage}
              alt="Generated Canvas High Resolution"
              referrerPolicy="no-referrer"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="border-b border-neutral-200 bg-white px-6 py-4 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center text-white shadow-sm shadow-black/10">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-neutral-900 tracking-tight">The Master's Mind</h1>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>
            <p className="text-xs text-neutral-500">Text generation &amp; image creator</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              title="Clear entire chat"
              className="p-2 text-neutral-500 hover:text-rose-600 hover:bg-neutral-50 rounded-lg border border-transparent hover:border-neutral-200/50 transition-all duration-200 flex items-center gap-1.5 text-xs font-medium"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 overflow-hidden relative flex flex-col justify-between max-w-4xl w-full mx-auto bg-white border-x border-neutral-100">
        {/* Scrollable Chat Area */}
        <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
          <AnimatePresence initial={false}>
            {messages.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="h-full flex flex-col justify-center max-w-2xl mx-auto py-4"
              >
                {/* Brand Hero */}
                <div className="text-center space-y-4 mb-8">
                  <div className="inline-flex p-3 rounded-2xl bg-neutral-50 border border-neutral-100 mb-2 shadow-sm">
                    <Sparkles className="w-8 h-8 text-amber-500 animate-pulse" />
                  </div>
                  <h2 className="text-3xl font-bold text-neutral-900 tracking-tight font-sans">
                    What are we creating today?
                  </h2>
                  <p className="text-neutral-500 text-sm max-w-md mx-auto">
                    Your visual and intellectual partner. Switch to <strong className="text-neutral-800">Image Mode</strong> to paint anything, or chat normally.
                  </p>
                </div>

                {/* Suggestions Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Text Suggestions */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-neutral-400 tracking-wider uppercase px-1">
                      Text &amp; Conversations
                    </h3>
                    <div className="space-y-2">
                      {TEXT_SUGGESTIONS.map((sug, i) => (
                        <button
                          key={i}
                          onClick={() => handleSuggestionClick(sug.text, "text")}
                          className="w-full text-left p-3.5 rounded-xl border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50/50 transition-all duration-200 group flex items-start gap-3 shadow-xs"
                        >
                          <div className="p-1.5 rounded-lg bg-neutral-50 group-hover:bg-white border border-neutral-100 transition-colors shrink-0">
                            {renderSuggestionIcon(sug.icon)}
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-neutral-900 group-hover:text-black">
                              {sug.title}
                            </h4>
                            <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{sug.text}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Image Suggestions */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-neutral-400 tracking-wider uppercase px-1">
                      Image &amp; Art Canvas
                    </h3>
                    <div className="space-y-2">
                      {IMAGE_SUGGESTIONS.map((sug, i) => (
                        <button
                          key={i}
                          onClick={() => handleSuggestionClick(sug.text, "image")}
                          className="w-full text-left p-3.5 rounded-xl border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50/50 transition-all duration-200 group flex items-start gap-3 shadow-xs"
                        >
                          <div className="p-1.5 rounded-lg bg-neutral-50 group-hover:bg-white border border-neutral-100 transition-colors shrink-0">
                            {renderSuggestionIcon(sug.icon)}
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-neutral-900 group-hover:text-black">
                              {sug.title}
                            </h4>
                            <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{sug.text}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Prompt tip */}
                <div className="mt-8 text-center text-[11px] text-neutral-400 bg-neutral-50 rounded-lg py-2 border border-neutral-100 max-w-sm mx-auto">
                  💡 Type <code className="font-mono bg-neutral-200 px-1 py-0.5 rounded text-[10px]">/image prompt</code> to generate images directly from normal chat.
                </div>
              </motion.div>
            ) : (
              messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex gap-4 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  {/* Sender Icon */}
                  {msg.sender === "bot" && (
                    <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-700 border border-neutral-200/50 shrink-0">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  {/* Message Bubble Container */}
                  <div className={`flex flex-col gap-1.5 max-w-[85%] ${msg.sender === "user" ? "items-end" : "items-start"}`}>
                    <div
                      className={`rounded-2xl px-4 py-3 text-sm shadow-xs ${
                        msg.sender === "user"
                          ? "bg-neutral-900 text-white font-normal"
                          : msg.error
                          ? "bg-rose-50 border border-rose-200 text-rose-800"
                          : "bg-neutral-50 border border-neutral-200/50 text-neutral-800"
                      }`}
                    >
                      {/* Generating Loading State */}
                      {msg.isGenerating ? (
                        <div className="flex items-center gap-3 py-1 text-neutral-500">
                          <RefreshCw className="w-4 h-4 animate-spin text-neutral-400" />
                          <span className="text-xs font-medium">
                            {msg.mode === "image" ? "Gemini is painting your canvas..." : "Gemini is crafting response..."}
                          </span>
                        </div>
                      ) : msg.error ? (
                        <div className="flex items-start gap-2.5">
                          <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-semibold block text-xs uppercase tracking-wide">Generation Error</span>
                            <p className="text-xs mt-0.5 font-mono">{msg.error}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* Text response */}
                          <div className="whitespace-pre-wrap leading-relaxed">
                            {msg.text}
                          </div>

                          {/* Image rendering */}
                          {msg.imageUrl && (
                            <div className="space-y-2 mt-2">
                              {msg.isFallback && (
                                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/60 text-amber-900 text-xs shadow-xs animate-fadeIn">
                                  <Sparkles className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                                  <div className="space-y-1">
                                    <span className="font-semibold block text-[11px] uppercase tracking-wide text-amber-800">Creative Fallback Active</span>
                                    <p className="text-[11px] text-amber-700/95 leading-normal">
                                      Your Gemini Free Tier key has a 0-quota limit for Imagen models. An alternative high-fidelity creative canvas engine is serving this render.
                                    </p>
                                  </div>
                                </div>
                              )}
                              <div className="relative group/img overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 shadow-xs max-w-full">
                                <img
                                  src={msg.imageUrl}
                                  alt="AI Generated Graphic"
                                  referrerPolicy="no-referrer"
                                  className="w-full h-auto object-cover max-h-[380px] transition-transform duration-300 group-hover/img:scale-[1.01]"
                                />
                              
                              {/* Hover Overlay Controls */}
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3">
                                <button
                                  onClick={() => setLightboxImage(msg.imageUrl || null)}
                                  className="p-2.5 bg-white/90 hover:bg-white text-neutral-900 rounded-full transition-all duration-150 transform scale-95 group-hover/img:scale-100 shadow-md"
                                  title="View full screen"
                                >
                                  <Maximize2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDownloadImage(msg.imageUrl || "", msg.text)}
                                  className="p-2.5 bg-white/90 hover:bg-white text-neutral-900 rounded-full transition-all duration-150 transform scale-95 group-hover/img:scale-100 shadow-md"
                                  title="Download high-quality image"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        </div>
                      )}
                    </div>

                    {/* Meta info (timestamp / actions) */}
                    {!msg.isGenerating && !msg.error && (
                      <div className="flex items-center gap-3 text-[10px] text-neutral-400 px-1">
                        <span>
                          {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {msg.sender === "bot" && (
                          <div className="flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-neutral-300" />
                            <button
                              onClick={() => handleCopyText(msg.id, msg.text)}
                              className="hover:text-neutral-600 flex items-center gap-1 transition-colors"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-500" />
                                  <span className="text-emerald-600 font-medium">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy text</span>
                                </>
                              )}
                            </button>
                            {msg.imageUrl && (
                              <>
                                <span className="w-1 h-1 rounded-full bg-neutral-300" />
                                <button
                                  onClick={() => handleDownloadImage(msg.imageUrl || "", msg.text)}
                                  className="hover:text-neutral-600 flex items-center gap-1 transition-colors"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>Save image</span>
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* User Icon */}
                  {msg.sender === "user" && (
                    <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center text-white shrink-0 shadow-xs">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* Floating Error Bar */}
        {error && (
          <div className="mx-6 mb-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-800 animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-neutral-400 hover:text-neutral-600 p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Footer Area: Options & Input Zone */}
        <div className="border-t border-neutral-200 bg-white p-4 space-y-4 shrink-0">
          {/* Option Toolbar Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Mode Selector */}
            <div className="flex items-center gap-1.5 bg-neutral-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setMode("text")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  mode === "text"
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-800"
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                Text Chat
              </button>
              <button
                type="button"
                onClick={() => setMode("image")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  mode === "image"
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-800"
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                Image Generator
              </button>
            </div>

            {/* Config Expand Toggle (Only relevant / styled nicely when Image mode is selected) */}
            <div className="flex items-center gap-2">
              {mode === "image" && (
                <button
                  type="button"
                  onClick={() => setIsConfigOpen(!isConfigOpen)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all duration-150 ${
                    isConfigOpen
                      ? "bg-neutral-50 border-neutral-400 text-neutral-900"
                      : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300"
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Canvas Options</span>
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isConfigOpen ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>
          </div>

          {/* Expandable Image Configurations Drawer */}
          <AnimatePresence>
            {mode === "image" && isConfigOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-t border-neutral-100 pt-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-neutral-50/50 p-4 rounded-xl border border-neutral-100">
                  {/* Aspect Ratio choice */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
                      Canvas Aspect Ratio
                    </label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {ASPECT_RATIOS.map((ratio) => (
                        <button
                          key={ratio.value}
                          type="button"
                          onClick={() => setSelectedRatio(ratio.value)}
                          className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all ${
                            selectedRatio === ratio.value
                              ? "bg-white border-neutral-950 text-neutral-950 font-medium ring-1 ring-neutral-950 shadow-xs"
                              : "bg-white border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-800"
                          }`}
                        >
                          {/* Mini visual representation of aspect ratio */}
                          <div className="w-full flex items-center justify-center h-6 mb-1">
                            <div
                              className={`border-1.5 rounded bg-neutral-50/50 ${
                                ratio.value === "1:1"
                                  ? "w-4 h-4"
                                  : ratio.value === "16:9"
                                  ? "w-6 h-3.5"
                                  : ratio.value === "9:16"
                                  ? "w-3 h-5"
                                  : ratio.value === "4:3"
                                  ? "w-5 h-4"
                                  : "w-4 h-5"
                              } ${
                                selectedRatio === ratio.value ? "border-neutral-950 bg-neutral-100" : "border-neutral-300"
                              }`}
                            />
                          </div>
                          <span className="text-[10px] whitespace-nowrap">{ratio.label.split(" ")[0]}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Preset Style choice */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
                      Illustration Preset Style
                    </label>
                    <div className="relative">
                      <select
                        value={selectedStyle}
                        onChange={(e) => setSelectedStyle(e.target.value as ImageStyle)}
                        className="w-full bg-white border border-neutral-200 hover:border-neutral-300 text-xs rounded-lg px-3 py-2 pr-8 appearance-none focus:outline-hidden focus:ring-1 focus:ring-neutral-950 focus:border-neutral-950"
                      >
                        {STYLE_OPTIONS.map((style) => (
                          <option key={style.value} value={style.value}>
                            {style.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-neutral-400 absolute right-2.5 top-2.5 pointer-events-none" />
                    </div>
                    <p className="text-[10px] text-neutral-400 italic">
                      {STYLE_OPTIONS.find((s) => s.value === selectedStyle)?.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Prompt Entry Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2 relative items-end border border-neutral-200 focus-within:border-neutral-400 bg-neutral-50/50 p-1.5 rounded-2xl transition-all"
          >
            {/* Context Mode indicator badge */}
            {mode === "image" && (
              <div className="absolute top-[-11px] left-4 bg-neutral-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm uppercase tracking-wide">
                <ImageIcon className="w-3 h-3" />
                Image Generation Mode
              </div>
            )}

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                mode === "image"
                  ? "Describe the image you want Gemini to paint..."
                  : "Type a message or use '/image prompt'..."
              }
              rows={1}
              className="flex-1 resize-none bg-transparent outline-hidden py-2 px-3 text-sm text-neutral-800 placeholder-neutral-400 font-sans max-h-32 min-h-[36px]"
            />

            <button
              type="submit"
              disabled={!input.trim() || isGenerating}
              className={`p-2.5 rounded-xl flex items-center justify-center transition-all ${
                !input.trim() || isGenerating
                  ? "bg-neutral-100 text-neutral-300 cursor-not-allowed"
                  : "bg-neutral-950 text-white hover:bg-neutral-900 shadow-xs shadow-neutral-950/20 active:scale-95"
              }`}
            >
              {isGenerating ? (
                <RefreshCw className="w-4.5 h-4.5 animate-spin" />
              ) : (
                <Send className="w-4.5 h-4.5" />
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
