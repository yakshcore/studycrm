'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { AppShell } from '@/components/AppShell';
import { MessageSkeleton } from '@/components/Skeleton';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/context/ToastContext';
import api from '@/lib/api';
import { io, Socket } from 'socket.io-client';
import type { Message, Student, DocRequestItem, FormAnswer } from '@/types';
import { DocRequestCard, FormRequestCard, FormResponseCard, ReplyQuote, Ticks } from '@/components/chat/MessageCards';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';
const API_BASE   = process.env.NEXT_PUBLIC_API_URL    || 'http://localhost:5000/api';

interface ConversationInfo {
  _id: string;
  participants: string[];
  updatedAt: string;
  lastMessage?: { text: string; senderId: string; createdAt: string; readBy?: string[] };
}

/** One-line preview of any message (for reply quotes) */
function msgPreview(msg: Message): string {
  if (msg.type === 'file')             return `📎 ${msg.fileName ?? 'File'}`;
  if (msg.type === 'document_request') return '📋 Documents requested';
  if (msg.type === 'form_request')     return `📝 ${msg.meta?.title ?? 'Details requested'}`;
  if (msg.type === 'form_response')    return '📝 Details submitted';
  return msg.text ?? '';
}

function FileContent({ msg, isMe }: { msg: Message; isMe: boolean }) {
  const ext  = msg.fileName?.split('.').pop()?.toLowerCase() ?? '';
  const isImg = ['jpg','jpeg','png','gif','webp','svg'].includes(ext);
  const href  = `${API_BASE.replace('/api','')}${msg.fileUrl}`;

  if (isImg) {
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={href} alt={msg.fileName} className="max-w-[220px] rounded-lg" />
      </a>
    );
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isMe ? 'bg-white/20' : 'bg-accent/15'}`}>
        <svg viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 ${isMe ? 'text-white' : 'text-accent'}`}>
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"/>
        </svg>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium truncate max-w-[150px]">{msg.fileName}</p>
        <p className={`text-xs ${isMe ? 'text-white/70' : 'text-t3'}`}>Tap to open</p>
      </div>
    </a>
  );
}

