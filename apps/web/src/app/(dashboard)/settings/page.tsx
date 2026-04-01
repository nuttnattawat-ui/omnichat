'use client';

import { useEffect, useState } from 'react';
import { api, Inbox, UserProfile, TeamMember, CannedResponse } from '@/lib/api';

type ChannelForm = {
  name: string;
  channelType: string;
  channelConfig: Record<string, string>;
  aiEnabled: boolean;
  aiPrompt: string;
  greeting: string;
};

const emptyForm: ChannelForm = {
  name: '',
  channelType: 'line',
  channelConfig: {},
  aiEnabled: false,
  aiPrompt: '',
  greeting: '',
};

const channelFields: Record<string, { key: string; label: string; placeholder: string }[]> = {
  line: [
    { key: 'channelAccessToken', label: 'Channel Access Token', placeholder: 'LINE Channel Access Token' },
    { key: 'channelSecret', label: 'Channel Secret', placeholder: 'LINE Channel Secret' },
  ],
  facebook: [
    { key: 'pageAccessToken', label: 'Page Access Token', placeholder: 'Facebook Page Access Token' },
    { key: 'appSecret', label: 'App Secret', placeholder: 'Meta App Secret' },
    { key: 'verifyToken', label: 'Verify Token', placeholder: 'Webhook Verify Token' },
  ],
  instagram: [
    { key: 'pageAccessToken', label: 'Page Access Token', placeholder: 'Instagram Page Access Token' },
    { key: 'appSecret', label: 'App Secret', placeholder: 'Meta App Secret' },
    { key: 'verifyToken', label: 'Verify Token', placeholder: 'Webhook Verify Token' },
  ],
};

