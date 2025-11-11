// Core journey orchestration types for RevelAI Journey Engine

/**
 * Patient context containing patient information for journey execution
 */
export interface PatientContext {
  patient_id: string;
  age: number;
  condition?: string;
  [key: string]: any; // Allow additional dynamic fields
}

/**
 * Base interface for all journey nodes
 */
export interface BaseJourneyNode {
  id: string;
  type: 'MESSAGE' | 'DELAY' | 'CONDITIONAL';
}

/**
 * Message node - sends a message to the patient
 */
export interface MessageNode extends BaseJourneyNode {
  type: 'MESSAGE';
  message: string;
  next_node_id: string | null; // null indicates end of journey
}

/**
 * Delay node - waits for specified duration before continuing
 */
export interface DelayNode extends BaseJourneyNode {
  type: 'DELAY';
  delay_seconds: number;
  next_node_id: string | null;
}

/**
 * Condition for conditional nodes
 */
export interface Condition {
  field: string; // e.g., 'age', 'patient.age', 'condition'
  operator: '>' | '<' | '>=' | '<=' | '=' | '!=';
  value: any; // The value to compare against
}

/**
 * Conditional node - branches based on patient context
 */
export interface ConditionalNode extends BaseJourneyNode {
  type: 'CONDITIONAL';
  condition: Condition;
  true_node_id: string | null;
  false_node_id: string | null;
}

/**
 * Union type for all journey node types
 */
export type JourneyNode = MessageNode | DelayNode | ConditionalNode;

/**
 * Complete journey definition
 */
export interface Journey {
  id: string;
  name: string;
  start_node_id: string;
  nodes: JourneyNode[];
}

/**
 * Journey execution run state - tracks execution progress
 */
export interface JourneyRun {
  id: string;
  journey_id: string;
  patient_context: PatientContext;
  status: 'in_progress' | 'completed' | 'failed';
  current_node_id: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * API request types
 */
export interface CreateJourneyRequest {
  name: string;
  start_node_id: string;
  nodes: JourneyNode[];
}

export interface TriggerJourneyRequest {
  patient_context: PatientContext;
}

/**
 * API response types
 */
export interface CreateJourneyResponse {
  journey_id: string;
}

export interface TriggerJourneyResponse {
  run_id: string;
}

export interface JourneyRunResponse {
  id: string;
  journey_id: string;
  patient_context: PatientContext;
  status: 'in_progress' | 'completed' | 'failed';
  current_node_id: string | null;
  created_at: string; // ISO date string for API response
  updated_at: string; // ISO date string for API response
}