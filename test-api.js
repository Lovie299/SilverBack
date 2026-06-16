// test-api.js
import { GoogleGenerativeAI } from '@google/generative-ai';

// Use the SAME API key that worked in your test
const API_KEY = 'AIzaSyANWNDoSBwsRQEtba02fMw5fGkFAg4GDUI'; // Put your working key here

async function testGemini() {
  try {
    console.log('Testing Gemini API with key:', API_KEY.substring(0, 10) + '...');
    
    const genAI = new GoogleGenerativeAI(API_KEY);
    
    // Try different models
    const models = ['gemini-pro', 'gemini-1.5-pro', 'gemini-1.0-pro'];
    
    for (const modelName of models) {
      try {
        console.log(`\nTrying model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Say 'API is working!'");
        const response = await result.response;
        console.log(`✅ Model ${modelName} works! Response:`, response.text());
      } catch (e) {
        console.log(`❌ Model ${modelName} failed:`, e.message);
      }
    }
  } catch (error) {
    console.error('API Error:', error.message);
  }
}

testGemini();