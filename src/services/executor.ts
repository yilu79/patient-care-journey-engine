import { JourneyRun, JourneyNode, MessageNode, DelayNode, ConditionalNode, PatientContext, Journey } from '../types/journey';
import { journeyQueries } from '../db/queries';

// In-memory state management for active delays
const activeTimeouts = new Map<string, NodeJS.Timeout>();

/**
 * Evaluates a conditional expression against patient context
 * Supports operators: >, <, >=, <=, =, !=
 */
function evaluateCondition(
  context: PatientContext,
  field: string,
  operator: string,
  value: any
): boolean {
  // Get value from context - support nested paths like 'patient.age' or just 'age'
  const fieldValue = field.includes('.') 
    ? field.split('.').reduce((obj: any, key) => obj?.[key], context)
    : (context as any)[field];

  // Evaluate based on operator
  switch (operator) {
    case '>':
      return fieldValue > value;
    case '<':
      return fieldValue < value;
    case '>=':
      return fieldValue >= value;
    case '<=':
      return fieldValue <= value;
    case '=':
    case '==':
      return fieldValue == value;
    case '!=':
      return fieldValue != value;
    default:
      throw new Error(`Unsupported operator: ${operator}`);
  }
}

/**
 * Process a MESSAGE node
 * Logs the message and moves to the next node
 */
async function processMessageNode(
  run: JourneyRun,
  node: MessageNode,
  journey: Journey
): Promise<void> {
  console.log(`[MESSAGE] Sending message to patient ${run.patient_context.patient_id}: ${node.message}`);

  // Move to next node or complete journey
  if (node.next_node_id) {
    run.current_node_id = node.next_node_id;
    journeyQueries.updateJourneyRun(run.id, 'in_progress', node.next_node_id);
    
    // Continue processing next node
    await continueExecution(run.id);
  } else {
    // No next node - journey is complete
    console.log(`[EXECUTOR] Journey run ${run.id} completed`);
    journeyQueries.updateJourneyRun(run.id, 'completed', null);
  }
}

/**
 * Process a CONDITIONAL node
 * Evaluates the condition and branches accordingly
 */
async function processConditionalNode(
  run: JourneyRun,
  node: ConditionalNode,
  journey: Journey
): Promise<void> {
  console.log(`[CONDITIONAL] Evaluating condition: ${node.condition.field} ${node.condition.operator} ${node.condition.value}`);

  const conditionResult = evaluateCondition(
    run.patient_context,
    node.condition.field,
    node.condition.operator,
    node.condition.value
  );

  console.log(`[CONDITIONAL] Result: ${conditionResult}`);

  // Determine next node based on condition result
  const nextNodeId = conditionResult ? node.true_node_id : node.false_node_id;

  if (nextNodeId) {
    run.current_node_id = nextNodeId;
    journeyQueries.updateJourneyRun(run.id, 'in_progress', nextNodeId);
    
    // Continue processing next node
    await continueExecution(run.id);
  } else {
    // No next node - journey is complete
    console.log(`[EXECUTOR] Journey run ${run.id} completed`);
    journeyQueries.updateJourneyRun(run.id, 'completed', null);
  }
}

/**
 * Process a DELAY node
 * Schedules continuation after the specified delay
 */
async function processDelayNode(
  run: JourneyRun,
  node: DelayNode,
  journey: Journey
): Promise<void> {
  console.log(`[DELAY] Scheduling ${node.delay_seconds}s delay for run ${run.id}`);

  // Update database before waiting
  journeyQueries.updateJourneyRun(run.id, 'in_progress', node.id);

  // Schedule delayed execution
  scheduleDelayedExecution(run.id, node.delay_seconds, node.next_node_id);
}

/**
 * Schedule delayed execution for a journey run
 */
function scheduleDelayedExecution(
  runId: string,
  delaySeconds: number,
  nextNodeId: string | null
): void {
  // Clear any existing timeout for this run
  if (activeTimeouts.has(runId)) {
    clearTimeout(activeTimeouts.get(runId)!);
  }

  const timeout = setTimeout(async () => {
    console.log(`[DELAY] Delay completed for run ${runId}, resuming execution`);
    activeTimeouts.delete(runId);

    // Update current node and continue
    if (nextNodeId) {
      journeyQueries.updateJourneyRun(runId, 'in_progress', nextNodeId);
      await continueExecution(runId);
    } else {
      // No next node - journey is complete
      console.log(`[EXECUTOR] Journey run ${runId} completed after delay`);
      journeyQueries.updateJourneyRun(runId, 'completed', null);
    }
  }, delaySeconds * 1000);

  activeTimeouts.set(runId, timeout);
}

