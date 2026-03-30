'use client';

import { useEffect, useState } from 'react';
import { api, Contact } from '@/lib/api';

const channelColors: Record<string, string> = {
  line: 'bg-green-500',
  facebook: 'bg-blue-600',
  instagram: 'bg-pink-500',
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getContacts()
      .then(setContacts)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full bg-white">
      <div className="border-b border-gray-200 p-6">
        <h2 className="text-xl font-semibold">Contacts</h2>
        <p className="text-sm text-gray-500">
          All customers across all channels
        </p>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-400">Loading...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-left text-sm text-gray-500">
              <tr>
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Email</th>
                <th className="px-6 py-3 font-medium">Phone</th>
                <th className="px-6 py-3 font-medium">Channels</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">
                    {contact.name || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {contact.email || '-'}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {contact.phone || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1">
                      {contact.contactInboxes?.map((ci) => (
                        <span
                          key={ci.sourceId}
                          className={`rounded-full px-2 py-0.5 text-xs text-white ${
                            channelColors[ci.inbox.channelType] ||
                            'bg-gray-400'
                          }`}
                        >
                          {ci.inbox.channelType}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {contacts.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              No contacts yet
            </div>
          )}
        </div>
      )}
    </div>
  );
}
