/**
 * Founder Project Financials API
 * GET: Get project financials (budget, spend, variance)
 * POST: Add budget allocation or expense
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sqlQuery as sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

type FinancialType = 'budget' | 'expense' | 'income' | 'adjustment';
type FinancialCategory = 'materials' | 'labor' | 'equipment' | 'services' | 'overhead' | 'contingency' | 'other';

interface ParsedFinancial {
  type?: FinancialType;
  category?: FinancialCategory;
  amount?: number;
  description?: string;
  vendor?: string;
  invoiceNumber?: string;
}

function parseFinancialFromText(text: string): ParsedFinancial {
  const result: ParsedFinancial = {};
  const lower = text.toLowerCase();

  // Type
  if (lower.includes('budget') || lower.includes('allocate')) {
    result.type = 'budget';
  } else if (lower.includes('expense') || lower.includes('spent') || lower.includes('paid') || lower.includes('cost')) {
    result.type = 'expense';
  } else if (lower.includes('income') || lower.includes('received') || lower.includes('revenue')) {
    result.type = 'income';
  } else if (lower.includes('adjust')) {
    result.type = 'adjustment';
  }

  // Category
  const categoryMap: Record<string, FinancialCategory> = {
    'material': 'materials',
    'parts': 'materials',
    'component': 'materials',
    'bom': 'materials',
    'labor': 'labor',
    'worker': 'labor',
    'contractor': 'labor',
    'freelance': 'labor',
    'equipment': 'equipment',
    'tool': 'equipment',
    'machine': 'equipment',
    'service': 'services',
    'software': 'services',
    'subscription': 'services',
    'overhead': 'overhead',
    'rent': 'overhead',
    'utilit': 'overhead',
    'contingency': 'contingency',
    'reserve': 'contingency',
  };

  for (const [keyword, category] of Object.entries(categoryMap)) {
    if (lower.includes(keyword)) {
      result.category = category;
      break;
    }
  }

  // Amount
  const amountMatch = text.match(/\$?([\d,]+(?:\.\d{2})?)/);
  if (amountMatch) {
    result.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
  }

  // Vendor
  const vendorMatch = text.match(/(?:from|to|vendor|supplier|paid)\s+([A-Z][A-Za-z\s]+?)(?:\s+for|\s+\$|$)/i);
  if (vendorMatch) {
    result.vendor = vendorMatch[1].trim();
  }

  // Invoice
  const invoiceMatch = text.match(/(?:invoice|inv|po)[#:\s]*([A-Z0-9-]+)/i);
  if (invoiceMatch) {
    result.invoiceNumber = invoiceMatch[1];
  }

  // Description - clean text
  let cleanText = text
    .replace(/\$[\d,]+(?:\.\d{2})?/g, '')
    .replace(/(?:from|to|vendor|supplier|paid)\s+[A-Z][A-Za-z\s]+/gi, '')
    .replace(/(?:invoice|inv|po)[#:\s]*[A-Z0-9-]+/gi, '')
    .replace(/(?:budget|expense|spent|paid|allocate)/gi, '')
    .trim();

  if (cleanText.length > 0 && cleanText.length < 500) {
    result.description = cleanText;
  }

  return result;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await params;
    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get('type') as FinancialType | null;
    const category = searchParams.get('category') as FinancialCategory | null;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Verify project ownership
    const projectCheck = await sql`
      SELECT id, name, target_budget FROM founder_projects WHERE id = ${projectId} AND user_id = ${userId}
    `;

    if (projectCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: "Project not found or you don't have access.",
      }, { status: 404 });
    }

    const project = projectCheck.rows[0];

    // Get financial entries
    let entries;
    if (type && category) {
      entries = await sql`
        SELECT * FROM founder_project_financials
        WHERE project_id = ${projectId}
          AND type = ${type}
          AND category = ${category}
        ORDER BY date DESC, created_at DESC
      `;
    } else if (type) {
      entries = await sql`
        SELECT * FROM founder_project_financials
        WHERE project_id = ${projectId} AND type = ${type}
        ORDER BY date DESC, created_at DESC
      `;
    } else if (category) {
      entries = await sql`
        SELECT * FROM founder_project_financials
        WHERE project_id = ${projectId} AND category = ${category}
        ORDER BY date DESC, created_at DESC
      `;
    } else {
      entries = await sql`
        SELECT * FROM founder_project_financials
        WHERE project_id = ${projectId}
        ORDER BY date DESC, created_at DESC
      `;
    }

    const transactions = entries.rows.map(row => ({
      id: row.id,
      projectId: row.project_id,
      type: row.type,
      category: row.category,
      amount: parseFloat(row.amount),
      description: row.description,
      vendor: row.vendor,
      invoiceNumber: row.invoice_number,
      date: row.date,
      milestoneId: row.milestone_id,
      bomItemId: row.bom_item_id,
      taskId: row.task_id,
      metadata: row.metadata,
      createdAt: row.created_at,
    }));

    // Calculate summary
    const summaryResult = await sql`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE type = 'budget'), 0) as total_budget,
        COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) as total_expenses,
        COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0) as total_income,
        COALESCE(SUM(amount) FILTER (WHERE type = 'adjustment'), 0) as adjustments
      FROM founder_project_financials
      WHERE project_id = ${projectId}
    `;

    const s = summaryResult.rows[0];
    const totalBudget = parseFloat(s.total_budget) || 0;
    const totalExpenses = parseFloat(s.total_expenses) || 0;
    const totalIncome = parseFloat(s.total_income) || 0;
    const adjustments = parseFloat(s.adjustments) || 0;
    const projectTargetBudget = project.target_budget ? parseFloat(project.target_budget) : totalBudget;

    // Category breakdown
    const categoryBreakdown = await sql`
      SELECT
        category,
        COALESCE(SUM(amount) FILTER (WHERE type = 'budget'), 0) as budgeted,
        COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) as spent
      FROM founder_project_financials
      WHERE project_id = ${projectId}
      GROUP BY category
    `;

    const byCategory = categoryBreakdown.rows.map(row => ({
      category: row.category,
      budgeted: parseFloat(row.budgeted) || 0,
      spent: parseFloat(row.spent) || 0,
      remaining: (parseFloat(row.budgeted) || 0) - (parseFloat(row.spent) || 0),
      utilizationRate: parseFloat(row.budgeted) > 0
        ? Math.round((parseFloat(row.spent) / parseFloat(row.budgeted)) * 100)
        : 0,
    }));

    // BOM cost tracking
    const bomCosts = await sql`
      SELECT
        SUM(unit_cost * quantity) FILTER (WHERE status IN ('sourced', 'ordered', 'shipped', 'received')) as committed_bom,
        SUM(unit_cost * quantity) FILTER (WHERE status = 'received') as received_bom,
        SUM(target_cost * quantity) as target_bom_cost
      FROM founder_project_bom
      WHERE project_id = ${projectId}
    `;

    const bom = bomCosts.rows[0];

    const summary = {
      targetBudget: projectTargetBudget,
      allocatedBudget: totalBudget,
      totalExpenses,
      totalIncome,
      adjustments,
      netPosition: totalBudget + totalIncome + adjustments - totalExpenses,
      remaining: projectTargetBudget - totalExpenses,
      utilizationRate: projectTargetBudget > 0
        ? Math.round((totalExpenses / projectTargetBudget) * 100)
        : 0,
      variance: projectTargetBudget - totalExpenses,
      variancePercent: projectTargetBudget > 0
        ? Math.round(((projectTargetBudget - totalExpenses) / projectTargetBudget) * 100)
        : 0,
      bom: {
        committed: parseFloat(bom.committed_bom) || 0,
        received: parseFloat(bom.received_bom) || 0,
        target: parseFloat(bom.target_bom_cost) || 0,
      },
      byCategory,
    };

    // Generate message
    let message = '';

    if (projectTargetBudget > 0) {
      message = `Budget: $${projectTargetBudget.toLocaleString()}. `;
      message += `Spent: $${totalExpenses.toLocaleString()} (${summary.utilizationRate}%). `;

      if (summary.variance < 0) {
        message += `Over budget by $${Math.abs(summary.variance).toLocaleString()}.`;
      } else {
        message += `$${summary.remaining.toLocaleString()} remaining.`;
      }
    } else if (totalExpenses > 0) {
      message = `Total spent: $${totalExpenses.toLocaleString()}. Set a target budget to track against.`;
    } else {
      message = "No financial data yet. Add a budget or record expenses to start tracking.";
    }

    // Add BOM info if relevant
    if (summary.bom.committed > 0) {
      message += ` BOM committed: $${summary.bom.committed.toLocaleString()}.`;
    }

    return NextResponse.json({
      success: true,
      transactions,
      summary,
      message,
    });
  } catch (error: any) {
    console.error('Error fetching financials:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch financials' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await params;
    const body = await req.json();
    const { action, text, data, entries: bulkEntries } = body;

    // Verify project ownership
    const projectCheck = await sql`
      SELECT id, name, target_budget FROM founder_projects WHERE id = ${projectId} AND user_id = ${userId}
    `;

    if (projectCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: "Project not found or you don't have access.",
      }, { status: 404 });
    }

    const project = projectCheck.rows[0];

    switch (action) {
      case 'set_budget': {
        // Set or update project target budget
        const { amount, breakdown } = data || {};

        if (!amount && !text) {
          return NextResponse.json({
            success: false,
            message: "What's your total budget? Give me a number and I'll set it up.",
          });
        }

        let budgetAmount = amount;
        if (!budgetAmount && text) {
          const parsed = parseFinancialFromText(text);
          budgetAmount = parsed.amount;
        }

        if (!budgetAmount || budgetAmount <= 0) {
          return NextResponse.json({
            success: false,
            message: "I need a valid budget amount. How much are you working with?",
          });
        }

        // Update project target budget
        await sql`
          UPDATE founder_projects
          SET target_budget = ${budgetAmount}, updated_at = NOW()
          WHERE id = ${projectId}
        `;

        // If breakdown provided, create budget allocations
        if (breakdown && typeof breakdown === 'object') {
          for (const [category, alloc] of Object.entries(breakdown)) {
            const allocAmount = typeof alloc === 'number' ? alloc : (alloc as any).amount;
            if (allocAmount > 0) {
              await sql`
                INSERT INTO founder_project_financials (
                  project_id, type, category, amount, description, date, created_at
                ) VALUES (
                  ${projectId}, 'budget', ${category}, ${allocAmount},
                  ${`Budget allocation for ${category}`}, NOW(), NOW()
                )
              `;
            }
          }
        }

        // Log activity
        await sql`
          INSERT INTO founder_project_activity (project_id, type, description, metadata, created_at)
          VALUES (
            ${projectId},
            'budget_set',
            ${`Set project budget to $${budgetAmount.toLocaleString()}`},
            ${JSON.stringify({ amount: budgetAmount, breakdown })}::jsonb,
            NOW()
          )
        `;

        return NextResponse.json({
          success: true,
          budget: budgetAmount,
          message: `Set "${project.name}" budget to $${budgetAmount.toLocaleString()}. I'll help you track spending against this.`,
        });
      }

      case 'allocate': {
        // Allocate budget to a category
        const { category, amount: allocAmount, description: allocDesc } = data || {};

        if (!category || !allocAmount) {
          return NextResponse.json({
            success: false,
            message: "How much do you want to allocate and to which category?",
            categories: ['materials', 'labor', 'equipment', 'services', 'overhead', 'contingency', 'other'],
          });
        }

        const result = await sql`
          INSERT INTO founder_project_financials (
            project_id, type, category, amount, description, date, created_at
          ) VALUES (
            ${projectId}, 'budget', ${category}, ${allocAmount},
            ${allocDesc || `Budget allocation for ${category}`}, NOW(), NOW()
          )
          RETURNING *
        `;

        return NextResponse.json({
          success: true,
          entry: {
            id: result.rows[0].id,
            type: 'budget',
            category,
            amount: allocAmount,
          },
          message: `Allocated $${allocAmount.toLocaleString()} to ${category}.`,
        });
      }

      case 'expense':
      case 'record_expense': {
        // Record an expense
        let expenseData = data || {};
        if (text) {
          const parsed = parseFinancialFromText(text);
          expenseData = { ...parsed, ...expenseData };
        }

        if (!expenseData.amount) {
          return NextResponse.json({
            success: false,
            message: "How much did you spend? Tell me the amount and what it was for.",
          });
        }

        const result = await sql`
          INSERT INTO founder_project_financials (
            project_id,
            type,
            category,
            amount,
            description,
            vendor,
            invoice_number,
            date,
            milestone_id,
            bom_item_id,
            task_id,
            metadata,
            created_at
          ) VALUES (
            ${projectId},
            'expense',
            ${expenseData.category || 'other'},
            ${expenseData.amount},
            ${expenseData.description || null},
            ${expenseData.vendor || null},
            ${expenseData.invoiceNumber || null},
            ${expenseData.date ? new Date(expenseData.date) : new Date()},
            ${expenseData.milestoneId || null},
            ${expenseData.bomItemId || null},
            ${expenseData.taskId || null},
            ${expenseData.metadata ? JSON.stringify(expenseData.metadata) : null}::jsonb,
            NOW()
          )
          RETURNING *
        `;

        const entry = result.rows[0];

        // Update running totals
        const totals = await sql`
          SELECT
            COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) as total_spent
          FROM founder_project_financials
          WHERE project_id = ${projectId}
        `;

        const totalSpent = parseFloat(totals.rows[0].total_spent);
        const targetBudget = project.target_budget ? parseFloat(project.target_budget) : 0;

        let message = `Recorded $${expenseData.amount.toLocaleString()} expense`;
        if (expenseData.category) {
          message += ` (${expenseData.category})`;
        }
        if (expenseData.vendor) {
          message += ` to ${expenseData.vendor}`;
        }
        message += '.';

        if (targetBudget > 0) {
          const remaining = targetBudget - totalSpent;
          const pct = Math.round((totalSpent / targetBudget) * 100);
          message += ` Total spent: $${totalSpent.toLocaleString()} (${pct}%). $${remaining.toLocaleString()} remaining.`;

          if (remaining < 0) {
            message += ` Warning: You're over budget!`;
          } else if (pct > 80) {
            message += ` Getting close to budget limit.`;
          }
        }

        return NextResponse.json({
          success: true,
          entry: {
            id: entry.id,
            type: 'expense',
            category: entry.category,
            amount: parseFloat(entry.amount),
            description: entry.description,
            vendor: entry.vendor,
          },
          totalSpent,
          remaining: targetBudget > 0 ? targetBudget - totalSpent : null,
          message,
        });
      }

      case 'bulk': {
        // Bulk add entries
        if (!bulkEntries || !Array.isArray(bulkEntries)) {
          return NextResponse.json({
            success: false,
            message: "Provide an array of entries to add.",
          });
        }

        const added = [];
        for (const entry of bulkEntries) {
          if (!entry.amount || !entry.type) continue;

          const result = await sql`
            INSERT INTO founder_project_financials (
              project_id, type, category, amount, description, vendor, date, created_at
            ) VALUES (
              ${projectId},
              ${entry.type},
              ${entry.category || 'other'},
              ${entry.amount},
              ${entry.description || null},
              ${entry.vendor || null},
              ${entry.date ? new Date(entry.date) : new Date()},
              NOW()
            )
            RETURNING id, type, category, amount
          `;
          added.push(result.rows[0]);
        }

        return NextResponse.json({
          success: true,
          entries: added,
          count: added.length,
          message: `Added ${added.length} financial entries.`,
        });
      }

      case 'create':
      default: {
        // Generic create from text or data
        let entryData = data || {};
        if (text) {
          const parsed = parseFinancialFromText(text);
          entryData = { ...parsed, ...entryData };
        }

        if (!entryData.amount) {
          return NextResponse.json({
            success: false,
            message: "What's the amount? Tell me if it's a budget allocation or an expense.",
            example: "Example: 'Spent $500 on materials from Acme Supply'",
          });
        }

        // Default to expense if not specified
        entryData.type = entryData.type || 'expense';

        const result = await sql`
          INSERT INTO founder_project_financials (
            project_id,
            type,
            category,
            amount,
            description,
            vendor,
            invoice_number,
            date,
            created_at
          ) VALUES (
            ${projectId},
            ${entryData.type},
            ${entryData.category || 'other'},
            ${entryData.amount},
            ${entryData.description || null},
            ${entryData.vendor || null},
            ${entryData.invoiceNumber || null},
            ${entryData.date ? new Date(entryData.date) : new Date()},
            NOW()
          )
          RETURNING *
        `;

        const entry = result.rows[0];

        let message = entryData.type === 'budget'
          ? `Added $${entryData.amount.toLocaleString()} budget allocation`
          : `Recorded $${entryData.amount.toLocaleString()} ${entryData.type}`;

        if (entryData.category) {
          message += ` for ${entryData.category}`;
        }
        message += '.';

        return NextResponse.json({
          success: true,
          entry: {
            id: entry.id,
            type: entry.type,
            category: entry.category,
            amount: parseFloat(entry.amount),
            description: entry.description,
          },
          message,
        });
      }
    }
  } catch (error: any) {
    console.error('Error adding financial entry:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add financial entry' },
      { status: 500 }
    );
  }
}
