import { GoogleGenAI } from "@google/genai";

async function generateBackground() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          text: "A cinematic, hyper-realistic shot of an astronaut in a high-tech white suit floating in deep space. The astronaut is gently holding a glowing, iridescent silver olive branch. The metallic silver leaves reflect a soft orange 'nuclear heart' glow from a nearby star. In the astronaut's gold-tinted helmet visor, we see a reflection of a distant, silver-glowing olive tree. Moody atmosphere, nebula clouds in shades of deep space black and soft silver, 8k resolution, ethereal, emotional, and futuristic.",
        },
      ],
    },
    config: {
      imageConfig: {
            aspectRatio: "16:9",
            imageSize: "1K"
        }
    },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
}

export { generateBackground };
