import { NextResponse } from 'next/server';
import { listSessions, saveSession, type Session } from '@/lib/session';

export async function GET() {
  const sessions = await listSessions();
  return NextResponse.json(sessions);
}

export async function POST(request: Request) {
  const session: Session = await request.json();
  await saveSession(session);
  return NextResponse.json({ success: true });
}
