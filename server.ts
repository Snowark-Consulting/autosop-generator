import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit to handle base64 video frames and audio
  app.use(express.json({ limit: "200mb" }));
  app.use(express.urlencoded({ limit: "200mb", extended: true }));

  app.post("/api/generate-sop", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Missing GEMINI_API_KEY environment variable. Please configure it in settings." });
      }

      const ai = new GoogleGenAI({ apiKey });
      const { videoFrames, audioPart, prompt } = req.body;

      console.log("Received SOP generation request. Frames count:", videoFrames?.length);

      const parts: any[] = [{ text: prompt }];
      if (audioPart) {
        parts.push(audioPart);
      }
      if (videoFrames && videoFrames.length > 0) {
        parts.push(...videoFrames);
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: { parts },
        config: {
          thinkingConfig: { thinkingBudget: 2048 },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { 
                type: Type.STRING, 
                description: "A professional, action-oriented title for the SOP." 
              },
              overview: { 
                type: Type.STRING, 
                description: "A concise overview of the process goal and prerequisites." 
              },
              steps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    stepNumber: { type: Type.INTEGER },
                    description: { 
                      type: Type.STRING, 
                      description: "Clear, imperative instruction for the step. Include constraints mentioned in audio." 
                    },
                    timestampSeconds: { 
                      type: Type.NUMBER, 
                      description: "The estimated time in seconds where this step visually occurs." 
                    },
                  },
                  required: ["stepNumber", "description", "timestampSeconds"],
                },
              },
            },
            required: ["title", "overview", "steps"],
          }
        }
      });

      const responseText = response.text;
      if (!responseText) throw new Error("No response from AI");

      res.json(JSON.parse(responseText));
    } catch (err: any) {
      console.error("Gemini API Error in backend:", err);
      res.status(500).json({ error: err.message || "Failed to generate SOP" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // For Express 5 we must use *all instead of * but Express 5 is newly installed. Let's stick to express 5 standard: app.get("*", ... ) still works depending on the exact version. Wait, the rule says: In Express v4, use app.get('*',), but in Express v5, you must use app.get('*all',).
    // package.json shows express "^5.2.1" so I must use *all!
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
