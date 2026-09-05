import { SopData } from "../types";
import { extractFramesFromVideo } from "./videoService";
import { extractAudioFromVideo } from "./audioService";

export const generateSopFromVideo = async (videoFile: File): Promise<SopData> => {
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
    You are an expert technical writer for The AFS Group.
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

  console.log("Sending to backend proxy...");

  try {
    const res = await fetch("/api/generate-sop", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt,
        audioPart,
        videoFrames
      })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const errorMessage = errorData.error || `Server error: ${res.status} ${res.statusText}`;
      throw new Error(errorMessage);
    }

    const data = await res.json();
    return data as SopData;
  } catch (error: any) {
    console.error("Gemini API Error (via backend):", error);
    
    const errorMessage = error.message || JSON.stringify(error);

    // Handle 400 INVALID_ARGUMENT (Bad API Key)
    if (errorMessage.includes("API key not valid") || errorMessage.includes("400") || errorMessage.includes("Missing GEMINI_API_KEY")) {
        throw new Error("The API Key configured in your environment is invalid. Please check your deployment settings or try selecting the key again.");
    }
    
    // Handle 413 Payload Too Large specifically
    if (errorMessage.includes("413") || errorMessage.includes("Too Large")) {
      throw new Error("The video is still too large (over 30 mins). Please try a shorter video.");
    }
    
    throw error;
  }
};