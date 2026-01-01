import { NextRequest, NextResponse } from 'next/server'

// ============================================
// TYPES
// ============================================

interface FormTestRequest {
  url: string
  method?: 'POST' | 'GET' | 'PUT' | 'PATCH' | 'DELETE'
  contentType?: 'application/json' | 'application/x-www-form-urlencoded' | 'multipart/form-data'
  data: Record<string, string | number | boolean | null>
  headers?: Record<string, string>
  timeout?: number // in milliseconds
  followRedirects?: boolean
}

type ContentTypeValue = 'application/json' | 'application/x-www-form-urlencoded' | 'multipart/form-data' | ''

interface FormTestResult {
  success: boolean
  request: {
    url: string
    method: string
    contentType: string
    dataSent: Record<string, unknown>
    headers: Record<string, string>
  }
  response: {
    status: number
    statusText: string
    headers: Record<string, string>
    bodyPreview: string
    bodyLength: number
    isJson: boolean
    jsonData?: unknown
    redirected: boolean
    finalUrl: string
    timing: {
      startTime: string
      endTime: string
      durationMs: number
    }
  }
  error?: string
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function buildFormUrlEncoded(data: Record<string, string | number | boolean | null>): string {
  return Object.entries(data)
    .filter(([_, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
}

function truncateBody(body: string, maxLength: number = 10000): string {
  if (body.length <= maxLength) return body
  return body.slice(0, maxLength) + `\n\n... [truncated, ${body.length - maxLength} more characters]`
}

function headersToObject(headers: Headers): Record<string, string> {
  const obj: Record<string, string> = {}
  headers.forEach((value, key) => {
    obj[key] = value
  })
  return obj
}

function isJsonResponse(contentType: string | null): boolean {
  if (!contentType) return false
  return contentType.includes('application/json') || contentType.includes('+json')
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

// ============================================
// MAIN HANDLER
// ============================================

export async function POST(request: NextRequest) {
  const startTime = new Date()

  try {
    const body: FormTestRequest = await request.json()
    const {
      url,
      method = 'POST',
      contentType = 'application/json',
      data,
      headers: customHeaders = {},
      timeout = 30000,
      followRedirects = true,
    } = body

    // Validate URL
    if (!url) {
      return NextResponse.json(
        { error: 'URL is required', success: false },
        { status: 400 }
      )
    }

    let targetUrl: URL
    try {
      targetUrl = new URL(url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format', success: false },
        { status: 400 }
      )
    }

    // Only allow http/https
    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
      return NextResponse.json(
        { error: 'Only HTTP and HTTPS URLs are supported', success: false },
        { status: 400 }
      )
    }

    // Validate data
    if (!data || typeof data !== 'object') {
      return NextResponse.json(
        { error: 'Data must be an object', success: false },
        { status: 400 }
      )
    }

    // Validate timeout
    const effectiveTimeout = Math.min(Math.max(timeout, 1000), 60000) // Between 1s and 60s

    // Build request body based on content type
    let requestBody: string | FormData
    let finalContentType: ContentTypeValue = contentType

    if (contentType === 'application/json') {
      requestBody = JSON.stringify(data)
    } else if (contentType === 'application/x-www-form-urlencoded') {
      requestBody = buildFormUrlEncoded(data)
    } else if (contentType === 'multipart/form-data') {
      // For multipart, we need to let fetch set the content-type with boundary
      const formData = new FormData()
      Object.entries(data).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          formData.append(key, String(value))
        }
      })
      requestBody = formData
      finalContentType = '' // Let fetch handle it
    } else {
      requestBody = JSON.stringify(data)
      finalContentType = 'application/json'
    }

    // Build headers
    const requestHeaders: Record<string, string> = {
      'User-Agent': 'WellsAI-FormTester/1.0 (https://wellsai.com)',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      ...customHeaders,
    }

    if (finalContentType) {
      requestHeaders['Content-Type'] = finalContentType
    }

    // Setup timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout)

    let response: Response
    try {
      response = await fetch(targetUrl.toString(), {
        method,
        headers: requestHeaders,
        body: method !== 'GET' && method !== 'DELETE' ? requestBody : undefined,
        signal: controller.signal,
        redirect: followRedirects ? 'follow' : 'manual',
      })
    } catch (error) {
      clearTimeout(timeoutId)
      const endTime = new Date()

      if (error instanceof Error && error.name === 'AbortError') {
        return NextResponse.json(
          {
            error: `Request timed out after ${effectiveTimeout}ms`,
            success: false,
            request: {
              url: targetUrl.toString(),
              method,
              contentType: finalContentType || contentType,
              dataSent: data,
              headers: requestHeaders,
            },
            response: {
              status: 0,
              statusText: 'Timeout',
              headers: {},
              bodyPreview: '',
              bodyLength: 0,
              isJson: false,
              redirected: false,
              finalUrl: '',
              timing: {
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                durationMs: endTime.getTime() - startTime.getTime(),
              },
            },
          },
          { status: 408 }
        )
      }

      return NextResponse.json(
        {
          error: `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          success: false,
        },
        { status: 502 }
      )
    } finally {
      clearTimeout(timeoutId)
    }

    const endTime = new Date()

    // Read response body
    const responseText = await response.text()
    const responseContentType = response.headers.get('content-type')
    const isJson = isJsonResponse(responseContentType)
    const jsonData = isJson ? tryParseJson(responseText) : null

    const result: FormTestResult = {
      success: response.ok,
      request: {
        url: targetUrl.toString(),
        method,
        contentType: finalContentType || contentType,
        dataSent: data,
        headers: requestHeaders,
      },
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: headersToObject(response.headers),
        bodyPreview: truncateBody(responseText),
        bodyLength: responseText.length,
        isJson,
        jsonData: jsonData ?? undefined,
        redirected: response.redirected,
        finalUrl: response.url,
        timing: {
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          durationMs: endTime.getTime() - startTime.getTime(),
        },
      },
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Form test error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        success: false,
      },
      { status: 500 }
    )
  }
}

// OPTIONS handler for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}

// GET handler for documentation
export async function GET() {
  return NextResponse.json({
    name: 'WellsAI Form Test API',
    version: '1.0.0',
    description: 'Test form submissions and API endpoints',
    usage: {
      method: 'POST',
      contentType: 'application/json',
      body: {
        url: 'Required. The target URL to submit form data to.',
        method: 'Optional. HTTP method: POST, GET, PUT, PATCH, DELETE. Default: POST',
        contentType: 'Optional. Content type: application/json, application/x-www-form-urlencoded, multipart/form-data. Default: application/json',
        data: 'Required. Object containing form field key-value pairs.',
        headers: 'Optional. Custom headers to include in the request.',
        timeout: 'Optional. Timeout in milliseconds (1000-60000). Default: 30000',
        followRedirects: 'Optional. Whether to follow redirects. Default: true',
      },
      example: {
        url: 'https://httpbin.org/post',
        method: 'POST',
        contentType: 'application/json',
        data: {
          name: 'Test User',
          email: 'test@example.com',
        },
        timeout: 10000,
      },
    },
  })
}
