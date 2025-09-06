export interface VetoSession {
  userId: number;
  step: 'username' | 'feedback' | 'images' | 'review';
  targetUsername?: string;
  feedback?: string;
  images?: string[];
  messageIds?: number[];
  createdAt: Date;
}

class SessionManager {
  private sessions: Map<number, VetoSession> = new Map();

  startSession(userId: number): VetoSession {
    const session: VetoSession = {
      userId,
      step: 'username',
      createdAt: new Date()
    };
    this.sessions.set(userId, session);
    return session;
  }

  getSession(userId: number): VetoSession | undefined {
    return this.sessions.get(userId);
  }

  updateSession(userId: number, updates: Partial<VetoSession>): VetoSession | undefined {
    const session = this.sessions.get(userId);
    if (!session) return undefined;
    
    const updatedSession = { ...session, ...updates };
    this.sessions.set(userId, updatedSession);
    return updatedSession;
  }

  clearSession(userId: number): void {
    this.sessions.delete(userId);
  }

  hasActiveSession(userId: number): boolean {
    return this.sessions.has(userId);
  }

  addMessageId(userId: number, messageId: number): void {
    const session = this.sessions.get(userId);
    if (session) {
      if (!session.messageIds) {
        session.messageIds = [];
      }
      session.messageIds.push(messageId);
      this.sessions.set(userId, session);
    }
  }

  // Clean up old sessions (older than 30 minutes)
  cleanupOldSessions(): void {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    for (const [userId, session] of this.sessions.entries()) {
      if (session.createdAt < thirtyMinutesAgo) {
        this.sessions.delete(userId);
      }
    }
  }
}

export const sessionManager = new SessionManager();

// Clean up old sessions every 10 minutes
setInterval(() => {
  sessionManager.cleanupOldSessions();
}, 10 * 60 * 1000);