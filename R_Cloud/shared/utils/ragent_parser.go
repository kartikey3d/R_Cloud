package utils

import (
	"errors"
	"os"

	"github.com/r-cloud/shared/models"
	"gopkg.in/yaml.v3"
)

var (
	ErrInvalidMode = errors.New("invalid deployment mode in ragent.yaml")
	ErrNoAgents    = errors.New("no agents defined for microservices mode")
)

// ParseRAgentConfig parses the ragent.yaml file from the given path.
func ParseRAgentConfig(path string) (*models.RAgentConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var config models.RAgentConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, err
	}

	// Validation
	if config.Application.Mode != "monolith" && config.Application.Mode != "microservices" {
		return nil, ErrInvalidMode
	}

	if config.Application.Mode == "microservices" && len(config.Agents) == 0 {
		return nil, ErrNoAgents
	}

	return &config, nil
}