export default function ChatPage() {
  const { user, studentId } = useAuthStore();
  const { toast }           = useToast();

  const [conversation, setConversation] = useState<ConversationInfo | null>(null);
  const [messages, setMessages]         = useState<Message[]>([]);
  const [counsellor, setCounsellor]     = useState<{ _id: string; name: string } | null>(null);
  const [input, setInput]               = useState('');
  const [loading, setLoading]           = useState(true);
  const [sending, setSending]           = useState(false);
  const [uploading, setUploading]       = useState(false);
  const [isTyping, setIsTyping]         = useState(false);
  const [counsellorTyping, setCounsellorTyping] = useState(false);
  const [counsellorOnline, setCounsellorOnline] = useState(false);
  const [replyTo, setReplyTo]           = useState<Message | null>(null);
  const [reqUploadingId, setReqUploadingId] = useState<string | null>(null);
  const [formBusy, setFormBusy]         = useState(false);

  const socketRef    = useRef<Socket | null>(null);
  const bottomRef    = useRef<HTMLDivElement>(null);
  const typingTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const counsellorRef = useRef<string | null>(null);

  const myId = user?._id ?? '';

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  const markRead = useCallback((convId: string) => {
    api.post(`/messages/${convId}/read`).catch(() => {});
  }, []);

  // Load conversation + counsellor
  useEffect(() => {
    if (!studentId) return;
    api.get<Student>(`/students/${studentId}`).then(res => {
      const c = res.data.assignedCounsellor;
      if (!c) { setLoading(false); return; }
      setCounsellor(c);
      counsellorRef.current = c._id;
      return api.post<ConversationInfo>('/messages/conversation', { participantId: c._id });
    }).then(convRes => {
      if (!convRes) return;
      setConversation(convRes.data);
      return api.get<Message[]>(`/messages/${convRes.data._id}`);
    }).then(msgRes => {
      if (msgRes) {
        setMessages(msgRes.data);
        scrollToBottom();
        markRead(msgRes.data[0]?.conversationId ?? '');
      }
    }).catch(() => toast('Could not load chat', 'error')).finally(() => setLoading(false));
  }, [studentId, scrollToBottom, toast, markRead]);

  // Socket.io
  useEffect(() => {
    if (!conversation || !user) return;
    const socket = io(SOCKET_URL, { auth: { token: localStorage.getItem('student_token') } });
    socketRef.current = socket;
    socket.emit('join_room', conversation._id);

    socket.on('connect', () => {
      socket.emit('get_presence', (online: string[]) => {
        if (counsellorRef.current) setCounsellorOnline(online.includes(counsellorRef.current));
      });
    });
    // Initial presence check (socket may already be connected)
    socket.emit('get_presence', (online: string[]) => {
      if (counsellorRef.current) setCounsellorOnline(online.includes(counsellorRef.current));
    });

    socket.on('presence', ({ userId, online }: { userId: string; online: boolean }) => {
      if (userId === counsellorRef.current) setCounsellorOnline(online);
    });

    socket.on('receive_message', (msg: Message) => {
      setMessages(prev => {
        if (prev.some(m => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
      if (msg.senderId !== myId) markRead(conversation._id);
      scrollToBottom();
    });

    socket.on('message_updated', (msg: Message) => {
      setMessages(prev => prev.map(m => m._id === msg._id ? { ...m, ...msg } : m));
    });

    socket.on('messages_read', ({ userId }: { conversationId: string; userId: string }) => {
      if (userId !== myId) {
        setMessages(prev => prev.map(m =>
          m.readBy?.includes(userId) ? m : { ...m, readBy: [...(m.readBy ?? []), userId] }
        ));
      }
    });

    socket.on('typing', ({ userId, isTyping: t }: { userId: string; isTyping: boolean }) => {
      if (userId !== user._id) setCounsellorTyping(t);
    });

    return () => { socket.emit('leave_room', conversation._id); socket.disconnect(); };
  }, [conversation, user, scrollToBottom, markRead, myId]);

  function emitTyping(active: boolean) {
    if (!conversation || !socketRef.current) return;
    socketRef.current.emit('typing', { roomId: conversation._id, userId: myId, isTyping: active });
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInput(e.target.value);
    if (!isTyping) { setIsTyping(true); emitTyping(true); }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => { setIsTyping(false); emitTyping(false); }, 1500);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !conversation || !user) return;
    const text = input.trim();
    const reply = replyTo;
    setInput('');
    setReplyTo(null);
    setSending(true);
    emitTyping(false);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    try {
      await api.post('/messages/send', {
        conversationId: conversation._id,
        text,
        replyTo: reply ? { messageId: reply._id, senderName: reply.senderName, preview: msgPreview(reply) } : undefined,
      });
    } catch {
      toast('Failed to send message', 'error');
      setInput(text);
      setReplyTo(reply);
    } finally {
      setSending(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !conversation) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('conversationId', conversation._id);
      if (studentId) form.append('studentId', studentId);

      const token = localStorage.getItem('student_token');
      const res   = await fetch(`${API_BASE}/messages/send-file`, {
        method:  'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body:    form,
      });
      if (!res.ok) throw new Error('Upload failed');
      toast('File sent!', 'success');
    } catch {
      toast('Failed to send file', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  /* ── Upload for a counsellor's document request ────────────────────────── */
  async function handleRequestUpload(item: DocRequestItem, file: File) {
    if (!studentId || !conversation) return;
    setReqUploadingId(item.requestId);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('studentId', studentId);
      form.append('type', item.type);
      if (item.label) form.append('label', item.label);
      form.append('requestId', item.requestId);
      form.append('conversationId', conversation._id);

      const token = localStorage.getItem('student_token');
      const res   = await fetch(`${API_BASE}/documents/upload`, {
        method:  'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body:    form,
      });
      if (!res.ok) throw new Error('Upload failed');
      toast('Document uploaded!', 'success');
    } catch {
      toast('Upload failed', 'error');
    } finally {
      setReqUploadingId(null);
    }
  }

  /* ── Submit an in-chat form ────────────────────────────────────────────── */
  async function handleFormSubmit(formMessageId: string, answers: FormAnswer[]) {
    if (!conversation) return;
    setFormBusy(true);
    try {
      await api.post('/messages/form-response', {
        conversationId: conversation._id,
        formMessageId,
        answers,
      });
      toast('Answers sent!', 'success');
    } catch {
      toast('Failed to send answers', 'error');
    } finally {
      setFormBusy(false);
    }
  }

  return (
    <AppShell title="Chat">
      <div className="flex flex-col h-full max-h-screen">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 sm:px-6 py-3.5 border-b border-line glass-nav flex-shrink-0">
          {counsellor ? (
            <>
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-full bg-accent/20 text-accent text-sm font-bold flex items-center justify-center">
                  {counsellor.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                {counsellorOnline && (
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-surface" />
                )}
              </div>
              <div>
                <p className="font-semibold text-t1 text-sm">{counsellor.name}</p>
                <p className="text-xs text-t3">
                  {counsellorTyping
                    ? <span className="text-accent">typing…</span>
                    : counsellorOnline
                      ? <span className="text-emerald-500">online</span>
                      : 'Your Counsellor'}
                </p>
              </div>
            </>
          ) : (
            <p className="text-t2 text-sm">Chat</p>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-1 min-h-0">
          {loading ? (
            <MessageSkeleton />
          ) : !counsellor ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="text-4xl mb-3">💬</div>
              <p className="text-t2 font-medium">No counsellor assigned yet</p>
              <p className="text-t3 text-sm mt-1">Once a counsellor is assigned to you, you can chat here.</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="text-4xl mb-3">👋</div>
              <p className="text-t2 font-medium">Start a conversation</p>
              <p className="text-t3 text-sm mt-1">Say hello to your counsellor!</p>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => {
                const isMe     = msg.senderId === myId;
                const showDate = idx === 0 || new Date(msg.createdAt).toDateString() !== new Date(messages[idx - 1].createdAt).toDateString();
                const read     = !!(counsellor && msg.readBy?.includes(counsellor._id));
                const isCard   = msg.type === 'document_request' || msg.type === 'form_request' || msg.type === 'form_response';

                if (msg.type === 'system') {
                  return (
                    <div key={msg._id} className="flex justify-center my-3">
                      <span className="text-xs text-t3 bg-muted px-3 py-1 rounded-full">{msg.text}</span>
                    </div>
                  );
                }

                return (
                  <div key={msg._id}>
                    {showDate && (
                      <div className="flex justify-center my-3">
                        <span className="text-xs text-t3 bg-muted px-3 py-1 rounded-full">
                          {new Date(msg.createdAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    )}
                    <div className={`group flex ${isMe ? 'justify-end' : 'justify-start'} gap-2 py-1`}>
                      {!isMe && (
                        <div className="w-7 h-7 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center flex-shrink-0 self-end mb-4">
                          {msg.senderName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                      )}

                      {isMe && (
                        <button
                          onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }}
                          title="Reply"
                          className="self-center opacity-0 group-hover:opacity-100 transition text-t3 hover:text-accent p-1"
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd"/>
                          </svg>
                        </button>
                      )}

                      <div className={`${isCard ? '' : 'max-w-[75%]'} space-y-0.5`}>
                        {isCard ? (
                          <>
                            {msg.type === 'document_request' && (
                              <DocRequestCard msg={msg} onUpload={handleRequestUpload} uploadingId={reqUploadingId} />
                            )}
                            {msg.type === 'form_request' && (
                              <FormRequestCard
                                msg={msg}
                                canAnswer={!isMe}
                                onSubmit={handleFormSubmit}
                                busy={formBusy}
                              />
                            )}
                            {msg.type === 'form_response' && <FormResponseCard msg={msg} />}
                          </>
                        ) : (
                          <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                            isMe
                              ? 'bg-gradient-to-br from-accent to-accent/75 text-white rounded-br-md glow-accent-sm'
                              : 'glass-card text-t1 rounded-bl-md'
                          }`}>
                            {msg.replyTo && <ReplyQuote replyTo={msg.replyTo} isMe={isMe} />}
                            {msg.type === 'file' ? <FileContent msg={msg} isMe={isMe} /> : msg.text}
                          </div>
                        )}
                        <p className={`text-xs text-t3 px-1 flex items-center gap-1 ${isMe ? 'justify-end' : ''}`}>
                          {new Date(msg.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          {isMe && <Ticks read={read} />}
                        </p>
                      </div>

                      {!isMe && (
                        <button
                          onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }}
                          title="Reply"
                          className="self-center opacity-0 group-hover:opacity-100 transition text-t3 hover:text-accent p-1"
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Typing indicator */}
              {counsellorTyping && (
                <div className="flex items-center gap-2 pl-9 py-1">
                  <div className="flex items-center gap-1 px-4 py-2.5 rounded-2xl rounded-bl-md glass-card">
                    <span className="w-1.5 h-1.5 rounded-full bg-t3 typing-dot" />
                    <span className="w-1.5 h-1.5 rounded-full bg-t3 typing-dot" />
                    <span className="w-1.5 h-1.5 rounded-full bg-t3 typing-dot" />
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Reply banner */}
        {counsellor && replyTo && (
          <div className="flex-shrink-0 px-4 sm:px-6 pt-2 glass-nav border-t border-line">
            <div className="flex items-center gap-2 bg-muted border-l-2 border-accent rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-accent">Replying to {replyTo.senderName}</p>
                <p className="text-xs text-t2 truncate">{msgPreview(replyTo)}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="text-t3 hover:text-t1 text-lg leading-none px-1">×</button>
            </div>
          </div>
        )}

        {/* Input */}
        {counsellor && (
          <form
            onSubmit={handleSend}
            className={`flex-shrink-0 px-4 sm:px-6 py-3 glass-nav flex items-center gap-2 ${replyTo ? '' : 'border-t border-line'}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            />

            <button
              type="button"
              disabled={uploading || !conversation}
              onClick={() => fileInputRef.current?.click()}
              title="Send a file or document"
              className="w-10 h-10 rounded-xl text-t3 hover:text-t1 hover:bg-muted flex items-center justify-center disabled:opacity-40 transition flex-shrink-0"
            >
              {uploading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd"/>
                </svg>
              )}
            </button>

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={handleInputChange}
              placeholder="Message your counsellor…"
              disabled={loading || !conversation}
              className="flex-1 bg-muted border border-line rounded-xl px-4 py-2.5 text-sm text-t1 placeholder:text-t3 focus:outline-none focus:border-accent transition disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending || !conversation}
              className="w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center disabled:opacity-40 hover:bg-accent/90 transition active:scale-95 flex-shrink-0 glow-accent-sm"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4.5 h-4.5 -rotate-45">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
              </svg>
            </button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
