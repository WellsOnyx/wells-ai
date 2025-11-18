// app/api/chat/test-simple/route.ts
export async function POST(req: Request) {
  try {
    console.log('TEST: Request received')
    const body = await req.json()
    console.log('TEST: Body parsed:', body)

    return Response.json({
      success: true,
      message: 'Test endpoint works',
      receivedMessage: body.message
    })
  } catch (error) {
    console.error('TEST: Error:', error)
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
