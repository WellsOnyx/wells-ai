/**
 * Founder Projects API
 * GET: List user's projects (with status filter)
 * POST: Create new project
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sqlQuery as sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Project status types
type ProjectStatus = 'draft' | 'planning' | 'sourcing' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';

interface ParsedProjectInput {
  name?: string;
  description?: string;
  category?: string;
  targetBudget?: number;
  targetLaunchDate?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

function parseProjectFromText(text: string): ParsedProjectInput {
  const result: ParsedProjectInput = {};
  const lower = text.toLowerCase();

  // Extract budget
  const budgetMatch = text.match(/\$?([\d,]+(?:\.\d{2})?)\s*(?:budget|total|cost)?/i);
  if (budgetMatch) {
    result.targetBudget = parseFloat(budgetMatch[1].replace(/,/g, ''));
  }

  // Extract priority
  if (lower.includes('urgent') || lower.includes('asap')) {
    result.priority = 'urgent';
  } else if (lower.includes('high priority')) {
    result.priority = 'high';
  } else if (lower.includes('low priority')) {
    result.priority = 'low';
  }

  // Extract date
  const dateMatch = text.match(/(?:by|before|launch|deadline)\s+(\w+\s+\d{1,2}(?:,?\s+\d{4})?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i);
  if (dateMatch) {
    result.targetLaunchDate = dateMatch[1];
  }

  // Extract category hints
  const categories = ['hardware', 'software', 'electronics', 'manufacturing', 'prototype', 'consumer', 'b2b', 'iot', 'robotics', 'medical'];
  for (const cat of categories) {
    if (lower.includes(cat)) {
      result.category = cat;
      break;
    }
  }

  // The rest is likely the name/description
  const cleanText = text
    .replace(/\$[\d,]+(?:\.\d{2})?/g, '')
    .replace(/(?:by|before|launch|deadline)\s+\w+\s+\d{1,2}(?:,?\s+\d{4})?/gi, '')
    .replace(/(?:urgent|high priority|low priority|asap)/gi, '')
    .trim();

  if (cleanText.length > 0) {
    // First sentence or phrase is likely the name
    const sentences = cleanText.split(/[.!?]/);
    result.name = sentences[0].trim().slice(0, 100);
    if (sentences.length > 1) {
      result.description = sentences.slice(1).join('. ').trim();
    }
  }

  return result;
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status') as ProjectStatus | null;
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');

    // Build query based on filters
    let result;
    if (status && search) {
      result = await sql`
        SELECT
          p.*,
          COALESCE(b.bom_count, 0) as bom_item_count,
          COALESCE(b.total_cost, 0) as bom_total_cost,
          COALESCE(t.task_count, 0) as task_count,
          COALESCE(t.completed_tasks, 0) as completed_task_count,
          COALESCE(m.milestone_count, 0) as milestone_count
        FROM founder_projects p
        LEFT JOIN (
          SELECT project_id, COUNT(*) as bom_count, SUM(unit_cost * quantity) as total_cost
          FROM founder_project_bom
          GROUP BY project_id
        ) b ON p.id = b.project_id
        LEFT JOIN (
          SELECT project_id, COUNT(*) as task_count,
                 COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks
          FROM founder_project_tasks
          GROUP BY project_id
        ) t ON p.id = t.project_id
        LEFT JOIN (
          SELECT project_id, COUNT(*) as milestone_count
          FROM founder_project_milestones
          GROUP BY project_id
        ) m ON p.id = m.project_id
        WHERE p.user_id = ${userId}
          AND p.status = ${status}
          AND (p.name ILIKE ${'%' + search + '%'} OR p.description ILIKE ${'%' + search + '%'})
        ORDER BY p.updated_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    } else if (status) {
      result = await sql`
        SELECT
          p.*,
          COALESCE(b.bom_count, 0) as bom_item_count,
          COALESCE(b.total_cost, 0) as bom_total_cost,
          COALESCE(t.task_count, 0) as task_count,
          COALESCE(t.completed_tasks, 0) as completed_task_count,
          COALESCE(m.milestone_count, 0) as milestone_count
        FROM founder_projects p
        LEFT JOIN (
          SELECT project_id, COUNT(*) as bom_count, SUM(unit_cost * quantity) as total_cost
          FROM founder_project_bom
          GROUP BY project_id
        ) b ON p.id = b.project_id
        LEFT JOIN (
          SELECT project_id, COUNT(*) as task_count,
                 COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks
          FROM founder_project_tasks
          GROUP BY project_id
        ) t ON p.id = t.project_id
        LEFT JOIN (
          SELECT project_id, COUNT(*) as milestone_count
          FROM founder_project_milestones
          GROUP BY project_id
        ) m ON p.id = m.project_id
        WHERE p.user_id = ${userId} AND p.status = ${status}
        ORDER BY p.updated_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    } else if (search) {
      result = await sql`
        SELECT
          p.*,
          COALESCE(b.bom_count, 0) as bom_item_count,
          COALESCE(b.total_cost, 0) as bom_total_cost,
          COALESCE(t.task_count, 0) as task_count,
          COALESCE(t.completed_tasks, 0) as completed_task_count,
          COALESCE(m.milestone_count, 0) as milestone_count
        FROM founder_projects p
        LEFT JOIN (
          SELECT project_id, COUNT(*) as bom_count, SUM(unit_cost * quantity) as total_cost
          FROM founder_project_bom
          GROUP BY project_id
        ) b ON p.id = b.project_id
        LEFT JOIN (
          SELECT project_id, COUNT(*) as task_count,
                 COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks
          FROM founder_project_tasks
          GROUP BY project_id
        ) t ON p.id = t.project_id
        LEFT JOIN (
          SELECT project_id, COUNT(*) as milestone_count
          FROM founder_project_milestones
          GROUP BY project_id
        ) m ON p.id = m.project_id
        WHERE p.user_id = ${userId}
          AND (p.name ILIKE ${'%' + search + '%'} OR p.description ILIKE ${'%' + search + '%'})
        ORDER BY p.updated_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    } else {
      result = await sql`
        SELECT
          p.*,
          COALESCE(b.bom_count, 0) as bom_item_count,
          COALESCE(b.total_cost, 0) as bom_total_cost,
          COALESCE(t.task_count, 0) as task_count,
          COALESCE(t.completed_tasks, 0) as completed_task_count,
          COALESCE(m.milestone_count, 0) as milestone_count
        FROM founder_projects p
        LEFT JOIN (
          SELECT project_id, COUNT(*) as bom_count, SUM(unit_cost * quantity) as total_cost
          FROM founder_project_bom
          GROUP BY project_id
        ) b ON p.id = b.project_id
        LEFT JOIN (
          SELECT project_id, COUNT(*) as task_count,
                 COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks
          FROM founder_project_tasks
          GROUP BY project_id
        ) t ON p.id = t.project_id
        LEFT JOIN (
          SELECT project_id, COUNT(*) as milestone_count
          FROM founder_project_milestones
          GROUP BY project_id
        ) m ON p.id = m.project_id
        WHERE p.user_id = ${userId}
        ORDER BY p.updated_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    }

    const projects = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      status: row.status,
      priority: row.priority,
      targetBudget: row.target_budget ? parseFloat(row.target_budget) : null,
      targetLaunchDate: row.target_launch_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      stats: {
        bomItems: parseInt(row.bom_item_count) || 0,
        bomTotalCost: parseFloat(row.bom_total_cost) || 0,
        tasks: parseInt(row.task_count) || 0,
        completedTasks: parseInt(row.completed_task_count) || 0,
        milestones: parseInt(row.milestone_count) || 0,
      },
    }));

    // Get total count
    const countResult = await sql`
      SELECT COUNT(*) as total FROM founder_projects WHERE user_id = ${userId}
    `;
    const total = parseInt(countResult.rows[0]?.total || '0');

    // Generate conversational message
    let message: string;
    if (projects.length === 0) {
      message = status
        ? `You don't have any ${status} projects yet. Want to create one?`
        : "You don't have any projects yet. Tell me about what you're building and I'll help you set it up.";
    } else {
      const activeCount = projects.filter(p => ['planning', 'sourcing', 'in_progress'].includes(p.status)).length;
      message = `Found ${projects.length} project${projects.length !== 1 ? 's' : ''}. ${activeCount} currently active.`;
    }

    return NextResponse.json({
      success: true,
      projects,
      total,
      pagination: {
        limit,
        offset,
        hasMore: offset + projects.length < total,
      },
      message,
    });
  } catch (error: any) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, text, data } = body;

    // Parse from natural language if provided
    let projectData = data || {};
    if (text) {
      const parsed = parseProjectFromText(text);
      projectData = { ...parsed, ...projectData };
    }

    switch (action) {
      case 'create':
      default: {
        // Validate required fields
        if (!projectData.name) {
          return NextResponse.json({
            success: false,
            message: "What would you like to call this project? Give me a name and I'll set it up.",
            parsed: projectData,
          });
        }

        // Create the project
        const result = await sql`
          INSERT INTO founder_projects (
            user_id,
            name,
            description,
            category,
            status,
            priority,
            target_budget,
            target_launch_date,
            metadata,
            created_at,
            updated_at
          ) VALUES (
            ${userId},
            ${projectData.name},
            ${projectData.description || null},
            ${projectData.category || null},
            ${projectData.status || 'draft'},
            ${projectData.priority || 'medium'},
            ${projectData.targetBudget || null},
            ${projectData.targetLaunchDate ? new Date(projectData.targetLaunchDate) : null},
            ${JSON.stringify(projectData.metadata || {})},
            NOW(),
            NOW()
          )
          RETURNING *
        `;

        const project = result.rows[0];

        let message = `Created "${project.name}"!`;
        if (!projectData.description) {
          message += " Add a description when you're ready.";
        }
        if (!projectData.targetBudget) {
          message += " Set a target budget to help with planning.";
        }
        message += " You can start adding BOM items or tasks.";

        return NextResponse.json({
          success: true,
          project: {
            id: project.id,
            name: project.name,
            description: project.description,
            category: project.category,
            status: project.status,
            priority: project.priority,
            targetBudget: project.target_budget ? parseFloat(project.target_budget) : null,
            targetLaunchDate: project.target_launch_date,
            createdAt: project.created_at,
            updatedAt: project.updated_at,
          },
          message,
        });
      }

      case 'parse': {
        // Parse text without creating
        if (!text) {
          return NextResponse.json({
            success: false,
            message: "Tell me about your project and I'll help structure it.",
          });
        }

        const parsed = parseProjectFromText(text);

        return NextResponse.json({
          success: true,
          parsed,
          message: parsed.name
            ? `Got it - "${parsed.name}". ${parsed.targetBudget ? `Budget: $${parsed.targetBudget.toLocaleString()}. ` : ''}Ready to create?`
            : "I'll need at least a project name. What are you building?",
        });
      }
    }
  } catch (error: any) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create project' },
      { status: 500 }
    );
  }
}
