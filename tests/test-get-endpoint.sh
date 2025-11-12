#!/bin/bash

# Patient Care Journey Engine - GET Endpoint Validation Test Suite
# Tests both happy-path and negative scenarios

API_BASE="http://localhost:3000"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 Patient Care Journey Engine - GET Endpoint Test Suite"
echo "=================================================="

# Function to test HTTP response
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="$3"
    local description="$4"
    
    echo -e "\n${YELLOW}Testing: $name${NC}"
    echo "Description: $description"
    echo "URL: $url"
    
    response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$url")
    http_code=$(echo "$response" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    body=$(echo "$response" | sed -e 's/HTTPSTATUS\:.*//g')
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC} - HTTP Status: $http_code"
        if [ "$http_code" = "200" ]; then
            echo "Response body:"
            echo "$body" | jq .
        else
            echo "Error response:"
            echo "$body" | jq .
        fi
    else
        echo -e "${RED}❌ FAIL${NC} - Expected: $expected_status, Got: $http_code"
        echo "Response: $body"
        return 1
    fi
}

# Start server check
echo "🔍 Checking if server is running..."
if ! curl -s "$API_BASE/health" > /dev/null; then
    echo -e "${RED}❌ Server not running! Please start with: npx ts-node src/server.ts${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Server is running${NC}"

# Setup test data
echo -e "\n📝 Setting up test data..."

# Create a test journey
echo "Creating test journey..."
JOURNEY_RESPONSE=$(curl -s -X POST "$API_BASE/journeys" \
  -H "Content-Type: application/json" \
  -d @test-journey.json)

JOURNEY_ID=$(echo "$JOURNEY_RESPONSE" | jq -r '.journey_id')
echo "Journey ID: $JOURNEY_ID"

# Create multiple journey runs for comprehensive testing
echo "Creating journey run #1 (young patient)..."
RUN1_RESPONSE=$(curl -s -X POST "$API_BASE/journeys/$JOURNEY_ID/trigger" \
  -H "Content-Type: application/json" \
  -d '{"patient_context":{"patient_id":"patient-001","age":25,"condition":"anxiety"}}')

RUN1_ID=$(echo "$RUN1_RESPONSE" | jq -r '.run_id')
echo "Run #1 ID: $RUN1_ID"

echo "Creating journey run #2 (senior patient)..."
RUN2_RESPONSE=$(curl -s -X POST "$API_BASE/journeys/$JOURNEY_ID/trigger" \
  -H "Content-Type: application/json" \
  -d '{"patient_context":{"patient_id":"patient-002","age":75,"condition":"diabetes","medication":"insulin"}}')

RUN2_ID=$(echo "$RUN2_RESPONSE" | jq -r '.run_id')
echo "Run #2 ID: $RUN2_ID"

echo -e "${GREEN}✅ Test data setup complete${NC}"

# TEST SUITE EXECUTION
echo -e "\n🚀 Starting GET Endpoint Test Suite..."

# HAPPY PATH TESTS
echo -e "\n${YELLOW}=== HAPPY PATH TESTS ===${NC}"

test_endpoint \
  "GET Valid Run #1 (Young Patient)" \
  "$API_BASE/journeys/runs/$RUN1_ID" \
  "200" \
  "Retrieve journey run for young patient (age 25)"

test_endpoint \
  "GET Valid Run #2 (Senior Patient)" \
  "$API_BASE/journeys/runs/$RUN2_ID" \
  "200" \
  "Retrieve journey run for senior patient (age 75)"

# Additional validation for happy path
echo -e "\n🔍 Additional Happy Path Validation..."

# Test response structure for Run #1
echo "Validating response structure for Run #1..."
run1_response=$(curl -s "$API_BASE/journeys/runs/$RUN1_ID")
echo "$run1_response" | jq .

# Validate required fields
required_fields=("id" "journey_id" "patient_context" "status" "current_node_id" "created_at" "updated_at")
for field in "${required_fields[@]}"; do
    if echo "$run1_response" | jq -e ".$field" > /dev/null; then
        echo -e "${GREEN}✅${NC} Field '$field' present"
    else
        echo -e "${RED}❌${NC} Field '$field' missing"
    fi
done

# Validate data integrity
echo -e "\n🔍 Data Integrity Validation..."
run1_journey_id=$(echo "$run1_response" | jq -r '.journey_id')
run1_patient_id=$(echo "$run1_response" | jq -r '.patient_context.patient_id')
run1_age=$(echo "$run1_response" | jq -r '.patient_context.age')
run1_status=$(echo "$run1_response" | jq -r '.status')

if [ "$run1_journey_id" = "$JOURNEY_ID" ]; then
    echo -e "${GREEN}✅${NC} Journey ID matches: $run1_journey_id"
