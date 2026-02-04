import { nanoid } from 'nanoid';
import fs from 'fs/promises';
import path from 'path';

export interface SessionMessage {
  id: number;
  type: "sent" | "received";
  content: string;
  dataType: string;
  timestamp: string;
  rawString: string;
}

export interface Session {
  id: string;
  createdAt: string;
  updatedAt: string;
  messages: SessionMessage[];
  metadata?: {
    imageUrls?: string[];
    photopeaSrc?: string;
  };
}

const SESSIONS_DIR = path.join(process.cwd(), '.sessions');

export function generateSessionId(): string {
  return nanoid(16);
}

export async function saveSession(session: Session): Promise<void> {
  await fs.mkdir(SESSIONS_DIR, { recursive: true });
  const filePath = path.join(SESSIONS_DIR, `${session.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8');
}

export async function loadSession(sessionId: string): Promise<Session | null> {
  try {
    const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function listSessions(): Promise<Session[]> {
  try {
    await fs.mkdir(SESSIONS_DIR, { recursive: true });
    const files = await fs.readdir(SESSIONS_DIR);
    const sessions: Session[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(SESSIONS_DIR, file);
        const data = await fs.readFile(filePath, 'utf-8');
        sessions.push(JSON.parse(data));
      }
    }

    // Sort by updatedAt descending
    return sessions.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch {
    return [];
  }
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  try {
    const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
    await fs.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}
