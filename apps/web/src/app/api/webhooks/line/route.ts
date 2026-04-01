import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const res = await fetch(`${API_URL}/api/webhooks/line`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-line-signature': req.headers.get('x-line-signature') || '',
    },
    body,
  });
  const data = await res.text();
  return new NextResponse(data, { status: res.status });
}
