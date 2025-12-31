/**
 * AI Analysis API for Sourcing Intake
 *
 * Analyzes natural language input and suggests:
 * - Best matching category and subcategory
 * - Pre-filled specifications
 * - Summary of the request
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { SOURCING_CATEGORIES } from '@/lib/wells-ai/sourcing/categories';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { input } = body;

    if (!input || typeof input !== 'string') {
      return NextResponse.json(
        { error: 'Input is required' },
        { status: 400 }
      );
    }

    // Build category reference for AI
    const categoryRef = SOURCING_CATEGORIES.map(cat => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      subcategories: cat.subcategories.map(sub => ({
        id: sub.id,
        name: sub.name
      }))
    }));

    const prompt = `You are a procurement analyst AI. Analyze this sourcing request and extract structured information.

USER'S REQUEST:
"${input}"

AVAILABLE CATEGORIES:
${JSON.stringify(categoryRef, null, 2)}

Analyze the request and provide:
1. The best matching category ID
2. The best matching subcategory ID (from that category)
3. Any specifications you can extract (quantity, budget, location, timeline, etc.)
4. A brief summary of what they need

Respond in JSON format:
{
  "category": "category_id",
  "subcategory": "subcategory_id",
  "suggestedSpecs": {
    "quantity": 1000,
    "unit": "units",
    "budget_min": 10000,
    "budget_max": 50000,
    "delivery_location": "Chicago, IL",
    "frequency": "one-time"
  },
  "summary": "Brief 1-2 sentence summary",
  "confidence": 0.85
}

Only include specs that you can reasonably infer from the input. If you're not sure about a category, use "other".`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      // Parse JSON from response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse AI response');
      }

      const suggestions = JSON.parse(jsonMatch[0]);

      // Validate category exists
      const category = SOURCING_CATEGORIES.find(c => c.id === suggestions.category);
      if (!category) {
        suggestions.category = 'other';
        suggestions.subcategory = 'custom';
      } else {
        // Validate subcategory exists
        const subcategory = category.subcategories.find(s => s.id === suggestions.subcategory);
        if (!subcategory) {
          suggestions.subcategory = category.subcategories[0]?.id;
        }
      }

      return NextResponse.json({
        success: true,
        suggestions,
        originalInput: input
      });

    } catch (aiError) {
      console.error('AI analysis error:', aiError);

      // Return basic fallback
      return NextResponse.json({
        success: true,
        suggestions: {
          category: 'other',
          subcategory: 'custom',
          suggestedSpecs: {},
          summary: input.substring(0, 200),
          confidence: 0.3
        },
        originalInput: input,
        fallback: true
      });
    }

  } catch (error) {
    console.error('Error in analyze endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to analyze request' },
      { status: 500 }
    );
  }
}
