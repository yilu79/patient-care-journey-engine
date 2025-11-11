import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { journeyQueries } from '../db/queries';
import { 
  CreateJourneyRequest, 
  CreateJourneyResponse,
  TriggerJourneyRequest,
  TriggerJourneyResponse,
  JourneyRunResponse,
  Journey,
  JourneyNode,
  JourneyRun
} from '../types/journey';

const router = Router();

/**
 * Validates journey structure ensuring all references are valid
 */
function validateJourneyStructure(journey: CreateJourneyRequest): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Basic validation
  if (!journey.name || journey.name.trim().length === 0) {
    errors.push('Journey name is required and cannot be empty');
  }

  if (!journey.nodes || journey.nodes.length === 0) {
    errors.push('Journey must contain at least one node');
  }

  if (!journey.start_node_id) {
    errors.push('Journey must have a valid start_node_id');
  }

  if (journey.nodes && journey.nodes.length > 0) {
    const nodeIds = new Set(journey.nodes.map(node => node.id));
    
    // Check if start_node_id exists in nodes
    if (journey.start_node_id && !nodeIds.has(journey.start_node_id)) {
      errors.push(`start_node_id '${journey.start_node_id}' does not exist in nodes array`);
    }

    // Validate each node
    journey.nodes.forEach((node, index) => {
      if (!node.id) {
        errors.push(`Node at index ${index} must have an id`);
      }

      if (!['MESSAGE', 'DELAY', 'CONDITIONAL'].includes(node.type)) {
        errors.push(`Node '${node.id}' has invalid type '${node.type}'`);
      }

      // Validate node-specific requirements
      switch (node.type) {
        case 'MESSAGE':
          const messageNode = node as any;
          if (!messageNode.message) {
            errors.push(`MESSAGE node '${node.id}' must have a message`);
          }
          if (messageNode.next_node_id && !nodeIds.has(messageNode.next_node_id)) {
            errors.push(`MESSAGE node '${node.id}' references non-existent next_node_id '${messageNode.next_node_id}'`);
          }
          break;

        case 'DELAY':
          const delayNode = node as any;
          if (typeof delayNode.delay_seconds !== 'number' || delayNode.delay_seconds < 0) {
            errors.push(`DELAY node '${node.id}' must have a valid delay_seconds (number >= 0)`);
          }
          if (delayNode.next_node_id && !nodeIds.has(delayNode.next_node_id)) {
            errors.push(`DELAY node '${node.id}' references non-existent next_node_id '${delayNode.next_node_id}'`);
          }
          break;

        case 'CONDITIONAL':
          const conditionalNode = node as any;
          if (!conditionalNode.condition) {
            errors.push(`CONDITIONAL node '${node.id}' must have a condition`);
          } else {
            const { field, operator, value } = conditionalNode.condition;
            if (!field) {
              errors.push(`CONDITIONAL node '${node.id}' condition must have a field`);
            }
            if (!['>', '<', '>=', '<=', '=', '!='].includes(operator)) {
              errors.push(`CONDITIONAL node '${node.id}' has invalid operator '${operator}'`);
            }
            if (value === undefined || value === null) {
              errors.push(`CONDITIONAL node '${node.id}' condition must have a value`);
            }
          }
          if (conditionalNode.true_node_id && !nodeIds.has(conditionalNode.true_node_id)) {
            errors.push(`CONDITIONAL node '${node.id}' references non-existent true_node_id '${conditionalNode.true_node_id}'`);
          }
          if (conditionalNode.false_node_id && !nodeIds.has(conditionalNode.false_node_id)) {
            errors.push(`CONDITIONAL node '${node.id}' references non-existent false_node_id '${conditionalNode.false_node_id}'`);
          }
          break;
      }
    });

    // Check for duplicate node IDs
    const duplicateIds = journey.nodes
      .map(node => node.id)
      .filter((id, index, arr) => arr.indexOf(id) !== index);
    
    if (duplicateIds.length > 0) {
      errors.push(`Duplicate node IDs found: ${duplicateIds.join(', ')}`);
    }
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * POST /journeys - Create a new journey
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const journeyData: CreateJourneyRequest = req.body;

    // Validate request body structure
    if (!journeyData) {
      return res.status(400).json({ 
        error: 'Request body is required',
        expected: 'CreateJourneyRequest object with name, start_node_id, and nodes array'
      });
    }

    // Validate journey structure
    const validation = validateJourneyStructure(journeyData);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Journey validation failed',
        details: validation.errors
      });
    }

    // Create journey with UUID
    const journeyId = uuidv4();
    const journey: Journey = {
      id: journeyId,
      name: journeyData.name.trim(),
      start_node_id: journeyData.start_node_id,
      nodes: journeyData.nodes
    };

    // Store in database
    journeyQueries.insertJourney(journey);

    console.log(`✅ Journey created: ${journey.name} (ID: ${journeyId})`);

    // Return 201 with journey ID
    const response: CreateJourneyResponse = { journey_id: journeyId };
    res.status(201).json(response);

  } catch (error: any) {
    console.error('❌ Error creating journey:', error);
    res.status(500).json({ 
      error: 'Failed to create journey',
      details: error.message 
    });
  }
});