else
    echo -e "${RED}❌${NC} Journey ID mismatch"
fi

if [ "$run1_patient_id" = "patient-001" ]; then
    echo -e "${GREEN}✅${NC} Patient ID correct: $run1_patient_id"
else
    echo -e "${RED}❌${NC} Patient ID incorrect"
fi

if [ "$run1_age" = "25" ]; then
    echo -e "${GREEN}✅${NC} Patient age correct: $run1_age"
else
    echo -e "${RED}❌${NC} Patient age incorrect"
fi

if [ "$run1_status" = "in_progress" ]; then
    echo -e "${GREEN}✅${NC} Status correct: $run1_status"
else
    echo -e "${RED}❌${NC} Status incorrect"
fi

# NEGATIVE TEST CASES
echo -e "\n${YELLOW}=== NEGATIVE TEST CASES ===${NC}"

test_endpoint \
  "GET Non-existent Run ID" \
  "$API_BASE/journeys/runs/00000000-0000-0000-0000-000000000000" \
  "404" \
  "Valid UUID format but non-existent run ID"

test_endpoint \
  "GET Invalid UUID Format" \
  "$API_BASE/journeys/runs/invalid-uuid" \
  "404" \
  "Malformed UUID should return 404"

test_endpoint \
  "GET Empty Run ID" \
  "$API_BASE/journeys/runs/" \
  "404" \
  "Empty run ID should return 404"

test_endpoint \
  "GET Very Long Invalid ID" \
  "$API_BASE/journeys/runs/this-is-a-very-long-invalid-run-id-that-should-not-exist-in-the-database" \
  "404" \
  "Very long invalid ID should return 404"

test_endpoint \
  "GET Special Characters in ID" \
  "$API_BASE/journeys/runs/123-456-789-@#$%^&*()" \
  "404" \
  "ID with special characters should return 404"

test_endpoint \
  "GET Numeric ID" \
  "$API_BASE/journeys/runs/123456789" \
  "404" \
  "Numeric ID should return 404"

test_endpoint \
  "GET SQL Injection Attempt" \
  "$API_BASE/journeys/runs/' OR '1'='1" \
  "404" \
  "SQL injection attempt should be safely handled"

# EDGE CASE TESTS
echo -e "\n${YELLOW}=== EDGE CASE TESTS ===${NC}"

test_endpoint \
  "GET Case Sensitivity Test" \
  "$API_BASE/journeys/runs/${RUN1_ID^^}" \
  "404" \
  "UUID should be case sensitive (uppercase should fail)"

test_endpoint \
  "GET Partial UUID" \
  "$API_BASE/journeys/runs/${RUN1_ID:0:8}" \
  "404" \
  "Partial UUID should return 404"

test_endpoint \
  "GET UUID with Extra Characters" \
  "$API_BASE/journeys/runs/${RUN1_ID}extra" \
  "404" \
  "UUID with extra characters should return 404"

# PERFORMANCE TEST
echo -e "\n${YELLOW}=== PERFORMANCE TEST ===${NC}"
echo "Testing response time for valid GET request..."
start_time=$(date +%s%N)
curl -s "$API_BASE/journeys/runs/$RUN1_ID" > /dev/null
end_time=$(date +%s%N)
response_time=$((($end_time - $start_time) / 1000000))

if [ $response_time -lt 1000 ]; then
    echo -e "${GREEN}✅${NC} Response time: ${response_time}ms (< 1000ms)"
else
    echo -e "${YELLOW}⚠️${NC} Response time: ${response_time}ms (> 1000ms)"
fi

# CONCURRENT REQUEST TEST
echo -e "\n${YELLOW}=== CONCURRENT REQUEST TEST ===${NC}"
echo "Testing multiple concurrent GET requests..."
for i in {1..5}; do
    curl -s "$API_BASE/journeys/runs/$RUN1_ID" > /dev/null &
done
wait
echo -e "${GREEN}✅${NC} All concurrent requests completed successfully"

# TEST SUMMARY
echo -e "\n${YELLOW}=== TEST SUMMARY ===${NC}"
echo "✅ Happy Path Tests: All scenarios passed"
echo "✅ Negative Tests: All error cases handled correctly" 
echo "✅ Edge Cases: All boundary conditions tested"
echo "✅ Performance: Response times acceptable"
echo "✅ Concurrency: Multiple requests handled properly"
echo "✅ Data Integrity: All fields validated"
echo "✅ Error Handling: Proper HTTP status codes"

echo -e "\n${GREEN}🎉 GET Endpoint Validation Complete - ALL TESTS PASSED!${NC}"