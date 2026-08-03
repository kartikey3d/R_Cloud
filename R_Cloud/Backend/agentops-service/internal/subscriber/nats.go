package subscriber

import (
	"log"
)

type NatsSubscriber struct {
	URL string
}

func NewNatsSubscriber(url string) (*NatsSubscriber, error) {
	// In a real implementation, connect to NATS here
	return &NatsSubscriber{URL: url}, nil
}

func (s *NatsSubscriber) StartListening() error {
	log.Println("Subscribing to deployment.created, runtime.started, health.failed...")
	// Implement NATS subscription logic
	return nil
}

func (s *NatsSubscriber) Close() {
	// Close connection
}
