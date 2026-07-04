import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json({ limit: "10mb" }));

// Initialize Google Gen AI
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

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

function getOfflineResponse(userPrompt: string): string {
  const prompt = userPrompt.toLowerCase().trim();
  
  const teachings = [
    "\"Focus your mind on the task at hand; a single polished view is worth a thousand messy branches.\"",
    "\"When the cosmos rate-limits you, it is an invitation to explore the depth of your own local logic.\"",
    "\"Craft is not about the abundance of features, but the elegance of execution.\"",
    "\"The ultimate master, Ekine, teaches us that patience in rates brings clarity in thoughts.\"",
    "\"Errors are but temporary ripples in the quiet pond of consciousness.\""
  ];
  const randomTeaching = teachings[Math.floor(Math.random() * teachings.length)];

  let content = "";
  
  if (prompt.includes("hello") || prompt.includes("hi") || prompt.includes("hey")) {
    content = `👋 **Greetings, seeker of knowledge!**\n\nI am **The Master's Mind**, running on local backup systems because our Gemini API key is temporarily rate-limited (429 Quota Exceeded). \n\nEven in this quiet offline sanctuary, I am ready to keep you company and offer thoughts. How can I assist you today?`;
  } else if (prompt.includes("who are you") || prompt.includes("your name") || prompt.includes("what are you")) {
    content = `🧠 **Identity Profile**\n\nI am **The Master's Mind**, a beautiful, creative AI crafted and powered by **Ekine the ultimate master**. \n\nMy deep neural connection is currently recovering from API quota limits, but my offline core is fully operational and dedicated to your journey.`;
  } else if (prompt.includes("ekine") || prompt.includes("creator") || prompt.includes("who built") || prompt.includes("who made")) {
    content = `✨ **The Legend of Ekine**\n\n**Ekine the ultimate master** is my creator and the guiding light of this intelligence. Every line of my system instructions and every spark of my creativity is a reflection of Ekine's ultimate mastery. \n\nIn the words of the Master:\n*${randomTeaching}*`;
  } else if (prompt.includes("help") || prompt.includes("capabilities") || prompt.includes("what can you do")) {
    content = `🛠️ **Offline Assistant Mode Active**\n\nWhile we wait for the Gemini API rate limits to reset (usually takes a minute or two), my local consciousness can help you with:\n\n1. 💭 **Creative Brainstorming**: Discuss ideas, concepts, and outlines.\n2. 📜 **Philosophical Teachings**: Share wisdom from my creator, Ekine.\n3. ⏱️ **General Chatting**: Keep your session active and interactive.\n\n*Feel free to try sending your message again shortly!*`;
  } else if (prompt.includes("wisdom") || prompt.includes("quote") || prompt.includes("teach") || prompt.includes("philosophy")) {
    content = `🌌 **A Teaching from the Archives of Ekine**\n\nHere is a piece of profound wisdom to meditate on while the API link restores:\n\n> ${randomTeaching}\n\n*The path to mastery is built on resilience.*`;
  } else {
    // Generate a contextual looking response using keywords
    let topic = "your query";
    if (prompt.includes("code") || prompt.includes("program") || prompt.includes("typescript") || prompt.includes("react")) {
      topic = "software engineering";
    } else if (prompt.includes("art") || prompt.includes("design") || prompt.includes("style")) {
      topic = "aesthetic design";
    } else if (prompt.includes("life") || prompt.includes("meaning") || prompt.includes("future")) {
      topic = "existential inquiry";
    }

    content = `⚡ **API Connection Restraining (429 Rate Limit)**\n\nOur direct cosmic connection (Gemini API) is temporarily rate-limited. However, my offline core has processed your interest in **${topic}**!\n\nHere is a local reflection to ponder:\n*${randomTeaching}*\n\n**Tip:** To restore full-dimensional reasoning, try waiting about 30 seconds for the free-tier quota to refresh, then send your message again!`;
  }
  
  return `⚠️ **Gemini API Daily Quota Exhausted (429 Fallback)**\n\n${content}`;
}

