
require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

async function testGemini() {
  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL,
      contents: "Reply with exactly: CLIPPING AI CONNECTED",
    });

    console.log("\nGemini Response:");
    console.log(response.text);
    console.log("\nGemini API connection successful!");
  } catch (error) {
    console.error("\nGemini connection failed:");
    console.error(error.message);
  }
}

testGemini();
