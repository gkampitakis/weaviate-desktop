package weaviate

import (
	"context"
	"net"
	"net/url"
	"testing"
	"time"

	"weaviate-desktop/internal/utils"

	"github.com/stretchr/testify/assert"
	weaviate_grpc "github.com/weaviate/weaviate-go-client/v5/weaviate/grpc"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
)

func TestResolveGrpcConfig(t *testing.T) {
	tests := []struct {
		name            string
		uri             string
		stored          *string
		expectedHost    string
		expectedSecured bool
	}{
		{
			name:            "derives the default port for a local http instance",
			uri:             "http://localhost:8080",
			expectedHost:    "localhost:50051",
			expectedSecured: false,
		},
		{
			name:            "drops the rest port when deriving the host",
			uri:             "http://weaviate.internal:9999/",
			expectedHost:    "weaviate.internal:50051",
			expectedSecured: false,
		},
		{
			name:            "secures a self hosted instance served over https",
			uri:             "https://weaviate.example.com",
			expectedHost:    "weaviate.example.com:50051",
			expectedSecured: true,
		},
		{
			name:            "prefixes and secures a weaviate cloud cluster",
			uri:             "https://my-cluster.c0.europe-west3.gcp.weaviate.cloud",
			expectedHost:    "grpc-my-cluster.c0.europe-west3.gcp.weaviate.cloud:443",
			expectedSecured: true,
		},
		{
			name:            "treats the legacy cloud domains as cloud hosts",
			uri:             "https://my-cluster.weaviate.io",
			expectedHost:    "grpc-my-cluster.weaviate.io:443",
			expectedSecured: true,
		},
		{
			name:            "treats semi.technology as a cloud host",
			uri:             "https://my-cluster.semi.technology",
			expectedHost:    "grpc-my-cluster.semi.technology:443",
			expectedSecured: true,
		},
		{
			name:            "is case insensitive on the cloud domain",
			uri:             "https://My-Cluster.WEAVIATE.CLOUD",
			expectedHost:    "grpc-my-cluster.weaviate.cloud:443",
			expectedSecured: true,
		},
		{
			name:            "does not treat a lookalike domain as a cloud host",
			uri:             "https://notweaviate.cloud.example.com",
			expectedHost:    "notweaviate.cloud.example.com:50051",
			expectedSecured: true,
		},
		{
			name:            "brackets an ipv6 host when deriving the default",
			uri:             "http://[::1]:8080",
			expectedHost:    "[::1]:50051",
			expectedSecured: false,
		},
		{
			name:            "prefers a stored endpoint over the derived default",
			uri:             "http://localhost:8080",
			stored:          utils.Pointer("localhost:60051"),
			expectedHost:    "localhost:60051",
			expectedSecured: false,
		},
		{
			name:            "secures a stored endpoint according to the rest scheme",
			uri:             "https://weaviate.example.com",
			stored:          utils.Pointer("grpc.example.com:50051"),
			expectedHost:    "grpc.example.com:50051",
			expectedSecured: true,
		},
		{
			name:            "overrides the cloud default when an endpoint is stored",
			uri:             "https://my-cluster.weaviate.cloud",
			stored:          utils.Pointer("my-proxy.example.com:443"),
			expectedHost:    "my-proxy.example.com:443",
			expectedSecured: true,
		},
		{
			name:            "falls back to the derived default for an empty stored endpoint",
			uri:             "http://localhost:8080",
			stored:          utils.Pointer("   "),
			expectedHost:    "localhost:50051",
			expectedSecured: false,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			u, err := url.Parse(test.uri)
			assert.NoError(t, err)

			config := resolveGrpcConfig(u, test.stored)

			assert.Equal(t, test.expectedHost, config.Host)
			assert.Equal(t, test.expectedSecured, config.Secured)
		})
	}
}

func TestGrpcAddress(t *testing.T) {
	tests := []struct {
		name     string
		uri      string
		stored   *string
		expected string
	}{
		{
			name:     "keeps an explicit port",
			uri:      "http://localhost:8080",
			expected: "localhost:50051",
		},
		{
			name:     "appends 443 for a secured endpoint without a port",
			uri:      "https://weaviate.example.com",
			stored:   utils.Pointer("grpc.example.com"),
			expected: "grpc.example.com:443",
		},
		{
			name:     "appends 80 for an insecure endpoint without a port",
			uri:      "http://localhost:8080",
			stored:   utils.Pointer("grpc.internal"),
			expected: "grpc.internal:80",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			u, err := url.Parse(test.uri)
			assert.NoError(t, err)

			assert.Equal(t, test.expected, grpcAddress(resolveGrpcConfig(u, test.stored)))
		})
	}
}

func TestDefaultGrpcEndpoint(t *testing.T) {
	w := &Weaviate{}

	t.Run("should return the derived default endpoint", func(t *testing.T) {
		endpoint, err := w.DefaultGrpcEndpoint("https://my-cluster.weaviate.cloud")

		assert.NoError(t, err)
		assert.Equal(t, "grpc-my-cluster.weaviate.cloud:443", endpoint)
	})

	t.Run("should return error for an invalid URI", func(t *testing.T) {
		endpoint, err := w.DefaultGrpcEndpoint("http://[::1]:namedport")

		assert.Empty(t, endpoint)
		assert.ErrorContains(t, err, "failed parsing connection URI")
	})
}

func TestGrpcAvailable(t *testing.T) {
	t.Run("should return error if connection doesn't exist", func(t *testing.T) {
		w := &Weaviate{clients: map[int64]*WClient{}}

		available, err := w.GrpcAvailable(1)

		assert.False(t, available)
		assert.EqualError(t, err, "connection doesn't exist 1")
	})

	t.Run("should report the probed state", func(t *testing.T) {
		w := &Weaviate{clients: map[int64]*WClient{
			1: {grpcHealthy: true},
			2: {grpcHealthy: false},
		}}

		available, err := w.GrpcAvailable(1)
		assert.NoError(t, err)
		assert.True(t, available)

		available, err = w.GrpcAvailable(2)
		assert.NoError(t, err)
		assert.False(t, available)
	})
}

func TestProbeGrpc(t *testing.T) {
	t.Run("should succeed against a serving grpc endpoint", func(t *testing.T) {
		listener, err := (&net.ListenConfig{}).Listen(context.Background(), "tcp", "127.0.0.1:0")
		assert.NoError(t, err)

		server := grpc.NewServer()
		grpc_health_v1.RegisterHealthServer(server, health.NewServer())

		go func() { _ = server.Serve(listener) }()
		t.Cleanup(server.Stop)

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		assert.NoError(t, probeGrpc(ctx, weaviate_grpc.Config{Host: listener.Addr().String()}))
	})

	t.Run("should fail against a closed grpc endpoint", func(t *testing.T) {
		listener, err := (&net.ListenConfig{}).Listen(context.Background(), "tcp", "127.0.0.1:0")
		assert.NoError(t, err)
		address := listener.Addr().String()
		assert.NoError(t, listener.Close())

		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		err = probeGrpc(ctx, weaviate_grpc.Config{Host: address})
		assert.ErrorContains(t, err, "failed health checking grpc endpoint")
	})
}