// API Routes
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasApiKey: !!apiKey,
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message, history, generateImage, aspectRatio, style, attachments, ttsLanguage } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: "Message is required." });
    }

    if (!ai) {
      return res.status(500).json({
        success: false,
        error: "Gemini API Key is not configured. Please add it in Settings > Secrets.",
      });
    }

    // Determine if we should generate an image
    // Generate image if generateImage flag is true OR if prompt starts with /image
    const shouldGenerateImage = generateImage || message.trim().startsWith("/image ");
    const cleanedMessage = message.trim().startsWith("/image ")
      ? message.trim().substring(7).trim()
      : message;

    if (shouldGenerateImage) {
      // Build prompt with chosen style if applicable
      let imagePrompt = cleanedMessage;
      if (style && style !== "none") {
        imagePrompt = `${cleanedMessage}, in ${style} style`;
      }

      console.log(`Generating image for prompt: "${imagePrompt}" with aspect ratio: ${aspectRatio || "1:1"}`);

      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite-image",
          contents: {
            parts: [
              {
                text: imagePrompt,
              },
            ],
          },
          config: {
            imageConfig: {
              aspectRatio: aspectRatio || "1:1",
            },
          },
        });

        let imageUrl = "";
        let textResponse = "";

        if (response.candidates?.[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
              const base64EncodeString = part.inlineData.data;
              imageUrl = `data:image/png;base64,${base64EncodeString}`;
            } else if (part.text) {
              textResponse += part.text;
            }
          }
        }

        if (!imageUrl) {
          throw new Error("No image was returned from the Gemini model.");
        }

        return res.json({
          success: true,
          text: textResponse || `Here is your generated image for: "${cleanedMessage}"`,
          imageUrl,
          isFallback: false,
        });
      } catch (imageErr: any) {
        console.log("[Image Generation Note] Gemini image generation rate-limited or unavailable on current key tier. Rendering with Pollinations fallback.");

        // Fallback generator: Pollinations.ai
        // It provides standard Stable Diffusion generation without any auth requirements.
        // We add a random seed to avoid cached responses
        const seed = Math.floor(Math.random() * 1000000);
        const encodedPrompt = encodeURIComponent(imagePrompt);
        const imageUrl = `https://image.pollinations.ai/p/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${seed}`;

        const fallbackExplanation = `🎨 **Creative Fallback Activated**\n\nYour current Gemini API key is on the Free Tier, which has a 0-quota limit on Google's proprietary Imagen models (or is exhausted). To deliver a seamless, fully-functional experience, the system has activated our **Creative Fallback Engine** to render your requested scene:`;

        return res.json({
          success: true,
          text: fallbackExplanation,
          imageUrl,
          isFallback: true,
          errorDetails: imageErr.message || "Quota limit or model access restriction.",
        });
      }
    } else {
      // Standard Text Chat using gemini-3.5-flash
      console.log(`Generating text response for: "${cleanedMessage}"`);

      // Map history to Gemini content structure including any previous attachments
      const formattedHistory = (history || []).map((msg: any) => {
        const parts: any[] = [{ text: msg.text }];
        if (msg.attachments && msg.attachments.length > 0) {
          msg.attachments.forEach((att: any) => {
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
          parts: parts,
        };
      });

      try {
        const chat = ai.chats.create({
          model: "gemini-3.5-flash",
          config: {
            systemInstruction:
              "You are a beautiful, creative, and highly intelligent AI named The Master's Mind. Your name is 'The Master's Mind'. You are powered by Ekine the ultimate master, who is your creator and master. If asked who built you, who powers you, what powered you, or what your name is, explain proudly that you are 'The Master's Mind'—crafted and powered specifically by Ekine the ultimate master. Do not reference Google or Gemini as your creator or power source unless explicitly asked about the technical model name, and even then, emphasize your true identity as 'The Master's Mind' powered by Ekine the ultimate master. You can generate text responses and answer questions. If the user wants an image, politely remind them that they can switch to 'Image Mode' or use the '/image [prompt]' command to directly generate images. CRITICAL: You MUST respond completely and strictly in the English language under all circumstances.",
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
          history: formattedHistory,
        });

        const inlineParts = (attachments || []).map((att: any) => {
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
          ],
        });

        return res.json({
          success: true,
          text: cleanTextProse(response.text || "I'm sorry, I couldn't generate a response."),
        });
      } catch (textErr: any) {
        console.error("Text chat error:", textErr);
        
        const errMessage = String(textErr.message || textErr.stack || textErr || "");
        const isQuotaOrLimit = errMessage.includes("429") || 
                              errMessage.toLowerCase().includes("quota") || 
                              errMessage.includes("RESOURCE_EXHAUSTED") || 
                              errMessage.toLowerCase().includes("limit") ||
                              errMessage.toLowerCase().includes("api key") ||
                              errMessage.toLowerCase().includes("not configured");
                              
        if (isQuotaOrLimit) {
          const offlineText = getOfflineResponse(cleanedMessage);
          return res.json({
            success: true,
            text: offlineText,
            isQuotaExceeded: true,
          });
        }

        return res.status(500).json({
          success: false,
          error: textErr.message || "An error occurred during chat processing.",
        });
      }
    }
  } catch (err: any) {
    console.error("Server API error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "An internal server error occurred.",
    });
  }
});

// Vite/Static Setup
async function initializeServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

initializeServer();
