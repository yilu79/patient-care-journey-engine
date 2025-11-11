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
└── integration/     # E2E tests
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

**Validation Testing:**

✅ **Happy Path Tests:**

- Returns 200 with all required fields for valid run ID
- Patient context preserved with all custom fields
- Timestamps in ISO 8601 format
- Proper JSON structure

✅ **Negative Tests:**

- Returns 404 for non-existent run ID
- Returns 404 for invalid UUID format
- Graceful error messages with context

## 🧩 Journey Node Types

### MESSAGE Node

Sends a message to the patient.

```json
{
  "id": "welcome",
  "type": "MESSAGE",
  "message": "Welcome to your care journey!",
  "next_node_id": "next_step"
}
```

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

## 🧪 Testing the API

### Using curl

1. **Create a journey:**

   ```bash
   curl -X POST http://localhost:3000/journeys \
     -H "Content-Type: application/json" \
     -d @test-journey.json
   ```

2. **Trigger execution:**

   ```bash
   curl -X POST http://localhost:3000/journeys/{JOURNEY_ID}/trigger \
     -H "Content-Type: application/json" \
     -d '{"patient_context":{"patient_id":"patient-123","age":70}}'
   ```

3. **Check run status:**

   ```bash
   curl http://localhost:3000/journeys/runs/{RUN_ID}
   ```

4. **Test 404 error handling:**
   ```bash
   # Non-existent run ID
   curl -i http://localhost:3000/journeys/runs/non-existent-id
   # Expected: HTTP 404 with error message
   ```

### Complete Test Flow

```bash
# 1. Create journey
JOURNEY_ID=$(curl -s -X POST http://localhost:3000/journeys \
  -H "Content-Type: application/json" \
  -d @test-journey.json | jq -r '.journey_id')

echo "Journey ID: $JOURNEY_ID"

# 2. Trigger execution
RUN_ID=$(curl -s -X POST http://localhost:3000/journeys/$JOURNEY_ID/trigger \
  -H "Content-Type: application/json" \
  -d '{"patient_context":{"patient_id":"patient-123","age":70}}' | jq -r '.run_id')

echo "Run ID: $RUN_ID"

# 3. Check status (with pretty print)
curl -s http://localhost:3000/journeys/runs/$RUN_ID | jq
```

### Validated Test Cases

The GET endpoint has been validated with the following test scenarios:

✅ **Happy Path:**

- Valid run ID returns complete data with all fields
- Patient context includes all custom fields
- Status reflects current execution state
- Timestamps in proper ISO format

✅ **Error Handling:**

- Non-existent run ID returns 404
- Invalid UUID format returns 404
- Error responses include helpful context

## 🛠️ Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm test` - Run test suite
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

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

## 📝 Journey Validation

The API performs comprehensive validation:

- **Structure validation**: Ensures all required fields are present
- **Reference integrity**: Verifies all `next_node_id` references exist
- **Node type validation**: Validates node-specific requirements
- **Duplicate prevention**: Checks for duplicate node IDs
- **Conditional logic**: Validates condition syntax and operators

## 🚨 Error Handling

The API provides detailed error responses:

- `400 Bad Request` - Validation errors with detailed explanations
- `404 Not Found` - Journey or run not found
- `409 Conflict` - Database constraint violations
- `500 Internal Server Error` - Server errors (with details in development)

## 🔮 Future Implementation

- **Journey Executor** (Hour 3) - Actual node processing and execution
- **Testing Suite** (Hour 4) - Unit and integration tests
- **Advanced Features** - Webhooks, parallel execution, retry mechanisms

## 📄 License

ISC
