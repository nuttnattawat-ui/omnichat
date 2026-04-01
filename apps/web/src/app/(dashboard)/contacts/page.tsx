'use client';

import { useEffect, useState } from 'react';
import { api, Contact, Conversation } from '@/lib/api';

const channelColors: Record<string, string> = {
  line: 'bg-green-500',
  facebook: 'bg-blue-600',
  instagram: 'bg-pink-500',
};

interface ContactDetail extends Contact {
  conversations?: Conversation[];
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ContactDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getContacts()
      .then(setContacts)
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = async (contact: Contact) => {
    setDetailLoading(true);
    setSelected(null);
    try {
      const detail = await api.getContact(contact.id) as ContactDetail;
      setSelected(detail);
      setEditForm({
        name: detail.name || '',
        email: detail.email || '',
        phone: detail.phone || '',
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.updateContact(selected.id, editForm);
      setContacts((prev) =>
        prev.map((c) => (c.id === selected.id ? { ...c, ...editForm } : c)),
      );
      setSelected((prev) => prev ? { ...prev, ...editForm } : prev);
    } finally {
      setSaving(false);
    }
  };

  const filteredContacts = contacts.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(q)
    );
  });

  return (
    <div className="flex h-full bg-white">
      {/* Contact List */}
      <div className="flex w-[380px] flex-col border-r border-gray-200">
        <div className="flex-shrink-0 border-b border-gray-100 p-4">
          <h2 className="mb-3 text-lg font-bold text-gray-900">Contacts</h2>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts..."
              className="w-full rounded-full bg-gray-100 py-2 pl-10 pr-4 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>
          <p className="mt-2 text-xs text-gray-400">{contacts.length} contacts</p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {filteredContacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => handleSelect(contact)}
                className={`flex w-full items-center gap-3 border-b border-gray-50 px-4 py-3 text-left transition hover:bg-gray-50 ${
                  selected?.id === contact.id ? 'bg-indigo-50' : ''
                }`}
              >
                {contact.avatarUrl ? (
                  <img src={contact.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-600">
                    {(contact.name || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {contact.name || 'Unknown'}
                  </p>
                  <p className="truncate text-xs text-gray-400">
                    {contact.email || contact.phone || 'No info'}
                  </p>
                </div>
                <div className="flex gap-1">
                  {contact.contactInboxes?.map((ci) => (
                    <span
                      key={ci.sourceId}
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-white ${
                        channelColors[ci.inbox.channelType] || 'bg-gray-400'
                      }`}
                    >
                      {ci.inbox.channelType === 'line' ? 'L' : ci.inbox.channelType === 'facebook' ? 'F' : 'IG'}
                    </span>
                  ))}
                </div>
              </button>
            ))}
            {filteredContacts.length === 0 && (
              <div className="p-8 text-center text-gray-400">
                {search ? 'No contacts match your search' : 'No contacts yet'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail Panel */}
      <div className="flex flex-1 flex-col">
        {detailLoading ? (
          <div className="flex flex-1 items-center justify-center text-gray-400">
            Loading...
          </div>
        ) : selected ? (
          <div className="flex-1 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center gap-4 border-b border-gray-100 px-6 py-6">
              {selected.avatarUrl ? (
                <img src={selected.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-200 text-xl font-bold text-gray-600">
                  {(selected.name || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h3 className="text-lg font-bold text-gray-900">{selected.name || 'Unknown'}</h3>
                <div className="mt-1 flex gap-1">
                  {selected.contactInboxes?.map((ci) => (
                    <span
                      key={ci.sourceId}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${
                        channelColors[ci.inbox.channelType] || 'bg-gray-400'
                      }`}
                    >
                      {ci.inbox.channelType} — {ci.inbox.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Edit Form */}
            <div className="border-b border-gray-100 px-6 py-5">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Contact Info
              </h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    placeholder="Not provided"
                    className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Phone</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="Not provided"
                    className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                </div>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="mt-3 rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>

            {/* Conversation History */}
            <div className="px-6 py-5">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Conversation History
              </h4>
              {selected.conversations && selected.conversations.length > 0 ? (
                <div className="space-y-2">
                  {selected.conversations.map((conv: Conversation) => (
                    <a
                      key={conv.id}
                      href={`/inbox?conv=${conv.id}`}
                      className="flex items-center justify-between rounded-lg border border-gray-100 p-3 transition hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          conv.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {conv.status}
                        </span>
                        <span className="text-sm text-gray-700">
                          Conversation #{conv.id}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>{conv.messagesCount} messages</span>
                        <span>{new Date(conv.lastActivityAt).toLocaleDateString('th-TH')}</span>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No conversations yet</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="mb-1 text-lg font-semibold text-gray-700">Select a contact</h3>
            <p className="text-sm text-gray-400">Choose a contact to view details and conversation history</p>
          </div>
        )}
      </div>
    </div>
  );
}
