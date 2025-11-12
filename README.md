# RevelAI Journey Engine

A backend journey orchestration engine that executes patient care pathways with support for messages, delays, and conditional branching.

## 🏗️ Architecture

- **Language**: TypeScript with Node.js
- **Framework**: Express.js
- **Database**: SQLite with better-sqlite3 (zero-config, file-based)
- **Testing**: Jest + Supertest
- **Async Processing**: setTimeout with in-memory tracking

## 📁 Project Structure

```
src/
├── types/           # TypeScript interfaces
├── db/              # Database setup & queries
├── services/        # Business logic (executor)
├── routes/          # API endpoints
├── app.ts           # Express app setup
└── server.ts        # Server entry point
tests/
├── unit/            # Unit tests (30 tests)
└── integration/     # Integration tests (22 tests)
examples/            # Sample journey JSON files
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ (LTS)
- npm or yarn

### Installation

1. **Clone and setup the project:**

   ```bash
   git clone <repository-url>
   cd revelai-journey-engine
   npm install
   ```

2. **Start the development server:**

   ```bash
   npm run dev
   ```

3. **The server will start on port 3000:**
   ```
   🚀 RevelAI Journey Engine started successfully!
   📚 API Server running on: http://localhost:3000
   🏥 Health check available at: http://localhost:3000/health
   ```

## 📡 API Endpoints

### Health Check

```http
GET /health
```

**Response (200 OK):**

```json
{
  "status": "healthy",
  "timestamp": "2025-11-11T19:36:21.135Z",
  "service": "RevelAI Journey Engine"
}
```

### 1. Create Journey

```http
POST /journeys
Content-Type: application/json
```

**Request Body:**

```json
{
  "name": "Simple Welcome Journey",
  "start_node_id": "welcome",
  "nodes": [
    {
      "id": "welcome",
      "type": "MESSAGE",
      "message": "Welcome to your care journey!",
      "next_node_id": "check_age"
    },
    {
      "id": "check_age",
      "type": "CONDITIONAL",
      "condition": {
        "field": "age",
        "operator": ">",
        "value": 65
      },
      "true_node_id": "senior_message",
      "false_node_id": "general_message"
    },
    {
      "id": "senior_message",
      "type": "MESSAGE",
      "message": "As a senior patient, you have access to specialized care programs.",
      "next_node_id": null
    },
    {
      "id": "general_message",
      "type": "MESSAGE",
      "message": "Thank you for choosing our care program!",
      "next_node_id": null
    }
  ]
}
```

**Response (201 Created):**

```json
{
  "journey_id": "6ad40b69-b577-49c9-abc7-feed24d2e98a"
}
```

### 2. Trigger Journey Execution

```http
POST /journeys/:journeyId/trigger
Content-Type: application/json
```

**Request Body:**

```json
{
  "patient_context": {
    "patient_id": "patient-123",
    "age": 70,
    "condition": "diabetes"
  }
}
```

**Response (202 Accepted):**

```json
{
  "run_id": "fc510827-9240-46c3-8598-aaf7f07bfbe0"
}
```

**Headers:**

- `Location: /journeys/runs/fc510827-9240-46c3-8598-aaf7f07bfbe0`

### 3. Get Journey Run Status

```http
GET /journeys/runs/:runId
```

**Success Response (200 OK):**

```json
{
  "id": "445ccbdc-49ba-4b21-8354-8a1e55e52470",
  "journey_id": "97b1a13b-9428-4094-8832-7983e1699470",
  "patient_context": {
    "patient_id": "patient-456",
    "age": 45,
    "condition": "hypertension"
  },
  "status": "in_progress",
  "current_node_id": "welcome",
  "created_at": "2025-11-12T03:54:21.000Z",
  "updated_at": "2025-11-12T03:54:21.000Z"
}
```

**Error Response (404 Not Found):**

```json
{
  "error": "Journey run not found",
  "run_id": "non-existent-id"
}
```

**Response Fields:**

- `id` - Unique run identifier (UUID)
- `journey_id` - Reference to the journey definition
- `patient_context` - Full patient information provided at trigger
- `status` - Current execution status (`in_progress`, `completed`, `failed`)
- `current_node_id` - ID of the node currently being processed (null if completed/failed)
- `created_at` - ISO 8601 timestamp of run creation
- `updated_at` - ISO 8601 timestamp of last update

## 🧩 Journey Node Types

### MESSAGE Node

Sends a message to the patient (logged to console).

```json
{
  "id": "welcome",
  "type": "MESSAGE",
  "message": "Welcome to your care journey!",
  "next_node_id": "next_step"
}
```

**Execution Behavior:**

- Logs message to server console with patient ID
- Updates `current_node_id` to `next_node_id`
- If `next_node_id` is null, marks journey as `completed`
- Continues to next node automatically

### DELAY Node

Waits for specified duration before continuing.

```json
{
  "id": "wait_24h",
  "type": "DELAY",
  "delay_seconds": 86400,
  "next_node_id": "follow_up"
}
```

**Execution Behavior:**

- Schedules continuation with `setTimeout`
- Stores timeout reference in memory (Map<runId, NodeJS.Timeout>)
- Updates database status to `in_progress` before waiting
- Resumes execution after delay completes
- **Note:** Delays do not survive server restarts

### CONDITIONAL Node

Branches based on patient context evaluation.

```json
{
  "id": "age_check",
  "type": "CONDITIONAL",
  "condition": {
    "field": "age",
    "operator": ">",
    "value": 65
  },
  "true_node_id": "senior_path",
  "false_node_id": "general_path"
}
```

**Supported Operators:**

- `>`, `<`, `>=`, `<=` - Numeric comparisons
- `=`, `!=` - Equality/inequality (any type)

**Execution Behavior:**

- Evaluates condition against patient context
- Supports nested field paths (e.g., `patient.age` or just `age`)
- Branches to `true_node_id` or `false_node_id` based on result
- Logs evaluation result to console
- Continues to selected branch automatically

## ⚙️ Journey Execution

### How It Works

When a journey is triggered via `POST /journeys/:id/trigger`:

1. **Initialization:**

   - Creates a new `journey_run` record with status `in_progress`
   - Sets `current_node_id` to the journey's `start_node_id`
   - Returns 202 Accepted immediately (non-blocking)

2. **Async Execution:**

   - Executor starts processing in the background
   - Processes nodes sequentially, one at a time
   - Updates database after each node

3. **Node Processing Loop:**

   ```
   Start → Fetch Run → Fetch Journey → Find Current Node → Process Node
           ↑                                                      ↓
           └──────────── Continue to Next Node ←─────────────────┘
   ```

4. **Completion:**
   - Journey marked as `completed` when reaching a terminal node
   - Journey marked as `failed` if error occurs during processing

### Example Execution Flow

```
[EXECUTOR] Starting execution for run ec7cd8ec-f8ab-42aa-9abf-9eb77d0ef4d3
[EXECUTOR] Processing node msg1 (MESSAGE) for run ec7cd8ec...
[MESSAGE] Sending message to patient patient-001: Welcome! Starting your journey...
[EXECUTOR] Processing node cond1 (CONDITIONAL) for run ec7cd8ec...
[CONDITIONAL] Evaluating condition: age > 65
[CONDITIONAL] Result: true
[EXECUTOR] Processing node msg_senior (MESSAGE) for run ec7cd8ec...
[MESSAGE] Sending message to patient patient-001: You qualify for senior care programs!
[EXECUTOR] Journey run ec7cd8ec-f8ab-42aa-9abf-9eb77d0ef4d3 completed
```

### State Management

- **Database:** Persistent storage for journey definitions and run state
- **In-Memory:** Active delay timeouts (Map<runId, NodeJS.Timeout>)
- **Status Updates:** After each node, `current_node_id` updated in database
- **Error Handling:** Failed runs marked as `failed` with error logging

## 🧪 Testing

### Quick Start

```bash
# Run all tests
npm test