/**
 * POST /journeys/:journeyId/trigger - Trigger journey execution
 */
router.post('/:journeyId/trigger', (req: Request, res: Response) => {
  try {
    const { journeyId } = req.params;
    const triggerData: TriggerJourneyRequest = req.body;

    // Validate request body
    if (!triggerData || !triggerData.patient_context) {
      return res.status(400).json({
        error: 'Request body must contain patient_context',
        expected: 'TriggerJourneyRequest object with patient_context'
      });
    }

    // Validate patient context has required fields
    const { patient_context } = triggerData;
    if (!patient_context.patient_id) {
      return res.status(400).json({
        error: 'patient_context must include patient_id'
      });
    }

    // Check if journey exists
    if (!journeyQueries.journeyExists(journeyId)) {
      return res.status(404).json({
        error: 'Journey not found',
        journey_id: journeyId
      });
    }

    const journey = journeyQueries.getJourneyById(journeyId)!;

    // Create new journey run
    const runId = uuidv4();
    const journeyRun: Omit<JourneyRun, 'created_at' | 'updated_at'> = {
      id: runId,
      journey_id: journeyId,
      patient_context: patient_context,
      status: 'in_progress',
      current_node_id: journey.start_node_id
    };

    // Store run in database
    journeyQueries.insertJourneyRun(journeyRun);

    console.log(`🚀 Journey execution started: ${journey.name} for patient ${patient_context.patient_id} (Run ID: ${runId})`);

    // TODO: Trigger async executor (will implement in Hour 3)
    console.log(`⏳ Journey executor will be implemented in Hour 3`);

    // Return 202 with run ID and Location header
    const response: TriggerJourneyResponse = { run_id: runId };
    res.status(202)
      .header('Location', `/journeys/runs/${runId}`)
      .json(response);

  } catch (error: any) {
    console.error('❌ Error triggering journey:', error);
    res.status(500).json({
      error: 'Failed to trigger journey execution',
      details: error.message
    });
  }
});

/**
 * GET /journeys/runs/:runId - Get journey run status
 */
router.get('/runs/:runId', (req: Request, res: Response) => {
  try {
    const { runId } = req.params;

    // Fetch run from database
    const journeyRun = journeyQueries.getJourneyRunById(runId);
    
    if (!journeyRun) {
      return res.status(404).json({
        error: 'Journey run not found',
        run_id: runId
      });
    }

    // Convert to API response format (dates as ISO strings)
    const response: JourneyRunResponse = {
      id: journeyRun.id,
      journey_id: journeyRun.journey_id,
      patient_context: journeyRun.patient_context,
      status: journeyRun.status,
      current_node_id: journeyRun.current_node_id,
      created_at: journeyRun.created_at.toISOString(),
      updated_at: journeyRun.updated_at.toISOString()
    };

    res.json(response);

  } catch (error: any) {
    console.error('❌ Error fetching journey run:', error);
    res.status(500).json({
      error: 'Failed to fetch journey run',
      details: error.message
    });
  }
});

export const journeyRoutes = router;