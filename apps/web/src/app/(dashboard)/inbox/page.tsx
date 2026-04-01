'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useChatStore } from '@/stores/chat.store';
import { connectSocket } from '@/lib/socket';
import { api, Message, Conversation, TeamMember, CannedResponse, Label } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function resolveMediaUrl(content: string, sourceId?: string): string {
  // Base64 data URL — use directly
  if (content?.startsWith('data:')) {
    return content;
  }

  // Proxy URL — prepend API base
  if (content?.startsWith('/api/')) {
    return `${API_URL}${content}`;
  }

  // Full URL — use as-is
  if (content?.startsWith('http')) {
    return content;
  }

  // Fallback: construct proxy URL from sourceId
  if (sourceId) {
    return `${API_URL}/api/media/line/${sourceId}`;
  }

  return '';
}

const channelColors: Record<string, string> = {
  line: 'bg-[#06C755]',
  facebook: 'bg-blue-600',
  instagram: 'bg-gradient-to-tr from-purple-500 via-pink-500 to-orange-400',
};

const channelIcons: Record<string, string> = {
  line: 'LINE',
  facebook: 'FB',
  instagram: 'IG',
};

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function ConversationItem({
  conv,
  isActive,
  unreadCount,
  onClick,
}: {
  conv: Conversation;
  isActive: boolean;
  unreadCount: number;
  onClick: () => void;
}) {
  const lastMsgObj = conv.messages?.[0];
  const lastMsg = lastMsgObj
    ? lastMsgObj.contentType === 'image' || lastMsgObj.content?.startsWith('/api/media/')
      ? '📷 รูปภาพ'
      : lastMsgObj.contentType === 'sticker'
        ? '🎉 Sticker'
        : lastMsgObj.contentType === 'video'
          ? '🎬 วิดีโอ'
          : lastMsgObj.contentType === 'audio'
            ? '🎵 เสียง'
            : lastMsgObj.content || ''
    : '';
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
        isActive
          ? 'bg-[#06C755]/10 border-l-[3px] border-[#06C755]'
          : 'hover:bg-gray-50 border-l-[3px] border-transparent'
      }`}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {conv.contact.avatarUrl ? (
          <img
            src={conv.contact.avatarUrl}
            alt={conv.contact.name}
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-600">
            {getInitials(conv.contact.name || '?')}
          </div>
        )}
        {/* Channel indicator */}
        <span
          className={`absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-white ring-2 ring-white ${
            channelColors[conv.inbox.channelType] || 'bg-gray-400'
          }`}
        >
          {conv.inbox.channelType === 'line' ? 'L' : conv.inbox.channelType === 'facebook' ? 'F' : 'I'}
        </span>
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="truncate text-sm font-semibold text-gray-900">
            {conv.contact.name || 'Unknown'}
          </span>
          <span className="flex-shrink-0 text-xs text-gray-400">
            {formatTime(conv.lastActivityAt)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <p className="truncate text-xs text-gray-500">{lastMsg || 'No messages yet'}</p>
          {unreadCount > 0 && !isActive && (
            <span className="ml-2 flex h-5 min-w-[20px] flex-shrink-0 items-center justify-center rounded-full bg-[#06C755] px-1.5 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function StickerView({ attrs }: { attrs?: Record<string, unknown> }) {
  const stickerId = attrs?.stickerId != null ? String(attrs.stickerId) : undefined;
  const packageId = attrs?.packageId != null ? String(attrs.packageId) : undefined;

  if (!stickerId) {
    return (
      <div className="flex h-[80px] w-[80px] items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
        <span className="text-3xl">😊</span>
      </div>
    );
  }

  // Try multiple LINE sticker CDN formats
  const urls = [
    `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/android/sticker.png`,
    `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/iPhone/sticker@2x.png`,
    `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/iPhone/sticker.png`,
  ];

  return (
    <img
      src={urls[0]}
      alt="sticker"
      className="h-[120px] w-[120px] object-contain"
      data-urls={JSON.stringify(urls)}
      data-url-index="0"
      onError={(e) => {
        const img = e.target as HTMLImageElement;
        const allUrls = JSON.parse(img.dataset.urls || '[]');
        const currentIndex = parseInt(img.dataset.urlIndex || '0');
        const nextIndex = currentIndex + 1;
        if (nextIndex < allUrls.length) {
          img.dataset.urlIndex = String(nextIndex);
          img.src = allUrls[nextIndex];
        } else {
          // All URLs failed — show emoji fallback
          img.style.display = 'none';
          const fallback = document.createElement('div');
          fallback.className = 'flex h-[80px] w-[80px] items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-gray-100';
          fallback.innerHTML = '<span class="text-3xl">😊</span>';
          img.parentElement?.appendChild(fallback);
        }
      }}
    />
  );
}

function ChatBubble({ msg, isLast, onImageClick }: { msg: Message; isLast: boolean; onImageClick?: (url: string) => void }) {
  const isIncoming = msg.messageType === 'incoming';
  const isBot = msg.senderType === 'Bot';
  const isPrivate = msg.private === true;
  const isSticker = msg.contentType === 'sticker';
  const isImage = msg.contentType === 'image';

  // Private note — yellow bubble, always right-aligned
  if (isPrivate) {
    return (
      <div className="flex items-end gap-2 justify-end">
        <span className="mb-1 text-[10px] text-gray-400">{formatTime(msg.createdAt)}</span>
        <div className="relative max-w-[70%] rounded-2xl rounded-br-md bg-yellow-100 px-4 py-2.5 text-gray-800 ring-1 ring-yellow-200">
          <div className="mb-0.5 flex items-center gap-1 text-[10px] font-medium text-yellow-700">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            Private Note
          </div>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.content}</p>
        </div>
      </div>
    );
  }

  // Sticker - no bubble background
  if (isSticker) {
    return (
      <div className={`flex items-end gap-2 ${isIncoming ? 'justify-start' : 'justify-end'}`}>
        {!isIncoming && <span className="mb-1 text-[10px] text-gray-400">{formatTime(msg.createdAt)}</span>}
        <StickerView attrs={msg.contentAttributes} />
        {isIncoming && <span className="mb-1 text-[10px] text-gray-400">{formatTime(msg.createdAt)}</span>}
      </div>
    );
  }

  // Image - no bubble background, just the image
  if (isImage) {
    const imgUrl = resolveMediaUrl(msg.content, msg.sourceId);
    return (
      <div className={`flex items-end gap-2 ${isIncoming ? 'justify-start' : 'justify-end'}`}>
        {!isIncoming && <span className="mb-1 text-[10px] text-gray-400">{formatTime(msg.createdAt)}</span>}
        {imgUrl ? (
          <img
            src={imgUrl}
            alt=""
            className="max-w-[240px] cursor-pointer rounded-2xl shadow-sm transition hover:opacity-90"
            onClick={() => onImageClick?.(imgUrl)}
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              img.style.display = 'none';
              img.parentElement?.insertAdjacentHTML('beforeend',
                '<div class="flex items-center gap-1.5 rounded-2xl bg-white px-4 py-3 text-xs text-gray-400 shadow-sm ring-1 ring-gray-100"><svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"/></svg>Image expired</div>');
            }}
          />
        ) : (
          <div className="flex items-center gap-1.5 rounded-2xl bg-white px-4 py-3 text-xs text-gray-400 shadow-sm ring-1 ring-gray-100">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
            </svg>
            Image
          </div>
        )}
        {isIncoming && <span className="mb-1 text-[10px] text-gray-400">{formatTime(msg.createdAt)}</span>}
      </div>
    );
  }

  return (
    <div
      className={`flex items-end gap-2 ${isIncoming ? 'justify-start' : 'justify-end'}`}
    >
      {!isIncoming && (
        <span className="mb-1 text-[10px] text-gray-400">
          {formatTime(msg.createdAt)}
        </span>
      )}

      <div
        className={`relative max-w-[70%] px-4 py-2.5 ${
          isIncoming
            ? 'rounded-2xl rounded-bl-md bg-white text-gray-900 shadow-sm ring-1 ring-gray-100'
            : isBot
              ? 'rounded-2xl rounded-br-md bg-purple-500 text-white'
              : 'rounded-2xl rounded-br-md bg-indigo-600 text-white'
        }`}
      >
        {isBot && (
          <div className="mb-0.5 flex items-center gap-1 text-[10px] font-medium opacity-80">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            AI Assistant
          </div>
        )}
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.content}</p>
      </div>

      {isIncoming && (
        <span className="mb-1 text-[10px] text-gray-400">
          {formatTime(msg.createdAt)}
        </span>
      )}
    </div>
  );
}

// LINE Messaging API sendable sticker packages
// See: https://developers.line.biz/en/docs/messaging-api/sticker-list/
const STICKER_PACKAGES = [
  {
    packageId: '446',
    name: 'Moon',
    stickers: ['1988','1989','1990','1991','1992','1993','1994','1995','1996','1997','1998','1999','2000','2001','2002','2003','2004','2005','2006','2007','2008','2009','2010','2011','2012','2013','2014','2015','2016','2017','2018','2019','2020','2021','2022','2023','2024','2025','2026','2027'],
  },
  {
    packageId: '789',
    name: 'Brown & Cony',
    stickers: ['10855','10856','10857','10858','10859','10860','10861','10862','10863','10864','10865','10866','10867','10868','10869','10870','10871','10872','10873','10874','10875','10876','10877','10878','10879','10880','10881','10882','10883','10884','10885','10886','10887','10888','10889','10890','10891','10892','10893','10894'],
  },
  {
    packageId: '6362',
    name: 'Brown Special',
    stickers: ['11087920','11087921','11087922','11087923','11087924','11087925','11087926','11087927','11087928','11087929','11087930','11087931','11087932','11087933','11087934','11087935','11087936','11087937','11087938','11087939','11087940','11087941','11087942','11087943'],
  },
];

function StickerPicker({ onSelect, onClose }: { onSelect: (packageId: string, stickerId: string) => void; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState(0);
  const pkg = STICKER_PACKAGES[activeTab];
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div ref={panelRef} className="absolute bottom-12 right-0 z-50 w-[320px] rounded-xl border border-gray-200 bg-white shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
        <span className="text-xs font-semibold text-gray-600">Stickers</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {/* Package tabs */}
      <div className="flex gap-1 border-b border-gray-100 px-2 py-1.5">
        {STICKER_PACKAGES.map((p, i) => (
          <button
            key={p.packageId}
            onClick={() => setActiveTab(i)}
            className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
              activeTab === i ? 'bg-[#06C755] text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>
      {/* Sticker grid */}
      <div className="grid max-h-[240px] grid-cols-4 gap-1 overflow-y-auto p-2">
        {pkg.stickers.map((stickerId) => (
          <button
            key={stickerId}
            onClick={() => onSelect(pkg.packageId, stickerId)}
            className="flex items-center justify-center rounded-lg p-1 transition hover:bg-gray-100"
          >
            <img
              src={`https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/iPhone/sticker@2x.png`}
              alt=""
              className="h-16 w-16 object-contain"
              crossOrigin="anonymous"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                // Try android format as fallback
                if (!img.dataset.retried) {
                  img.dataset.retried = '1';
                  img.src = `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/android/sticker.png`;
                } else {
                  img.style.opacity = '0.3';
                }
              }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function InboxPage() {
  const {
    conversations,
    activeConversation,
    messages,
    fetchConversations,
    setActiveConversation,
    addMessage,
    sendMessage,
    getUnreadCount,
    updateConversation,
  } = useChatStore();

  const [input, setInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [showInfo, setShowInfo] = useState(true);
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '' });
  const [savingContact, setSavingContact] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [sendingNote, setSendingNote] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);
  const [showCannedMenu, setShowCannedMenu] = useState(false);
  const [cannedFilter, setCannedFilter] = useState('');
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [convLabels, setConvLabels] = useState<{ id: number; label: Label }[]>([]);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [readAt, setReadAt] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const assignDropdownRef = useRef<HTMLDivElement>(null);
  const labelPickerRef = useRef<HTMLDivElement>(null);

  // Initialize notification sound + data
  const notifAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Load team members, canned responses, labels
    api.getTeam().then(setTeamMembers).catch(() => {});
    api.getCannedResponses().then(setCannedResponses).catch(() => {});
    api.getLabels().then(setAllLabels).catch(() => {});

    // Generate a small WAV notification beep and preload it
    try {
      const sampleRate = 8000;
      const duration = 0.3;
      const numSamples = Math.floor(sampleRate * duration);
      const buffer = new ArrayBuffer(44 + numSamples * 2);
      const view = new DataView(buffer);

      // WAV header
      const writeStr = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
      };
      writeStr(0, 'RIFF');
      view.setUint32(4, 36 + numSamples * 2, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeStr(36, 'data');
      view.setUint32(40, numSamples * 2, true);

      // Generate two-tone beep
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const freq = t < 0.15 ? 880 : 1100;
        const envelope = Math.max(0, 1 - t / duration);
        const sample = Math.sin(2 * Math.PI * freq * t) * envelope * 0.4;
        view.setInt16(44 + i * 2, Math.floor(sample * 32767), true);
      }

      const blob = new Blob([buffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = 0.6;
      notifAudioRef.current = audio;
    } catch {
      // Audio generation failed
    }
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      if (notifAudioRef.current) {
        notifAudioRef.current.currentTime = 0;
        notifAudioRef.current.play().catch(() => {});
      }
    } catch {
      // Audio not available
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    const socket = connectSocket();

    socket.on('new_message', (msg: Message) => {
      addMessage(msg);
      // Play notification sound for incoming messages (not from current agent)
      if (msg.messageType === 'incoming') {
        playNotificationSound();
        // Browser notification
        if (typeof window !== 'undefined' && Notification.permission === 'granted') {
          new Notification('New message', {
            body: msg.content?.substring(0, 100) || 'New message received',
            icon: '/favicon.ico',
          });
        }
      }
    });

    // Listen for conversation updates (contact name/avatar, last message, etc.)
    socket.on('conversation_updated', (data: any) => {
      updateConversation(data);
    });

    // Listen for read receipts
    socket.on('message_read', (data: { conversationId: number; readAt: string }) => {
      setReadAt(data.readAt);
    });

    // Request notification permission
    if (typeof window !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      socket.off('new_message');
      socket.off('conversation_updated');
      socket.off('message_read');
    };
  }, [fetchConversations, addMessage, updateConversation, playNotificationSound]);

  useEffect(() => {
    if (!activeConversation) return;
    const socket = connectSocket();
    socket.emit('join_conversation', activeConversation.id);
    return () => {
      socket.emit('leave_conversation', activeConversation.id);
    };
  }, [activeConversation]);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (assignDropdownRef.current && !assignDropdownRef.current.contains(e.target as Node)) {
        setShowAssignDropdown(false);
      }
      if (labelPickerRef.current && !labelPickerRef.current.contains(e.target as Node)) {
        setShowLabelPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync contact form + fetch labels + reset read receipt
  useEffect(() => {
    setReadAt(null);
    if (activeConversation) {
      setContactForm({
        name: activeConversation.contact.name || '',
        email: (activeConversation.contact as any).email || '',
        phone: (activeConversation.contact as any).phone || '',
      });
      api.getConversationLabels(activeConversation.id).then(setConvLabels).catch(() => {});
    } else {
      setConvLabels([]);
    }
  }, [activeConversation]);

  // Auto-scroll to bottom
  const prevConvRef = useRef<number | null>(null);
  useEffect(() => {
    const isNewConv = activeConversation?.id !== prevConvRef.current;
    prevConvRef.current = activeConversation?.id ?? null;

    // When opening a conversation or first load: instant scroll (no animation)
    // When new message arrives in same conversation: smooth scroll
    const behavior = isNewConv ? 'instant' as ScrollBehavior : 'smooth';
    messagesEndRef.current?.scrollIntoView({ behavior });

    // Delayed scroll for images/stickers loading
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
    }, 150);
    return () => clearTimeout(timer);
  }, [messages, activeConversation]);

  const handleSend = async () => {
    if (!input.trim() || !activeConversation) return;
    const text = input;
    setInput('');
    await sendMessage(activeConversation.id, text);
  };

  const handleAiSuggest = async () => {
    if (!activeConversation) return;
    setAiLoading(true);
    try {
      const { suggestion } = await api.suggestReply(activeConversation.id);
      setInput(suggestion);
    } catch {
      // ignore
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveContact = async () => {
    if (!activeConversation) return;
    setSavingContact(true);
    try {
      await api.updateContact(activeConversation.contact.id, contactForm);
      fetchConversations();
    } catch {
      // ignore
    } finally {
      setSavingContact(false);
    }
  };

  const handleSendSticker = async (packageId: string, stickerId: string) => {
    if (!activeConversation) return;
    setShowStickerPicker(false);
    await sendMessage(activeConversation.id, '', false, {
      contentType: 'sticker',
      contentAttributes: { packageId, stickerId },
    });
  };

  const handleAssign = async (assigneeId: number | null) => {
    if (!activeConversation) return;
    setShowAssignDropdown(false);
    await api.assignConversation(activeConversation.id, assigneeId);
    fetchConversations();
  };

  const handleToggleLabel = async (label: Label) => {
    if (!activeConversation) return;
    const existing = convLabels.find((cl) => cl.label.id === label.id);
    if (existing) {
      await api.removeLabelFromConversation(activeConversation.id, label.id);
      setConvLabels((prev) => prev.filter((cl) => cl.label.id !== label.id));
    } else {
      const created = await api.addLabelToConversation(activeConversation.id, label.id);
      setConvLabels((prev) => [...prev, { id: (created as any).id, label }]);
    }
  };

  const handleCannedSelect = (response: CannedResponse) => {
    setInput(response.content);
    setShowCannedMenu(false);
    setCannedFilter('');
  };

  // Handle "/" shortcut for canned responses
  const handleInputChange = (value: string) => {
    setInput(value);
    if (value.startsWith('/') && value.length >= 1) {
      setShowCannedMenu(true);
      setCannedFilter(value.slice(1).toLowerCase());
    } else {
      setShowCannedMenu(false);
      setCannedFilter('');
    }
  };

  const filteredCanned = cannedResponses.filter((cr) =>
    !cannedFilter || cr.shortCode.toLowerCase().includes(cannedFilter) || cr.content.toLowerCase().includes(cannedFilter)
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversation) return;
    setUploadingFile(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        await sendMessage(activeConversation.id, base64, false, {
          contentType: 'image',
          contentAttributes: { fileName: file.name, fileSize: file.size, mimeType: file.type },
        });
        setUploadingFile(false);
      };
      reader.onerror = () => setUploadingFile(false);
      reader.readAsDataURL(file);
    } catch {
      setUploadingFile(false);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleSendNote = async () => {
    if (!noteInput.trim() || !activeConversation) return;
    setSendingNote(true);
    try {
      await sendMessage(activeConversation.id, noteInput.trim(), true);
      setNoteInput('');
    } catch {
      // ignore
    } finally {
      setSendingNote(false);
    }
  };

  const filteredConversations = conversations
    .filter((c) => {
      if (filter === 'open') return c.status === 'open';
      if (filter === 'resolved') return c.status === 'resolved';
      return true;
    })
    .filter((c) => {
      if (!search) return true;
      return c.contact.name?.toLowerCase().includes(search.toLowerCase());
    });

  // Group messages by date
  const groupedMessages: { date: string; msgs: Message[] }[] = [];
  let currentDate = '';
  for (const msg of messages) {
    const date = formatDate(msg.createdAt);
    if (date !== currentDate) {
      currentDate = date;
      groupedMessages.push({ date, msgs: [] });
    }
    groupedMessages[groupedMessages.length - 1].msgs.push(msg);
  }

  return (
    <div className="flex h-full">
      {/* Sidebar - Conversation List */}
      <div className="flex w-[340px] flex-col border-r border-gray-200 bg-white">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-100 px-4 pb-3 pt-4">
          <h2 className="mb-3 text-lg font-bold text-gray-900">Chats</h2>
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-full bg-gray-100 py-2 pl-10 pr-9 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#06C755]/30"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {/* Filter tabs */}
          <div className="mt-3 flex gap-1">
            {(['all', 'open', 'resolved'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  filter === f
                    ? 'bg-[#06C755] text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {f === 'all' ? 'All' : f === 'open' ? 'Open' : 'Resolved'}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conv={conv}
              isActive={activeConversation?.id === conv.id}
              unreadCount={getUnreadCount(conv.id, conv.messagesCount)}
              onClick={() => setActiveConversation(conv)}
            />
          ))}
          {filteredConversations.length === 0 && (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <svg className="mb-3 h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-sm text-gray-400">No conversations</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex flex-1 flex-col bg-[#f5f5f0]">
        {activeConversation ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3 shadow-sm">
              <div className="flex items-center gap-3">
                {activeConversation.contact.avatarUrl ? (
                  <img
                    src={activeConversation.contact.avatarUrl}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-600">
                    {getInitials(activeConversation.contact.name || '?')}
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    {activeConversation.contact.name}
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${
                        channelColors[activeConversation.inbox.channelType] || 'bg-gray-400'
                      }`}
                    >
                      {channelIcons[activeConversation.inbox.channelType]}
                    </span>
                    <span className="text-xs text-gray-400">
                      {activeConversation.inbox.name}
                    </span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        activeConversation.status === 'open'
                          ? 'bg-green-100 text-green-700'
                          : activeConversation.status === 'resolved'
                            ? 'bg-gray-100 text-gray-500'
                            : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {activeConversation.status}
                    </span>
                    {convLabels.map((cl) => (
                      <span
                        key={cl.label.id}
                        className="rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
                        style={{ backgroundColor: cl.label.color }}
                      >
                        {cl.label.title}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Label Picker */}
                <div className="relative" ref={labelPickerRef}>
                  <button
                    onClick={() => setShowLabelPicker(!showLabelPicker)}
                    className="flex items-center gap-1 rounded-lg bg-gray-50 px-2.5 py-1.5 text-sm text-gray-500 transition hover:bg-gray-100"
                    title="Labels"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </button>
                  {showLabelPicker && (
                    <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                      {allLabels.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-gray-400">No labels. Create in Settings.</p>
                      ) : (
                        allLabels.map((label) => {
                          const isActive = convLabels.some((cl) => cl.label.id === label.id);
                          return (
                            <button
                              key={label.id}
                              onClick={() => handleToggleLabel(label)}
                              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50 ${isActive ? 'bg-gray-50' : ''}`}
                            >
                              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: label.color }} />
                              <span className="flex-1 text-gray-700">{label.title}</span>
                              {isActive && (
                                <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
                {/* Assign Agent Dropdown */}
                <div className="relative" ref={assignDropdownRef}>
                  <button
                    onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                    className="flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    {activeConversation.assignee?.name || 'Assign'}
                  </button>
                  {showAssignDropdown && (
                    <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                      <button
                        onClick={() => handleAssign(null)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50"
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[10px]">—</span>
                        Unassigned
                      </button>
                      {teamMembers.map((member) => (
                        <button
                          key={member.id}
                          onClick={() => handleAssign(member.id)}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                            activeConversation.assignee?.id === member.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'
                          }`}
                        >
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-600">
                            {member.name.charAt(0).toUpperCase()}
                          </span>
                          {member.name}
                          {activeConversation.assignee?.id === member.id && (
                            <svg className="ml-auto h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={async () => {
                    await api.updateConversationStatus(activeConversation.id, 'resolved');
                    fetchConversations();
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 transition hover:bg-green-100"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Resolve
                </button>
                <button
                  onClick={() => setShowInfo(!showInfo)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                    showInfo ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:bg-gray-100'
                  }`}
                  title="Customer Info"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {groupedMessages.map((group) => (
                <div key={group.date}>
                  {/* Date separator */}
                  <div className="my-4 flex items-center justify-center">
                    <span className="rounded-full bg-gray-200/80 px-3 py-1 text-[11px] font-medium text-gray-500">
                      {group.date}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {group.msgs.map((msg, i) => (
                      <ChatBubble
                        key={msg.id}
                        msg={msg}
                        isLast={i === group.msgs.length - 1}
                        onImageClick={(url) => setLightboxUrl(url)}
                      />
                    ))}
                  </div>
                </div>
              ))}
              {/* Read receipt indicator */}
              {readAt && (
                <div className="flex justify-end pr-2">
                  <span className="flex items-center gap-1 text-[10px] text-blue-500">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Read {formatTime(readAt)}
                  </span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-200 bg-white px-4 py-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAiSuggest}
                  disabled={aiLoading}
                  className="group relative flex h-10 flex-shrink-0 items-center gap-1.5 rounded-full bg-purple-100 px-3 text-purple-600 transition hover:bg-purple-200 disabled:opacity-50"
                  title="AI Suggest Reply"
                >
                  {aiLoading ? (
                    <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                      </svg>
                      <span className="text-xs font-medium">AI</span>
                    </>
                  )}
                </button>
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        if (showCannedMenu && filteredCanned.length > 0) {
                          e.preventDefault();
                          handleCannedSelect(filteredCanned[0]);
                        } else {
                          handleSend();
                        }
                      }
                      if (e.key === 'Escape') setShowCannedMenu(false);
                    }}
                    placeholder='Type a message... (type "/" for shortcuts)'
                    className="w-full rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                  />
                  {/* Canned Responses Popup */}
                  {showCannedMenu && filteredCanned.length > 0 && (
                    <div className="absolute bottom-full left-0 z-50 mb-2 w-full max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                      {filteredCanned.map((cr) => (
                        <button
                          key={cr.id}
                          onClick={() => handleCannedSelect(cr)}
                          className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-gray-50"
                        >
                          <span className="flex-shrink-0 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-mono font-medium text-indigo-700">
                            /{cr.shortCode}
                          </span>
                          <span className="truncate text-sm text-gray-600">{cr.content}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* File Upload */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
                  title="Send Image"
                >
                  {uploadingFile ? (
                    <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  )}
                </button>
                {activeConversation?.inbox.channelType === 'line' && (
                  <div className="relative">
                    <button
                      onClick={() => setShowStickerPicker(!showStickerPicker)}
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                      title="LINE Stickers"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                    {showStickerPicker && (
                      <StickerPicker
                        onSelect={handleSendSticker}
                        onClose={() => setShowStickerPicker(false)}
                      />
                    )}
                  </div>
                )}
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#06C755] text-white transition hover:bg-[#05b34c] disabled:opacity-40"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="mb-1 text-lg font-semibold text-gray-700">Select a conversation</h3>
            <p className="text-sm text-gray-400">Choose a chat from the left to start messaging</p>
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={lightboxUrl}
            alt=""
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Customer Info Panel */}
      {activeConversation && showInfo && (
        <div className="w-[300px] flex-shrink-0 overflow-y-auto border-l border-gray-200 bg-white">
          {/* Contact Header */}
          <div className="flex flex-col items-center border-b border-gray-100 px-4 py-6">
            {activeConversation.contact.avatarUrl ? (
              <img
                src={activeConversation.contact.avatarUrl}
                alt=""
                className="mb-3 h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gray-200 text-lg font-semibold text-gray-600">
                {getInitials(activeConversation.contact.name || '?')}
              </div>
            )}
            <h3 className="text-sm font-bold text-gray-900">
              {activeConversation.contact.name}
            </h3>
            <span
              className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${
                channelColors[activeConversation.inbox.channelType] || 'bg-gray-400'
              }`}
            >
              {channelIcons[activeConversation.inbox.channelType]} {activeConversation.inbox.name}
            </span>
            <button
              onClick={async () => {
                try {
                  const result = await api.refreshContactProfile(activeConversation.contact.id);
                  if (result.name && !result.error) {
                    fetchConversations();
                    alert(`Profile updated: ${result.name}`);
                  } else {
                    alert(result.error || 'Could not fetch profile');
                  }
                } catch (err) {
                  alert('Failed to refresh: ' + (err instanceof Error ? err.message : String(err)));
                }
              }}
              className="mt-1 text-[10px] text-indigo-500 hover:text-indigo-700 transition"
              title="Refresh profile from platform"
            >
              Refresh Profile
            </button>
          </div>

          {/* Contact Info Form */}
          <div className="space-y-3 p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Customer Info
            </h4>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Name</label>
              <input
                type="text"
                value={contactForm.name}
                onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Email</label>
              <input
                type="email"
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                placeholder="Not provided"
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Phone</label>
              <input
                type="tel"
                value={contactForm.phone}
                onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                placeholder="Not provided"
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <button
              onClick={handleSaveContact}
              disabled={savingContact}
              className="w-full rounded-lg bg-indigo-600 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {savingContact ? 'Saving...' : 'Save'}
            </button>
          </div>

          {/* Conversation Details */}
          <div className="space-y-2 border-t border-gray-100 p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Conversation
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  activeConversation.status === 'open'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {activeConversation.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Messages</span>
                <span className="text-gray-900">{activeConversation.messagesCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Created</span>
                <span className="text-gray-900">
                  {new Date(activeConversation.lastActivityAt).toLocaleDateString('th-TH')}
                </span>
              </div>
              {activeConversation.assignee && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Assignee</span>
                  <span className="text-gray-900">{activeConversation.assignee.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Private Notes */}
          <div className="space-y-3 border-t border-gray-100 p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Notes
            </h4>
            <div className="space-y-2">
              {messages.filter((m) => m.private).map((note) => (
                <div key={note.id} className="rounded-lg bg-yellow-50 p-2.5 ring-1 ring-yellow-200">
                  <p className="text-xs text-gray-700">{note.content}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">{note.senderName || 'Agent'}</span>
                    <span className="text-[10px] text-gray-400">{formatTime(note.createdAt)}</span>
                  </div>
                </div>
              ))}
              {messages.filter((m) => m.private).length === 0 && (
                <p className="text-xs text-gray-400">No notes yet</p>
              )}
            </div>
            <div className="flex gap-2">
              <textarea
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendNote();
                  }
                }}
                placeholder="Add a note..."
                rows={2}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 placeholder-gray-400 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400/30"
              />
            </div>
            <button
              onClick={handleSendNote}
              disabled={!noteInput.trim() || sendingNote}
              className="w-full rounded-lg bg-yellow-100 py-1.5 text-xs font-medium text-yellow-800 transition hover:bg-yellow-200 disabled:opacity-50"
            >
              {sendingNote ? 'Saving...' : 'Add Note'}
            </button>
          </div>

          {/* Quick Replies (Canned Responses) */}
          <div className="space-y-3 border-t border-gray-100 p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Quick Replies
            </h4>
            <div className="space-y-1.5">
              {cannedResponses.length === 0 ? (
                <p className="text-xs text-gray-400">No quick replies yet. Add them in Settings.</p>
              ) : (
                cannedResponses.map((cr) => (
                  <button
                    key={cr.id}
                    onClick={() => setInput(cr.content)}
                    className="flex w-full items-start gap-2 rounded-lg p-2 text-left transition hover:bg-gray-50"
                  >
                    <span className="flex-shrink-0 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-mono font-medium text-indigo-700">
                      /{cr.shortCode}
                    </span>
                    <span className="line-clamp-2 text-xs text-gray-600">{cr.content}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