# Run with coverage report
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

### Manual Testing with curl

1. **Create a journey:**

   ```bash
   curl -X POST http://localhost:3000/journeys \
     -H "Content-Type: application/json" \
     -d @examples/simple-message.json
   ```

2. **Trigger execution:**

   ```bash
   curl -X POST http://localhost:3000/journeys/{JOURNEY_ID}/trigger \
     -H "Content-Type: application/json" \
     -d '{"patient_context":{"patient_id":"patient-123","age":70}}'
   ```

3. **Check status:**
   ```bash
   curl http://localhost:3000/journeys/runs/{RUN_ID}
   ```

### Test Suite Overview

```bash
52 tests across 4 suites - all passing ✅
├── Unit Tests (30)
│   ├── Conditional evaluator (22 tests)
│   └── Executor logic (8 tests)
└── Integration Tests (22)
    ├── API endpoints (14 tests)
    └── Journey execution E2E (8 tests)

Code Coverage: 74% overall
```

For detailed testing documentation, see [TESTING.md](TESTING.md).

## 🛠️ Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm test` - Run test suite (52 tests)
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report (74% coverage)

### Testing

The project includes a comprehensive test suite with **52 tests** achieving **74% code coverage**:

- **30 Unit Tests**: Conditional evaluator, executor logic, error handling
- **22 Integration Tests**: API endpoints, E2E journey execution flows
- **Test Framework**: Jest 30.2.0 with ts-jest for TypeScript
- **API Testing**: Supertest for HTTP endpoint validation

**Test Coverage:**

- Statements: 74.09%
- Branches: 70.5%
- Functions: 70.83%
- Lines: 75%

For detailed testing documentation, see [TESTING.md](TESTING.md).

**Quick Test Commands:**

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test tests/unit/conditional.test.ts

