package weaviate

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/url"
	"strings"

	weaviate_grpc "github.com/weaviate/weaviate-go-client/v5/weaviate/grpc"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/health/grpc_health_v1"
)

const (
	grpcCloudHostPrefix = "grpc-"
	grpcCloudPort       = "443"
	grpcDefaultPort     = "50051"
)

var weaviateCloudDomains = []string{"weaviate.cloud", "weaviate.io", "semi.technology"}

func isWeaviateCloudHost(host string) bool {
	h := strings.ToLower(host)

	for _, domain := range weaviateCloudDomains {
		if h == domain || strings.HasSuffix(h, "."+domain) {
			return true
		}
	}

	return false
}

func resolveGrpcConfig(u *url.URL, stored *string) weaviate_grpc.Config {
	secured := u.Scheme == "https"

	if stored != nil {
		if host := strings.TrimSpace(*stored); host != "" {
			return weaviate_grpc.Config{Host: host, Secured: secured}
		}
	}

	host := strings.ToLower(u.Hostname())
	if isWeaviateCloudHost(host) {
		return weaviate_grpc.Config{
			Host:    net.JoinHostPort(grpcCloudHostPrefix+host, grpcCloudPort),
			Secured: true,
		}
	}

	return weaviate_grpc.Config{
		Host:    net.JoinHostPort(host, grpcDefaultPort),
		Secured: secured,
	}
}

func (w *Weaviate) DefaultGrpcEndpoint(uri string) (string, error) {
	u, err := url.Parse(uri)
	if err != nil {
		return "", fmt.Errorf("failed parsing connection URI: %w", err)
	}

	return resolveGrpcConfig(u, nil).Host, nil
}

func grpcAddress(c weaviate_grpc.Config) string {
	if strings.Contains(c.Host, ":") {
		return c.Host
	}
	if c.Secured {
		return c.Host + ":443"
	}

	return c.Host + ":80"
}

func grpcCredentials(c weaviate_grpc.Config) credentials.TransportCredentials {
	if c.Secured || strings.HasSuffix(c.Host, ":443") {
		return credentials.NewTLS(&tls.Config{InsecureSkipVerify: true})
	}

	return insecure.NewCredentials()
}

func probeGrpc(ctx context.Context, c weaviate_grpc.Config) error {
	conn, err := grpc.NewClient(
		grpcAddress(c),
		grpc.WithTransportCredentials(grpcCredentials(c)),
	)
	if err != nil {
		return fmt.Errorf("failed creating grpc client for %s: %w", c.Host, err)
	}
	defer conn.Close()

	if _, err := grpc_health_v1.NewHealthClient(conn).
		Check(ctx, &grpc_health_v1.HealthCheckRequest{}); err != nil {
		return fmt.Errorf("failed health checking grpc endpoint %s: %w", c.Host, err)
	}

	return nil
}

func (w *Weaviate) GrpcAvailable(connectionID int64) (bool, error) {
	c, exists := w.clients[connectionID]
	if !exists {
		return false, fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	return c.grpcHealthy, nil
}
