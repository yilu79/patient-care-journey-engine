import { getDatabase } from './database';
import { Journey, JourneyRun, PatientContext, JourneyNode } from '../types/journey';
import type { Statement } from 'better-sqlite3';

/**
 * Prepared SQL statements for RevelAI Journey Engine
 * All database operations with type safety and performance optimization
 */
export class JourneyQueries {
  private db = getDatabase();

  // Journey table queries
  private insertJourneyStmt!: Statement;
  private selectJourneyByIdStmt!: Statement;
  private selectAllJourneysStmt!: Statement;

  // Journey runs table queries
  private insertJourneyRunStmt!: Statement;
  private selectJourneyRunByIdStmt!: Statement;
  private updateJourneyRunStmt!: Statement;
  private selectRunsByJourneyIdStmt!: Statement;

  constructor() {
    // Prepare all statements once for better performance
    this.prepareStatements();
  }

  private prepareStatements(): void {
    // Journey statements
    this.insertJourneyStmt = this.db.prepare(`
      INSERT INTO journeys (id, name, start_node_id, nodes_json)
      VALUES (?, ?, ?, ?)
    `);

    this.selectJourneyByIdStmt = this.db.prepare(`
      SELECT id, name, start_node_id, nodes_json, created_at, updated_at
      FROM journeys
      WHERE id = ?
    `);

    this.selectAllJourneysStmt = this.db.prepare(`
      SELECT id, name, start_node_id, nodes_json, created_at, updated_at
      FROM journeys
      ORDER BY created_at DESC
    `);

    // Journey run statements
    this.insertJourneyRunStmt = this.db.prepare(`
      INSERT INTO journey_runs (id, journey_id, patient_context_json, status, current_node_id)
      VALUES (?, ?, ?, ?, ?)
    `);

    this.selectJourneyRunByIdStmt = this.db.prepare(`
      SELECT id, journey_id, patient_context_json, status, current_node_id, created_at, updated_at
      FROM journey_runs
      WHERE id = ?
    `);

    this.updateJourneyRunStmt = this.db.prepare(`
      UPDATE journey_runs 
      SET status = ?, current_node_id = ?
      WHERE id = ?
    `);

    this.selectRunsByJourneyIdStmt = this.db.prepare(`
      SELECT id, journey_id, patient_context_json, status, current_node_id, created_at, updated_at
      FROM journey_runs
      WHERE journey_id = ?
      ORDER BY created_at DESC
    `);
  }

  /**
   * Insert a new journey into the database
   */
  public insertJourney(journey: Journey): void {
    const nodesJson = JSON.stringify(journey.nodes);
    this.insertJourneyStmt.run(journey.id, journey.name, journey.start_node_id, nodesJson);
  }

  /**
   * Get a journey by ID
   */
  public getJourneyById(id: string): Journey | null {
    const row = this.selectJourneyByIdStmt.get(id) as any;
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      start_node_id: row.start_node_id,
      nodes: JSON.parse(row.nodes_json) as JourneyNode[]
    };
  }

  /**
   * Get all journeys
   */
  public getAllJourneys(): Journey[] {
    const rows = this.selectAllJourneysStmt.all() as any[];
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      start_node_id: row.start_node_id,
      nodes: JSON.parse(row.nodes_json) as JourneyNode[]
    }));
  }

  /**
   * Insert a new journey run
   */
  public insertJourneyRun(run: Omit<JourneyRun, 'created_at' | 'updated_at'>): void {
    const patientContextJson = JSON.stringify(run.patient_context);
    this.insertJourneyRunStmt.run(
      run.id,
      run.journey_id,
      patientContextJson,
      run.status,
      run.current_node_id
    );
  }

  /**
   * Get a journey run by ID
   */
  public getJourneyRunById(id: string): JourneyRun | null {
    const row = this.selectJourneyRunByIdStmt.get(id) as any;
    if (!row) return null;

    return {
      id: row.id,
      journey_id: row.journey_id,
      patient_context: JSON.parse(row.patient_context_json) as PatientContext,
      status: row.status,
      current_node_id: row.current_node_id,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    };
  }

  /**
   * Update journey run status and current node
   */
  public updateJourneyRun(id: string, status: JourneyRun['status'], currentNodeId: string | null): void {
    this.updateJourneyRunStmt.run(status, currentNodeId, id);
  }

  /**
   * Get all runs for a specific journey
   */
  public getRunsByJourneyId(journeyId: string): JourneyRun[] {
    const rows = this.selectRunsByJourneyIdStmt.all(journeyId) as any[];
    return rows.map(row => ({
      id: row.id,
      journey_id: row.journey_id,
      patient_context: JSON.parse(row.patient_context_json) as PatientContext,
      status: row.status,
      current_node_id: row.current_node_id,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    }));
  }

  /**
   * Check if a journey exists
   */
  public journeyExists(id: string): boolean {
    const journey = this.getJourneyById(id);
    return journey !== null;
  }

  /**
   * Get journey run with associated journey data (for executor)
   */
  public getRunWithJourney(runId: string): { run: JourneyRun; journey: Journey } | null {
    const run = this.getJourneyRunById(runId);
    if (!run) return null;

    const journey = this.getJourneyById(run.journey_id);
    if (!journey) return null;

    return { run, journey };
  }
}

// Export singleton instance
export const journeyQueries = new JourneyQueries();