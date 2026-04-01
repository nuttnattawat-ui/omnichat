const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
    }
  }

  getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem('token');
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(options.headers as Record<string, string>),
    };

    let res: Response | null = null;

    // Retry up to 2 times for cold start (Render free tier sleeps after 15min)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        res = await fetch(`${API_URL}/api${path}`, {
          ...options,
          headers,
          signal: AbortSignal.timeout(90_000), // 90s timeout for cold start
        });
        break;
      } catch (err) {
        if (attempt === 2) {
          throw new Error('เซิร์ฟเวอร์กำลังเริ่มระบบ กรุณาลองอีกครั้ง');
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    if (!res) {
      throw new Error('เซิร์ฟเวอร์กำลังเริ่มระบบ กรุณาลองอีกครั้ง');
    }

    if (res.status === 401) {
      this.clearToken();
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(error.message || 'Request failed');
    }

    return res.json();
  }

  // Auth
  login(email: string, password: string) {
    return this.request<{ accessToken: string; refreshToken: string }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
    );
  }

  register(data: { email: string; password: string; name: string; accountName?: string }) {
    return this.request<{ accessToken: string; refreshToken: string }>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify(data) },
    );
  }

  // Conversations
  getConversations(params?: { status?: string; inboxId?: number }) {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.inboxId) query.set('inboxId', String(params.inboxId));
    return this.request<Conversation[]>(`/conversations?${query}`);
  }

  getConversation(id: number) {
    return this.request<Conversation>(`/conversations/${id}`);
  }

  updateConversationStatus(id: number, status: string) {
    return this.request(`/conversations/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  assignConversation(id: number, assigneeId: number | null) {
    return this.request(`/conversations/${id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ assigneeId }),
    });
  }

  // Messages
  getMessages(conversationId: number) {
    return this.request<Message[]>(
      `/conversations/${conversationId}/messages`,
    );
  }

  sendMessage(conversationId: number, data: { content: string; contentType?: string; private?: boolean; contentAttributes?: Record<string, unknown> }) {
    return this.request<Message>(
      `/conversations/${conversationId}/messages`,
      { method: 'POST', body: JSON.stringify(data) },
    );
  }

  // Contacts
  getContacts() {
    return this.request<Contact[]>('/contacts');
  }

  getContact(id: number) {
    return this.request<Contact>(`/contacts/${id}`);
  }

  updateContact(id: number, data: { name?: string; email?: string; phone?: string }) {
    return this.request<Contact>(`/contacts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Inboxes
  getInboxes() {
    return this.request<Inbox[]>('/inboxes');
  }

  createInbox(data: { name: string; channelType: string; channelConfig: Record<string, string> }) {
    return this.request<Inbox>('/inboxes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateInbox(id: number, data: Record<string, unknown>) {
    return this.request(`/inboxes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  deleteInbox(id: number) {
    return this.request(`/inboxes/${id}`, { method: 'DELETE' });
  }

  // Settings
  getProfile() {
    return this.request<UserProfile>('/settings/profile');
  }

  updateProfile(data: { name?: string }) {
    return this.request('/settings/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  getTeam() {
    return this.request<TeamMember[]>('/settings/team');
  }

  // AI
  suggestReply(conversationId: number) {
    return this.request<{ suggestion: string }>(
      `/ai/suggest/${conversationId}`,
      { method: 'POST' },
    );
  }

  // Reports
  getReportsOverview() {
    return this.request<ReportsOverview>('/reports/overview');
  }

  getConversationsByDay(days = 30) {
    return this.request<DayData[]>(`/reports/conversations-by-day?days=${days}`);
  }

  getMessagesByDay(days = 30) {
    return this.request<MessageDayData[]>(`/reports/messages-by-day?days=${days}`);
  }

  getReportsByChannel() {
    return this.request<ChannelData[]>('/reports/by-channel');
  }

  getAgentPerformance() {
    return this.request<AgentPerformance[]>('/reports/agent-performance');
  }

  // Canned Responses
  getCannedResponses() {
    return this.request<CannedResponse[]>('/canned-responses');
  }

  createCannedResponse(data: { shortCode: string; content: string }) {
    return this.request<CannedResponse>('/canned-responses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateCannedResponse(id: number, data: { shortCode?: string; content?: string }) {
    return this.request(`/canned-responses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  deleteCannedResponse(id: number) {
    return this.request(`/canned-responses/${id}`, { method: 'DELETE' });
  }
}

export const api = new ApiClient();

// Types
export interface Conversation {
  id: number;
  status: string;
  lastActivityAt: string;
  messagesCount: number;
  contact: { id: number; name: string; avatarUrl?: string };
  inbox: { id: number; name: string; channelType: string };
  assignee?: { id: number; name: string };
  messages?: Message[];
}

export interface Message {
  id: number;
  conversationId: number;
  messageType: string;
  content: string;
  contentType: string;
  contentAttributes?: Record<string, unknown>;
  sourceId?: string;
  senderType: string;
  senderId?: number;
  senderName?: string;
  private: boolean;
  createdAt: string;
}

export interface Contact {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  contactInboxes?: { inbox: Inbox; sourceId: string }[];
}

export interface Inbox {
  id: number;
  name: string;
  channelType: string;
  channelConfig: Record<string, string>;
  enabled: boolean;
  aiEnabled: boolean;
  aiPrompt?: string;
  greeting?: string;
}

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
  account: { id: number; name: string; plan: string };
}

export interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

export interface ReportsOverview {
  totalConversations: number;
  openConversations: number;
  resolvedConversations: number;
  totalMessages: number;
  totalContacts: number;
  avgMessages: number;
  resolutionRate: number;
}

export interface DayData {
  date: string;
  total: number;
  resolved: number;
}

export interface MessageDayData {
  date: string;
  incoming: number;
  outgoing: number;
}

export interface ChannelData {
  inboxId: number;
  name: string;
  channelType: string;
  conversations: number;
  messages: number;
}

export interface AgentPerformance {
  id: number;
  name: string;
  role: string;
  avatarUrl?: string;
  assigned: number;
  resolved: number;
  messagesSent: number;
}

export interface CannedResponse {
  id: number;
  shortCode: string;
  content: string;
  createdAt: string;
}
