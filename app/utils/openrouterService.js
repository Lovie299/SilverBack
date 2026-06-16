// app/utils/openrouterService.js
class OpenRouterService {
  constructor() {
    this.apiKey = null;
    this.isInitialized = false;
    this.conversationHistory = [];
    this.currentModelIndex = 0;
    this.models = [
      "meta-llama/llama-3.1-8b-instruct",
      "mistralai/mistral-7b-instruct-v0.2",
      "openai/gpt-3.5-turbo",
    ];
  }

  initialize(apiKey) {
    if (!apiKey || apiKey === "YOUR_OPENROUTER_API_KEY_HERE" || apiKey === "") {
      console.warn(
        "⚠️ OpenRouter API key not provided. Using fallback responses.",
      );
      return false;
    }
    this.apiKey = apiKey;
    this.isInitialized = true;
    console.log("✅ OpenRouter AI initialized");
    return true;
  }

  async generateConservationInsight(prompt, includeHistory = true) {
    if (!this.isInitialized || !this.apiKey) {
      console.log("⚠️ API not initialized, using fallback");
      return this.getFallbackResponse(prompt);
    }

    const model = this.models[this.currentModelIndex];
    console.log(`📤 Sending request to OpenRouter API using model: ${model}`);

    try {
      // Build conversation context
      let messages = [];
      if (includeHistory && this.conversationHistory.length > 0) {
        const recentHistory = this.conversationHistory.slice(-3);
        for (const exchange of recentHistory) {
          messages.push({ role: "user", content: exchange.question });
          messages.push({
            role: "assistant",
            content: exchange.answer.substring(0, 200),
          });
        }
      }

      messages.push({
        role: "user",
        content: `You are SilverBack Sentry, an expert AI conservation assistant for gorilla rangers. 
Answer the following question about gorilla conservation. Be helpful, accurate, and concise. 
Use simple language suitable for field rangers. Do NOT use markdown (no **, no *). 
Keep responses under 300 words. Be practical and actionable.

Question: ${prompt}`,
      });

      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://silverback-sentry.app",
            "X-Title": "SilverBack Sentry",
          },
          body: JSON.stringify({
            model: model,
            messages: messages,
            temperature: 0.7,
            max_tokens: 800,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error(
          `API Error with model ${model}:`,
          response.status,
          errorData,
        );

        // Try next model if available
        if (this.currentModelIndex < this.models.length - 1) {
          this.currentModelIndex++;
          console.log(
            `🔄 Switching to next model: ${this.models[this.currentModelIndex]}`,
          );
          return this.generateConservationInsight(prompt, includeHistory);
        }

        throw new Error(`All models failed`);
      }

      const data = await response.json();
      let text = data.choices[0].message.content;

      text = text.replace(/\*\*/g, "").replace(/\*/g, "").trim();

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

      console.log("✅ OpenRouter response received");
      return text;
    } catch (error) {
      console.error("OpenRouter API error:", error.message);
      return this.getFallbackResponse(prompt);
    }
  }

  getFallbackResponse(prompt) {
    const p = prompt.toLowerCase();

    if (p.includes("health") || p.includes("sick")) {
      return "🩺 Gorilla Health Assessment\n\nSigns of illness: respiratory issues (coughing, nasal discharge), digestive problems (diarrhea, loss of appetite), physical injuries (limping, wounds), behavioral changes (isolation, lethargy).\n\nImmediate actions: Maintain 7m distance, document in app, mark GPS, report to veterinary team within 2 hours.\n\nNever attempt to treat a sick gorilla yourself.";
    }

    if (p.includes("behavior")) {
      return "🦍 Gorilla Behaviors\n\nSilverback: chest beating (strength display), ground thumping (warning), vocalizations (hoots, grunts, barks).\nGroup: nest building (fresh nightly), grooming (social bonding), play (juveniles).\nMother-infant: riding on back (2-3 years), nursing (3-4 years).\n\nDocument all behaviors in the SilverBack Sentry app.";
    }

    if (p.includes("track")) {
      return "📍 Tracking Tips\n\nSigns of recent passage:\n• Fresh dung (warm/moist) - within 1-2 hours\n• Bent vegetation - indicates direction\n• Footprints - size indicates group composition\n• Night nests - built fresh daily\n\nBest times: early morning (6-9 AM) or late afternoon (3-5 PM).\n\nLog in app: group size, GPS coordinates, composition, direction of travel.";
    }

    if (p.includes("conservation")) {
      return "🌍 Conservation Guidelines\n\nDo's:\n✅ Report signs of poaching immediately\n✅ Maintain 7m distance from gorillas\n✅ Log all sightings with GPS coordinates\n✅ Report sick/injured gorillas promptly\n\nDon'ts:\n❌ Never make direct eye contact with silverbacks\n❌ Don't feed gorillas - disrupts natural diet\n❌ Avoid loud noises or sudden movements\n❌ Don't smoke near gorillas\n❌ Never approach if you're sick\n\nYour observations directly help conservation efforts.";
    }

    if (p.includes("silverback") || p.includes("group")) {
      return "🦍 Group Dynamics\n\nGroup Composition:\n• 1-4 silverback males (dominant leader)\n• 3-8 adult females\n• Juveniles and infants\n• Total size: 5-30 members\n\nSilverback Role:\n• Makes movement/feeding decisions\n• Mediates conflicts\n• Defends against threats\n• Primary mating partner\n\nWhen silverback dies, group may fragment or females may join other groups.";
    }

    if (p.includes("eat") || p.includes("food") || p.includes("diet")) {
      return "🌿 Gorilla Diet\n\nPrimary Foods:\n• Leaves and stems (50-60% of diet)\n• Bamboo shoots (seasonal)\n• Fruits (favorite when available)\n• Bark and roots\n• Occasional insects\n\nDaily Intake:\n• Adult male: 30kg (66 lbs)\n• Adult female: 18kg (40 lbs)\n• Juvenile: 10-15kg\n\nFeeding Times: morning (6-9 AM) and afternoon (2-5 PM).\n\nDocument preferred food plants in the app to help identify critical habitat.";
    }

    return "🦍 SilverBack Sentry AI Assistant\n\nI'm your expert conservation partner for gorilla protection. I can help with:\n\n🩺 Health Assessment - Identify signs of illness/injury\n🦍 Behavior - Understand gorilla actions and communications\n📍 Tracking - Tips for locating gorilla groups\n🌍 Conservation - Best practices for protection\n👑 Group Dynamics - Silverback leadership and troop structure\n🌿 Diet - Feeding patterns and preferences\n\nWhat would you like to know about gorilla conservation?\n\nTry asking:\n• How to identify a sick gorilla?\n• What are common gorilla behaviors?\n• How to track gorillas effectively?\n• Tell me about silverback leadership";
  }

  clearConversationHistory() {
    this.conversationHistory = [];
    console.log("Conversation history cleared");
  }
}

export default new OpenRouterService();
