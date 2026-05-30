'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/context/ToastContext';
import type { Conversation, Message } from '@/types';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';
const API_BASE   = process.env.NEXT_PUBLIC_API_URL    || 'http://localhost:5000/api';

/* ─── helpers ─────────────────────────────────────────────────────────────── */
function getOther(conv: Conversation, myId: string) {
  return conv.participants.find(p => p._id !== myId) ?? conv.participants[0];
}

function getInitials(name: string) {
  return (name ?? '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function shortPreview(text?: string) {
  if (!text) return '';
  return text.length > 45 ? text.slice(0, 42) + '…' : text;
}

/* ─── FileMessage sub-component ───────────────────────────────────────────── */
function FileMessage({ msg, isMe }: { msg: Message; isMe: boolean }) {
  const ext    = msg.fileName?.split('.').pop()?.toLowerCase() ?? '';
  const isImg  = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
  const href   = `${API_BASE.replace('/api', '')}${msg.fileUrl}`;

  return (
    <div className="max-w-[70%] space-y-0.5">
      <div className={`px-3 py-2.5 rounded-2xl text-sm ${
        isMe
          ? 'bg-gradient-to-br from-accent to-accent/70 text-white rounded-br-md'
          : 'bg-card border border-line text-t1 rounded-bl-md'
      }`}>
        {isImg ? (
          <a href={href} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={href} alt={msg.fileName} className="max-w-[200px] rounded-lg" />
          </a>
        ) : (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isMe ? 'bg-white/20' : 'bg-accent/15'}`}>
              <svg viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 ${isMe ? 'text-white' : 'text-accent'}`}>
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"/>
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate max-w-[150px]">{msg.fileName}</p>
              <p className={`text-xs ${isMe ? 'text-white/70' : 'text-t3'}`}>Click to open</p>
            </div>
          </a>
        )}
      </div>
      <p className={`text-xs text-t3 px-1 ${isMe ? 'text-right' : ''}`}>
        {fmtTime(msg.createdAt)}
      </p>
    </div>
  );
}

/* ─── Conversation list skeleton ──────────────────────────────────────────── */
function ConvSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-line">
          <div className="w-10 h-10 rounded-full bg-muted animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-muted animate-pulse rounded w-2/5" />
            <div className="h-2.5 bg-muted animate-pulse rounded w-3/5" />
          </div>
        </div>
      ))}
    </>
  );
}

/* ─── Message area skeleton ───────────────────────────────────────────────── */
function MsgSkeleton() {
  return (
    <div className="space-y-4 px-5 py-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={`flex gap-2 ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
          {i % 2 === 0 && <div className="w-7 h-7 rounded-full bg-muted animate-pulse flex-shrink-0 self-end" />}
          <div className={`h-10 bg-muted animate-pulse rounded-2xl ${i % 2 === 0 ? 'w-52 rounded-bl-md' : 'w-44 rounded-br-md'}`} />
        </div>
      ))}
    </div>
  );
}

