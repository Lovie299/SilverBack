// app/components/AIContent.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import openrouterService from '../utils/openrouterService';

// Your OpenRouter API key - get from https://openrouter.ai/keys
const OPENROUTER_API_KEY = 'YOUR_OPENROUTER_API_KEY';

export default function AIContent() {
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState([]);
  const [initialized, setInitialized] = useState(false);
  const flatListRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const init = openrouterService.initialize(OPENROUTER_API_KEY);
    setInitialized(init);
    
    setMessages([
      {
        id: 'welcome',
        text: init 
          ? "🦍 Welcome to SilverBack Sentry AI Assistant!\n\nI'm here to help with:\n• Gorilla health assessment\n• Behavior tracking\n• Field conservation strategies\n• Group dynamics\n• Tracking techniques\n\nWhat would you like to know about gorilla conservation today?"
          : "🦍 Welcome to SilverBack Sentry AI Assistant!\n\nI'm here to help with gorilla conservation. Please add your OpenRouter API key to enable live AI responses.\n\nFor now, I'll provide expert conservation knowledge.",
        isUser: false,
        timestamp: new Date(),
      },
    ]);
  }, []);

  // Thinking animation component
  const ThinkingIndicator = () => (
    <View style={styles.thinkingContainer}>
      <LinearGradient colors={['#10B981', '#059669']} style={styles.avatar}>
        <Text style={styles.avatarText}>AI</Text>
      </LinearGradient>
      <View style={styles.thinkingBubble}>
        <View style={styles.thinkingDots}>
          <View style={[styles.thinkingDot, styles.thinkingDot1]} />
          <View style={[styles.thinkingDot, styles.thinkingDot2]} />
          <View style={[styles.thinkingDot, styles.thinkingDot3]} />
        </View>
        <Text style={styles.thinkingText}>Thinking</Text>
      </View>
    </View>
  );

  // Typing effect function with smaller cursor
  const typeMessage = async (fullText, botMessageId) => {
    let currentText = '';
    const typingSpeed = 20; // milliseconds per character
    
    // Split into characters for smooth typing
    const characters = fullText.split('');
    
    for (let i = 0; i < characters.length; i++) {
      currentText += characters[i];
      
      // Update the message in real-time with smaller cursor
      setMessages(prev => prev.map(msg => 
        msg.id === botMessageId 
          ? { ...msg, text: currentText + (i < characters.length - 1 ? '▏' : '') }
          : msg
      ));
      
      // Variable delay for more natural typing
      let delay = typingSpeed;
      const char = characters[i];
      if (char === '.' || char === '!' || char === '?') {
        delay = typingSpeed * 3;
      } else if (char === ',' || char === '\n') {
        delay = typingSpeed * 2;
      } else if (Math.random() < 0.02) {
        delay = typingSpeed * 4;
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // Remove the cursor after typing completes
    setMessages(prev => prev.map(msg => 
      msg.id === botMessageId 
        ? { ...msg, text: currentText }
        : msg
    ));
  };

  const sendMessage = async () => {
    if (!inputText.trim() || loading) return;
    Keyboard.dismiss();

    const userMessage = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isUser: true,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);
    setIsThinking(true); // Show thinking indicator

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      // Get AI response (this may take a moment)
      const aiResponse = await openrouterService.generateConservationInsight(userMessage.text);
      
      // Hide thinking indicator
      setIsThinking(false);
      
      // Create a placeholder message that will be typed out
      const botMessageId = (Date.now() + 1).toString();
      const botMessage = {
        id: botMessageId,
        text: '', // Start empty
        isUser: false,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, botMessage]);
      
      // Small delay before starting to type
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Start typing animation
      await typeMessage(aiResponse, botMessageId);
      
    } catch (error) {
      console.error('AI Error:', error);
      setIsThinking(false);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I'm having trouble responding. Please try again.",
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const suggestedQuestions = [
    { icon: '🩺', text: 'How to identify a sick gorilla?' },
    { icon: '🦍', text: 'What are common gorilla behaviors?' },
    { icon: '📍', text: 'How to track gorillas?' },
    { icon: '👑', text: 'Tell me about silverback leadership' },
    { icon: '🌿', text: 'What do gorillas eat?' },
  ];

  const renderMessage = ({ item }) => {
    const isMe = item.isUser;
    
    return (
      <View style={[styles.messageRow, isMe ? styles.userRow : styles.botRow]}>
        {!isMe && (
          <LinearGradient colors={['#10B981', '#059669']} style={styles.avatar}>
            <Text style={styles.avatarText}>AI</Text>
          </LinearGradient>
        )}
        <View style={[styles.bubble, isMe ? styles.userBubble : styles.botBubble]}>
          <Text style={[styles.messageText, isMe ? styles.userText : styles.botText]}>
            {item.text}
          </Text>
          <Text style={styles.timeText}>
            {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        {isMe && (
          <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.avatar}>
            <Ionicons name="person" size={18} color="white" />
          </LinearGradient>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messagesList}
        onScrollBeginDrag={Keyboard.dismiss}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={isThinking ? <ThinkingIndicator /> : null}
      />

      {messages.length === 1 && (
        <View style={styles.suggestedContainer}>
          <Text style={styles.suggestedTitle}>Suggested questions:</Text>
          <View style={styles.suggestedGrid}>
            {suggestedQuestions.map((q, i) => (
              <TouchableOpacity key={i} style={styles.suggestedChip} onPress={() => { setInputText(q.text); inputRef.current?.focus(); }}>
                <Text style={styles.suggestedIcon}>{q.icon}</Text>
                <Text style={styles.suggestedText}>{q.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.inputWrapper}>
        <LinearGradient colors={['#FFFFFF', '#FAFAFA']} style={styles.inputContainer}>
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask about gorilla conservation..."
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={500}
              editable={!loading}
            />
            <TouchableOpacity 
              style={[styles.sendButton, (!inputText.trim() || loading) && styles.sendButtonDisabled]} 
              onPress={sendMessage}
              disabled={!inputText.trim() || loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={inputText.trim() && !loading ? ['#10B981', '#059669'] : ['#D1D5DB', '#D1D5DB']}
                style={styles.sendGradient}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name="send" size={18} color="white" />
                    <Text style={styles.sendButtonText}>Send</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  messagesList: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  messageRow: { flexDirection: 'row', marginBottom: 16, alignItems: 'flex-end' },
  userRow: { justifyContent: 'flex-end' },
  botRow: { justifyContent: 'flex-start' },
  avatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 12, fontWeight: 'bold', color: 'white' },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 20 },
  userBubble: { backgroundColor: '#10B981', borderBottomRightRadius: 4 },
  botBubble: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  messageText: { fontSize: 15, lineHeight: 20 },
  userText: { color: '#FFFFFF' },
  botText: { color: '#1F2937' },
  timeText: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end', color: '#9CA3AF' },
  inputWrapper: { borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  inputContainer: { paddingHorizontal: 16, paddingVertical: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  input: { flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, maxHeight: 100, fontSize: 15, backgroundColor: '#FAFAFA' },
  sendButton: { borderRadius: 24, overflow: 'hidden' },
  sendButtonDisabled: { opacity: 0.5 },
  sendGradient: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24 },
  sendButtonText: { color: 'white', fontWeight: '600', fontSize: 14 },
  suggestedContainer: { padding: 16, paddingBottom: 8, backgroundColor: '#F3F4F6' },
  suggestedTitle: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 12 },
  suggestedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  suggestedChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 24, elevation: 2 },
  suggestedIcon: { fontSize: 16 },
  suggestedText: { fontSize: 13, color: '#374151', maxWidth: 150 },
  // Thinking indicator styles
  thinkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  thinkingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    gap: 8,
  },
  thinkingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  thinkingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    opacity: 0.6,
  },
  thinkingDot1: {
    animation: 'pulse 1.4s ease-in-out infinite',
  },
  thinkingDot2: {
    animation: 'pulse 1.4s ease-in-out 0.2s infinite',
  },
  thinkingDot3: {
    animation: 'pulse 1.4s ease-in-out 0.4s infinite',
  },
  thinkingText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
});