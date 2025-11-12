import { executeJourney, evaluateCondition } from '../../src/services/executor';
import { journeyQueries } from '../../src/db/queries';
import { Journey, JourneyRun, PatientContext } from '../../src/types/journey';

// Mock the database queries
jest.mock('../../src/db/queries', () => ({
  journeyQueries: {
    getJourneyRunById: jest.fn(),
    getJourneyById: jest.fn(),
    updateJourneyRun: jest.fn(),
  },
}));

describe('Journey Executor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear console.log to avoid cluttering test output
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('evaluateCondition', () => {
    const context: PatientContext = {
      id: 'test-001',
      age: 70,
      language: 'en',
      condition: 'hip_replacement',
    };

    it('should correctly evaluate all operators', () => {
      expect(evaluateCondition(context, 'age', '>', 65)).toBe(true);
      expect(evaluateCondition(context, 'age', '<', 75)).toBe(true);
      expect(evaluateCondition(context, 'age', '>=', 70)).toBe(true);
      expect(evaluateCondition(context, 'age', '<=', 70)).toBe(true);
      expect(evaluateCondition(context, 'age', '=', 70)).toBe(true);
      expect(evaluateCondition(context, 'age', '!=', 65)).toBe(true);
    });
  });

  describe('MESSAGE node processing', () => {
    it('should log message when processing MESSAGE node', async () => {
      const mockJourney: Journey = {
        id: 'journey-1',
        name: 'Test Journey',
        start_node_id: 'msg1',
        nodes: [
          {
            id: 'msg1',
            type: 'MESSAGE',
            message: 'Welcome!',
            next_node_id: null,
          },
        ],
      };

      const mockRun: JourneyRun = {
        id: 'run-1',
        journey_id: 'journey-1',
        patient_context: { id: 'patient-1', age: 50, language: 'en' as const, condition: 'hip_replacement' as const },
        status: 'in_progress',
        current_node_id: 'msg1',
        created_at: new Date(),
        updated_at: new Date(),
      };

      (journeyQueries.getJourneyRunById as jest.Mock).mockReturnValue(mockRun);
      (journeyQueries.getJourneyById as jest.Mock).mockReturnValue(mockJourney);

      await executeJourney('run-1');

      // Wait for async execution to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have logged the message
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Sending message to patient patient-1')
      );

      // Should have updated the run status
      expect(journeyQueries.updateJourneyRun).toHaveBeenCalled();
    });

    it('should mark journey as completed when reaching terminal MESSAGE node', async () => {
      const mockJourney: Journey = {
        id: 'journey-1',
        name: 'Test Journey',
        start_node_id: 'msg1',
        nodes: [
          {
            id: 'msg1',
            type: 'MESSAGE',
            message: 'Final message',
            next_node_id: null,
          },
        ],
      };

      const mockRun: JourneyRun = {
        id: 'run-1',
        journey_id: 'journey-1',
        patient_context: { id: 'patient-1', age: 50, language: 'en' as const, condition: 'knee_replacement' as const },
        status: 'in_progress',
        current_node_id: 'msg1',
        created_at: new Date(),
        updated_at: new Date(),
      };

      (journeyQueries.getJourneyRunById as jest.Mock).mockReturnValue(mockRun);
      (journeyQueries.getJourneyById as jest.Mock).mockReturnValue(mockJourney);

      await executeJourney('run-1');

      // Wait for async execution
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should mark as completed
      expect(journeyQueries.updateJourneyRun).toHaveBeenCalledWith(
        'run-1',
        'completed',
        null
      );
    });
  });

  describe('CONDITIONAL node processing', () => {
    it('should log conditional evaluation', async () => {
      const mockJourney: Journey = {
        id: 'journey-1',
        name: 'Test Journey',
        start_node_id: 'cond1',
        nodes: [
          {
            id: 'cond1',
            type: 'CONDITIONAL',
            condition: {
              field: 'age',
              operator: '>',
              value: 65,
            },
            on_true_next_node_id: 'msg_senior',
            on_false_next_node_id: 'msg_general',
          },
          {
            id: 'msg_senior',
            type: 'MESSAGE',
            message: 'Senior message',
            next_node_id: null,
          },
        ],
      };

      const mockRun: JourneyRun = {
        id: 'run-1',
        journey_id: 'journey-1',
        patient_context: { id: 'patient-1', age: 70, language: 'es' as const, condition: 'hip_replacement' as const },
        status: 'in_progress',
        current_node_id: 'cond1',
        created_at: new Date(),
        updated_at: new Date(),
      };

      (journeyQueries.getJourneyRunById as jest.Mock).mockReturnValue(mockRun);
      (journeyQueries.getJourneyById as jest.Mock).mockReturnValue(mockJourney);

      await executeJourney('run-1');

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should log conditional evaluation
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[CONDITIONAL] Evaluating condition')
      );

      // Should update current node
      expect(journeyQueries.updateJourneyRun).toHaveBeenCalled();
    });

    it('should evaluate condition correctly', async () => {
      const mockJourney: Journey = {
        id: 'journey-1',
        name: 'Test Journey',
        start_node_id: 'cond1',
        nodes: [
          {
            id: 'cond1',
            type: 'CONDITIONAL',
            condition: {
              field: 'age',
              operator: '>',
              value: 65,
            },
            on_true_next_node_id: 'msg_senior',
            on_false_next_node_id: 'msg_general',
          },
          {
            id: 'msg_general',
            type: 'MESSAGE',
            message: 'General message',
            next_node_id: null,
          },
        ],
      };

      const mockRun: JourneyRun = {
        id: 'run-1',
        journey_id: 'journey-1',
        patient_context: { id: 'patient-1', age: 45, language: 'en' as const, condition: 'knee_replacement' as const },
        status: 'in_progress',
        current_node_id: 'cond1',
        created_at: new Date(),
        updated_at: new Date(),
      };

      (journeyQueries.getJourneyRunById as jest.Mock).mockReturnValue(mockRun);
      (journeyQueries.getJourneyById as jest.Mock).mockReturnValue(mockJourney);

      await executeJourney('run-1');

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should log conditional evaluation
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[CONDITIONAL]')
      );
    });
  });

  describe('DELAY node processing', () => {
    it('should log delay scheduling', async () => {
      const mockJourney: Journey = {
        id: 'journey-1',
        name: 'Test Journey',
        start_node_id: 'delay1',
        nodes: [
          {
            id: 'delay1',
            type: 'DELAY',
            delay_seconds: 1,
            next_node_id: null,
          },
        ],
      };

      const mockRun: JourneyRun = {
        id: 'run-1',
        journey_id: 'journey-1',
        patient_context: { id: 'patient-1', age: 50, language: 'es' as const, condition: 'hip_replacement' as const },
        status: 'in_progress',
        current_node_id: 'delay1',
        created_at: new Date(),
        updated_at: new Date(),
      };

      (journeyQueries.getJourneyRunById as jest.Mock).mockReturnValue(mockRun);
      (journeyQueries.getJourneyById as jest.Mock).mockReturnValue(mockJourney);

      await executeJourney('run-1');

      // Should log delay scheduling
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[DELAY] Scheduling')
      );

      // Wait for delay to complete
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Should log delay completion
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[DELAY] Delay completed')
      );
    });
  });

  describe('Error handling', () => {
    it('should mark run as failed when journey is not found', async () => {
      const mockRun: JourneyRun = {
        id: 'run-1',
        journey_id: 'non-existent',
        patient_context: { id: 'patient-1', age: 50, language: 'en' as const, condition: 'knee_replacement' as const },
        status: 'in_progress',
        current_node_id: 'msg1',
        created_at: new Date(),
        updated_at: new Date(),
      };

      (journeyQueries.getJourneyRunById as jest.Mock).mockReturnValue(mockRun);
      (journeyQueries.getJourneyById as jest.Mock).mockReturnValue(null);

      await executeJourney('run-1');

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[EXECUTOR] Journey non-existent not found')
      );

      expect(journeyQueries.updateJourneyRun).toHaveBeenCalledWith(
        'run-1',
        'failed',
        'msg1'
      );
    });

    it('should handle missing run gracefully', async () => {
      (journeyQueries.getJourneyRunById as jest.Mock).mockReturnValue(null);

      await executeJourney('non-existent-run');

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[EXECUTOR] Run non-existent-run not found')
      );
    });
  });
});
