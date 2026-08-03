package models

type RAgentApplication struct {
	Name string `yaml:"name" json:"name"`
	Mode string `yaml:"mode" json:"mode"`
}

type RAgentAgent struct {
	ID         string `yaml:"id" json:"id"`
	Entrypoint string `yaml:"entrypoint" json:"entrypoint"`
}

type RAgentRoutes struct {
	Execute  string `yaml:"execute" json:"execute"`
	Stream   string `yaml:"stream" json:"stream"`
	Health   string `yaml:"health" json:"health"`
	Metadata string `yaml:"metadata" json:"metadata"`
}

type RAgentConfig struct {
	Application RAgentApplication   `yaml:"application" json:"application"`
	Agents      []RAgentAgent       `yaml:"agents" json:"agents"`
	Workflow    map[string][]string `yaml:"workflow" json:"workflow"`
	Routes      RAgentRoutes        `yaml:"routes" json:"routes"`
}
