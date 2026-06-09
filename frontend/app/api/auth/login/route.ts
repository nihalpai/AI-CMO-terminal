import { cookies } from 'next/headers'

export async function POST(request: Request) {
  let password: string
  try {
    const body = await request.json()
    password = body.password ?? ''
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const expected = process.env.SHARED_PASSWORD
  const token = process.env.SESSION_TOKEN

  if (!expected || !token) {
    // Env vars not configured — block all access
    return Response.json({ error: 'Server not configured' }, { status: 503 })
  }

  if (password !== expected) {
    return Response.json({ error: 'Incorrect password' }, { status: 401 })
  }

  // Correct password — set the session cookie
  const cookieStore = await cookies()
  cookieStore.set('auth_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })

  return Response.json({ ok: true })
}
