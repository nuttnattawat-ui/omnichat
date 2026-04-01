'use client';

import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/stores/chat.store';
import { connectSocket } from '@/lib/socket';
import { api, Message, Conversation } from '@/lib/api';

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
    `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/iPhone/sticker.png`,
    `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/iPhone/sticker@2x.png`,
    `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/android/sticker.png`,
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
  const isSticker = msg.contentType === 'sticker';
  const isImage = msg.contentType === 'image';

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
              : 'rounded-2xl rounded-br-md bg-[#06C755] text-white'
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

// LINE official sticker packages (free/common ones)
const STICKER_PACKAGES = [
  {
    packageId: '11537',
    name: 'Brown & Cony',
    stickers: ['52002734','52002735','52002736','52002737','52002738','52002739','52002740','52002741','52002742','52002743','52002744','52002745','52002746','52002747','52002748','52002749','52002750','52002751','52002752','52002753','52002754','52002755','52002756','52002757','52002758','52002759','52002760','52002761','52002762','52002763','52002764','52002765','52002766','52002767','52002768','52002769','52002770','52002771','52002772','52002773'],
  },
  {
    packageId: '11538',
    name: 'Brown & Friends',
    stickers: ['51626494','51626495','51626496','51626497','51626498','51626499','51626500','51626501','51626502','51626503','51626504','51626505','51626506','51626507','51626508','51626509','51626510','51626511','51626512','51626513','51626514','51626515','51626516','51626517','51626518','51626519','51626520','51626521','51626522','51626523','51626524','51626525','51626526','51626527','51626528','51626529','51626530','51626531','51626532','51626533'],
  },
  {
    packageId: '11539',
    name: 'CHOCO & Friends',
    stickers: ['52114110','52114111','52114112','52114113','52114114','52114115','52114116','52114117','52114118','52114119','52114120','52114121','52114122','52114123','52114124','52114125','52114126','52114127','52114128','52114129','52114130','52114131','52114132','52114133','52114134','52114135','52114136','52114137','52114138','52114139','52114140','52114141','52114142','52114143','52114144','52114145','52114146','52114147','52114148','52114149'],
  },
];

function StickerPicker({ onSelect, onClose }: { onSelect: (packageId: string, stickerId: string) => void; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState(0);
  const pkg = STICKER_PACKAGES[activeTab];

  return (
    <div className="absolute bottom-12 right-0 z-50 w-[320px] rounded-xl border border-gray-200 bg-white shadow-xl">
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
              src={`https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/iPhone/sticker.png`}
              alt=""
              className="h-16 w-16 object-contain"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.opacity = '0.3';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations();
    const socket = connectSocket();

    socket.on('new_message', (msg: Message) => {
      addMessage(msg);
    });

    // Listen for conversation updates (contact name/avatar, last message, etc.)
    socket.on('conversation_updated', (data: any) => {
      updateConversation(data);
    });

    return () => {
      socket.off('new_message');
      socket.off('conversation_updated');
    };
  }, [fetchConversations, addMessage, updateConversation]);

  useEffect(() => {
    if (!activeConversation) return;
    const socket = connectSocket();
    socket.emit('join_conversation', activeConversation.id);
    return () => {
      socket.emit('leave_conversation', activeConversation.id);
    };
  }, [activeConversation]);

  // Sync contact form
  useEffect(() => {
    if (activeConversation) {
      setContactForm({
        name: activeConversation.contact.name || '',
        email: (activeConversation.contact as any).email || '',
        phone: (activeConversation.contact as any).phone || '',
      });
    }
  }, [activeConversation]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
              className="w-full rounded-full bg-gray-100 py-2 pl-10 pr-4 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#06C755]/30"
            />
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
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
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
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-200 bg-white px-4 py-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAiSuggest}
                  disabled={aiLoading}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600 transition hover:bg-purple-200 disabled:opacity-50"
                  title="AI Suggest Reply"
                >
                  {aiLoading ? (
                    <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                  )}
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Type a message..."
                  className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:border-[#06C755] focus:outline-none focus:ring-1 focus:ring-[#06C755]/30"
                />
                <div className="relative">
                  <button
                    onClick={() => setShowStickerPicker(!showStickerPicker)}
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                    title="Send Sticker"
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
                placeholder="customer@email.com"
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Phone</label>
              <input
                type="tel"
                value={contactForm.phone}
                onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                placeholder="08X-XXX-XXXX"
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
        </div>
      )}
    </div>
  );
}
