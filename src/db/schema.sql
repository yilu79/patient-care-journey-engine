-- Patient Care Journey Engine Database Schema
-- SQLite schema for storing journey definitions and execution runs

-- Table for storing journey definitions
CREATE TABLE IF NOT EXISTS journeys (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    start_node_id TEXT NOT NULL,
    nodes_json TEXT NOT NULL, -- JSON serialized array of JourneyNode objects
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table for storing journey execution runs
CREATE TABLE IF NOT EXISTS journey_runs (
    id TEXT PRIMARY KEY,
    journey_id TEXT NOT NULL,
    patient_context_json TEXT NOT NULL, -- JSON serialized PatientContext object
    status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'failed')),
    current_node_id TEXT, -- NULL when journey is completed or failed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (journey_id) REFERENCES journeys(id) ON DELETE CASCADE
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_journey_runs_journey_id ON journey_runs(journey_id);
CREATE INDEX IF NOT EXISTS idx_journey_runs_status ON journey_runs(status);
CREATE INDEX IF NOT EXISTS idx_journey_runs_created_at ON journey_runs(created_at);

-- Trigger to automatically update updated_at timestamp on journeys table
CREATE TRIGGER IF NOT EXISTS update_journeys_timestamp 
    AFTER UPDATE ON journeys
BEGIN
    UPDATE journeys SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger to automatically update updated_at timestamp on journey_runs table
CREATE TRIGGER IF NOT EXISTS update_journey_runs_timestamp 
    AFTER UPDATE ON journey_runs
BEGIN
    UPDATE journey_runs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;