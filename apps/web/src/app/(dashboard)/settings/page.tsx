'use client';

import { useEffect, useState } from 'react';
import { api, Inbox, UserProfile, TeamMember } from '@/lib/api';

export default function SettingsPage() {
  const [tab, setTab] = useState<'profile' | 'inboxes' | 'team'>('profile');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);

  useEffect(() => {
    api.getProfile().then(setProfile);
    api.getInboxes().then(setInboxes);
    api.getTeam().then(setTeam);
  }, []);

  const tabs = [
    { key: 'profile' as const, label: 'Profile' },
    { key: 'inboxes' as const, label: 'Channels' },
    { key: 'team' as const, label: 'Team' },
  ];

  return (
    <div className="h-full bg-white">
      <div className="border-b border-gray-200 p-6">
        <h2 className="text-xl font-semibold">Settings</h2>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 px-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-4 py-3 text-sm font-medium transition ${
              tab === t.key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-6">
        {/* Profile Tab */}
        {tab === 'profile' && profile && (
          <div className="max-w-lg space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Name
              </label>
              <input
                type="text"
                defaultValue={profile.name}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                defaultValue={profile.email}
                disabled
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-gray-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Role
              </label>
              <span className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-sm text-indigo-700">
                {profile.role}
              </span>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Organization
              </label>
              <span className="text-gray-600">{profile.account.name}</span>
            </div>
          </div>
        )}

        {/* Channels/Inboxes Tab */}
        {tab === 'inboxes' && (
          <div className="space-y-4">
            <div className="flex justify-between">
              <p className="text-gray-500">
                Connect your LINE, Facebook, and Instagram channels
              </p>
              <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700">
                + Add Channel
              </button>
            </div>

            <div className="grid gap-4">
              {inboxes.map((inbox) => (
                <div
                  key={inbox.id}
                  className="flex items-center justify-between rounded-xl border border-gray-200 p-4"
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white ${
                        inbox.channelType === 'line'
                          ? 'bg-green-500'
                          : inbox.channelType === 'facebook'
                            ? 'bg-blue-600'
                            : 'bg-pink-500'
                      }`}
                    >
                      {inbox.channelType === 'line'
                        ? 'L'
                        : inbox.channelType === 'facebook'
                          ? 'F'
                          : 'I'}
                    </span>
                    <div>
                      <h3 className="font-medium">{inbox.name}</h3>
                      <span className="text-sm text-gray-500">
                        {inbox.channelType} &middot;{' '}
                        {inbox.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {inbox.aiEnabled && (
                      <span className="rounded-full bg-purple-100 px-2 py-1 text-xs text-purple-700">
                        AI Enabled
                      </span>
                    )}
                    <button className="text-sm text-indigo-600 hover:text-indigo-800">
                      Edit
                    </button>
                  </div>
                </div>
              ))}

              {inboxes.length === 0 && (
                <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center text-gray-400">
                  No channels connected yet. Click &quot;+ Add Channel&quot; to get
                  started.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Team Tab */}
        {tab === 'team' && (
          <div className="space-y-4">
            <div className="flex justify-between">
              <p className="text-gray-500">Manage your team members</p>
              <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700">
                + Invite Member
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 text-left text-sm text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {team.map((member) => (
                    <tr key={member.id}>
                      <td className="px-4 py-3 font-medium">
                        {member.name}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {member.email}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs">
                          {member.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs ${
                            member.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {member.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
