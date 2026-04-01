import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const res = await fetch(`${API_URL}/api/webhooks/facebook${url.search}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  const text = await res.text();
  return new NextResponse(text, { status: res.status });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const res = await fetch(`${API_URL}/api/webhooks/facebook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hub-signature-256': req.headers.get('x-hub-signature-256') || '',
    },
    body,
  });
  const data = await res.text();
  return new NextResponse(data, { status: res.status });
}
