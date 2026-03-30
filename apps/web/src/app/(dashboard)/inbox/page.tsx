'use client';

import { useEffect, useState } from 'react';
import { useChatStore } from '@/stores/chat.store';
import { connectSocket } from '@/lib/socket';
import { api, Message } from '@/lib/api';

const channelColors: Record<string, string> = {
  line: 'bg-green-500',
  facebook: 'bg-blue-600',
  instagram: 'bg-pink-500',
};

const channelLabels: Record<string, string> = {
  line: 'LINE',
  facebook: 'FB',
  instagram: 'IG',
};

export default function InboxPage() {
  const {
    conversations,
    activeConversation,
    messages,
    fetchConversations,
    setActiveConversation,
    addMessage,
    sendMessage,
  } = useChatStore();

  const [input, setInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetchConversations();

    const socket = connectSocket();
    socket.on('new_message', (msg: Message) => {
      addMessage(msg);
    });

    return () => {
      socket.off('new_message');
    };
  }, [fetchConversations, addMessage]);

  // Join conversation room when active changes
  useEffect(() => {
    if (!activeConversation) return;
    const socket = connectSocket();
    socket.emit('join_conversation', activeConversation.id);
    return () => {
      socket.emit('leave_conversation', activeConversation.id);
    };
  }, [activeConversation]);

  const handleSend = async () => {
    if (!input.trim() || !activeConversation) return;
    await sendMessage(activeConversation.id, input);
    setInput('');
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

  return (
    <div className="flex h-full">
      {/* Conversation List */}
      <div className="w-80 border-r border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-4">
          <h2 className="text-lg font-semibold">Inbox</h2>
        </div>
        <div className="overflow-y-auto">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setActiveConversation(conv)}
              className={`w-full border-b border-gray-100 p-4 text-left transition hover:bg-gray-50 ${
                activeConversation?.id === conv.id ? 'bg-indigo-50' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Channel badge */}
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${
                    channelColors[conv.inbox.channelType] || 'bg-gray-400'
                  }`}
                >
                  {channelLabels[conv.inbox.channelType] || '?'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate font-medium">
                      {conv.contact.name || 'Unknown'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(conv.lastActivityAt).toLocaleTimeString(
                        'th-TH',
                        { hour: '2-digit', minute: '2-digit' },
                      )}
                    </span>
                  </div>
                  <p className="truncate text-sm text-gray-500">
                    {conv.messages?.[0]?.content || 'No messages'}
                  </p>
                </div>
              </div>
            </button>
          ))}

          {conversations.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              No conversations yet
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex flex-1 flex-col">
        {activeConversation ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${
                    channelColors[
                      activeConversation.inbox.channelType
                    ] || 'bg-gray-400'
                  }`}
                >
                  {channelLabels[
                    activeConversation.inbox.channelType
                  ] || '?'}
                </span>
                <div>
                  <h3 className="font-semibold">
                    {activeConversation.contact.name}
                  </h3>
                  <span className="text-xs text-gray-400">
                    {activeConversation.inbox.name} &middot;{' '}
                    {activeConversation.status}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    api.updateConversationStatus(
                      activeConversation.id,
                      'resolved',
                    )
                  }
                  className="rounded-lg bg-green-100 px-3 py-1 text-sm text-green-700 hover:bg-green-200"
                >
                  Resolve
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.messageType === 'incoming'
                        ? 'justify-start'
                        : 'justify-end'
                    }`}
                  >
                    <div
                      className={`max-w-md rounded-2xl px-4 py-2 ${
                        msg.messageType === 'incoming'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : msg.senderType === 'Bot'
                            ? 'bg-purple-500 text-white'
                            : 'bg-indigo-600 text-white'
                      }`}
                    >
                      {msg.senderType === 'Bot' && (
                        <div className="mb-1 text-xs opacity-75">
                          AI Assistant
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      <div className="mt-1 text-xs opacity-60">
                        {new Date(msg.createdAt).toLocaleTimeString(
                          'th-TH',
                          { hour: '2-digit', minute: '2-digit' },
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Input */}
            <div className="border-t border-gray-200 bg-white p-4">
              <div className="flex gap-2">
                <button
                  onClick={handleAiSuggest}
                  disabled={aiLoading}
                  className="rounded-lg bg-purple-100 px-3 py-2 text-sm text-purple-700 hover:bg-purple-200 disabled:opacity-50"
                  title="AI Suggest Reply"
                >
                  {aiLoading ? '...' : 'AI'}
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === 'Enter' && !e.shiftKey && handleSend()
                  }
                  placeholder="Type a message..."
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={handleSend}
                  className="rounded-lg bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700"
                >
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-gray-400">
            Select a conversation to start
          </div>
        )}
      </div>
    </div>
  );
}
