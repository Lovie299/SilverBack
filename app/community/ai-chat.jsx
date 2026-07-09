// app/community/ai-chat.jsx — AI assistant chat (Gemini).
// Rangers ask questions about wildlife/conservation; answers come from the
// Gemini API via the shared geminiService (which degrades to offline
// field-guide responses when the API is unreachable). Locked behind
// ChatLockGate like the community chat.

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Send, Sparkles } from 'lucide-react-native';

import geminiService from '../utils/geminiService';
import { colors, radius, fonts, alpha } from '../../components/ui/theme';
import { AppBar } from '../../components/ui/Primitives';
import ChatLockGate from '../../components/ui/ChatLockGate';

export default function AiChat() {
  const { t } = useTranslation();
  return (
    <View style={styles.root}>
      <AppBar title={t('chat.ai')} subtitle={t('chat.aiSubtitle')} back="/community/chat" />
      <ChatLockGate>
        <AiChatBody />
      </ChatLockGate>
    </View>
  );
}

let nextId = 1;

function AiChatBody() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]); // newest first (inverted list)
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);

  useEffect(() => {
    geminiService.initialize();
  }, []);

  const ask = async () => {
    const question = draft.trim();
    if (!question || thinking) return;
    setDraft('');
    setMessages((m) => [{ id: `m${nextId++}`, role: 'user', text: question }, ...m]);
    setThinking(true);
    try {
      const answer = await geminiService.generateConservationInsight(question);
      setMessages((m) => [{ id: `m${nextId++}`, role: 'assistant', text: answer }, ...m]);
    } catch (error) {
      setMessages((m) => [
        { id: `m${nextId++}`, role: 'assistant', text: `Something went wrong: ${error.message}` },
        ...m,
      ]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior="padding"
    >
      <FlatList
        data={messages}
        inverted
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.bubbleUser : styles.bubbleAi]}>
            {item.role === 'assistant' && (
              <View style={styles.aiTag}>
                <Sparkles size={12} color={colors.primary} />
                <Text style={styles.aiTagText}>{t('chat.ai')}</Text>
              </View>
            )}
            <Text
              style={[styles.messageText, item.role === 'user' && { color: colors.primaryForeground }]}
            >
              {item.text}
            </Text>
          </View>
        )}
        ListHeaderComponent={
          thinking ? (
            <View style={[styles.bubble, styles.bubbleAi, styles.thinkingRow]}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.thinkingText}>{t('chat.thinking')}</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !thinking ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Sparkles size={24} color={colors.primary} />
              </View>
              <Text style={styles.emptyText}>{t('chat.aiHint')}</Text>
            </View>
          ) : null
        }
      />
      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom - 8, 8) }]}>
        <TextInput
          placeholder={t('chat.aiPlaceholder')}
          placeholderTextColor={colors.mutedForeground}
          value={draft}
          onChangeText={setDraft}
          multiline
          style={styles.input}
        />
        <TouchableOpacity
          onPress={ask}
          disabled={!draft.trim() || thinking}
          style={[styles.sendBtn, (!draft.trim() || thinking) && { opacity: 0.5 }]}
        >
          <Send size={18} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: 20, paddingVertical: 12, gap: 10 },
  emptyWrap: { paddingVertical: 48, alignItems: 'center', gap: 12 },
  emptyIcon: {
    height: 56,
    width: 56,
    borderRadius: radius.lg,
    backgroundColor: alpha(colors.primary, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: colors.mutedForeground,
    fontFamily: fonts.regular,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 19,
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderBottomRightRadius: radius.sm,
  },
  bubbleAi: {
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    borderBottomLeftRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  aiTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  aiTagText: { fontSize: 10, fontFamily: fonts.semibold, color: colors.primary },
  messageText: { fontSize: 14, fontFamily: fonts.regular, color: colors.foreground, lineHeight: 20 },
  thinkingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  thinkingText: { fontSize: 13, color: colors.mutedForeground, fontFamily: fonts.regular },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 8,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    color: colors.foreground,
    fontFamily: fonts.regular,
  },
  sendBtn: {
    height: 44,
    width: 44,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
