package server

import (
	"encoding/json"
	"net/http"
)

func NewServer() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/api/v1/agentops/dashboard", handleDashboard)
	mux.HandleFunc("/api/v1/agentops/metrics/", handleMetrics)
	mux.HandleFunc("/api/v1/agentops/logs/", handleLogs)
	mux.HandleFunc("/api/v1/agentops/health/", handleHealth)
	mux.HandleFunc("/api/v1/agentops/deployments", handleDeployments)

	return mux
}

func handleDashboard(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "dashboard summary"})
}

func handleMetrics(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"metrics": "data"})
}

func handleLogs(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"logs": "data"})
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"health": "ok"})
}

func handleDeployments(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"deployments": "list"})
}