/* ─── Main chat inner component (needs Suspense for useSearchParams) ─────── */
function ChatInner() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const withUserId   = searchParams.get('with'); // optional: open/create conv with this userId

  const [conversations,  setConversations]  = useState<Conversation[]>([]);
  const [activeConv,     setActiveConv]     = useState<Conversation | null>(null);
  const [messages,       setMessages]       = useState<Message[]>([]);
  const [input,          setInput]          = useState('');
  const [loading,        setLoading]        = useState(true);
  const [msgLoading,     setMsgLoading]     = useState(false);
  const [sending,        setSending]        = useState(false);
  const [uploading,      setUploading]      = useState(false);
  const [otherTyping,    setOtherTyping]    = useState(false);
  const [isTyping,       setIsTyping]       = useState(false);
  const [search,         setSearch]         = useState('');
  const [mobileView,     setMobileView]     = useState<'list' | 'messages'>('list');

  const socketRef      = useRef<Socket | null>(null);
  const bottomRef      = useRef<HTMLDivElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const typingTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeConvRef  = useRef<string | null>(null);

  const myId = user?._id ?? '';

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
  }, []);

  /* ── Load conversations on mount ───────────────────────────────────────── */
  useEffect(() => {
    api.get<Conversation[]>('/messages/conversations')
      .then(res => {
        setConversations(res.data);
        if (withUserId) {
          const existing = res.data.find(c =>
            c.participants.some(p => p._id === withUserId)
          );
          if (existing) {
            openConversation(existing);
          } else {
            // Create new conversation, then reload list
            api.post<Conversation>('/messages/conversation', { participantId: withUserId })
              .then(() => api.get<Conversation[]>('/messages/conversations'))
              .then(res2 => {
                setConversations(res2.data);
                const found = res2.data.find(c =>
                  c.participants.some(p => p._id === withUserId)
                );
                if (found) openConversation(found);
              })
              .catch(() => toast('Could not open conversation', 'error'));
          }
        }
      })
      .catch(() => toast('Could not load conversations', 'error'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withUserId]);

  /* ── Socket connection ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (!user) return;
    const token  = localStorage.getItem('crm_token');
    const socket = io(SOCKET_URL, { auth: { token } });
    socketRef.current = socket;

    socket.on('receive_message', (msg: Message) => {
      const cid = msg.conversationId;

      // Bubble conversation to top & update last message
      setConversations(prev => {
        const idx = prev.findIndex(c => c._id === cid);
        if (idx === -1) return prev;
        const updated: Conversation = {
          ...prev[idx],
          lastMessage: {
            text:      msg.text ?? msg.fileName ?? '📎 File',
            senderId:  typeof msg.senderId === 'string' ? msg.senderId : (msg.senderId as { _id: string })._id,
            createdAt: msg.createdAt,
          },
          updatedAt: msg.createdAt,
        };
        return [updated, ...prev.filter((_, i) => i !== idx)];
      });

      // Append to open conversation
      if (activeConvRef.current === cid) {
        setMessages(prev => prev.some(m => m._id === msg._id) ? prev : [...prev, msg]);
        scrollToBottom();
      }
    });

    socket.on('typing', ({ userId, isTyping: t }: { userId: string; isTyping: boolean }) => {
      if (userId !== myId) setOtherTyping(t);
    });

    return () => { socket.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /* ── Open a conversation ───────────────────────────────────────────────── */
  const openConversation = useCallback((conv: Conversation) => {
    // Leave old room
    if (activeConvRef.current && socketRef.current) {
      socketRef.current.emit('leave_room', activeConvRef.current);
    }
    setActiveConv(conv);
    activeConvRef.current = conv._id;
    setOtherTyping(false);
    setMessages([]);
    setMsgLoading(true);
    setMobileView('messages');

    if (socketRef.current) socketRef.current.emit('join_room', conv._id);

    api.get<Message[]>(`/messages/${conv._id}`)
      .then(res => { setMessages(res.data); scrollToBottom(); })
      .catch(() => toast('Could not load messages', 'error'))
      .finally(() => setMsgLoading(false));
  }, [scrollToBottom, toast]);

  /* ── Typing helpers ────────────────────────────────────────────────────── */
  function emitTyping(active: boolean) {
    if (!activeConvRef.current || !socketRef.current) return;
    socketRef.current.emit('typing', { roomId: activeConvRef.current, isTyping: active });
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInput(e.target.value);
    if (!isTyping) { setIsTyping(true); emitTyping(true); }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => { setIsTyping(false); emitTyping(false); }, 1500);
  }

  /* ── Send text ─────────────────────────────────────────────────────────── */
  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !activeConv) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    emitTyping(false);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    try {
      await api.post('/messages/send', { conversationId: activeConv._id, text });
    } catch {
      toast('Failed to send message', 'error');
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  /* ── Send file ─────────────────────────────────────────────────────────── */
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeConv) return;
    setUploading(true);
    try {
      const form  = new FormData();
      form.append('file', file);
      form.append('conversationId', activeConv._id);
      const token = localStorage.getItem('crm_token');
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

  /* ── Filtered conversations ────────────────────────────────────────────── */
  const filtered = conversations.filter(conv => {
    if (!search.trim()) return true;
    const other = getOther(conv, myId);
    return other?.name?.toLowerCase().includes(search.toLowerCase());
  });

  const otherParticipant = activeConv ? getOther(activeConv, myId) : null;

  /* ─────────────────────────────────────────────────────────────────────── */
  return (
    <div className="flex h-full overflow-hidden">

      {/* ══ Conversation sidebar ═════════════════════════════════════════════ */}
      <div className={`
        ${mobileView === 'messages' ? 'hidden' : 'flex'} lg:flex
        flex-col w-full lg:w-72 xl:w-80 border-r border-line flex-shrink-0 bg-surface
      `}>
        {/* Header */}
        <div className="px-4 pt-5 pb-3 border-b border-line space-y-3">
          <h1 className="text-lg font-bold text-t1">Chat</h1>
          <div className="relative">
            <svg viewBox="0 0 20 20" fill="currentColor" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-t3 pointer-events-none">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search students…"
              className="w-full bg-muted border border-line rounded-xl pl-8 pr-3 py-2 text-sm text-t1 placeholder:text-t3 focus:outline-none focus:border-accent transition"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <ConvSkeleton />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16 px-6">
              <p className="text-3xl mb-2">💬</p>
              <p className="text-sm font-medium text-t2">No conversations yet</p>
              <p className="text-xs text-t3 mt-1 leading-relaxed">
                Open a student's profile and click&nbsp;<strong>Chat</strong> to start a conversation.
              </p>
            </div>
          ) : (
            filtered.map(conv => {
              const other    = getOther(conv, myId);
              const isActive = activeConv?._id === conv._id;
              const lastText = conv.lastMessage?.text;
              const lastTime = conv.lastMessage?.createdAt
                ? fmtTime(conv.lastMessage.createdAt)
                : '';

              return (
                <button
                  key={conv._id}
                  onClick={() => openConversation(conv)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors border-b border-line last:border-0 ${
                    isActive
                      ? 'bg-accent/10 border-l-[3px] border-l-accent'
                      : 'hover:bg-muted'
                  }`}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-accent/20 text-accent text-sm font-bold flex items-center justify-center flex-shrink-0">
                    {other ? getInitials(other.name) : '?'}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-sm font-semibold truncate ${isActive ? 'text-accent' : 'text-t1'}`}>
                        {other?.name ?? 'Unknown'}
                      </p>
                      {lastTime && (
                        <span className="text-[11px] text-t3 flex-shrink-0">{lastTime}</span>
                      )}
                    </div>
                    <p className="text-xs text-t3 truncate mt-0.5">
                      {shortPreview(lastText) || 'No messages yet'}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ══ Message pane ═════════════════════════════════════════════════════ */}
      <div className={`
        ${mobileView === 'list' ? 'hidden' : 'flex'} lg:flex
        flex-col flex-1 min-w-0 bg-base
      `}>
        {!activeConv ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-accent/15 flex items-center justify-center mb-4">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-accent">
                <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.39.39 0 00-.297.17l-2.755 4.133a.75.75 0 01-1.248 0l-2.755-4.133a.39.39 0 00-.297-.17 48.9 48.9 0 01-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97z" clipRule="evenodd"/>
              </svg>
            </div>
            <p className="text-t1 font-semibold text-base">Select a conversation</p>
            <p className="text-t3 text-sm mt-1.5 max-w-xs leading-relaxed">
              Choose a student from the list, or open their profile and click <strong className="text-t2">Chat</strong> to start.
            </p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-line bg-surface flex-shrink-0">
              {/* Mobile back */}
              <button
                onClick={() => setMobileView('list')}
                className="lg:hidden p-1.5 rounded-lg text-t2 hover:bg-muted -ml-1 flex-shrink-0"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/>
                </svg>
              </button>
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-accent/20 text-accent text-sm font-bold flex items-center justify-center flex-shrink-0">
                {otherParticipant ? getInitials(otherParticipant.name) : '?'}
              </div>
              {/* Name + status */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-t1 text-sm leading-tight">
                  {otherParticipant?.name ?? 'Unknown'}
                </p>
                <p className="text-xs text-t3">
                  {otherParticipant?.role === 'student' ? 'Student' : (otherParticipant?.role ?? '')}
                  {otherTyping && <span className="ml-1 text-accent">· typing…</span>}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-3 min-h-0">
              {msgLoading ? (
                <MsgSkeleton />
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-16">
                  <p className="text-4xl mb-3">👋</p>
                  <p className="text-t2 font-medium">No messages yet</p>
                  <p className="text-t3 text-sm mt-1">Send the first message!</p>
                </div>
              ) : (
                <>
                  {messages.map((msg, idx) => {
                    const sid    = typeof msg.senderId === 'object'
                      ? (msg.senderId as { _id: string })._id
                      : msg.senderId;
                    const isMe   = sid === myId;
                    const name   = msg.senderName ?? (typeof msg.senderId === 'object' ? (msg.senderId as { name: string }).name : '');
                    const showDate = idx === 0 ||
                      new Date(msg.createdAt).toDateString() !== new Date(messages[idx - 1].createdAt).toDateString();

                    return (
                      <div key={msg._id}>
                        {/* Date separator */}
                        {showDate && (
                          <div className="flex justify-center my-3">
                            <span className="text-xs text-t3 bg-muted px-3 py-1 rounded-full">
                              {fmtDate(msg.createdAt)}
                            </span>
                          </div>
                        )}
                        {/* Bubble */}
                        <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-2`}>
                          {!isMe && (
                            <div className="w-7 h-7 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center flex-shrink-0 self-end mb-0.5">
                              {getInitials(name)}
                            </div>
                          )}
                          {msg.type === 'file' ? (
                            <FileMessage msg={msg} isMe={isMe} />
                          ) : (
                            <div className="max-w-[70%] space-y-0.5">
                              <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                isMe
                                  ? 'bg-gradient-to-br from-accent to-accent/75 text-white rounded-br-md'
                                  : 'bg-card border border-line text-t1 rounded-bl-md'
                              }`}>
                                {msg.text}
                              </div>
                              <p className={`text-xs text-t3 px-1 ${isMe ? 'text-right' : ''}`}>
                                {fmtTime(msg.createdAt)}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Typing indicator */}
                  {otherTyping && (
                    <div className="flex items-center gap-2 pl-9">
                      <div className="flex items-center gap-1 px-4 py-2.5 rounded-2xl rounded-bl-md bg-card border border-line">
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

            {/* Input bar */}
            <form
              onSubmit={handleSend}
              className="flex-shrink-0 px-4 sm:px-5 py-3 border-t border-line bg-surface flex items-center gap-2"
            >
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              />
              {/* Attachment button */}
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                title="Send a file"
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
              {/* Text input */}
              <input
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder="Message…"
                className="flex-1 bg-muted border border-line rounded-xl px-4 py-2.5 text-sm text-t1 placeholder:text-t3 focus:outline-none focus:border-accent transition"
              />
              {/* Send */}
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className="w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center disabled:opacity-40 hover:bg-accent/90 transition active:scale-95 flex-shrink-0"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 -rotate-45">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
                </svg>
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Page wrapper (Suspense for useSearchParams) ──────────────────────────── */
export default function ChatPage() {
  return (
    <div className="h-full overflow-hidden">
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-full">
            <p className="text-t3 text-sm">Loading…</p>
          </div>
        }
      >
        <ChatInner />
      </Suspense>
    </div>
  );
}