export default function SettingsPage() {
  const [tab, setTab] = useState<'profile' | 'inboxes' | 'team' | 'canned'>('profile');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [profileName, setProfileName] = useState('');
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);
  const [newCannedCode, setNewCannedCode] = useState('');
  const [newCannedContent, setNewCannedContent] = useState('');
  const [cannedSaving, setCannedSaving] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingInbox, setEditingInbox] = useState<Inbox | null>(null);
  const [form, setForm] = useState<ChannelForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Delete confirm
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    api.getProfile().then((p) => { setProfile(p); setProfileName(p.name); });
    api.getInboxes().then(setInboxes);
    api.getTeam().then(setTeam);
    api.getCannedResponses().then(setCannedResponses).catch(() => {});
  }, []);

  const openAddModal = () => {
    setEditingInbox(null);
    setForm(emptyForm);
    setError('');
    setShowModal(true);
  };

  const openEditModal = (inbox: Inbox) => {
    setEditingInbox(inbox);
    setForm({
      name: inbox.name,
      channelType: inbox.channelType,
      channelConfig: inbox.channelConfig || {},
      aiEnabled: inbox.aiEnabled,
      aiPrompt: inbox.aiPrompt || '',
      greeting: inbox.greeting || '',
    });
    setError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingInbox(null);
    setForm(emptyForm);
    setError('');
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Please enter a channel name');
      return;
    }
    setSaving(true);
    setError('');

    try {
      if (editingInbox) {
        await api.updateInbox(editingInbox.id, {
          name: form.name,
          channelConfig: form.channelConfig,
          aiEnabled: form.aiEnabled,
          aiPrompt: form.aiPrompt || null,
          greeting: form.greeting || null,
        });
      } else {
        await api.createInbox({
          name: form.name,
          channelType: form.channelType,
          channelConfig: form.channelConfig,
        });
      }
      const updated = await api.getInboxes();
      setInboxes(updated);
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteInbox(id);
      setInboxes(inboxes.filter((i) => i.id !== id));
      setDeletingId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleProfileSave = async () => {
    if (!profileName.trim()) return;
    try {
      await api.updateProfile({ name: profileName });
      setProfile((p) => p ? { ...p, name: profileName } : p);
    } catch {
      alert('Failed to update profile');
    }
  };

  const updateConfig = (key: string, value: string) => {
    setForm((f) => ({ ...f, channelConfig: { ...f.channelConfig, [key]: value } }));
  };

  const handleAddCanned = async () => {
    if (!newCannedCode.trim() || !newCannedContent.trim()) return;
    setCannedSaving(true);
    try {
      const created = await api.createCannedResponse({
        shortCode: newCannedCode.trim().replace(/^\//, ''),
        content: newCannedContent.trim(),
      });
      setCannedResponses((prev) => [...prev, created]);
      setNewCannedCode('');
      setNewCannedContent('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setCannedSaving(false);
    }
  };

  const handleDeleteCanned = async (id: number) => {
    try {
      await api.deleteCannedResponse(id);
      setCannedResponses((prev) => prev.filter((cr) => cr.id !== id));
    } catch {
      alert('Failed to delete');
    }
  };

  const tabs = [
    { key: 'profile' as const, label: 'Profile' },
    { key: 'inboxes' as const, label: 'Channels' },
    { key: 'team' as const, label: 'Team' },
    { key: 'canned' as const, label: 'Quick Replies' },
  ];

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

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
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
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
            <button
              onClick={handleProfileSave}
              className="rounded-lg bg-indigo-600 px-6 py-2 text-sm text-white hover:bg-indigo-700"
            >
              Save Changes
            </button>
          </div>
        )}

        {/* Channels/Inboxes Tab */}
        {tab === 'inboxes' && (
          <div className="space-y-4">
            <div className="flex justify-between">
              <p className="text-gray-500">
                Connect your LINE, Facebook, and Instagram channels
              </p>
              <button
                onClick={openAddModal}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
              >
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
                  <div className="flex items-center gap-3">
                    {inbox.aiEnabled && (
                      <span className="rounded-full bg-purple-100 px-2 py-1 text-xs text-purple-700">
                        AI Enabled
                      </span>
                    )}
                    <button
                      onClick={() => openEditModal(inbox)}
                      className="text-sm text-indigo-600 hover:text-indigo-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeletingId(inbox.id)}
                      className="text-sm text-red-500 hover:text-red-700"
                    >
                      Delete
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

        {/* Canned Responses Tab */}
        {tab === 'canned' && (
          <div className="max-w-2xl space-y-4">
            <p className="text-gray-500">
              Create quick reply templates. Type &quot;/&quot; in the chat input to use them.
            </p>

            {/* Add New */}
            <div className="flex gap-3 rounded-xl border border-gray-200 p-4">
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={newCannedCode}
                  onChange={(e) => setNewCannedCode(e.target.value)}
                  placeholder="Shortcode (e.g. greeting)"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <textarea
                  value={newCannedContent}
                  onChange={(e) => setNewCannedContent(e.target.value)}
                  placeholder="Reply content..."
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <button
                onClick={handleAddCanned}
                disabled={cannedSaving || !newCannedCode.trim() || !newCannedContent.trim()}
                className="self-end rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {cannedSaving ? 'Adding...' : 'Add'}
              </button>
            </div>

            {/* List */}
            <div className="space-y-2">
              {cannedResponses.map((cr) => (
                <div
                  key={cr.id}
                  className="flex items-start justify-between rounded-xl border border-gray-100 p-4"
                >
                  <div>
                    <span className="rounded bg-indigo-100 px-2 py-0.5 font-mono text-xs font-medium text-indigo-700">
                      /{cr.shortCode}
                    </span>
                    <p className="mt-1 text-sm text-gray-600">{cr.content}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteCanned(cr.id)}
                    className="ml-4 flex-shrink-0 text-sm text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              ))}
              {cannedResponses.length === 0 && (
                <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center text-gray-400">
                  No quick replies yet. Add your first one above.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Channel Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="border-b border-gray-200 p-6">
              <h3 className="text-lg font-semibold">
                {editingInbox ? 'Edit Channel' : 'Add Channel'}
              </h3>
            </div>

            <div className="max-h-[60vh] space-y-4 overflow-y-auto p-6">
              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              {/* Channel Type (only for new) */}
              {!editingInbox && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Channel Type
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['line', 'facebook', 'instagram'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setForm({ ...form, channelType: type, channelConfig: {} })}
                        className={`rounded-lg border-2 p-3 text-center text-sm font-medium transition ${
                          form.channelType === type
                            ? type === 'line'
                              ? 'border-green-500 bg-green-50 text-green-700'
                              : type === 'facebook'
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-pink-500 bg-pink-50 text-pink-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {type === 'line' ? 'LINE' : type === 'facebook' ? 'Facebook' : 'Instagram'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Channel Name */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Channel Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. My LINE OA"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Channel Config Fields */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  API Credentials
                </label>
                {(channelFields[form.channelType] || []).map((field) => (
                  <div key={field.key}>
                    <label className="mb-1 block text-xs text-gray-500">
                      {field.label}
                    </label>
                    <input
                      type="password"
                      value={form.channelConfig[field.key] || ''}
                      onChange={(e) => updateConfig(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              {/* Webhook URL Info */}
              {!editingInbox && (
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="mb-1 text-xs font-medium text-gray-500">
                    Webhook URL (set this in {form.channelType === 'line' ? 'LINE Developers' : 'Meta Developer'} console)
                  </p>
                  <code className="block break-all text-xs text-indigo-600">
                    {apiBaseUrl}/api/webhooks/{form.channelType}
                  </code>
                </div>
              )}

              {/* Greeting Message */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Greeting Message (optional)
                </label>
                <input
                  type="text"
                  value={form.greeting}
                  onChange={(e) => setForm({ ...form, greeting: e.target.value })}
                  placeholder="Auto-reply when customer starts a new chat"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* AI Settings */}
              <div className="space-y-3 rounded-lg border border-gray-200 p-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={form.aiEnabled}
                    onChange={(e) => setForm({ ...form, aiEnabled: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Enable AI Auto-Reply
                  </span>
                </label>
                {form.aiEnabled && (
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">
                      AI System Prompt (optional)
                    </label>
                    <textarea
                      value={form.aiPrompt}
                      onChange={(e) => setForm({ ...form, aiPrompt: e.target.value })}
                      placeholder="e.g. You are a helpful customer service agent for our shop..."
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 p-6">
              <button
                onClick={closeModal}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-6 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingInbox ? 'Save Changes' : 'Add Channel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold">Delete Channel</h3>
            <p className="mb-6 text-sm text-gray-500">
              Are you sure you want to delete this channel? This will remove all associated conversations and messages. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
