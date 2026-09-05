import { SopData } from "../types";
import { extractFramesFromVideo } from "./videoService";
import { extractAudioFromVideo } from "./audioService";

/**
 * Client-side CLI API key handling.
 * The Gemini key is stored in the browser (localStorage) so this tool can run
 * fully static on GitHub Pages with no backend. The key never leaves the browser.
 */
const GEMINI_KEY_STORAGE = "snowark.geminiApiKey";

export const getGeminiKey = (): string | null =>
  localStorage.getItem(GEMINI_KEY_STORAGE);

export const setGeminiKey = (key: string): void => {
  localStorage.setItem(GEMINI_KEY_STORAGE, key.trim());
};

export const clearGeminiKey = (): void => {
  localStorage.removeItem(GEMINI_KEY_STORAGE);
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_MODEL = "gemini-2.5-flash-latest";

/**
 * Calls the Gemini API directly from the browser with a structured-JSON schema.
 * No backend involved.
 */
const generateContent = async (
  apiKey: string,
  parts: any[],
  prompt: string
): Promise<any> => {
  const res = await fetch(
    `${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, ...parts] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING", description: "A professional, action-oriented title for the SOP." },
              overview: { type: "STRING", description: "A concise overview of the process goal and prerequisites." },
              steps: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    stepNumber: { type: "INTEGER" },
                    description: { type: "STRING", description: "Clear, imperative instruction for the step. Include constraints mentioned in audio." },
                    timestampSeconds: { type: "NUMBER", description: "The estimated time in seconds where this step visually occurs." },
                  },
                  required: ["stepNumber", "description", "timestampSeconds"],
                },
              },
            },
            required: ["title", "overview", "steps"],
          },
        },
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    const detail = data?.error?.message || JSON.stringify(data);
    const msg = `${detail}`;
    // Surface known failures clearly
    if (msg.includes("API key not valid")) {
      throw new Error("The Gemini API key is invalid. Check your key in settings.");
    }
    if (msg.includes("not enough") || msg.toLowerCase().includes("quota")) {
      throw new Error("The Gemini API key has hit its quota or is out of credits.");
    }
    throw new Error(msg);
  }

  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
  if (!text) throw new Error("No response from AI");
  return JSON.parse(text);
};

export const generateSopFromVideo = async (videoFile: File): Promise<SopData> => {
  const apiKey = getGeminiKey();
  if (!apiKey) {
    throw new Error("Please add your Gemini API key in Settings first.");
  }

  console.log("Sampling video frames...");
  const videoFrames = await extractFramesFromVideo(videoFile, 45); // Optimized frame count

  console.log("Extracting audio track...");
  const audioPart = await extractAudioFromVideo(videoFile);

  console.log(`Extracted ${videoFrames.length} frames.`);
  if (audioPart) {
    console.log("Audio track extracted successfully.");
  } else {
    console.log("No audio track found or extraction failed.");
  }

  const prompt = `
    You are an expert technical writer for SnowArk.
    Your objective is to create a highly accurate, reproducible Standard Operating Procedure (SOP) based on the provided screen recording analysis.

    **INPUTS:**
    1. **Visuals:** A sequence of image frames sampled from the video.
    2. **Audio:** The narrator's voice explaining the process (if available). The audio is 8kHz 8-bit Mono to optimize for length.

    **CRITICAL ANALYSIS STEPS:**
    1. **Goal Determination:** First, synthesize the audio narration and visual actions to determine the precise *Goal* of the process. What is the user achieving? (e.g., "Creating a new Invoice" vs "Approving an Invoice").
    2. **Multimodal Correlation:** Listen to the audio for the "Why" and "How" (context/nuance) and map it to the "What" and "Where" in the visuals.
    3. **Step Extraction:** Break the process down into granular, actionable steps.
       - **Completeness:** Ensure NO critical click, selection, or input is missed.
       - **Accuracy:** Use the visuals to describe exactly which buttons or fields to interact with.
       - **Context:** If the audio provides specific rules (e.g., "Only check this box if X"), include that in the step description.

    **OUTPUT REQUIREMENTS:**
    - **Title:** Specific and outcome-oriented.
    - **Overview:** A clear summary of the goal and any necessary context.
    - **Steps:** A chronological list of instructions.
    - **Timestamps:** For each step, identify the most relevant timestamp (in seconds) where the visual action occurs.

    Return the response in JSON format.
  `;

  const parts: any[] = [];
  if (audioPart) parts.push(audioPart);
  if (videoFrames && videoFrames.length > 0) parts.push(...videoFrames);

  console.log("Sending to Gemini directly from the browser...");
  return generateContent(apiKey, parts, prompt);
};