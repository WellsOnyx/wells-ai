import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

// ============================================
// TYPES
// ============================================

interface ScrapeRequest {
  url: string
  options?: {
    extractImages?: boolean
    extractScripts?: boolean
    maxDepth?: number
  }
}

interface FormField {
  name: string
  type: string
  id?: string
  placeholder?: string
  required?: boolean
  value?: string
}

interface FormData {
  action: string
  method: string
  id?: string
  name?: string
  fields: FormField[]
}

interface LinkData {
  href: string
  text: string
  rel?: string
  isExternal: boolean
}

interface ImageData {
  src: string
  alt?: string
  width?: string
  height?: string
}

interface ScrapeResult {
  success: boolean
  url: string
  timestamp: string
  meta: {
    title: string
    description: string
    keywords?: string
    author?: string
    ogTitle?: string
    ogDescription?: string
    ogImage?: string
    canonical?: string
  }
  headings: {
    h1: string[]
    h2: string[]
    h3: string[]
    h4: string[]
    h5: string[]
    h6: string[]
  }
  links: LinkData[]
  forms: FormData[]
  images?: ImageData[]
  textContent: string
  wordCount: number
  error?: string
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function isExternalLink(href: string, baseUrl: string): boolean {
  try {
    const linkUrl = new URL(href, baseUrl)
    const base = new URL(baseUrl)
    return linkUrl.hostname !== base.hostname
  } catch {
    return false
  }
}

function normalizeUrl(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).toString()
  } catch {
    return href
  }
}

function truncateText(text: string, maxLength: number = 500): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

// ============================================
// MAIN HANDLER
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body: ScrapeRequest = await request.json()
    const { url, options = {} } = body

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

    // Fetch the page with proper headers to avoid blocks
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

    let response: Response
    try {
      response = await fetch(targetUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
        signal: controller.signal,
        redirect: 'follow',
      })
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timed out after 30 seconds', success: false },
          { status: 408 }
        )
      }
      return NextResponse.json(
        { error: `Failed to fetch URL: ${error instanceof Error ? error.message : 'Unknown error'}`, success: false },
        { status: 502 }
      )
    } finally {
      clearTimeout(timeoutId)
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `HTTP ${response.status}: ${response.statusText}`,
          success: false,
          statusCode: response.status
        },
        { status: 422 }
      )
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return NextResponse.json(
        {
          error: `Content type is not HTML: ${contentType}`,
          success: false,
          contentType
        },
        { status: 422 }
      )
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // Extract metadata
    const meta = {
      title: $('title').text().trim() || $('meta[property="og:title"]').attr('content') || '',
      description: $('meta[name="description"]').attr('content') ||
                   $('meta[property="og:description"]').attr('content') || '',
      keywords: $('meta[name="keywords"]').attr('content'),
      author: $('meta[name="author"]').attr('content'),
      ogTitle: $('meta[property="og:title"]').attr('content'),
      ogDescription: $('meta[property="og:description"]').attr('content'),
      ogImage: $('meta[property="og:image"]').attr('content'),
      canonical: $('link[rel="canonical"]').attr('href'),
    }

    // Extract headings
    const headings = {
      h1: $('h1').map((_, el) => $(el).text().trim()).get(),
      h2: $('h2').map((_, el) => $(el).text().trim()).get(),
      h3: $('h3').map((_, el) => $(el).text().trim()).get(),
      h4: $('h4').map((_, el) => $(el).text().trim()).get(),
      h5: $('h5').map((_, el) => $(el).text().trim()).get(),
      h6: $('h6').map((_, el) => $(el).text().trim()).get(),
    }

    // Extract links
    const links: LinkData[] = []
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href')
      if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
        links.push({
          href: normalizeUrl(href, url),
          text: $(el).text().trim().slice(0, 100),
          rel: $(el).attr('rel'),
          isExternal: isExternalLink(href, url),
        })
      }
    })

    // Extract forms
    const forms: FormData[] = []
    $('form').each((_, formEl) => {
      const $form = $(formEl)
      const fields: FormField[] = []

      // Extract input fields
      $form.find('input, select, textarea').each((_, fieldEl) => {
        const $field = $(fieldEl)
        const type = $field.attr('type') || ($field.is('textarea') ? 'textarea' : ($field.is('select') ? 'select' : 'text'))
        const name = $field.attr('name')

        if (name && !['submit', 'reset', 'button', 'hidden'].includes(type)) {
          fields.push({
            name,
            type,
            id: $field.attr('id'),
            placeholder: $field.attr('placeholder'),
            required: $field.attr('required') !== undefined,
            value: $field.attr('value'),
          })
        }
      })

      forms.push({
        action: normalizeUrl($form.attr('action') || '', url),
        method: ($form.attr('method') || 'GET').toUpperCase(),
        id: $form.attr('id'),
        name: $form.attr('name'),
        fields,
      })
    })

    // Extract images if requested
    let images: ImageData[] | undefined
    if (options.extractImages) {
      images = []
      $('img[src]').each((_, el) => {
        const $img = $(el)
        images!.push({
          src: normalizeUrl($img.attr('src') || '', url),
          alt: $img.attr('alt'),
          width: $img.attr('width'),
          height: $img.attr('height'),
        })
      })
    }

    // Extract text content
    // Remove script, style, and other non-content elements
    $('script, style, noscript, iframe, svg, nav, footer, header').remove()
    const textContent = truncateText(
      $('body').text()
        .replace(/\s+/g, ' ')
        .trim(),
      5000
    )

    const wordCount = textContent.split(/\s+/).filter(word => word.length > 0).length

    const result: ScrapeResult = {
      success: true,
      url: response.url, // Final URL after redirects
      timestamp: new Date().toISOString(),
      meta,
      headings,
      links: links.slice(0, 100), // Limit to first 100 links
      forms,
      images: images?.slice(0, 50), // Limit to first 50 images
      textContent,
      wordCount,
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Scrape error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        success: false
      },
      { status: 500 }
    )
  }
}

// GET handler for simple scrapes via query param
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json(
      { error: 'URL query parameter is required', success: false },
      { status: 400 }
    )
  }

  // Create a mock request and delegate to POST
  const mockRequest = new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ url }),
    headers: {
      'Content-Type': 'application/json',
    },
  })

  return POST(mockRequest)
}
