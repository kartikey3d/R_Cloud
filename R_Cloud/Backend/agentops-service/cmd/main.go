package main

import (
	"log"
	"net/http"

	"github.com/r-cloud/agentops-service/internal/server"
	"github.com/r-cloud/agentops-service/internal/subscriber"
	"github.com/r-cloud/agentops-service/internal/telemetry"
)

func main() {
	log.Println("Starting AgentOps Service...")

	// Initialize OpenTelemetry
	if err := telemetry.InitProvider(); err != nil {
		log.Fatalf("Failed to initialize telemetry: %v", err)
	}

	// Initialize NATS Subscriber
	sub, err := subscriber.NewNatsSubscriber("nats://localhost:4222")
	if err != nil {
		log.Fatalf("Failed to connect to NATS: %v", err)
	}
	defer sub.Close()

	if err := sub.StartListening(); err != nil {
		log.Fatalf("Failed to start NATS listening: %v", err)
	}

	// Start HTTP Server for Dashboard APIs
	srv := server.NewServer()
	log.Println("Listening on :8083")
	if err := http.ListenAndServe(":8083", srv); err != nil {
		log.Fatalf("HTTP server failed: %v", err)
	}
}
