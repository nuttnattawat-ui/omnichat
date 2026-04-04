'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, Contact, Conversation } from '@/lib/api';

interface MessageResult {
  id: number;
  conversationId: number;
  content: string;
  messageType: string;
  createdAt: string;
  conversation: { contact: { id: number; name: string } };
}

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    contacts: Contact[];
    messages: MessageResult[];
    conversations: Conversation[];
  } | null>(null);

  const handleSearch = async () => {
    if (!query.trim() || query.trim().length < 2) return;
    setLoading(true);
    try {
      const data = await api.search(query.trim());
      setResults(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const goToConversation = (convId: number) => {
    router.push(`/inbox?conv=${convId}`);
  };

  const totalResults = results
    ? results.contacts.length + results.messages.length + results.conversations.length
    : 0;

  return (
    <div className="h-full bg-white">
      <div className="border-b border-gray-200 p-6">
        <h2 className="text-xl font-semibold">Search</h2>
      </div>

      <div className="p-6">
        {/* Search input */}
        <div className="mx-auto max-w-2xl">
          <div className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search messages, contacts, conversations..."
              className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none"
              autoFocus
            />
            <button
              onClick={handleSearch}
              disabled={loading || query.trim().length < 2}
              className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>

          {results && (
            <div className="mt-6 space-y-6">
              <p className="text-sm text-gray-500">
                Found {totalResults} result{totalResults !== 1 ? 's' : ''} for &quot;{query}&quot;
              </p>

              {/* Conversations */}
              {results.conversations.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-gray-700">
                    Conversations ({results.conversations.length})
                  </h3>
                  <div className="space-y-2">
                    {results.conversations.map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => goToConversation(conv.id)}
                        className="flex w-full items-center gap-3 rounded-lg border border-gray-100 p-3 text-left transition hover:bg-gray-50"
                      >
                        {conv.contact.avatarUrl ? (
                          <img src={conv.contact.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-600">
                            {(conv.contact.name || '?')[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium">{conv.contact.name}</p>
                          <p className="text-xs text-gray-500">
                            {conv.inbox.channelType} &middot; {conv.status} &middot; #{conv.id}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Contacts */}
              {results.contacts.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-gray-700">
                    Contacts ({results.contacts.length})
                  </h3>
                  <div className="space-y-2">
                    {results.contacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center gap-3 rounded-lg border border-gray-100 p-3"
                      >
                        {contact.avatarUrl ? (
                          <img src={contact.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-600">
                            {(contact.name || '?')[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium">{contact.name}</p>
                          <p className="text-xs text-gray-500">
                            {contact.email && `${contact.email} `}
                            {contact.phone && `${contact.phone}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages */}
              {results.messages.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-gray-700">
                    Messages ({results.messages.length})
                  </h3>
                  <div className="space-y-2">
                    {results.messages.map((msg) => (
                      <button
                        key={msg.id}
                        onClick={() => goToConversation(msg.conversationId)}
                        className="w-full rounded-lg border border-gray-100 p-3 text-left transition hover:bg-gray-50"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-500">
                            {msg.conversation.contact.name} &middot; Conv #{msg.conversationId}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(msg.createdAt).toLocaleDateString('th-TH')}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-gray-700">{msg.content}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {totalResults === 0 && (
                <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center text-gray-400">
                  No results found
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
