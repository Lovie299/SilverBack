// app/community/chat.jsx — Community chat (users ↔ rangers).
// Real-time Firestore-backed group conversation for the park community,
// privacy-locked behind ChatLockGate (biometrics or account password).
// The sparkle button in the header opens the ranger AI assistant.

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { Send, Sparkles } from 'lucide-react-native';

import { useAuth } from '../contexts/AuthContext';
import { db } from '../../firebaseConfig';
import { colors, radius, fonts, alpha } from '../../components/ui/theme';
import { AppBar } from '../../components/ui/Primitives';
import ChatLockGate from '../../components/ui/ChatLockGate';
import { useUserPrefs, initials } from '../../components/ui/userPrefs';
import { formatReportTime } from './index';

export default function CommunityChat() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
      <AppBar
        title={t('chat.title')}
        subtitle={t('chat.subtitle')}
        back="/community"
        right={
          <TouchableOpacity
            onPress={() => router.push('/community/ai-chat')}
            style={styles.aiButton}
          >
            <Sparkles size={16} color={colors.primary} />
            <Text style={styles.aiButtonText}>{t('chat.ai')}</Text>
          </TouchableOpacity>
        }
      />
      <ChatLockGate>
        <ChatBody />
      </ChatLockGate>
    </View>
  );
}

function ChatBody() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const prefs = useUserPrefs();
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  // Newest 100 messages, streamed live. Single-field orderBy — no composite
  // index deployment needed. List renders inverted (newest at the bottom).
  useEffect(() => {
    const q = query(
      collection(db, 'chatMessages'),
      orderBy('createdAt', 'desc'),
      limit(100),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => setMessages(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (error) => console.warn('[chat] listener error:', error.message),
    );
    return unsubscribe;
  }, []);

  const send = async () => {
    const text = draft.trim();
    if (!text || !user || sending) return;
    setDraft('');
    setSending(true);
    try {
      await addDoc(collection(db, 'chatMessages'), {
        senderId: user.uid,
        senderName: user.displayName || prefs.fullName || 'Member',
        park: prefs.park,
        text,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.warn('[chat] send failed:', error.message);
      setDraft(text); // give the message back rather than losing it
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior="padding"
    >
      <FlatList
        ref={listRef}
        data={messages}
        inverted
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <MessageBubble message={item} own={item.senderId === user?.uid} />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>{t('chat.empty')}</Text>
          </View>
        }
      />
      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom - 8, 8) }]}>
        <TextInput
          placeholder={t('chat.placeholder')}
          placeholderTextColor={colors.mutedForeground}
          value={draft}
          onChangeText={setDraft}
          multiline
          style={styles.input}
        />
        <TouchableOpacity
          onPress={send}
          disabled={!draft.trim() || sending}
          style={[styles.sendBtn, (!draft.trim() || sending) && { opacity: 0.5 }]}
        >
          <Send size={18} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ message, own }) {
  return (
    <View style={[styles.messageRow, own && { flexDirection: 'row-reverse' }]}>
      {!own && (
        <View style={styles.msgAvatar}>
          <Text style={styles.msgAvatarText}>{initials(message.senderName)}</Text>
        </View>
      )}
      <View style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleOther]}>
        {!own && <Text style={styles.senderName}>{message.senderName}</Text>}
        <Text style={[styles.messageText, own && { color: colors.primaryForeground }]}>
          {message.text}
        </Text>
        <Text style={[styles.messageMeta, own && { color: 'rgba(255,255,255,0.7)' }]}>
          {formatReportTime(message.createdAt)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: alpha(colors.primary, 0.1),
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  aiButtonText: { fontSize: 12, fontFamily: fonts.semibold, color: colors.primary },
  list: { paddingHorizontal: 20, paddingVertical: 12, gap: 10 },
  emptyWrap: { paddingVertical: 48, alignItems: 'center' },
  emptyText: { fontSize: 13, color: colors.mutedForeground, fontFamily: fonts.regular },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgAvatar: {
    height: 28,
    width: 28,
    borderRadius: 999,
    backgroundColor: alpha(colors.primary, 0.15),
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgAvatarText: { fontSize: 10, fontFamily: fonts.bold, color: colors.primary },
  bubble: {
    maxWidth: '78%',
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleOwn: { backgroundColor: colors.primary, borderBottomRightRadius: radius.sm },
  bubbleOther: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  senderName: { fontSize: 11, fontFamily: fonts.semibold, color: colors.primary, marginBottom: 2 },
  messageText: { fontSize: 14, fontFamily: fonts.regular, color: colors.foreground, lineHeight: 20 },
  messageMeta: {
    fontSize: 9,
    fontFamily: fonts.regular,
    color: colors.mutedForeground,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
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
