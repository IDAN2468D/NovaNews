import { GoogleGenAI, Modality } from "@google/genai";
import { NewsArticle } from "../types";

// Lazy load AI client
let aiClient: GoogleGenAI | null = null;
const getAi = (): GoogleGenAI => {
  if (!aiClient) {
    // Safety check for process.env in browser environments
    // In many build tools, process.env.API_KEY is replaced by a string literal.
    // If process is undefined at runtime, we fallback safely.
    let apiKey = "";
    try {
        apiKey = process.env.API_KEY as string;
    } catch (e) {
        console.warn("process.env.API_KEY access failed, attempting fallback or assuming injection.");
    }
    
    if (!apiKey) {
        console.error("API Key is missing.");
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
};

// Robust JSON extraction from LLM text response
const extractJson = (text: string): any => {
  if (!text) return null;
  let cleaned = text.trim();

  // Remove markdown code blocks ```json ... ```
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

  // Attempt 1: Direct Parse
  try {
    return JSON.parse(cleaned);
  } catch (e) {}

  // Attempt 2: Extract Array [...]
  const firstOpen = cleaned.indexOf("[");
  const lastClose = cleaned.lastIndexOf("]");
  if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
    try {
      return JSON.parse(cleaned.substring(firstOpen, lastClose + 1));
    } catch (e) {}
  }

  // Attempt 3: Extract Object {...}
  const firstOpenObj = cleaned.indexOf("{");
  const lastCloseObj = cleaned.lastIndexOf("}");
  if (firstOpenObj !== -1 && lastCloseObj !== -1 && lastCloseObj > firstOpenObj) {
    try {
      return JSON.parse(cleaned.substring(firstOpenObj, lastCloseObj + 1));
    } catch (e) {}
  }

  return null;
};

// --- Standard News Search ---
export const fetchNewsFromAgent = async (topic: string = "latest news"): Promise<NewsArticle[]> => {
  try {
    const prompt = `
      You are a professional news aggregator API.
      Task: Fetch 6-10 real news articles about: "${topic}".
      
      Requirements:
      - Articles must be real and current (use Google Search).
      - Cover diverse categories: Politics, Economy, Technology, Sports, World.
      - Output strictly valid JSON array.
      - Titles and Summaries must be in Hebrew.
      
      JSON Schema:
      [
        {
          "title": "Hebrew Headline",
          "summary": "Brief Hebrew summary (2 sentences)",
          "category": "Politics|Technology|Sports|Economy|Health|Entertainment|Science|World|General",
          "publishedAt": "Time ago (e.g. 'לפני שעה')"
        }
      ]
    `;

    const response = await getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "";
    let data = extractJson(text);
    
    // Normalize data structure
    let articles: any[] = [];
    if (Array.isArray(data)) {
        articles = data;
    } else if (data && typeof data === 'object') {
        if (Array.isArray(data.news)) articles = data.news;
        else if (Array.isArray(data.articles)) articles = data.articles;
        else articles = [data];
    }

    // Attach Source URLs from grounding metadata
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const validLinks = groundingChunks
      .map(chunk => chunk.web?.uri)
      .filter((uri): uri is string => !!uri);

    return articles.map((article, index) => {
        const url = validLinks[index % validLinks.length]; // Distribute links
        return {
            title: article.title || "ללא כותרת",
            summary: article.summary || "",
            category: article.category || "General",
            publishedAt: article.publishedAt || "לאחרונה",
            sourceUrl: url,
            sourceName: url ? new URL(url).hostname.replace('www.', '') : undefined
        };
    });

  } catch (error) {
    console.error("Gemini API Error:", error);
    return [{
        title: "שגיאה בטעינת החדשות",
        summary: "אנא נסה שוב מאוחר יותר.",
        category: "General",
        publishedAt: "עכשיו"
    }];
  }
};

// --- Deep Research ---
export const fetchDeepResearch = async (topic: string): Promise<NewsArticle[]> => {
  try {
    const prompt = `
      Perform deep analysis on: "${topic}".
      Return a JSON array of 3 detailed insight articles in Hebrew.
      Use Google Search for facts.
      
      JSON Format:
      [{"title": "...", "summary": "...", "category": "General", "publishedAt": "Deep Dive"}]
    `;

    const response = await getAi().models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 32768 },
        tools: [{ googleSearch: {} }], 
      },
    });

    let data = extractJson(response.text || "");
    let articles = Array.isArray(data) ? data : (data?.articles || []);

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const validLinks = groundingChunks.map(c => c.web?.uri).filter(u => !!u);

    return articles.map((a: any, i: number) => ({
        ...a,
        sourceUrl: validLinks[i % validLinks.length],
        sourceName: "Gemini 3 Pro Analysis"
    }));

  } catch (error) {
    console.error("Deep Research Error:", error);
    return [{
        title: "שגיאה בניתוח",
        summary: "המודל נתקל בבעיה.",
        category: "General",
        publishedAt: "עכשיו"
    }];
  }
};

// --- Image Analysis ---
export const analyzeImage = async (base64Image: string, mimeType: string): Promise<NewsArticle> => {
    try {
        const response = await getAi().models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: {
                parts: [
                    { inlineData: { mimeType, data: base64Image } },
                    { text: "Analyze this image for news context. JSON Output: { \"title\": \"Hebrew Headline\", \"summary\": \"Hebrew Description\", \"category\": \"General\" }" }
                ]
            }
        });

        const data = extractJson(response.text || "") || {};
        return {
            title: data.title || "ניתוח תמונה",
            summary: data.summary || "לא ניתן היה לפענח את התמונה.",
            category: data.category || "General",
            publishedAt: "עכשיו",
            sourceName: "Image Analysis"
        };
    } catch (error) {
        console.error("Image Error:", error);
        throw error;
    }
};

// --- Text to Speech ---
export const generateSpeech = async (text: string): Promise<ArrayBuffer | null> => {
    try {
        const response = await getAi().models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: text.substring(0, 300) }] }], // Limit length for speed
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
            },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) return null;

        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    } catch (error) {
        console.error("TTS Error:", error);
        return null;
    }
};