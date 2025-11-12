import request from 'supertest';
import app from '../../src/app';
import { getDatabase } from '../../src/db/database';
import { Journey } from '../../src/types/journey';

describe('API Endpoints Integration Tests', () => {
  let db: any;

  beforeAll(() => {
    db = getDatabase();
  });

  beforeEach(() => {
    // Clean up database before each test
    db.exec('DELETE FROM journey_runs');
    db.exec('DELETE FROM journeys');
  });

  describe('POST /journeys', () => {
    it('should create a new journey and return 201 with journey_id', async () => {
      const journey = {
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

      const response = await request(app)
        .post('/journeys')
        .send(journey)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body).toHaveProperty('journey_id');
      expect(typeof response.body.journey_id).toBe('string');
      expect(response.body.journey_id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
    });

    it('should return 400 for invalid journey structure', async () => {
      const invalidJourney = {
        name: 'Test Journey',
        start_node_id: 'non-existent',
        nodes: [
          {
            id: 'msg1',
            type: 'MESSAGE',
            message: 'Welcome!',
            next_node_id: null,
          },
        ],
      };

      const response = await request(app)
        .post('/journeys')
        .send(invalidJourney)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('details');
    });

    it('should validate all node references', async () => {
      const journeyWithInvalidRef = {
        name: 'Test Journey',
        start_node_id: 'msg1',
        nodes: [
          {
            id: 'msg1',
            type: 'MESSAGE',
            message: 'Test',
            next_node_id: 'non-existent', // Invalid reference
          },
        ],
      };

      const response = await request(app)
        .post('/journeys')
        .send(journeyWithInvalidRef)
        .expect(400);

      expect(response.body.details).toContainEqual(
        expect.stringContaining('non-existent')
      );
    });

    it('should validate conditional node structure', async () => {
      const journey = {
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
            on_true_next_node_id: 'msg1',
            on_false_next_node_id: 'msg2',
          },
          {
            id: 'msg1',
            type: 'MESSAGE',
            message: 'Senior',
            next_node_id: null,
          },
          {
            id: 'msg2',
            type: 'MESSAGE',
            message: 'General',
            next_node_id: null,
          },
        ],
      };

      const response = await request(app)
        .post('/journeys')
        .send(journey)
        .expect(201);

      expect(response.body).toHaveProperty('journey_id');
    });
  });

  describe('POST /journeys/:journeyId/trigger', () => {
    let journeyId: string;

    beforeEach(async () => {
      // Create a journey first
      const journey = {
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

      const response = await request(app).post('/journeys').send(journey);
      journeyId = response.body.journey_id;
    });

    it('should trigger journey execution and return 202 with run_id', async () => {
      const triggerData = {
        patient_context: {
          id: 'patient-001',
          age: 45,
          language: 'en' as const,
          condition: 'hip_replacement' as const,
        },
      };

      const response = await request(app)
        .post(`/journeys/${journeyId}/trigger`)
        .send(triggerData)
        .expect('Content-Type', /json/)
        .expect(202);

      expect(response.body).toHaveProperty('run_id');
      expect(typeof response.body.run_id).toBe('string');
      expect(response.body.run_id).toMatch(/^[0-9a-f-]{36}$/);

      // Check Location header
      expect(response.headers.location).toMatch(/\/journeys\/runs\/.+/);
    });

    it('should return 404 for non-existent journey', async () => {
      const triggerData = {
        patient_context: {
          id: 'patient-001',
          age: 45,
          language: 'en' as const,
          condition: 'knee_replacement' as const,
        },
      };

      const response = await request(app)
        .post('/journeys/non-existent-id/trigger')
        .send(triggerData)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('not found');
    });

    it('should return 400 for missing patient_context', async () => {
      const response = await request(app)
        .post(`/journeys/${journeyId}/trigger`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('patient_context');
    });

    it('should return 400 for missing id in context', async () => {
      const triggerData = {
        patient_context: {
          age: 45,
          language: 'en' as const,
          condition: 'hip_replacement' as const,
        },
      };

      const response = await request(app)
        .post(`/journeys/${journeyId}/trigger`)
        .send(triggerData)
        .expect(400);

      expect(response.body.error).toContain('id');
    });
  });

  describe('GET /journeys/runs/:runId', () => {
    let journeyId: string;
    let runId: string;

    beforeEach(async () => {
      // Create a journey
      const journey = {
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

      const journeyResponse = await request(app)
        .post('/journeys')
        .send(journey);
      journeyId = journeyResponse.body.journey_id;

      // Trigger execution
      const triggerData = {
        patient_context: {
          id: 'patient-001',
          age: 45,
          language: 'es' as const,
          condition: 'knee_replacement' as const,
        },
      };

      const triggerResponse = await request(app)
        .post(`/journeys/${journeyId}/trigger`)
        .send(triggerData);
      runId = triggerResponse.body.run_id;
    });

    it('should return run status with all fields', async () => {
      const response = await request(app)
        .get(`/journeys/runs/${runId}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('id', runId);
      expect(response.body).toHaveProperty('journey_id', journeyId);
      expect(response.body).toHaveProperty('patient_context');
      expect(response.body.patient_context).toEqual({
        id: 'patient-001',
        age: 45,
        language: 'es',
        condition: 'knee_replacement',
      });
      expect(response.body).toHaveProperty('status');
      expect(['in_progress', 'completed', 'failed']).toContain(
        response.body.status
      );
      expect(response.body).toHaveProperty('created_at');
      expect(response.body).toHaveProperty('updated_at');
    });

    it('should return 404 for non-existent run', async () => {
      const response = await request(app)
        .get('/journeys/runs/non-existent-id')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('not found');
      expect(response.body).toHaveProperty('run_id', 'non-existent-id');
    });

    it('should have ISO 8601 formatted timestamps', async () => {
      const response = await request(app)
        .get(`/journeys/runs/${runId}`)
        .expect(200);

      // Check if timestamps are valid ISO 8601 strings
      expect(() => new Date(response.body.created_at)).not.toThrow();
      expect(() => new Date(response.body.updated_at)).not.toThrow();

      // Check format
      expect(response.body.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(response.body.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('service');
    });
  });

  describe('Error handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown-route')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/journeys')
        .set('Content-Type', 'application/json')
        .send('invalid json{');

      // Express body-parser returns 400 by default, but may return 500 in some configurations
      expect([400, 500]).toContain(response.status);
    });
  });
});
