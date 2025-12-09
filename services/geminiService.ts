import { GoogleGenAI, Modality } from "@google/genai";
import { NewsArticle } from "../types";

// Helper to lazy load AI client to avoid top-level side effects
let aiClient: GoogleGenAI | null = null;
const getAi = (): GoogleGenAI => {
  if (!aiClient) {
    // Check if process is defined to avoid crashes in strict browser environments, 
    // though the environment should inject it.
    const apiKey = typeof process !== 'undefined' ? process.env.API_KEY : undefined;
    if (!apiKey) {
        console.warn("API Key might be missing or process.env is undefined.");
    }
    aiClient = new GoogleGenAI({ apiKey: apiKey as string });
  }
  return aiClient;
};

// Helper to parse the text response looking for a JSON block (Array or Object)
const extractJson = (text: string): any => {
  if (!text) return null;
  
  let cleanedText = text.trim();
  
  // Pre-cleaning: remove markdown code blocks
  const codeBlockMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    cleanedText = codeBlockMatch[1].trim();
  } else {
    // Sometimes it just says "json" without ticks at start
    cleanedText = cleanedText.replace(/^json\s*/i, '');
  }

  // 1. Try direct parse
  try {
      return JSON.parse(cleanedText);
  } catch (e) {}

  // 2. Try to find the widest bracket pair [] (Array)
  const firstOpenBracket = cleanedText.indexOf('[');
  const lastCloseBracket = cleanedText.lastIndexOf(']');
  
  if (firstOpenBracket !== -1 && lastCloseBracket !== -1 && lastCloseBracket > firstOpenBracket) {
      const potentialJson = cleanedText.substring(firstOpenBracket, lastCloseBracket + 1);
      try {
          return JSON.parse(potentialJson);
      } catch (e) {}
  }
  
  // 3. Fallback: Sequential object extraction
  const objects: any[] = [];
  let startIndex = cleanedText.indexOf('{');
  
  // Safety limiter
  let loopCount = 0;
  
  while (startIndex !== -1 && loopCount < 50) {
      loopCount++;
      let balance = 1;
      let endIndex = startIndex + 1;
      let inString = false;
      let escape = false;

      while (endIndex < cleanedText.length && balance > 0) {
          const char = cleanedText[endIndex];
          if (escape) {
              escape = false;
          } else if (char === '\\') {
              escape = true;
          } else if (char === '"') {
              inString = !inString;
          } else if (!inString) {
              if (char === '{') balance++;
              else if (char === '}') balance--;
          }
          endIndex++;
      }

      if (balance === 0) {
          const jsonStr = cleanedText.substring(startIndex, endIndex);
          try {
              const obj = JSON.parse(jsonStr);
              if (obj && typeof obj === 'object') {
                   objects.push(obj);
              }
          } catch (e) {
              // Ignore invalid objects
          }
          startIndex = cleanedText.indexOf('{', endIndex);
      } else {
          break; // Stop if structure is broken
      }
  }

  if (objects.length > 0) return objects;

  console.error("Failed to parse JSON from Gemini response.");
  return null;
};

// --- Standard News Search (Flash) ---
export const fetchNewsFromAgent = async (topic: string = "latest news"): Promise<NewsArticle[]> => {
  try {
    const prompt = `
      You are a news aggregator. 
      Task: Fetch comprehensive news coverage on: "${topic}".
      
      REQUIRED: You must find at least 2 articles for EACH of the following categories if they are relevant to the topic or generally trending:
      - Politics (Israel & World)
      - Economy
      - Technology
      - Sports
      - Health
      - Entertainment
      - Science
      
      Output Rules:
      1. Return ONLY a raw JSON array.
      2. RFC8259 compliant JSON.
      3. All keys MUST be double-quoted (e.g. "title", not title).
      4. All string values MUST be double-quoted. 
      5. CRITICAL: Escape all double quotes inside strings (e.g. "She said \\"Hello\\"").
      6. CRITICAL: Escape all newlines inside strings (use \\n).
      7. No trailing commas.
      8. No markdown formatting.
      
      JSON Structure:
      [
        {
          "title": "Hebrew Headline",
          "summary": "Short summary in Hebrew",
          "category": "Politics|Technology|Sports|Economy|Health|Entertainment|Science|World|General",
          "publishedAt": "e.g. 'Just now'"
        }
      ]
      
      Fetch at least 10 items total.
    `;

    const response = await getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "";
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    let articles: any = extractJson(text);

    // Normalize result to array
    if (!articles || !Array.isArray(articles)) {
        if (articles && (articles as any).news) articles = (articles as any).news;
        else if (articles && (articles as any).articles) articles = (articles as any).articles;
        else {
             return [{
                title: "שגיאה בטעינת הנתונים",
                summary: "המודל החזיר תשובה שאינה תקינה. אנא נסה שוב או נסח את החיפוש מחדש.",
                category: "General",
                publishedAt: "עכשיו"
            }];
        }
    }

    const validLinks = groundingChunks
      .map(chunk => chunk.web?.uri)
      .filter((uri): uri is string => !!uri);

    return (articles as NewsArticle[]).map((article, index) => {
      const linkIndex = index < validLinks.length ? index : -1; 
      const url = linkIndex >= 0 ? validLinks[linkIndex] : undefined;
      
      return {
        ...article,
        sourceUrl: url,
        sourceName: url ? new URL(url).hostname.replace('www.', '') : "מקור ברשת"
      };
    });

  } catch (error) {
    console.error("Gemini API Error:", error);
    return [{
        title: "שגיאה בתקשורת",
        summary: "לא ניתן היה ליצור קשר עם השרת. אנא בדוק את החיבור שלך.",
        category: "General",
        publishedAt: "עכשיו"
    }];
  }
};