# Watch mode for development
npm test -- --watch
```

### Database

- **Type**: SQLite
- **Location**: `journeys.db` (auto-created)
- **Schema**: Automatically initialized on startup
- **Tables**: `journeys`, `journey_runs`

### Project Setup Details

The project uses:

- **TypeScript** with strict mode enabled
- **Express.js** for REST API
- **better-sqlite3** for database operations
- **UUID v4** for ID generation
- **Comprehensive validation** for journey structure
- **Type-safe database queries** with prepared statements

## 🔧 Configuration

### Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode (development/production)

### Database Configuration

The SQLite database is automatically created and initialized with the required schema on first startup. No additional configuration needed.

## 🎯 Design Decisions & Assumptions

### Architecture Choices

1. **SQLite Database:**

   - File-based storage for simplicity and zero configuration
   - Single file (`journeys.db`) contains all data
   - Auto-initialization of schema on startup
   - Perfect for development and single-instance deployments

2. **In-Memory Timeout Tracking:**

   - Active DELAY nodes tracked in JavaScript Map
   - Fast and efficient for single-server setup
   - **Limitation:** Delays do not survive server restarts
   - **Production Alternative:** Use external job queue (Bull, BullMQ, etc.)

3. **Synchronous Node Processing:**

   - Nodes processed one at a time, in sequence
   - Simpler to reason about and debug
   - Database updated after each node
   - **Alternative:** Could parallelize independent branches

4. **Async Journey Execution:**
   - POST /trigger returns 202 immediately
   - Execution happens in background (non-blocking)
   - Status checked via GET /runs/:runId
   - Follows async processing best practices

### Execution Behavior

- **MESSAGE Nodes:** Logged to console (in production, would integrate with messaging service)
- **CONDITIONAL Nodes:** Simple expression evaluation (no complex logic support)
- **DELAY Nodes:** setTimeout-based (production would use durable job queue)
- **Error Handling:** Failed journeys marked as `failed` with error logging

## Error Handling

The API provides detailed error responses:

- `400 Bad Request` - Validation errors (missing fields, invalid references, duplicate node IDs)
- `404 Not Found` - Journey or run not found
- `500 Internal Server Error` - Server errors

**Validation includes:**

- Structure validation and required fields
- Reference integrity (all `next_node_id` values exist)
- Node-specific requirements (CONDITIONAL operators, etc.)
- Execution errors are caught and runs marked as `failed`

## ⚠️ Known Limitations

1. **Delay Persistence:**

   - DELAY nodes use in-memory `setTimeout`
   - Active delays are lost on server restart
   - Run remains in `in_progress` state after restart
   - **Production Solution:** Use persistent job queue (Redis, RabbitMQ, Bull)

2. **Scalability:**

   - Single-instance design (in-memory state)
   - SQLite has write concurrency limits
   - **Production Solution:** PostgreSQL + distributed job queue

3. **Retry Mechanism:**

   - No automatic retry for failed nodes
   - Failed journeys require manual intervention
   - **Future Enhancement:** Implement retry logic with exponential backoff

4. **Parallel Execution:**

   - Nodes processed sequentially only
   - No support for concurrent branches
   - **Future Enhancement:** DAG-based execution with parallel paths

5. **Condition Evaluation:**
   - Simple expressions only (field operator value)
   - No complex logic (AND/OR combinations)
   - No nested conditions
   - **Future Enhancement:** Expression language support

## ✅ Project Status

**All objectives completed:**

- ✅ TypeScript backend with SQLite database
- ✅ REST API with 3 endpoints (create, trigger, status)
- ✅ Journey executor supporting MESSAGE, CONDITIONAL, DELAY nodes
- ✅ Comprehensive test suite (52 tests, 74% coverage)
- ✅ Complete documentation

See [PROJECT_COMPLETION.md](PROJECT_COMPLETION.md) for detailed implementation timeline.

## 🔮 Future Enhancements

### Production Readiness

- **Persistent Job Queue:** Replace setTimeout with Bull/BullMQ + Redis
- **Database Migration:** Move from SQLite to PostgreSQL for scalability
- **Horizontal Scaling:** Support multiple server instances
- **Monitoring:** Add APM, metrics, and health checks
- **Authentication:** Add API key or OAuth authentication
- **Rate Limiting:** Protect endpoints from abuse

### Advanced Features

- **Webhooks:** Call external URLs for MESSAGE nodes
- **Journey Versioning:** Track and manage journey versions
- **Parallel Execution:** Support concurrent branch processing
- **Complex Conditions:** AND/OR logic, nested conditions
- **Retry Logic:** Automatic retry with exponential backoff
- **Run History:** Query all runs for a journey
- **Journey Cancellation:** DELETE /journeys/runs/:runId endpoint

## 🧪 Test Results

### Executor Tests (Validated)

✅ **MESSAGE Node Test:**

- Messages logged to console with patient ID
- Correct continuation to next node
- Terminal nodes mark journey as completed

✅ **CONDITIONAL Node Test:**

- Senior patient (age=70): Correctly branched to `true_node_id`
- Young patient (age=45): Correctly branched to `false_node_id`
- Condition evaluation logged and accurate

✅ **DELAY Node Test:**

- 3-second delay scheduled correctly
- Execution resumed after delay
- Timestamps show correct 3-second gap (created_at → updated_at)
- Timeout tracked in memory successfully

✅ **Error Handling:**

- Invalid run IDs handled gracefully
- Missing nodes fail journey with proper status
- Database errors caught and logged

## 📄 License

ISC
