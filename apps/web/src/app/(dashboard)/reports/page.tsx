'use client';

import { useEffect, useState } from 'react';
import { api, ReportsOverview, DayData, MessageDayData, ChannelData, AgentPerformance } from '@/lib/api';

const channelColors: Record<string, string> = {
  line: 'bg-green-500',
  facebook: 'bg-blue-600',
  instagram: 'bg-pink-500',
};

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-gray-100">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{value}</span>
    </div>
  );
}

function SimpleChart({ data, height = 120 }: { data: { label: string; v1: number; v2: number }[]; height?: number }) {
  const maxVal = Math.max(...data.map((d) => d.v1 + d.v2), 1);

  return (
    <div className="flex items-end gap-[2px]" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="group relative flex flex-1 flex-col items-center justify-end">
          <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-[10px] text-white opacity-0 shadow-lg transition group-hover:opacity-100">
            {d.label}: {d.v1} + {d.v2}
          </div>
          {d.v2 > 0 && (
            <div
              className="w-full rounded-t bg-indigo-300"
              style={{ height: `${(d.v2 / maxVal) * height}px` }}
            />
          )}
          <div
            className="w-full rounded-t bg-indigo-600"
            style={{ height: `${(d.v1 / maxVal) * height}px` }}
          />
        </div>
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const [overview, setOverview] = useState<ReportsOverview | null>(null);
  const [convByDay, setConvByDay] = useState<DayData[]>([]);
  const [msgByDay, setMsgByDay] = useState<MessageDayData[]>([]);
  const [channels, setChannels] = useState<ChannelData[]>([]);
  const [agents, setAgents] = useState<AgentPerformance[]>([]);
  const [csatStats, setCsatStats] = useState<{ avg: number; total: number; distribution: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getReportsOverview(),
      api.getConversationsByDay(period),
      api.getMessagesByDay(period),
      api.getReportsByChannel(),
      api.getAgentPerformance(),
      api.getCsatStats(),
    ])
      .then(([ov, conv, msg, ch, ag, csat]) => {
        setOverview(ov);
        setConvByDay(conv);
        setMsgByDay(msg);
        setChannels(ch);
        setAgents(ag);
        setCsatStats(csat);
      })
      .finally(() => setLoading(false));
  }, [period]);

  if (loading || !overview) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        Loading reports...
      </div>
    );
  }

  const last7Conv = convByDay.slice(-7);
  const last7Msg = msgByDay.slice(-7);
  const maxAgentMessages = Math.max(...agents.map((a) => a.messagesSent), 1);

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="mx-auto max-w-6xl px-6 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Reports</h2>
            <p className="text-sm text-gray-500">Analytics & performance overview</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {[7, 14, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setPeriod(d)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    period === d ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <button
                onClick={async () => {
                  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
                  const token = localStorage.getItem('token');
                  const res = await fetch(`${apiUrl}/api/reports/export/conversations`, { headers: { Authorization: `Bearer ${token}` } });
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = 'conversations.csv'; a.click();
                  URL.revokeObjectURL(url);
                }}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                Export Conversations
              </button>
              <button
                onClick={async () => {
                  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
                  const token = localStorage.getItem('token');
                  const res = await fetch(`${apiUrl}/api/reports/export/messages`, { headers: { Authorization: `Bearer ${token}` } });
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = 'messages.csv'; a.click();
                  URL.revokeObjectURL(url);
                }}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                Export Messages
              </button>
            </div>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard label="Total Conversations" value={overview.totalConversations} color="text-gray-900" />
          <StatCard label="Open" value={overview.openConversations} color="text-orange-600" sub="Needs attention" />
          <StatCard label="Resolved" value={overview.resolvedConversations} color="text-green-600" sub={`${overview.resolutionRate}% rate`} />
          <StatCard label="Total Messages" value={overview.totalMessages} color="text-indigo-600" sub={`~${overview.avgMessages}/conv`} />
          <StatCard label="CSAT Score" value={csatStats?.avg || '-'} color="text-yellow-600" sub={csatStats ? `${csatStats.total} ratings` : 'No ratings yet'} />
        </div>

        {/* Charts Row */}
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Conversations Chart */}
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">Conversations (last 7 days)</h3>
            <SimpleChart
              data={last7Conv.map((d) => ({
                label: d.date.slice(5),
                v1: d.total - d.resolved,
                v2: d.resolved,
              }))}
            />
            <div className="mt-2 flex gap-4 text-[10px] text-gray-400">
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-indigo-600" /> Open</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-indigo-300" /> Resolved</span>
            </div>
          </div>

          {/* Messages Chart */}
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">Messages (last 7 days)</h3>
            <SimpleChart
              data={last7Msg.map((d) => ({
                label: d.date.slice(5),
                v1: d.incoming,
                v2: d.outgoing,
              }))}
            />
            <div className="mt-2 flex gap-4 text-[10px] text-gray-400">
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-indigo-600" /> Incoming</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-indigo-300" /> Outgoing</span>
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* By Channel */}
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">By Channel</h3>
            {channels.length === 0 ? (
              <p className="text-sm text-gray-400">No channels configured</p>
            ) : (
              <div className="space-y-3">
                {channels.map((ch) => (
                  <div key={ch.inboxId} className="flex items-center gap-3">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white ${channelColors[ch.channelType] || 'bg-gray-400'}`}>
                      {ch.channelType === 'line' ? 'L' : ch.channelType === 'facebook' ? 'F' : 'IG'}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-700">{ch.name}</span>
                        <span className="text-xs text-gray-400">{ch.conversations} conv / {ch.messages} msg</span>
                      </div>
                      <MiniBar value={ch.conversations} max={Math.max(...channels.map((c) => c.conversations), 1)} color={channelColors[ch.channelType] || 'bg-gray-400'} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Agent Performance */}
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">Agent Performance</h3>
            {agents.length === 0 ? (
              <p className="text-sm text-gray-400">No agents yet</p>
            ) : (
              <div className="space-y-3">
                {agents.map((agent) => (
                  <div key={agent.id} className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">
                      {agent.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-700">{agent.name}</span>
                        <span className="text-xs text-gray-400">
                          {agent.assigned} assigned / {agent.resolved} resolved / {agent.messagesSent} sent
                        </span>
                      </div>
                      <MiniBar value={agent.messagesSent} max={maxAgentMessages} color="bg-indigo-500" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Contacts stat */}
        <div className="mt-6 text-center text-sm text-gray-400">
          Total contacts: {overview.totalContacts}
        </div>
      </div>
    </div>
  );
}
