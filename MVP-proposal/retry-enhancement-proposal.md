# Advanced Retry Mechanisms Enhancement Proposal

## Current State Analysis

### ✅ What We Have:

- Basic error detection and `failed` status marking
- Current node tracking (`current_node_id`)
- Timestamp tracking (`created_at`, `updated_at`)
- SQLite database with prepared statements
- In-memory timeout management for delays

### ❌ What's Missing for Retry:

- Retry count tracking
- Error details storage
- Retry scheduling capabilities
- Maximum retry limits
- Exponential backoff logic
- Retry eligibility rules

## Proposed Implementation

### 1. Database Schema Extensions

```sql
-- Add retry-related columns to journey_runs table
ALTER TABLE journey_runs ADD COLUMN retry_count INTEGER DEFAULT 0;
ALTER TABLE journey_runs ADD COLUMN max_retries INTEGER DEFAULT 3;
ALTER TABLE journey_runs ADD COLUMN last_error_message TEXT;
ALTER TABLE journey_runs ADD COLUMN last_error_timestamp DATETIME;
ALTER TABLE journey_runs ADD COLUMN next_retry_at DATETIME;
ALTER TABLE journey_runs ADD COLUMN retry_enabled BOOLEAN DEFAULT true;

-- Add status for retrying
-- Status values: 'in_progress', 'completed', 'failed', 'retrying', 'failed_max_retries'

-- Index for efficient retry scheduling queries
CREATE INDEX IF NOT EXISTS idx_journey_runs_next_retry_at ON journey_runs(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_journey_runs_retrying ON journey_runs(status) WHERE status = 'retrying';
```

### 2. Enhanced Queries Class

```typescript
export class RetryEnabledJourneyQueries extends JourneyQueries {
  // New prepared statements for retry functionality
  private updateJourneyRunWithRetryStmt!: Statement;
  private selectPendingRetriesStmt!: Statement;
  private incrementRetryCountStmt!: Statement;

  // Update run with retry information
  public updateJourneyRunWithRetry(
    id: string,
    status: JourneyRun["status"],
    currentNodeId: string | null,
    errorMessage?: string,
    nextRetryAt?: Date
  ): void {
    // Implementation details...
  }

  // Get runs that are ready for retry
  public getPendingRetries(): JourneyRun[] {
    // Return runs where status = 'retrying' and next_retry_at <= NOW
  }

  // Increment retry count and calculate next retry time
  public scheduleRetry(runId: string, errorMessage: string): boolean {
    // Check if max retries reached
    // Calculate exponential backoff
    // Update retry fields
  }
}
```

### 3. Retry Service Implementation

```typescript
export class RetryService {
  private retryTimeouts = new Map<string, NodeJS.Timeout>();

  // Exponential backoff calculation
  private calculateBackoffDelay(retryCount: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 300000; // 5 minutes
    const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
    return delay + Math.random() * 1000; // Add jitter
  }

  // Schedule a retry for a failed run
  public scheduleRetry(runId: string, retryCount: number): void {
    const delay = this.calculateBackoffDelay(retryCount);
    const nextRetryAt = new Date(Date.now() + delay);

    // Update database
    journeyQueries.scheduleRetry(runId, "Processing error");

    // Schedule in-memory timeout
    const timeout = setTimeout(() => {
      this.executeRetry(runId);
    }, delay);

    this.retryTimeouts.set(runId, timeout);
  }

  // Execute a retry attempt
  private async executeRetry(runId: string): Promise<void> {
    this.retryTimeouts.delete(runId);

    // Reset run to in_progress and continue from last successful node
    journeyQueries.updateJourneyRun(runId, "in_progress", currentNodeId);

    // Resume execution
    await executeJourney(runId);
  }

  // Retry scheduler - runs periodically to catch missed retries
  public startRetryScheduler(): void {
    setInterval(() => {
      const pendingRetries = journeyQueries.getPendingRetries();
      pendingRetries.forEach((run) => {
        if (!this.retryTimeouts.has(run.id)) {
          this.executeRetry(run.id);
        }
      });
    }, 30000); // Check every 30 seconds
  }
}
```

### 4. Enhanced Executor with Retry Logic

```typescript
// Modified continueExecution function
async function continueExecution(runId: string): Promise<void> {
  try {
    // ... existing logic ...
    await processNode(run, currentNode, journey);
  } catch (error) {
    console.error(`[EXECUTOR] Error processing run ${runId}:`, error);

    // Try to schedule retry
    const shouldRetry = await retryService.scheduleRetry(runId, error.message);

    if (!shouldRetry) {
      // Max retries reached, mark as permanently failed
      journeyQueries.updateJourneyRun(
        runId,
        "failed_max_retries",
        run?.current_node_id || null
      );
    }
  }
}
```

## Implementation Advantages

### ✅ **Fully Compatible with Current System:**

- Extends existing schema without breaking changes
- Builds on current prepared statement architecture
- Maintains backward compatibility

### ✅ **Production-Ready Features:**

- **Exponential Backoff**: Prevents thundering herd problems
- **Jitter**: Randomizes retry timing to avoid synchronized retries
- **Max Retry Limits**: Prevents infinite retry loops
- **Persistent Retry State**: Survives server restarts (unlike current delays)
- **Node-Level Recovery**: Resumes from last successful node
- **Error Tracking**: Stores error details for debugging

### ✅ **Monitoring & Observability:**

- Retry count metrics
- Error pattern analysis
- Failed vs. retrying status distinction
- Historical retry data

## Retry Strategies

### 1. **Immediate Retry (0-1 second)**

- Network blips
- Temporary database locks
- Quick recovery scenarios

### 2. **Short Backoff (1-10 seconds)**

- Database connection issues
- External service temporary unavailability
- Resource contention

### 3. **Long Backoff (minutes)**

- External API rate limits
- Downstream service maintenance
- Complex system recovery

### 4. **No Retry Scenarios**

- Validation errors (bad patient data)
- Missing journey definitions
- Malformed node configurations

## Migration Strategy

1. **Phase 1**: Add new columns with defaults
2. **Phase 2**: Deploy retry service (disabled by default)
3. **Phase 3**: Enable retries for specific error types
4. **Phase 4**: Full retry system activation

## Configuration Options

```typescript
interface RetryConfig {
  maxRetries: number; // Default: 3
  baseDelayMs: number; // Default: 1000
  maxDelayMs: number; // Default: 300000
  jitterMs: number; // Default: 1000
  retryableErrors: string[]; // Configurable error patterns
  nonRetryableErrors: string[]; // Skip retry for these
}
```

## Conclusion

**Yes, advanced retry mechanisms are definitely feasible** with the current implementation. The main enhancements needed are:

1. Schema extensions for retry tracking
2. Retry scheduling service
3. Enhanced error handling logic
4. Configuration management

This would transform the current "fail-once-and-stop" behavior into a robust, production-ready retry system with exponential backoff, jitter, and persistent state management.
