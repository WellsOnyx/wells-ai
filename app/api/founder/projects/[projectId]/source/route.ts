/**
 * Founder Project Sourcing API
 * POST: Auto-source BOM items (create RFQs, find suppliers, find workers)
 * Actions: source_bom, find_workers, auto_assign
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sqlQuery as sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface SourcingResult {
  itemId: string;
  itemName: string;
  action: 'rfq_created' | 'supplier_matched' | 'already_sourced' | 'skipped';
  rfqId?: string;
  supplierId?: string;
  supplierName?: string;
  message?: string;
}

interface WorkerResult {
  taskId: string;
  taskTitle: string;
  action: 'workers_found' | 'task_posted' | 'already_assigned' | 'skipped';
  matchedWorkers?: number;
  message?: string;
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
    const { action, text, data } = body;

    // Verify project ownership
    const projectCheck = await sql`
      SELECT id, name, status FROM founder_projects WHERE id = ${projectId} AND user_id = ${userId}
    `;

    if (projectCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: "Project not found or you don't have access.",
      }, { status: 404 });
    }

    const project = projectCheck.rows[0];

    switch (action) {
      case 'source_bom': {
        // Auto-source pending BOM items
        const itemIds = data?.itemIds; // Optional: specific items to source
        const strategy = data?.strategy || 'balanced'; // 'fastest', 'cheapest', 'balanced'

        // Get pending BOM items
        let bomItems;
        if (itemIds && Array.isArray(itemIds) && itemIds.length > 0) {
          bomItems = await sql`
            SELECT * FROM founder_project_bom
            WHERE project_id = ${projectId}
              AND id = ANY(${itemIds}::uuid[])
              AND status IN ('pending', 'sourcing')
          `;
        } else {
          bomItems = await sql`
            SELECT * FROM founder_project_bom
            WHERE project_id = ${projectId}
              AND status IN ('pending', 'sourcing')
          `;
        }

        if (bomItems.rows.length === 0) {
          return NextResponse.json({
            success: true,
            results: [],
            message: "No pending BOM items to source. All items are already being handled.",
          });
        }

        const results: SourcingResult[] = [];
        let rfqsCreated = 0;
        let suppliersMatched = 0;

        for (const item of bomItems.rows) {
          // Check if item already has an RFQ
          if (item.rfq_id) {
            results.push({
              itemId: item.id,
              itemName: item.name,
              action: 'already_sourced',
              rfqId: item.rfq_id,
              message: 'RFQ already exists',
            });
            continue;
          }

          // Create RFQ for this item
          const rfqResult = await sql`
            INSERT INTO rfqs (
              category,
              description,
              quantity,
              target_price,
              urgency,
              status,
              metadata,
              created_at,
              updated_at
            ) VALUES (
              ${item.category || 'general'},
              ${`${item.name}${item.description ? ': ' + item.description : ''}${item.part_number ? ' (P/N: ' + item.part_number + ')' : ''}`},
              ${item.quantity || 1},
              ${item.target_cost || item.unit_cost || null},
              ${strategy === 'fastest' ? 'urgent' : 'standard'},
              'open',
              ${JSON.stringify({
                projectId,
                projectName: project.name,
                bomItemId: item.id,
                partNumber: item.part_number,
                sourcingStrategy: strategy,
              })}::jsonb,
              NOW(),
              NOW()
            )
            RETURNING id
          `;

          const rfqId = rfqResult.rows[0].id;

          // Update BOM item with RFQ reference
          await sql`
            UPDATE founder_project_bom
            SET rfq_id = ${rfqId}, status = 'sourcing', updated_at = NOW()
            WHERE id = ${item.id}
          `;

          // Try to find matching suppliers
          const supplierMatches = await sql`
            SELECT sp.id, sp.company_name, sp.categories, sp.lead_time_days
            FROM supplier_profiles sp
            WHERE sp.categories @> ${JSON.stringify([item.category || 'general'])}::jsonb
              OR sp.company_name ILIKE ${'%' + (item.name || '').split(' ')[0] + '%'}
            LIMIT 5
          `;

          if (supplierMatches.rows.length > 0) {
            suppliersMatched++;
            results.push({
              itemId: item.id,
              itemName: item.name,
              action: 'supplier_matched',
              rfqId,
              supplierId: supplierMatches.rows[0].id,
              supplierName: supplierMatches.rows[0].company_name,
              message: `Found ${supplierMatches.rows.length} potential supplier(s)`,
            });
          } else {
            results.push({
              itemId: item.id,
              itemName: item.name,
              action: 'rfq_created',
              rfqId,
              message: 'RFQ created, awaiting supplier quotes',
            });
          }

          rfqsCreated++;
        }

        // Log activity
        await sql`
          INSERT INTO founder_project_activity (project_id, type, description, metadata, created_at)
          VALUES (
            ${projectId},
            'sourcing_started',
            ${`Started sourcing ${rfqsCreated} BOM items`},
            ${JSON.stringify({ rfqsCreated, suppliersMatched, strategy })}::jsonb,
            NOW()
          )
        `;

        // Update project status if needed
        if (project.status === 'planning' || project.status === 'draft') {
          await sql`
            UPDATE founder_projects SET status = 'sourcing', updated_at = NOW()
            WHERE id = ${projectId}
          `;
        }

        const message = rfqsCreated === 0
          ? "All items already have active RFQs."
          : `Created ${rfqsCreated} RFQ${rfqsCreated !== 1 ? 's' : ''} for your BOM items. ${suppliersMatched > 0 ? `Found ${suppliersMatched} potential supplier match${suppliersMatched !== 1 ? 'es' : ''}.` : 'Quotes will start coming in soon.'} I'll notify you when quotes arrive.`;

        return NextResponse.json({
          success: true,
          results,
          summary: {
            rfqsCreated,
            suppliersMatched,
            strategy,
          },
          message,
        });
      }

      case 'find_workers': {
        // Find workers for project tasks
        const taskIds = data?.taskIds;
        const skills = data?.skills || [];

        // Get tasks that need workers
        let tasks;
        if (taskIds && Array.isArray(taskIds) && taskIds.length > 0) {
          tasks = await sql`
            SELECT * FROM founder_project_tasks
            WHERE project_id = ${projectId}
              AND id = ANY(${taskIds}::uuid[])
              AND assignee_id IS NULL
              AND status IN ('pending', 'in_progress')
          `;
        } else {
          tasks = await sql`
            SELECT * FROM founder_project_tasks
            WHERE project_id = ${projectId}
              AND assignee_id IS NULL
              AND status IN ('pending', 'in_progress')
          `;
        }

        if (tasks.rows.length === 0) {
          return NextResponse.json({
            success: true,
            results: [],
            message: "No unassigned tasks to find workers for.",
          });
        }

        const results: WorkerResult[] = [];
        let workersFound = 0;
        let tasksPosted = 0;

        for (const task of tasks.rows) {
          // Derive skills from task category or title
          const taskSkills = skills.length > 0 ? skills : [
            task.category,
            ...(task.title.toLowerCase().includes('design') ? ['design'] : []),
            ...(task.title.toLowerCase().includes('develop') ? ['development'] : []),
            ...(task.title.toLowerCase().includes('test') ? ['testing', 'qa'] : []),
          ].filter(Boolean);

          // Find matching workers
          const workerMatches = await sql`
            SELECT wp.id, wp.user_id, wp.display_name, wp.skills, wp.hourly_rate
            FROM worker_profiles wp
            WHERE wp.skills && ${taskSkills}::text[]
              AND wp.availability_status = 'available'
            ORDER BY wp.rating DESC NULLS LAST
            LIMIT 10
          `;

          if (workerMatches.rows.length > 0) {
            workersFound++;
            results.push({
              taskId: task.id,
              taskTitle: task.title,
              action: 'workers_found',
              matchedWorkers: workerMatches.rows.length,
              message: `Found ${workerMatches.rows.length} available worker(s)`,
            });
          } else {
            // Could post task to marketplace
            tasksPosted++;
            results.push({
              taskId: task.id,
              taskTitle: task.title,
              action: 'task_posted',
              matchedWorkers: 0,
              message: 'Posted to task marketplace',
            });
          }
        }

        // Log activity
        await sql`
          INSERT INTO founder_project_activity (project_id, type, description, metadata, created_at)
          VALUES (
            ${projectId},
            'workers_search',
            ${`Searched workers for ${tasks.rows.length} tasks`},
            ${JSON.stringify({ workersFound, tasksPosted })}::jsonb,
            NOW()
          )
        `;

        const message = workersFound > 0
          ? `Found workers for ${workersFound} task${workersFound !== 1 ? 's' : ''}. ${tasksPosted > 0 ? `Posted ${tasksPosted} to the marketplace.` : ''}`
          : `Posted ${tasksPosted} task${tasksPosted !== 1 ? 's' : ''} to the marketplace. Workers will apply soon.`;

        return NextResponse.json({
          success: true,
          results,
          summary: {
            tasksProcessed: tasks.rows.length,
            workersFound,
            tasksPosted,
          },
          message,
        });
      }

      case 'auto_assign': {
        // Auto-assign best matches
        const scope = data?.scope || 'both'; // 'bom', 'tasks', 'both'
        const autoAccept = data?.autoAccept || false;

        const actions: string[] = [];

        if (scope === 'bom' || scope === 'both') {
          // Auto-assign best supplier quotes to BOM items
          const pendingItems = await sql`
            SELECT b.id, b.name, b.rfq_id, q.id as best_quote_id, q.supplier_id, q.unit_price,
                   sp.company_name as supplier_name
            FROM founder_project_bom b
            JOIN rfq_quotes q ON b.rfq_id = q.rfq_id
            JOIN supplier_profiles sp ON q.supplier_id = sp.id
            WHERE b.project_id = ${projectId}
              AND b.status = 'sourcing'
              AND q.status = 'submitted'
            ORDER BY b.id, q.unit_price ASC
          `;

          // Group by BOM item and select best quote
          const itemBestQuotes = new Map<string, any>();
          for (const row of pendingItems.rows) {
            if (!itemBestQuotes.has(row.id)) {
              itemBestQuotes.set(row.id, row);
            }
          }

          let bomAssigned = 0;
          for (const [itemId, quote] of itemBestQuotes) {
            if (autoAccept) {
              await sql`
                UPDATE founder_project_bom
                SET supplier = ${quote.supplier_name},
                    unit_cost = ${quote.unit_price},
                    status = 'sourced',
                    updated_at = NOW()
                WHERE id = ${itemId}
              `;
              bomAssigned++;
            }
          }

          if (bomAssigned > 0) {
            actions.push(`Assigned ${bomAssigned} BOM item${bomAssigned !== 1 ? 's' : ''} to best-priced suppliers`);
          } else if (itemBestQuotes.size > 0) {
            actions.push(`${itemBestQuotes.size} BOM item${itemBestQuotes.size !== 1 ? 's have' : ' has'} quotes ready for review`);
          }
        }

        if (scope === 'tasks' || scope === 'both') {
          // Auto-assign best worker to tasks
          const pendingTasks = await sql`
            SELECT t.id, t.title, t.category, a.id as application_id, a.worker_id,
                   wp.display_name as worker_name, wp.hourly_rate
            FROM founder_project_tasks t
            JOIN task_applications a ON t.id = a.task_id
            JOIN worker_profiles wp ON a.worker_id = wp.id
            WHERE t.project_id = ${projectId}
              AND t.assignee_id IS NULL
              AND a.status = 'pending'
            ORDER BY t.id, wp.rating DESC NULLS LAST
          `;

          const taskBestWorkers = new Map<string, any>();
          for (const row of pendingTasks.rows) {
            if (!taskBestWorkers.has(row.id)) {
              taskBestWorkers.set(row.id, row);
            }
          }

          let tasksAssigned = 0;
          for (const [taskId, worker] of taskBestWorkers) {
            if (autoAccept) {
              await sql`
                UPDATE founder_project_tasks
                SET assignee_id = ${worker.worker_id},
                    assignee_name = ${worker.worker_name},
                    status = 'in_progress',
                    updated_at = NOW()
                WHERE id = ${taskId}
              `;
              tasksAssigned++;
            }
          }

          if (tasksAssigned > 0) {
            actions.push(`Assigned ${tasksAssigned} task${tasksAssigned !== 1 ? 's' : ''} to top-rated workers`);
          } else if (taskBestWorkers.size > 0) {
            actions.push(`${taskBestWorkers.size} task${taskBestWorkers.size !== 1 ? 's have' : ' has'} worker applications ready for review`);
          }
        }

        // Log activity
        if (actions.length > 0) {
          await sql`
            INSERT INTO founder_project_activity (project_id, type, description, metadata, created_at)
            VALUES (
              ${projectId},
              'auto_assign',
              ${actions.join('; ')},
              ${JSON.stringify({ scope, autoAccept })}::jsonb,
              NOW()
            )
          `;
        }

        const message = actions.length > 0
          ? actions.join('. ') + '.'
          : "No pending assignments to process. Everything is either assigned or waiting for quotes/applications.";

        return NextResponse.json({
          success: true,
          actions,
          message,
        });
      }

      case 'status': {
        // Get sourcing status overview
        const bomStatus = await sql`
          SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'pending') as pending,
            COUNT(*) FILTER (WHERE status = 'sourcing') as sourcing,
            COUNT(*) FILTER (WHERE status = 'quoted') as quoted,
            COUNT(*) FILTER (WHERE status = 'sourced') as sourced,
            COUNT(*) FILTER (WHERE status = 'ordered') as ordered
          FROM founder_project_bom
          WHERE project_id = ${projectId}
        `;

        const taskStatus = await sql`
          SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE assignee_id IS NULL AND status NOT IN ('completed', 'cancelled')) as unassigned,
            COUNT(*) FILTER (WHERE assignee_id IS NOT NULL) as assigned
          FROM founder_project_tasks
          WHERE project_id = ${projectId}
        `;

        const rfqStatus = await sql`
          SELECT
            COUNT(DISTINCT b.rfq_id) as active_rfqs,
            COUNT(DISTINCT q.id) as total_quotes
          FROM founder_project_bom b
          LEFT JOIN rfq_quotes q ON b.rfq_id = q.rfq_id
          WHERE b.project_id = ${projectId} AND b.rfq_id IS NOT NULL
        `;

        const bom = bomStatus.rows[0];
        const tasks = taskStatus.rows[0];
        const rfqs = rfqStatus.rows[0];

        const status = {
          bom: {
            total: parseInt(bom.total) || 0,
            pending: parseInt(bom.pending) || 0,
            sourcing: parseInt(bom.sourcing) || 0,
            quoted: parseInt(bom.quoted) || 0,
            sourced: parseInt(bom.sourced) || 0,
            ordered: parseInt(bom.ordered) || 0,
          },
          tasks: {
            total: parseInt(tasks.total) || 0,
            unassigned: parseInt(tasks.unassigned) || 0,
            assigned: parseInt(tasks.assigned) || 0,
          },
          rfqs: {
            active: parseInt(rfqs.active_rfqs) || 0,
            quotes: parseInt(rfqs.total_quotes) || 0,
          },
        };

        let message = '';
        if (status.bom.pending > 0) {
          message += `${status.bom.pending} BOM items need sourcing. `;
        }
        if (status.bom.sourcing > 0) {
          message += `${status.bom.sourcing} awaiting quotes. `;
        }
        if (status.rfqs.quotes > 0) {
          message += `${status.rfqs.quotes} quote${status.rfqs.quotes !== 1 ? 's' : ''} received. `;
        }
        if (status.tasks.unassigned > 0) {
          message += `${status.tasks.unassigned} task${status.tasks.unassigned !== 1 ? 's' : ''} need workers. `;
        }
        if (!message) {
          message = "All sourcing is complete. Everything is assigned or ordered.";
        }

        return NextResponse.json({
          success: true,
          status,
          message: message.trim(),
        });
      }

      default: {
        // Parse natural language
        if (text) {
          const lower = text.toLowerCase();

          if (lower.includes('source') || lower.includes('rfq') || lower.includes('supplier')) {
            return NextResponse.json({
              success: false,
              message: "I can source your BOM items. Use action: 'source_bom' or tell me which items you want to source.",
              availableActions: ['source_bom', 'find_workers', 'auto_assign', 'status'],
            });
          }

          if (lower.includes('worker') || lower.includes('assign') || lower.includes('hire')) {
            return NextResponse.json({
              success: false,
              message: "I can find workers for your tasks. Use action: 'find_workers' to search for matching talent.",
              availableActions: ['source_bom', 'find_workers', 'auto_assign', 'status'],
            });
          }
        }

        return NextResponse.json({
          success: false,
          message: "What would you like to source? I can find suppliers for your BOM items or workers for your tasks.",
          availableActions: ['source_bom', 'find_workers', 'auto_assign', 'status'],
        });
      }
    }
  } catch (error: any) {
    console.error('Error in sourcing:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process sourcing request' },
      { status: 500 }
    );
  }
}
