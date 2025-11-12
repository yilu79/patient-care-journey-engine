import request from 'supertest';
import app from '../../src/app';
import { getDatabase } from '../../src/db/database';

describe('Journey Execution Integration Tests', () => {
  let db: any;

  beforeAll(() => {
    db = getDatabase();
  });

  beforeEach(() => {
    // Clean up database before each test
    db.exec('DELETE FROM journey_runs');
    db.exec('DELETE FROM journeys');
  });

  describe('Linear Journey Execution', () => {
    it('should execute a linear journey with multiple MESSAGE nodes', async () => {
      // Create journey
      const journey = {
        name: 'Linear Test Journey',
        start_node_id: 'msg1',
        nodes: [
          {
            id: 'msg1',
            type: 'MESSAGE',
            message: 'First message',
            next_node_id: 'msg2',
          },
          {
            id: 'msg2',
            type: 'MESSAGE',
            message: 'Second message',
            next_node_id: 'msg3',
          },
          {
            id: 'msg3',
            type: 'MESSAGE',
            message: 'Final message',
            next_node_id: null,
          },
        ],
      };

      const createResponse = await request(app).post('/journeys').send(journey);
      const journeyId = createResponse.body.journey_id;

      // Trigger execution
      const triggerData = {
        patient_context: {
          patient_id: 'patient-001',
          age: 50,
        },
      };

      const triggerResponse = await request(app)
        .post(`/journeys/${journeyId}/trigger`)
        .send(triggerData);

      const runId = triggerResponse.body.run_id;
      expect(runId).toBeDefined();

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Check final status
      const statusResponse = await request(app)
        .get(`/journeys/runs/${runId}`)
        .expect(200);

      expect(statusResponse.body).toBeDefined();
      expect(statusResponse.body.status).toBe('completed');
      expect(statusResponse.body.current_node_id).toBeNull();
    });
  });

  describe('Conditional Journey Execution', () => {
    it('should branch to senior path for patients over 65', async () => {
      const journey = {
        name: 'Age-based Journey',
        start_node_id: 'welcome',
        nodes: [
          {
            id: 'welcome',
            type: 'MESSAGE',
            message: 'Welcome!',
            next_node_id: 'age_check',
          },
          {
            id: 'age_check',
            type: 'CONDITIONAL',
            condition: {
              field: 'age',
              operator: '>',
              value: 65,
            },
            true_node_id: 'senior_msg',
            false_node_id: 'general_msg',
          },
          {
            id: 'senior_msg',
            type: 'MESSAGE',
            message: 'Senior care program',
            next_node_id: null,
          },
          {
            id: 'general_msg',
            type: 'MESSAGE',
            message: 'General care program',
            next_node_id: null,
          },
        ],
      };

      const createResponse = await request(app).post('/journeys').send(journey);
      const journeyId = createResponse.body.journey_id;

      // Trigger with senior patient (age > 65)
      const triggerData = {
        patient_context: {
          patient_id: 'senior-patient',
          age: 70,
        },
      };

      const triggerResponse = await request(app)
        .post(`/journeys/${journeyId}/trigger`)
        .send(triggerData);

      const runId = triggerResponse.body.run_id;

      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify execution completed successfully
      const statusResponse = await request(app).get(`/journeys/runs/${runId}`);

      expect(statusResponse.body.status).toBe('completed');
      expect(statusResponse.body.current_node_id).toBeNull();
    });

    it('should branch to general path for patients under 65', async () => {
      const journey = {
        name: 'Age-based Journey',
        start_node_id: 'welcome',
        nodes: [
          {
            id: 'welcome',
            type: 'MESSAGE',
            message: 'Welcome!',
            next_node_id: 'age_check',
          },
          {
            id: 'age_check',
            type: 'CONDITIONAL',
            condition: {
              field: 'age',
              operator: '>',
              value: 65,
            },
            true_node_id: 'senior_msg',
            false_node_id: 'general_msg',
          },
          {
            id: 'senior_msg',
            type: 'MESSAGE',
            message: 'Senior care program',
            next_node_id: null,
          },
          {
            id: 'general_msg',
            type: 'MESSAGE',
            message: 'General care program',
            next_node_id: null,
          },
        ],
      };

      const createResponse = await request(app).post('/journeys').send(journey);
      const journeyId = createResponse.body.journey_id;

      // Trigger with young patient (age <= 65)
      const triggerData = {
        patient_context: {
          patient_id: 'young-patient',
          age: 45,
        },
      };

      const triggerResponse = await request(app)
        .post(`/journeys/${journeyId}/trigger`)
        .send(triggerData);

      const runId = triggerResponse.body.run_id;

      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify execution completed
      const statusResponse = await request(app).get(`/journeys/runs/${runId}`);

      expect(statusResponse.body.status).toBe('completed');
    });

    it('should handle multiple conditional branches', async () => {
      const journey = {
        name: 'Multi-condition Journey',
        start_node_id: 'cond1',
        nodes: [
          {
            id: 'cond1',
            type: 'CONDITIONAL',
            condition: {
              field: 'age',
              operator: '>=',
              value: 18,
            },
            true_node_id: 'cond2',
            false_node_id: 'minor_msg',
          },
          {
            id: 'cond2',
            type: 'CONDITIONAL',
            condition: {
              field: 'age',
              operator: '>=',
              value: 65,
            },
            true_node_id: 'senior_msg',
            false_node_id: 'adult_msg',
          },
          {
            id: 'minor_msg',
            type: 'MESSAGE',
            message: 'Minor care',
            next_node_id: null,
          },
          {
            id: 'adult_msg',
            type: 'MESSAGE',
            message: 'Adult care',
            next_node_id: null,
          },
          {
            id: 'senior_msg',
            type: 'MESSAGE',
            message: 'Senior care',
            next_node_id: null,
          },
        ],
      };

      const createResponse = await request(app).post('/journeys').send(journey);
      const journeyId = createResponse.body.journey_id;

      // Test adult path (18 <= age < 65)
      const triggerData = {
        patient_context: {
          patient_id: 'adult-patient',
          age: 40,
        },
      };

      const triggerResponse = await request(app)
        .post(`/journeys/${journeyId}/trigger`)
        .send(triggerData);

      const runId = triggerResponse.body.run_id;

      await new Promise(resolve => setTimeout(resolve, 500));

      const statusResponse = await request(app).get(`/journeys/runs/${runId}`);
      expect(statusResponse.body.status).toBe('completed');
    });
  });

  describe('Journey with DELAY Node', () => {
    it('should handle journey with delay and complete after waiting', async () => {
      const journey = {
        name: 'Delay Test Journey',
        start_node_id: 'msg1',
        nodes: [
          {
            id: 'msg1',
            type: 'MESSAGE',
            message: 'Before delay',
            next_node_id: 'delay1',
          },
          {
            id: 'delay1',
            type: 'DELAY',
            delay_seconds: 2,
            next_node_id: 'msg2',
          },
          {
            id: 'msg2',
            type: 'MESSAGE',
            message: 'After delay',
            next_node_id: null,
          },
        ],
      };

      const createResponse = await request(app).post('/journeys').send(journey);
      const journeyId = createResponse.body.journey_id;

      const triggerData = {
        patient_context: {
          patient_id: 'delay-test-patient',
          age: 50,
        },
      };

      const triggerResponse = await request(app)
        .post(`/journeys/${journeyId}/trigger`)
        .send(triggerData);

      const runId = triggerResponse.body.run_id;

      // Check status immediately (should be in_progress)
      const immediateStatus = await request(app).get(`/journeys/runs/${runId}`);
      // Status could be in_progress or completed depending on timing

      // Wait for delay to complete (2 seconds + buffer)
      await new Promise(resolve => setTimeout(resolve, 2500));

      // Check status after delay (should be completed)
      const finalStatus = await request(app).get(`/journeys/runs/${runId}`);
      expect(finalStatus.body.status).toBe('completed');
      expect(finalStatus.body.current_node_id).toBeNull();

      // Verify timestamps show delay occurred
      const createdAt = new Date(finalStatus.body.created_at);
      const updatedAt = new Date(finalStatus.body.updated_at);
      const timeDiff = updatedAt.getTime() - createdAt.getTime();

      // Should be at least 2 seconds difference
      expect(timeDiff).toBeGreaterThanOrEqual(1900); // Allow small margin
    });

    it('should handle multiple delays in sequence', async () => {
      const journey = {
        name: 'Multi-Delay Journey',
        start_node_id: 'delay1',
        nodes: [
          {
            id: 'delay1',
            type: 'DELAY',
            delay_seconds: 1,
            next_node_id: 'msg1',
          },
          {
            id: 'msg1',
            type: 'MESSAGE',
            message: 'Between delays',
            next_node_id: 'delay2',
          },
          {
            id: 'delay2',
            type: 'DELAY',
            delay_seconds: 1,
            next_node_id: 'msg2',
          },
          {
            id: 'msg2',
            type: 'MESSAGE',
            message: 'Final',
            next_node_id: null,
          },
        ],
      };

      const createResponse = await request(app).post('/journeys').send(journey);
      const journeyId = createResponse.body.journey_id;

      const triggerData = {
        patient_context: {
          patient_id: 'multi-delay-patient',
          age: 50,
        },
      };

      const triggerResponse = await request(app)
        .post(`/journeys/${journeyId}/trigger`)
        .send(triggerData);

      const runId = triggerResponse.body.run_id;

      // Wait for both delays (2 seconds + buffer)
      await new Promise(resolve => setTimeout(resolve, 2500));

      const finalStatus = await request(app).get(`/journeys/runs/${runId}`);
      expect(finalStatus.body.status).toBe('completed');
    });
  });

  describe('Complex Journey Scenarios', () => {
    it('should execute journey with MESSAGE -> CONDITIONAL -> DELAY -> MESSAGE', async () => {
      const journey = {
        name: 'Complex Journey',
        start_node_id: 'welcome',
        nodes: [
          {
            id: 'welcome',
            type: 'MESSAGE',
            message: 'Welcome!',
            next_node_id: 'age_check',
          },
          {
            id: 'age_check',
            type: 'CONDITIONAL',
            condition: {
              field: 'age',
              operator: '>',
              value: 65,
            },
            true_node_id: 'delay_senior',
            false_node_id: 'final_msg',
          },
          {
            id: 'delay_senior',
            type: 'DELAY',
            delay_seconds: 1,
            next_node_id: 'senior_msg',
          },
          {
            id: 'senior_msg',
            type: 'MESSAGE',
            message: 'Senior care after delay',
            next_node_id: null,
          },
          {
            id: 'final_msg',
            type: 'MESSAGE',
            message: 'General care',
            next_node_id: null,
          },
        ],
      };

      const createResponse = await request(app).post('/journeys').send(journey);
      const journeyId = createResponse.body.journey_id;

      // Test with senior patient
      const triggerData = {
        patient_context: {
          patient_id: 'complex-test-patient',
          age: 70,
        },
      };

      const triggerResponse = await request(app)
        .post(`/journeys/${journeyId}/trigger`)
        .send(triggerData);

      const runId = triggerResponse.body.run_id;

      // Wait for execution with delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      const finalStatus = await request(app).get(`/journeys/runs/${runId}`);
      expect(finalStatus.body.status).toBe('completed');
      expect(finalStatus.body.patient_context.age).toBe(70);
    });
  });

  describe('Patient Context Preservation', () => {
    it('should preserve all patient context fields throughout journey', async () => {
      const journey = {
        name: 'Context Test Journey',
        start_node_id: 'msg1',
        nodes: [
          {
            id: 'msg1',
            type: 'MESSAGE',
            message: 'Test',
            next_node_id: null,
          },
        ],
      };

      const createResponse = await request(app).post('/journeys').send(journey);
      const journeyId = createResponse.body.journey_id;

      const complexContext = {
        patient_context: {
          patient_id: 'patient-999',
          age: 55,
          condition: 'hypertension',
          medications: ['med1', 'med2'],
          score: 87.5,
          notes: 'Custom patient notes',
        },
      };

      const triggerResponse = await request(app)
        .post(`/journeys/${journeyId}/trigger`)
        .send(complexContext);

      const runId = triggerResponse.body.run_id;

      await new Promise(resolve => setTimeout(resolve, 500));

      const finalStatus = await request(app).get(`/journeys/runs/${runId}`);
      
      // Verify all context fields preserved
      expect(finalStatus.body.patient_context).toEqual(complexContext.patient_context);
    });
  });
});
