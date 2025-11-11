#!/bin/bash

echo "🧪 Testing Journey Executor"
echo "================================"

# Create journey
echo "📝 Creating journey..."
JOURNEY_RESPONSE=$(curl -s -X POST http://localhost:3000/journeys \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Executor Test Journey",
    "start_node_id": "msg1",
    "nodes": [
      {
        "id": "msg1",
        "type": "MESSAGE",
        "message": "Welcome! Starting your journey...",
        "next_node_id": "cond1"
      },
      {
        "id": "cond1",
        "type": "CONDITIONAL",
        "condition": {
          "field": "age",
          "operator": ">",
          "value": 65
        },
        "true_node_id": "msg_senior",
        "false_node_id": "msg_general"
      },
      {
        "id": "msg_senior",
        "type": "MESSAGE",
        "message": "You qualify for senior care programs!",
        "next_node_id": null
      },
      {
        "id": "msg_general",
        "type": "MESSAGE",
        "message": "Thank you for joining our care program!",
        "next_node_id": null
      }
    ]
  }')

JOURNEY_ID=$(echo $JOURNEY_RESPONSE | grep -o '"journey_id":"[^"]*"' | cut -d'"' -f4)
echo "✅ Journey created: $JOURNEY_ID"
echo ""

# Test 1: Trigger with senior patient (age > 65)
echo "🧪 Test 1: Senior patient (age=70)"
echo "-----------------------------------"
RUN_RESPONSE=$(curl -s -X POST "http://localhost:3000/journeys/$JOURNEY_ID/trigger" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_context": {
      "patient_id": "patient-001",
      "age": 70,
      "condition": "diabetes"
    }
  }')

RUN_ID=$(echo $RUN_RESPONSE | grep -o '"run_id":"[^"]*"' | cut -d'"' -f4)
echo "🚀 Run started: $RUN_ID"
echo "⏳ Waiting for execution..."
sleep 2

# Check run status
echo "📊 Checking run status..."
curl -s "http://localhost:3000/journeys/runs/$RUN_ID" | python3 -m json.tool
echo ""
echo ""

# Test 2: Trigger with young patient (age < 65)
echo "🧪 Test 2: Young patient (age=45)"
echo "-----------------------------------"
RUN_RESPONSE2=$(curl -s -X POST "http://localhost:3000/journeys/$JOURNEY_ID/trigger" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_context": {
      "patient_id": "patient-002",
      "age": 45,
      "condition": "asthma"
    }
  }')

RUN_ID2=$(echo $RUN_RESPONSE2 | grep -o '"run_id":"[^"]*"' | cut -d'"' -f4)
echo "🚀 Run started: $RUN_ID2"
echo "⏳ Waiting for execution..."
sleep 2

# Check run status
echo "📊 Checking run status..."
curl -s "http://localhost:3000/journeys/runs/$RUN_ID2" | python3 -m json.tool
echo ""

echo "================================"
echo "✅ Test complete! Check server logs for MESSAGE outputs"
