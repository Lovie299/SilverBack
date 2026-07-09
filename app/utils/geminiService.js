// app/utils/geminiService.js
import { GoogleGenerativeAI } from '@google/generative-ai';

// The previous hardcoded key was revoked by Google after being detected in a
// public repository ("API key was reported as leaked"). Supply a fresh key
// via .env — never commit it:  EXPO_PUBLIC_GEMINI_API_KEY=...
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';

class GeminiService {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.isInitialized = false;
    this.conversationHistory = [];
  }

  initialize() {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
      console.warn('⚠️ Gemini API key not configured. Please add your API key.');
      return false;
    }
    
    try {
      this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      // gemini-1.5-flash was retired; 2.5-flash is the current stable model.
      this.model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      });
      this.isInitialized = true;
      console.log('✅ Gemini AI initialized with model: gemini-1.5-flash');
      return true;
    } catch (error) {
      console.error('Failed to initialize Gemini AI:', error);
      return false;
    }
  }

  async generateConservationInsight(prompt, includeHistory = true) {
    if (!this.isInitialized) {
      console.log('Using fallback response (API not initialized)');
      return this.getFallbackResponse(prompt);
    }

    try {
      console.log('📤 Sending request to Gemini API...');
      
      const fullPrompt = `You are SilverBack Sentry, an AI conservation assistant for gorilla rangers. 
Answer the following question about gorilla conservation in a helpful, accurate, and concise manner. 
Use simple language suitable for field rangers. Do not use markdown formatting like ** or *.
Keep responses clear and actionable, under 300 words.

Question: ${prompt}`;
      
      const result = await this.model.generateContent(fullPrompt);
      const response = await result.response;
      let text = response.text();
      
      text = this.cleanResponse(text);
      
      if (includeHistory) {
        this.conversationHistory.push({
          question: prompt,
          answer: text,
          timestamp: new Date().toISOString(),
        });
        if (this.conversationHistory.length > 10) {
          this.conversationHistory.shift();
        }
      }
      
      console.log('✅ Gemini API response received');
      return text;
      
    } catch (error) {
      // warn (not error) so Expo doesn't surface a red LogBox toast over the
      // chat — the fallback answer below keeps the assistant usable offline.
      console.warn('Gemini API error:', error.message);
      return this.getFallbackResponse(prompt);
    }
  }

  cleanResponse(text) {
    return text
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      .replace(/`/g, '')
      .trim();
  }

  clearConversationHistory() {
    this.conversationHistory = [];
    console.log('Conversation history cleared');
  }

  getFallbackResponse(prompt) {
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('health') || lowerPrompt.includes('sick') || lowerPrompt.includes('ill')) {
      return "🩺 Gorilla Health Assessment\n\n" +
        "Key signs of illness/injury:\n" +
        "• Respiratory: coughing, nasal discharge, wheezing\n" +
        "• Digestive: diarrhea, vomiting, loss of appetite\n" +
        "• Physical: limping, wounds, swelling, hair loss\n" +
        "• Behavioral: isolation, lethargy, unusual aggression\n\n" +
        "⚠️ Actions: Maintain 7m distance, document in app, report to vet team.";
    }
    
    if (lowerPrompt.includes('behavior')) {
      return "🦍 Gorilla Behaviors:\n\n" +
        "• Chest beating - strength display\n" +
        "• Ground thumping - warning signal\n" +
        "• Vocalizations - hoots, grunts, barks\n" +
        "• Nest building - fresh nests daily\n" +
        "• Grooming - social bonding";
    }
    
    if (lowerPrompt.includes('track')) {
      return "📍 Tracking Tips:\n\n" +
        "• Fresh dung (warm, moist) - within 1-2 hours\n" +
        "• Bent vegetation - direction indicator\n" +
        "• Footprints - size indicates group\n" +
        "• Listen for vocalizations - up to 1km away\n" +
        "• Track early morning (6-9 AM)";
    }
    
    if (lowerPrompt.includes('conservation')) {
      return "🌍 Conservation Guidelines:\n\n" +
        "✅ Report poaching immediately\n" +
        "✅ Maintain 7m distance\n" +
        "✅ Log all sightings with GPS\n" +
        "❌ No direct eye contact with silverbacks\n" +
        "❌ Never feed gorillas";
    }
    
    if (lowerPrompt.includes('silverback') || lowerPrompt.includes('group')) {
      return "🦍 Group Dynamics:\n\n" +
        "• 1-4 silverbacks (dominant leader)\n" +
        "• 3-8 adult females\n" +
        "• Juveniles and infants\n" +
        "• Group size: 5-30 members\n" +
        "• Silverback makes all movement decisions";
    }
    
    return "🦍 SilverBack Sentry AI Assistant\n\n" +
      "I can help with:\n" +
      "• Health assessment\n" +
      "• Behavior tracking\n" +
      "• Conservation strategies\n" +
      "• Group dynamics\n" +
      "• Tracking techniques\n\n" +
      "What would you like to know?";
  }
}

const geminiService = new GeminiService();
export default geminiService;