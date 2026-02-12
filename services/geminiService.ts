import { GoogleGenAI, Type } from "@google/genai";

export const analyzeBatch = async (
  images: { base64: string; index: number }[]
): Promise<Map<number, string>> => {
  // STRICT: Only use process.env.API_KEY. No fallback to invalid hardcoded keys.
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API_KEY is missing in environment variables.");
    return new Map();
  }

  const ai = new GoogleGenAI({ apiKey });
  // Using gemini-3-flash-preview as per latest guidelines for multimodal tasks
  const MODEL_NAME = 'gemini-3-flash-preview';

  if (images.length === 0) return new Map();

  console.log(`[Gemini Service] Analyzing ${images.length} images with ${MODEL_NAME}`);

  try {
    const parts: any[] = [];
    const properties: Record<string, any> = {};
    const required: string[] = [];

    images.forEach((img) => {
      const key = `page_${img.index}`;
      
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: img.base64
        }
      });
      parts.push({
        text: `Image for ${key}`
      });

      // Request structured data: List of bubbles with coordinates for sorting
      // We need ymin and xmin to determine Manga reading order (Top-to-Bottom, Right-to-Left)
      properties[key] = {
        type: Type.ARRAY,
        description: `List of text bubbles for Page ${img.index}`,
        items: {
            type: Type.OBJECT,
            properties: {
                text: { type: Type.STRING, description: "The content of the text bubble" },
                ymin: { type: Type.NUMBER, description: "The y-coordinate of the top edge (0-1000)" },
                xmin: { type: Type.NUMBER, description: "The x-coordinate of the left edge (0-1000)" }
            },
            required: ["text", "ymin", "xmin"]
        }
      };
      required.push(key);
    });

    const prompt = `
      Analyze these manga pages. 
      Extract all dialogue.
      For each text bubble, provide the text, 'ymin', and 'xmin' coordinates (0-1000 scale).
      Return JSON.
    `;
    parts.push({ text: prompt });

    // Add a longer timeout (45s) for the API call to prevent premature aborts on slower connections
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); 

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts: parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: properties,
          required: required,
        },
      }
    });

    clearTimeout(timeoutId);

    const text = response.text;
    if (!text) throw new Error("Empty response");

    let cleanText = text.trim();
    if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const json = JSON.parse(cleanText);
    const result = new Map<number, string>();

    images.forEach((img) => {
      const key = `page_${img.index}`;
      const bubbles = json[key];
      
      if (Array.isArray(bubbles)) {
        // MANGA SORTING LOGIC (Right-to-Left, Top-to-Bottom)
        bubbles.sort((a: any, b: any) => {
            const yA = a.ymin || 0;
            const yB = b.ymin || 0;
            const xA = a.xmin || 0;
            const xB = b.xmin || 0;
            
            // Row Tolerance: If bubbles are vertically close (within 50/1000 units), 
            // treat them as being on the same "row".
            const ROW_TOLERANCE = 50;

            if (Math.abs(yA - yB) < ROW_TOLERANCE) {
                // Same Row: Sort Right-to-Left (Descending X)
                // This ensures the bubble on the right is read first.
                return xB - xA;
            }
            
            // Different Row: Sort Top-to-Bottom (Ascending Y)
            return yA - yB;
        });

        const joinedText = bubbles.map((b: any) => b.text).join(' ');
        result.set(img.index, joinedText);
      } else if (typeof bubbles === 'string') {
          // Fallback if the model returns a simple string
          result.set(img.index, bubbles);
      }
    });

    return result;

  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    return new Map();
  }
};