/**
 * Process a single node based on its type
 */
async function processNode(
  run: JourneyRun,
  node: JourneyNode,
  journey: any
): Promise<void> {
  switch (node.type) {
    case 'MESSAGE':
      await processMessageNode(run, node as MessageNode, journey);
      break;
    case 'CONDITIONAL':
      await processConditionalNode(run, node as ConditionalNode, journey);
      break;
    case 'DELAY':
      await processDelayNode(run, node as DelayNode, journey);
      break;
    default:
      throw new Error(`Unknown node type: ${(node as any).type}`);
  }
}

/**
 * Continue execution of a journey run from its current node
 */
async function continueExecution(runId: string): Promise<void> {
  try {
    // Fetch current run state
    const run = journeyQueries.getJourneyRunById(runId);
    if (!run) {
      console.error(`[EXECUTOR] Run ${runId} not found`);
      return;
    }

    // Check if run is already completed or failed
    if (run.status === 'completed' || run.status === 'failed') {
      console.log(`[EXECUTOR] Run ${runId} is already ${run.status}`);
      return;
    }

    // Fetch journey definition
    const journey = journeyQueries.getJourneyById(run.journey_id);
    if (!journey) {
      console.error(`[EXECUTOR] Journey ${run.journey_id} not found`);
      journeyQueries.updateJourneyRun(runId, 'failed', run.current_node_id);
      return;
    }

    // Find current node
    const currentNode = journey.nodes.find((n: JourneyNode) => n.id === run.current_node_id);
    if (!currentNode) {
      console.error(`[EXECUTOR] Node ${run.current_node_id} not found in journey ${run.journey_id}`);
      journeyQueries.updateJourneyRun(runId, 'failed', run.current_node_id);
      return;
    }

    console.log(`[EXECUTOR] Processing node ${currentNode.id} (${currentNode.type}) for run ${runId}`);

    // Process the current node
    await processNode(run, currentNode, journey);

  } catch (error) {
    console.error(`[EXECUTOR] Error processing run ${runId}:`, error);
    // Try to get the current node ID for the update
    const run = journeyQueries.getJourneyRunById(runId);
    journeyQueries.updateJourneyRun(runId, 'failed', run?.current_node_id || null);
  }
}

/**
 * Start execution of a journey run
 * This is the main entry point called by the trigger endpoint
 */
export async function executeJourney(runId: string): Promise<void> {
  console.log(`[EXECUTOR] Starting execution for run ${runId}`);
  
  try {
    // Fetch run details
    const run = journeyQueries.getJourneyRunById(runId);
    if (!run) {
      console.error(`[EXECUTOR] Run ${runId} not found`);
      return;
    }

    // Fetch journey definition
    const journey = journeyQueries.getJourneyById(run.journey_id);
    if (!journey) {
      console.error(`[EXECUTOR] Journey ${run.journey_id} not found`);
      journeyQueries.updateJourneyRun(runId, 'failed', run.current_node_id);
      return;
    }

    // Set current node to start node if not already set
    if (!run.current_node_id) {
      run.current_node_id = journey.start_node_id;
      journeyQueries.updateJourneyRun(runId, 'in_progress', journey.start_node_id);
    }

    // Start processing from the first node
    await continueExecution(runId);

  } catch (error) {
    console.error(`[EXECUTOR] Error starting execution for run ${runId}:`, error);
    const run = journeyQueries.getJourneyRunById(runId);
    journeyQueries.updateJourneyRun(runId, 'failed', run?.current_node_id || null);
  }
}

/**
 * Cancel a running journey (clear any pending delays)
 */
export function cancelJourneyRun(runId: string): void {
  if (activeTimeouts.has(runId)) {
    clearTimeout(activeTimeouts.get(runId)!);
    activeTimeouts.delete(runId);
    console.log(`[EXECUTOR] Cancelled run ${runId}`);
  }
}

/**
 * Get active timeout count (for monitoring/debugging)
 */
export function getActiveTimeoutCount(): number {
  return activeTimeouts.size;
}
