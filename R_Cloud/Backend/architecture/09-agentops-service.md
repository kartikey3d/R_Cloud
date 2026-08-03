# 09 — AgentOps Service

> Observability and analytics for deployed AI applications.

---

# Overview

AgentOps is the operational monitoring service of R Agent Cloud.

It subscribes to NATS events from the Deployment Service and Runtime Service.

It collects OpenTelemetry traces from the API Gateway and all backend services.

It exposes dashboard APIs to the frontend.

It does not inspect AI logic. It only monitors platform-level operations.

---

# Responsibilities

- Subscribe to NATS events and persist operational data
- Expose dashboard APIs
- Runtime health history
- Deployment analytics
- Request metrics (count, latency, success rate)
- Log aggregation
- Distributed trace display

---

# Data Sources

| Source | Data |
|---|---|
| NATS — Deployment Service | deployment.created, deployment.completed, deployment.failed |
| NATS — Runtime Service | runtime.started, runtime.restarted, runtime.failed, health.failed |
| OpenTelemetry Collector | HTTP traces, gRPC traces, latency, error rates |
| PostgreSQL — Runtime Registry | Current runtime status, health, restart count |
| Railway API | Runtime logs (when available) |

---

# Dashboard APIs

```
GET /api/v1/agentops/dashboard          ← summary of all runtimes
GET /api/v1/agentops/metrics/{id}       ← request count, latency, success rate
GET /api/v1/agentops/logs/{id}          ← runtime logs
GET /api/v1/agentops/health/{id}        ← health history
GET /api/v1/agentops/deployments        ← deployment analytics
```

---

# Runtime Metrics

Collected per deployment:

```
request_count
success_count
failure_count
avg_latency_ms
p95_latency_ms
uptime_seconds
restart_count
last_health_check
```

---

# Deployment States Tracked

```
Created → Validating → Deploying → Running → Restarting → Stopped → Deleted → Failed
```

---

# Token Usage

The platform cannot automatically determine LLM token usage or model cost.

Token data is only available if the developer's AI application returns it in the `/execute` response:

```json
{
  "success": true,
  "response": "...",
  "usage": {
    "prompt_tokens": 120,
    "completion_tokens": 350
  }
}
```

If present: store and display in dashboard.

If absent: show "Token data not reported by this agent."

---

# Event Flow

```text
Deployment Service
  → NATS: deployment.created
  → NATS: deployment.completed

Runtime Service
  → NATS: runtime.started
  → NATS: runtime.restarted
  → NATS: runtime.failed
  → NATS: health.failed

AgentOps Service
  → subscribes to all above events
  → writes to PostgreSQL
  → exposes via dashboard APIs
  → pushes to frontend via WebSocket
```

---

# OpenTelemetry

Every backend service sends traces to the OTel Collector.

AgentOps reads from the collector but **filters** the traces before exposing them to the User Dashboard:

- **Exposed to User (Developer Dashboard):**
  - Traces of execution requests sent to their specific deployed agent.
  - Proxy request latencies and HTTP error statuses.
- **Hidden from User (Internal SRE Only):**
  - Internal platform gRPC call latencies (e.g., Deployment → Runtime Service).
  - Internal database query durations.
  - Internal error details with platform stack context (to prevent leaking platform internals).
