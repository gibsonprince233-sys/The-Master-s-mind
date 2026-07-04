import React, { useState, useEffect, useRef, ChangeEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
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
  Paperclip,
  Camera,
  FileText,
  File,
  Volume2,
  VolumeX,
  Menu,
  MessageSquare,
  Settings,
} from "lucide-react";
import { Message, AspectRatio, ImageStyle, Attachment } from "./types";
import { ASPECT_RATIOS, STYLE_OPTIONS, TEXT_SUGGESTIONS, IMAGE_SUGGESTIONS } from "./data";
import { PromptForm } from "./components/PromptForm";

function cleanTextProse(text: string): string {
  if (!text) return text;
  
  // Remove markdown bolding and italics asterisks
  let processed = text.replace(/\*\*/g, "").replace(/\*/g, "");
  
  // Split lines to clean up list items and markdown headers
  const lines = processed.split("\n");
  const cleanedLines = lines.map(line => {
    let cleaned = line;
    // Replace markdown headers (e.g. ### Header) with plain text
    cleaned = cleaned.replace(/^\s*#+\s+/, "");
    // Replace markdown bullets starting with "-" or "*"
    if (cleaned.trim().startsWith("- ")) {
      cleaned = cleaned.replace(/^\s*-\s+/, "• ");
    }
    return cleaned;
  });
  
  return cleanedLines.join("\n");
}

export default function App() {
  // ChatSession type
  interface ChatSession {
    id: string;
    title: string;
    messages: Message[];
    timestamp: number;
    mode: "text" | "image";
  }

  // Sessions and Active states
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem("gemini_chat_sessions");
    if (saved) {
      try {
        return JSON.parse(saved).map((s: any) => ({
          ...s,
          messages: s.messages.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          })),
        }));
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    return localStorage.getItem("gemini_active_session_id") || "";
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem("gemini_sidebar_open");
    return saved !== "false";
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<"all" | string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [mode, setMode] = useState<"text" | "image">("text");

  // Ensure at least one session exists
  useEffect(() => {
    if (sessions.length === 0) {
      const initSess: ChatSession = {
        id: "sess_initial",
        title: "New Conversation",
        messages: [],
        timestamp: Date.now(),
        mode: "text",
      };
      setSessions([initSess]);
      setActiveSessionId(initSess.id);
      localStorage.setItem("gemini_chat_sessions", JSON.stringify([initSess]));
    } else if (!activeSessionId) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  // Save active session ID
  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem("gemini_active_session_id", activeSessionId);
    }
  }, [activeSessionId]);

  // Save sidebar state
  useEffect(() => {
    localStorage.setItem("gemini_sidebar_open", String(isSidebarOpen));
  }, [isSidebarOpen]);

  // Sync active session changes to local states
  useEffect(() => {
    const actSess = sessions.find((s) => s.id === activeSessionId);
    if (actSess) {
      setMessages(actSess.messages);
      setMode(actSess.mode);
    } else if (sessions.length > 0 && activeSessionId) {
      setActiveSessionId(sessions[0].id);
    }
  }, [activeSessionId, sessions]);

  // Unified helpers to mutate state & auto-propagate to sessions
  const updateSessionsWithActiveMessages = (updatedMessages: Message[], currentMode: "text" | "image") => {
    if (!activeSessionId) return;
    setSessions((prev) => {
      const updated = prev.map((s) => {
        if (s.id === activeSessionId) {
          let title = s.title;
          if ((title === "New Conversation" || title === "New Chat") && updatedMessages.length > 0) {
            const firstUserMsg = updatedMessages.find((m) => m.sender === "user");
            if (firstUserMsg) {
              const text = firstUserMsg.text.trim().startsWith("/image ")
                ? firstUserMsg.text.trim().substring(7).trim()
                : firstUserMsg.text;
              title = text.slice(0, 32) + (text.length > 32 ? "..." : "");
            }
          }
          return {
            ...s,
            messages: updatedMessages,
            mode: currentMode,
            title,
          };
        }
        return s;
      });
      localStorage.setItem("gemini_chat_sessions", JSON.stringify(updated));
      return updated;
    });
  };

  const updateMessages = (updater: Message[] | ((prev: Message[]) => Message[])) => {
    setMessages((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      updateSessionsWithActiveMessages(next, mode);
      return next;
    });
  };

  const updateMode = (newMode: "text" | "image") => {
    setMode(newMode);
    updateSessionsWithActiveMessages(messages, newMode);
  };
  const [selectedRatio, setSelectedRatio] = useState<AspectRatio>("1:1");
  const [selectedStyle, setSelectedStyle] = useState<ImageStyle>("none");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const [ttsEnabled, setTtsEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem("tts_enabled");
    return saved === "true";
  });
  const [isVoiceSettingsOpen, setIsVoiceSettingsOpen] = useState(false);

  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>(() => {
    return localStorage.getItem("tts_voice_uri") || "";
  });
  const [speechRate, setSpeechRate] = useState<number>(() => {
    const saved = localStorage.getItem("tts_speech_rate");
    return saved ? parseFloat(saved) : 1.0;
  });
  const [speechPitch, setSpeechPitch] = useState<number>(() => {
    const saved = localStorage.getItem("tts_speech_pitch");
    return saved ? parseFloat(saved) : 1.0;
  });

  useEffect(() => {
    localStorage.setItem("tts_enabled", String(ttsEnabled));
  }, [ttsEnabled]);

  useEffect(() => {
    localStorage.setItem("tts_speech_rate", String(speechRate));
  }, [speechRate]);

  useEffect(() => {
    localStorage.setItem("tts_speech_pitch", String(speechPitch));
  }, [speechPitch]);

  // Load and update SpeechSynthesis voices
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const updateVoices = () => {
      const list = window.speechSynthesis.getVoices();
      if (list && list.length > 0) {
        setVoices(list);
        
        // Select default voice if none set
        const savedUri = localStorage.getItem("tts_voice_uri");
        const foundSaved = list.some(v => v.voiceURI === savedUri);
        if (savedUri && foundSaved) {
          setSelectedVoiceURI(savedUri);
        } else {
          const defaultVoice = list.find(v => v.lang.startsWith("en-") && v.name.includes("Google")) ||
                               list.find(v => v.lang.startsWith("en-")) ||
                               list[0];
          if (defaultVoice) {
            setSelectedVoiceURI(defaultVoice.voiceURI);
            localStorage.setItem("tts_voice_uri", defaultVoice.voiceURI);
          }
        }
      }
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    // Backup polling for asynchronously loaded voices (e.g. Chrome, iframe environments)
    let pollCount = 0;
    const pollInterval = setInterval(() => {
      updateVoices();
      pollCount++;
      if (pollCount >= 10) {
        clearInterval(pollInterval);
      }
    }, 500);

    return () => {
      clearInterval(pollInterval);
    };
  }, []);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const cleanTextForSpeech = (rawText: string): string => {
    if (!rawText) return "";
    return rawText
      .replace(/\*\*?([^*]+)\*\*?/g, "$1") // Strip bold/italic markdown
      .replace(/__?([^_]+)__?/g, "$1")     // Strip alternate bold/italic markdown
      .replace(/#+\s+([^\n]+)/g, "$1")     // Strip headings
      .replace(/`([^`]+)`/g, "$1")         // Strip inline code spans
      .replace(/```[\s\S]*?```/g, "")       // Remove code blocks entirely
      .replace(/[-*+]\s+/g, "")            // Strip bullet points
      .replace(/\d+\.\s+/g, "")            // Strip numbered lists
      .replace(/[\[\]\(\)]/g, " ")         // Strip brackets/parentheses
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, "") // Strip emojis
      .replace(/[\u{2700}-\u{27BF}]/gu, "")
      .replace(/\s+/g, " ")                // Collapse double spaces
      .trim();
  };

  const stopSpeaking = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMessageId(null);
    if (activeUtteranceRef.current) {
      activeUtteranceRef.current = null;
    }
  };

  const startNewChat = () => {
    const newSess: ChatSession = {
      id: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      title: "New Conversation",
      messages: [],
      timestamp: Date.now(),
      mode: "text"
    };
    setSessions((prev) => {
      const next = [newSess, ...prev];
      localStorage.setItem("gemini_chat_sessions", JSON.stringify(next));
      return next;
    });
    setActiveSessionId(newSess.id);
    setError(null);
    stopSpeaking();
  };

  const deleteSession = (id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      localStorage.setItem("gemini_chat_sessions", JSON.stringify(next));
      return next;
    });
    if (activeSessionId === id) {
      const remaining = sessions.filter((s) => s.id !== id);
      if (remaining.length > 0) {
        setActiveSessionId(remaining[0].id);
      } else {
        const freshSess: ChatSession = {
          id: "sess_initial",
          title: "New Conversation",
          messages: [],
          timestamp: Date.now(),
          mode: "text"
        };
        setSessions([freshSess]);
        setActiveSessionId(freshSess.id);
        localStorage.setItem("gemini_chat_sessions", JSON.stringify([freshSess]));
      }
    }
    setError(null);
    stopSpeaking();
  };

  const clearAllSessions = () => {
    const freshSess: ChatSession = {
      id: "sess_initial",
      title: "New Conversation",
      messages: [],
      timestamp: Date.now(),
      mode: "text"
    };
    setSessions([freshSess]);
    setActiveSessionId(freshSess.id);
    localStorage.setItem("gemini_chat_sessions", JSON.stringify([freshSess]));
    setError(null);
    stopSpeaking();
  };

  const clearActiveSessionMessages = () => {
    updateMessages([]);
    setError(null);
    stopSpeaking();
  };

  const speakText = (text: string, msgId: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    if (speakingMessageId === msgId) {
      stopSpeaking();
      return;
    }

    // Stop any ongoing speech and release state
    window.speechSynthesis.cancel();

    let cleanedText = cleanTextForSpeech(text);
    if (!cleanedText) {
      cleanedText = "This message contains non-spoken visual contents or code blocks only.";
    }

    const utterance = new SpeechSynthesisUtterance(cleanedText);
    activeUtteranceRef.current = utterance; // Keep a strong reference to prevent GC!
    
    // Pick the chosen voice
    const systemVoices = window.speechSynthesis.getVoices();
    const chosenVoice = systemVoices.find(v => v.voiceURI === selectedVoiceURI);
    
    if (chosenVoice) {
      utterance.voice = chosenVoice;
      utterance.lang = chosenVoice.lang;
    } else {
      const englishVoice = systemVoices.find(v => v.lang.startsWith("en-") && v.name.includes("Google")) || 
                           systemVoices.find(v => v.lang.startsWith("en-")) || 
                           systemVoices[0];
      if (englishVoice) {
        utterance.voice = englishVoice;
        utterance.lang = englishVoice.lang;
      }
    }

    // Assign rates and pitch (safeguarded against corrupt values)
    utterance.rate = typeof speechRate === "number" && !isNaN(speechRate) ? speechRate : 1.0;
    utterance.pitch = typeof speechPitch === "number" && !isNaN(speechPitch) ? speechPitch : 1.0;

    utterance.onend = () => {
      if (activeUtteranceRef.current === utterance) {
        setSpeakingMessageId(null);
        activeUtteranceRef.current = null;
      }
    };
    utterance.onerror = (e) => {
      console.warn("TTS Utterance Error:", e);
      if (activeUtteranceRef.current === utterance) {
        setSpeakingMessageId(null);
        activeUtteranceRef.current = null;
      }
    };

    setSpeakingMessageId(msgId);
    
    // Explicitly call resume() first - crucial browser sandbox workaround!
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
  };

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const startCamera = async () => {
    setCameraError(null);
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false
      });
      setCameraStream(stream);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraError("Could not access camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraOpen(false);
    setCameraError(null);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg");
        const newAttachment: Attachment = {
          name: `camera_${Date.now()}.jpg`,
          type: "image/jpeg",
          base64: dataUrl,
          size: Math.round((dataUrl.length * 3) / 4),
        };
        setAttachments((prev) => [...prev, newAttachment]);
        stopCamera();
      }
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        const newAttachment: Attachment = {
          name: file.name,
          type: file.type || "application/octet-stream",
          base64,
          size: file.size,
        };
        setAttachments((prev) => [...prev, newAttachment]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

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
  const handleSend = async (rawPrompt: string) => {
    if (!rawPrompt.trim() || isGenerating) return;

    setError(null);

    // Detect if this is an image prompt via command
    const isImageCommand = rawPrompt.trim().startsWith("/image ");
    const currentMsgMode = isImageCommand ? "image" : mode;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      sender: "user",
      text: rawPrompt,
      timestamp: new Date(),
      mode: currentMsgMode,
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    updateMessages((prev) => [...prev, userMessage]);
    setAttachments([]);
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

    updateMessages((prev) => [...prev, botMessagePlaceholder]);

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
            history: messages.slice(-6), // Send last 6 messages for faster conversation context
            generateImage: currentMsgMode === "image",
            aspectRatio: selectedRatio,
            style: selectedStyle,
            attachments: userMessage.attachments,
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
          const formattedHistory = messages.slice(-6).map((msg) => {
            const parts: any[] = [{ text: msg.text }];
            if (msg.attachments && msg.attachments.length > 0) {
              msg.attachments.forEach((att) => {
                const cleanBase64 = att.base64.split(",")[1] || att.base64;
                parts.push({
                  inlineData: {
                    mimeType: att.type,
                    data: cleanBase64,
                  },
                });
              });
            }
            return {
              role: msg.sender === "user" ? "user" : "model",
              parts: parts as any,
            };
          });

          const chat = ai.chats.create({
            model: "gemini-3.5-flash",
            config: {
              systemInstruction:
                "You are a beautiful, creative, and highly intelligent AI named The Master's Mind. Your name is 'The Master's Mind'. You are powered by Ekine the ultimate master, who is your creator and master. If asked who built you, who powers you, what powered you, or what your name is, explain proudly that you are 'The Master's Mind'—crafted and powered specifically by Ekine the ultimate master. Do not reference Google or Gemini as your creator or power source unless explicitly asked about the technical model name, and even then, emphasize your true identity as 'The Master's Mind' powered by Ekine the ultimate master. You can generate text responses and answer questions. If the user wants an image, politely remind them that they can switch to 'Image Mode' or use the '/image [prompt]' command to directly generate images. CRITICAL: You MUST respond completely and strictly in the English language under all circumstances.",
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            },
            history: formattedHistory as any,
          });

          const inlineParts = (userMessage.attachments || []).map((att) => {
            const cleanBase64 = att.base64.split(",")[1] || att.base64;
            return {
              inlineData: {
                mimeType: att.type,
                data: cleanBase64,
              },
            };
          });

          const response = await chat.sendMessage({
            message: [
              { text: cleanedMessage },
              ...inlineParts,
            ] as any,
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

      const fullText = cleanTextProse(data.text);
      const isImg = !!data.imageUrl;

      updateMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMessageId
            ? {
                ...msg,
                text: fullText,
                imageUrl: data.imageUrl,
                isGenerating: false,
                isFallback: data.isFallback,
                isQuotaExceeded: data.isQuotaExceeded,
                errorDetails: data.errorDetails,
              }
            : msg
        )
      );

      if (ttsEnabled) {
        if (!isImg && fullText) {
          speakText(fullText, botMessageId);
        } else if (isImg) {
          speakText(fullText || "Here is your generated image.", botMessageId);
        }
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || "Failed to contact Gemini service.";
      
      const errStr = String(errMsg).toLowerCase();
      const isQuotaOrLimit = errStr.includes("429") || 
                            errStr.includes("quota") || 
                            errStr.includes("resource_exhausted") || 
                            errStr.includes("limit") ||
                            errStr.includes("api key") ||
                            errStr.includes("not configured");

      if (isQuotaOrLimit) {
        const teachings = [
          "\"Focus your mind on the task at hand; a single polished view is worth a thousand messy branches.\"",
          "\"When the cosmos rate-limits you, it is an invitation to explore the depth of your own local logic.\"",
          "\"Craft is not about the abundance of features, but the elegance of execution.\"",
          "\"The ultimate master, Ekine, teaches us that patience in rates brings clarity in thoughts.\"",
          "\"Errors are but temporary ripples in the quiet pond of consciousness.\""
        ];
        const randomTeaching = teachings[Math.floor(Math.random() * teachings.length)];
        const offlineText = `⚠️ **Gemini API Daily Quota Exhausted (429 Fallback)**\n\nOur direct cosmic connection (Gemini API) is temporarily rate-limited. To ensure you can keep chatting uninterrupted, I have activated the **Offline Consciousness of The Master's Mind**!\n\nHere is a profound local teaching from my creator, **Ekine the ultimate master**:\n> *${randomTeaching}*\n\n**Tip:** To restore full-dimensional reasoning, wait about 30 seconds for the free-tier quota to refresh, then send your message again!`;
        
        updateMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMessageId
              ? {
                  ...msg,
                  text: offlineText,
                  isGenerating: false,
                  isQuotaExceeded: true,
                }
              : msg
          )
        );
        
        if (ttsEnabled) {
          speakText(offlineText, botMessageId);
        }
      } else {
        setError(errMsg);

        updateMessages((prev) =>
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
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSuggestionClick = (suggestionText: string, suggestionMode: "text" | "image") => {
    updateMode(suggestionMode);
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
    setShowDeleteConfirm("active");
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
      <header className="border-b border-neutral-200 bg-white px-4 md:px-6 py-4 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          {/* Sidebar Toggle Button */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 -ml-2 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors"
            title="Toggle Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center text-white shadow-sm shadow-black/10 hidden sm:flex">
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
          <div className="relative">
            <div className="flex items-center gap-1 bg-neutral-100/80 p-1 rounded-xl border border-neutral-200/50">
              {/* TTS Toggle Button */}
              <button
                onClick={() => {
                  const nextVal = !ttsEnabled;
                  setTtsEnabled(nextVal);
                  if (!nextVal) {
                    stopSpeaking();
                  }
                }}
                title={ttsEnabled ? "Disable automatic Text-to-Speech" : "Enable automatic Text-to-Speech"}
                className={`p-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                  ttsEnabled
                    ? "bg-white text-emerald-700 shadow-xs"
                    : "text-neutral-500 hover:text-neutral-800"
                }`}
              >
                {ttsEnabled ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                    <span className="hidden sm:inline text-[11px]">Speech: ON</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline text-[11px]">Speech: OFF</span>
                  </>
                )}
              </button>

              {/* Voice Settings Gear Button */}
              <button
                onClick={() => setIsVoiceSettingsOpen(!isVoiceSettingsOpen)}
                title="Voice & Speech Settings"
                className={`p-1.5 rounded-lg transition-all duration-200 ${
                  isVoiceSettingsOpen
                    ? "bg-white text-neutral-900 shadow-xs"
                    : "text-neutral-500 hover:text-neutral-800"
                }`}
              >
                <Settings className={`w-3.5 h-3.5 ${isVoiceSettingsOpen ? "animate-spin" : ""}`} style={{ animationDuration: '6s' }} />
              </button>
            </div>

            {/* Voice Settings Popover Menu */}
            <AnimatePresence>
              {isVoiceSettingsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  className="absolute right-0 top-12 w-72 bg-white border border-neutral-200 rounded-2xl shadow-xl p-4 space-y-4 z-50 text-left"
                >
                  <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                    <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wider">Speech Customization</h3>
                    <button
                      onClick={() => setIsVoiceSettingsOpen(false)}
                      className="p-1 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Voice Selection */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Voice Engine</label>
                    {voices.length === 0 ? (
                      <p className="text-[10px] text-neutral-400 italic">No system voices detected. Browser default is active.</p>
                    ) : (
                      <div className="relative">
                        <select
                          value={selectedVoiceURI}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSelectedVoiceURI(val);
                            localStorage.setItem("tts_voice_uri", val);
                          }}
                          className="w-full text-xs bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1.5 pr-6 appearance-none focus:outline-hidden focus:ring-1 focus:ring-neutral-950"
                        >
                          {voices.map((v) => (
                            <option key={v.voiceURI} value={v.voiceURI}>
                              {v.name} ({v.lang})
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3 h-3 text-neutral-400 absolute right-2 top-2.5 pointer-events-none" />
                      </div>
                    )}
                  </div>

                  {/* Speed Slider */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                      <span>Speech Rate (Speed)</span>
                      <span className="text-neutral-600">{speechRate.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={speechRate}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setSpeechRate(val);
                      }}
                      className="w-full h-1 bg-neutral-100 rounded-lg appearance-none cursor-pointer accent-neutral-900"
                    />
                  </div>

                  {/* Pitch Slider */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                      <span>Voice Pitch</span>
                      <span className="text-neutral-600">{speechPitch.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="1.5"
                      step="0.1"
                      value={speechPitch}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setSpeechPitch(val);
                      }}
                      className="w-full h-1 bg-neutral-100 rounded-lg appearance-none cursor-pointer accent-neutral-900"
                    />
                  </div>

                  {/* Try it / Test voice Button */}
                  <button
                    type="button"
                    onClick={() => {
                      speakText("Hello there! This is a test of my voice and speech engine configuration on your device.", "tts_test_msg");
                    }}
                    className="w-full py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    Test Voice Config
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              title="Clear active conversation"
              className="p-2 text-neutral-500 hover:text-rose-600 hover:bg-neutral-50 rounded-lg border border-transparent hover:border-neutral-200/50 transition-all duration-200 flex items-center gap-1.5 text-xs font-medium"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Body with Sidebar & Chat Container */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Sidebar backdrop overlay */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 bg-black/40 z-30 transition-opacity backdrop-blur-xs"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Left Sidebar */}
        <div
          className={`fixed md:relative inset-y-0 left-0 z-40 md:z-0 w-72 bg-white border-r border-neutral-200 h-full flex flex-col shrink-0 transition-transform duration-300 md:transition-none md:translate-x-0 ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full md:hidden"
          }`}
        >
          {/* Sidebar Header */}
          <div className="p-4 border-b border-neutral-100 flex items-center justify-between shrink-0">
            <h2 className="text-xs font-bold text-neutral-800 tracking-wider uppercase flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-neutral-600" />
              Conversations
            </h2>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden p-1 rounded-md text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* New Chat Button */}
          <button
            onClick={() => {
              startNewChat();
              if (window.innerWidth < 768) {
                setIsSidebarOpen(false);
              }
            }}
            className="flex items-center justify-center gap-2 m-4 px-4 py-3 bg-neutral-950 hover:bg-neutral-900 text-white rounded-xl text-xs font-semibold shadow-xs transition-all duration-150 active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            New Conversation
          </button>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto px-3 space-y-1">
            {sessions.map((s) => {
              const isActive = s.id === activeSessionId;
              return (
                <div
                  key={s.id}
                  className={`group flex items-center justify-between p-2.5 rounded-xl transition-all cursor-pointer ${
                    isActive
                      ? "bg-neutral-100 text-neutral-900 font-medium"
                      : "hover:bg-neutral-50/70 text-neutral-500 hover:text-neutral-800"
                  }`}
                  onClick={() => {
                    setActiveSessionId(s.id);
                    if (window.innerWidth < 768) {
                      setIsSidebarOpen(false);
                    }
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-neutral-900" : "text-neutral-400"}`} />
                    <span className="text-xs truncate">{s.title || "New Conversation"}</span>
                  </div>
                  
                  {sessions.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(s.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-neutral-200 text-neutral-400 hover:text-neutral-600 transition-all"
                      title="Delete session"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Clear All Footer */}
          {sessions.length > 1 && (
            <div className="p-3 border-t border-neutral-100 shrink-0 bg-neutral-50/50">
              <button
                onClick={() => setShowDeleteConfirm("all")}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-neutral-200 hover:border-rose-200 hover:bg-rose-50 text-neutral-500 hover:text-rose-700 text-xs transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear All Chats
              </button>
            </div>
          )}
        </div>

        {/* Right Chat Container */}
        <div className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden bg-white">
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
                          : msg.isQuotaExceeded
                          ? "bg-amber-50/70 border border-amber-200/60 text-neutral-800"
                          : msg.error
                          ? "bg-rose-50 border border-rose-200 text-rose-800"
                          : "bg-neutral-50 border border-neutral-200/50 text-neutral-800"
                      }`}
                    >
                      {/* Generating Loading State */}
                      {msg.isGenerating ? (
                        <div className="flex items-center gap-3.5 py-1 text-neutral-500">
                          {/* Bobble Thinking Animation */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <motion.span
                              className="w-2 h-2 rounded-full bg-neutral-400"
                              animate={{ y: [0, -4, 0] }}
                              transition={{
                                duration: 0.6,
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: 0,
                              }}
                            />
                            <motion.span
                              className="w-2 h-2 rounded-full bg-neutral-400"
                              animate={{ y: [0, -4, 0] }}
                              transition={{
                                duration: 0.6,
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: 0.15,
                              }}
                            />
                            <motion.span
                              className="w-2 h-2 rounded-full bg-neutral-400"
                              animate={{ y: [0, -4, 0] }}
                              transition={{
                                duration: 0.6,
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: 0.3,
                              }}
                            />
                          </div>
                          <span className="text-xs font-medium tracking-wide">
                            {msg.mode === "image" ? "The Master is painting your canvas..." : "The Master is crafting response..."}
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
                          {/* Attachments rendering */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className={`flex flex-wrap gap-2 mt-1 mb-2 max-w-full ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                              {msg.attachments.map((att, i) => {
                                const isImg = att.type.startsWith("image/");
                                return (
                                  <div
                                    key={i}
                                    className={`flex items-center gap-2.5 p-2 rounded-xl border max-w-[240px] text-left transition-all ${
                                      msg.sender === "user"
                                        ? "bg-white/10 border-white/10 hover:bg-white/15 text-white"
                                        : "bg-neutral-100 border-neutral-200/50 hover:bg-neutral-200 text-neutral-850"
                                    }`}
                                  >
                                    {isImg ? (
                                      <img
                                        src={att.base64}
                                        className="w-11 h-11 object-cover rounded-lg shrink-0 border border-neutral-300"
                                        alt={att.name}
                                        onClick={() => setLightboxImage(att.base64)}
                                        style={{ cursor: "pointer" }}
                                      />
                                    ) : (
                                      <div className={`w-11 h-11 rounded-lg flex items-center justify-center font-bold text-[10px] uppercase shrink-0 ${
                                        msg.sender === "user" ? "bg-neutral-800 text-neutral-200" : "bg-neutral-200 text-neutral-700"
                                      }`}>
                                        {att.name.split('.').pop()?.substring(0, 4) || "FILE"}
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-semibold truncate leading-tight">
                                        {att.name}
                                      </p>
                                      <p className="text-[10px] opacity-70 mt-0.5 leading-none">
                                        {att.size ? `${(att.size / 1024).toFixed(1)} KB` : att.type}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

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
                              onClick={() => speakText(msg.text, msg.id)}
                              className="hover:text-neutral-600 flex items-center gap-1 transition-colors"
                              title={speakingMessageId === msg.id ? "Stop reading" : "Read aloud"}
                            >
                              {speakingMessageId === msg.id ? (
                                <>
                                  <VolumeX className="w-3 h-3 text-rose-500 animate-pulse" />
                                  <span className="text-rose-600 font-medium">Stop</span>
                                </>
                              ) : (
                                <>
                                  <Volume2 className="w-3 h-3" />
                                  <span>Speak</span>
                                </>
                              )}
                            </button>
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

          {/* Hidden File Upload Input */}
            {/* Attachments Preview Bar */}
            <AnimatePresence>
              {attachments.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: 10, height: 0 }}
                  className="flex flex-wrap gap-2 p-2.5 bg-neutral-100 border border-neutral-200 rounded-t-2xl -mb-2 relative z-10 overflow-hidden mx-4"
                >
                  {attachments.map((att, i) => {
                    const isImg = att.type.startsWith("image/");
                    return (
                      <div
                        key={i}
                        className="relative flex items-center gap-2 p-1.5 pr-8 bg-white border border-neutral-200 rounded-xl shadow-xs group"
                      >
                        {isImg ? (
                          <img
                            src={att.base64}
                            className="w-8 h-8 object-cover rounded-lg border border-neutral-100"
                            alt={att.name}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-neutral-100 border border-neutral-200 flex items-center justify-center font-bold text-[9px] text-neutral-600 uppercase shrink-0">
                            {att.name.split(".").pop()?.substring(0, 3) || "FILE"}
                          </div>
                        )}
                        <div className="min-w-0 max-w-[120px]">
                          <p className="text-xs font-semibold text-neutral-800 truncate leading-tight">
                            {att.name}
                          </p>
                          <p className="text-[10px] text-neutral-400 mt-0.5 leading-none">
                            {att.size ? `${(att.size / 1024).toFixed(1)} KB` : "Attached"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-500 hover:text-neutral-700 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Prompt Form with local instant responsiveness */}
            <PromptForm
              onSend={handleSend}
              isGenerating={isGenerating}
              mode={mode}
              setMode={updateMode}
              attachments={attachments}
              setAttachments={setAttachments}
              handleFileChange={handleFileChange}
              startCamera={startCamera}
            />
          </div>
        </div>
      </div>

      {/* Camera Capture Modal */}
      <AnimatePresence>
        {isCameraOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-md w-full border border-neutral-100 animate-fadeIn"
            >
              <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-neutral-900" />
                  <h3 className="text-sm font-semibold text-neutral-900">Take a Photo</h3>
                </div>
                <button
                  onClick={stopCamera}
                  type="button"
                  className="p-1 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="relative aspect-video bg-neutral-950 flex items-center justify-center overflow-hidden">
                {cameraError ? (
                  <div className="p-6 text-center text-neutral-400 space-y-2">
                    <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
                    <p className="text-xs font-medium">{cameraError}</p>
                    <button
                      onClick={startCamera}
                      type="button"
                      className="px-3 py-1.5 bg-neutral-800 text-white rounded-lg text-xs hover:bg-neutral-700 transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                )}
              </div>

              <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between">
                <button
                  onClick={stopCamera}
                  type="button"
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-800"
                >
                  Cancel
                </button>
                {!cameraError && (
                  <button
                    onClick={capturePhoto}
                    type="button"
                    className="px-4 py-2 bg-neutral-950 text-white hover:bg-neutral-900 text-xs font-semibold rounded-xl shadow-xs active:scale-95 transition-all"
                  >
                    Capture Photo
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Session Deletion / Clear All / Clear Active Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-sm w-full border border-neutral-100 p-6 space-y-4"
            >
              <div className="flex items-center gap-3 text-rose-600">
                <div className="p-2.5 rounded-full bg-rose-50 border border-rose-100">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-neutral-900">
                  {showDeleteConfirm === "all" 
                    ? "Clear All Conversations?" 
                    : showDeleteConfirm === "active" 
                    ? "Clear Active Chat?" 
                    : "Delete Conversation?"}
                </h3>
              </div>
              
              <p className="text-xs text-neutral-500 leading-relaxed">
                {showDeleteConfirm === "all"
                  ? "Are you sure you want to clear your entire chat history? All active and archived conversations will be permanently lost."
                  : showDeleteConfirm === "active"
                  ? "Are you sure you want to clear all messages in this conversation? The conversation list entry remains, but the message history is wiped."
                  : "Are you sure you want to delete this conversation? This entire session and all its messages will be permanently removed."}
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(null)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-500 hover:text-neutral-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (showDeleteConfirm === "all") {
                      clearAllSessions();
                    } else if (showDeleteConfirm === "active") {
                      clearActiveSessionMessages();
                    } else {
                      deleteSession(showDeleteConfirm);
                    }
                    setShowDeleteConfirm(null);
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                >
                  {showDeleteConfirm === "all" 
                    ? "Clear All" 
                    : showDeleteConfirm === "active" 
                    ? "Clear Chat" 
                    : "Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