// --- Deep Research (Gemini 3 Pro + Thinking) ---
export const fetchDeepResearch = async (topic: string): Promise<NewsArticle[]> => {
  try {
    const prompt = `
      Perform a DEEP RESEARCH analysis on the topic: "${topic}".
      
      Use your thinking capabilities to analyze trends, causes, and effects.
      Output the result as a STRICT JSON array containing 3-5 highly detailed "Feature Articles".
      
      CRITICAL OUTPUT RULES:
      1. Return ONLY a raw JSON array.
      2. RFC8259 compliant JSON.
      3. All keys MUST be double-quoted.
      4. Escape all double quotes inside strings (e.g. "Text \\"Quote\\"").
      5. Escape all newlines inside strings (use \\n).
      6. No trailing commas.
      
      Structure:
      [
        {
          "title": "Insightful Hebrew Headline",
          "summary": "Detailed analysis in Hebrew (50-70 words). Explain the 'Why' and 'How'.",
          "category": "General", 
          "publishedAt": "Deep Dive"
        }
      ]
    `;

    const response = await getAi().models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 32768 },
        tools: [{ googleSearch: {} }], 
      },
    });

    let articles: any = extractJson(response.text || "");
    
    if (!articles || !Array.isArray(articles)) {
        if (articles && (articles as any).news) articles = (articles as any).news;
        else if (articles && (articles as any).articles) articles = (articles as any).articles;
        else {
            return [{
                title: "ניתוח לא זמין",
                summary: "לא ניתן היה לעבד את תוצאות המחקר. אנא נסה שוב.",
                category: "General",
                publishedAt: "עכשיו"
            }];
        }
    }
    
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const validLinks = groundingChunks.map(chunk => chunk.web?.uri).filter(u => !!u);

    return (articles as NewsArticle[]).map((a, i) => ({
        ...a,
        sourceUrl: validLinks[i % validLinks.length],
        sourceName: "Gemini 3 Pro Analysis"
    }));

  } catch (error) {
    console.error("Deep Research Error:", error);
    return [{
        title: "שגיאה בניתוח מעמיק",
        summary: "המודל נתקל בבעיה בעת ביצוע חשיבה עמוקה. אנא נסה שוב.",
        category: "General",
        publishedAt: "עכשיו"
    }];
  }
};

// --- Image Analysis (Gemini 3 Pro Multimodal) ---
export const analyzeImage = async (base64Image: string, mimeType: string): Promise<NewsArticle> => {
    try {
        const response = await getAi().models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: {
                parts: [
                    { inlineData: { mimeType, data: base64Image } },
                    { text: "Analyze this image in the context of news. What is happening? Who is in it? What does the chart show? Return a VALID JSON object with: { \"title\": \"Hebrew Headline\", \"summary\": \"Detailed description in Hebrew\", \"category\": \"General\" }" }
                ]
            },
            config: {
                responseMimeType: "application/json"
            }
        });

        const text = response.text || "{}";
        let data: any = extractJson(text);
        
        if (Array.isArray(data)) {
            data = data[0];
        }

        if (data) {
            return {
                title: data.title || "ניתוח תמונה",
                summary: data.summary || text.substring(0, 100),
                category: data.category || "General",
                publishedAt: "זה עתה נסרק",
                sourceName: "Image Analysis"
            };
        }
        
        return {
            title: "ניתוח תמונה",
            summary: "לא ניתן היה לפענח את התמונה.",
            category: "General",
            publishedAt: "זה עתה נסרק"
        };

    } catch (error) {
        console.error("Image Analysis Error:", error);
        throw error;
    }
};

// --- Text to Speech (Gemini 2.5 Flash TTS) ---
export const generateSpeech = async (text: string): Promise<ArrayBuffer | null> => {
    try {
        const response = await getAi().models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' }, 
                    },
                },
            },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) return null;

        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;

    } catch (error) {
        console.error("TTS Error:", error);
        return null;
    }
};