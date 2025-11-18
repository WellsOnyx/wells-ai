// app/api/chat/wells-v2/route.ts
// Layer 1: Simple echo endpoint

export async function POST(req: Request) {
  try {
    const { message } = await req.json()
    return Response.json({
      response: `Echo: ${message}`,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
