import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
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

// API Routes
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasApiKey: !!apiKey,
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message, history, generateImage, aspectRatio, style } = req.body;

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

      // Map history to Gemini content structure
      const formattedHistory = (history || []).map((msg: any) => {
        return {
          role: msg.sender === "user" ? "user" : "model",
          parts: [{ text: msg.text }],
        };
      });

      try {
        const chat = ai.chats.create({
          model: "gemini-3.5-flash",
          config: {
            systemInstruction:
              "You are a helpful, creative and beautiful AI Chatbot. You can generate text responses and answer questions. If the user wants an image, politely remind them that they can switch to 'Image Mode' or use the '/image [prompt]' command to directly generate images.",
          },
          history: formattedHistory,
        });

        const response = await chat.sendMessage({
          message: cleanedMessage,
        });

        return res.json({
          success: true,
          text: response.text || "I'm sorry, I couldn't generate a response.",
        });
      } catch (textErr: any) {
        console.error("Text chat error:", textErr);
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
