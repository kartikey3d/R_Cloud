# 12 — Observability

> Distributed tracing and metrics across all backend services.

---

# Overview

Every backend service is instrumented with OpenTelemetry.

Traces flow from the API Gateway through all internal services to Railway.

AgentOps collects and displays the data.

---

# Instrumented Services

| Service | What is traced |
|---|---|
| API Gateway | Every HTTP request, JWT validation, proxy calls |
| Deployment Service | Deploy flow, validation, gRPC calls |
| Runtime Service | gRPC handler calls, Railway API calls, health checks |
| AgentOps Service | NATS event processing, dashboard API calls |

---

# Folder Structure

```
Backend/observability/
└── tracer.go    ← OpenTelemetry SDK setup for Go services

Ai-Agent/runtime-service/src/telemetry/
├── tracer.ts    ← OpenTelemetry setup for Runtime Service
└── metrics.ts   ← custom metrics
```

---

# Trace Example

Full deploy trace:

```text
[span] API Gateway: POST /api/v1/deployments          200ms
  [span] Deployment Service: validate ragent.yaml      80ms
  [span] Deployment Service: gRPC CreateRuntime        500ms
    [span] Runtime Service: create-runtime handler     480ms
      [span] Railway API: deploy container             450ms
```

Full execute trace:

```text
[span] API Gateway: POST /execute proxy                350ms
  [span] proxy: forward to Railway URL                 340ms
    (inside Railway — not our trace, developer's code)
```

---

# Trace Context

Trace ID is propagated via HTTP headers:

```
traceparent: 00-{traceId}-{spanId}-01
```

Every service reads this header and creates a child span.

This allows the full chain to appear as one trace in the dashboard.

---

# Metrics Collected

```
http_requests_total        ← total requests per endpoint
http_request_duration_ms   ← latency histogram
grpc_calls_total           ← gRPC call count
runtime_health_checks      ← health check results
runtime_restarts_total     ← number of auto-restarts
deployment_duration_ms     ← how long full deploy takes
```

---

# OpenTelemetry Collector

All services export to an OTel Collector.

Collector exports to AgentOps backend. AgentOps applies a **tenant filter**:
- **User Dashboard** only sees traces related to their specific `POST /execute` requests (external API gateway latency -> railway latency).
- **Internal SRE Dashboard** sees all internal spans (gRPC calls, DB queries, platform errors).

---

# Initialization Rule

OpenTelemetry must be initialized before any other imports in each service.

In the Runtime Service (`index.ts`):

```typescript
import './telemetry/tracer';   // MUST be first import
import './grpc/server';
import './health/scheduler';
```

Failure to do this first means library patches are not applied and traces are incomplete.
