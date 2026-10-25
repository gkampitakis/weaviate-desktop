package weaviate

import (
	"context"
	"crypto/tls"
	"fmt"
	"log/slog"
	"net"
	"net/url"
	"strings"
	"time"

	weaviate_grpc "github.com/weaviate/weaviate-go-client/v5/weaviate/grpc"
	pb "github.com/weaviate/weaviate/grpc/generated/protocol/v1"
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

type grpcAggregator interface {
	Aggregate(
		ctx context.Context,
		in *pb.AggregateRequest,
		opts ...grpc.CallOption,
	) (*pb.AggregateReply, error)
}

func dialGrpc(c weaviate_grpc.Config) (*grpc.ClientConn, error) {
	conn, err := grpc.NewClient(
		grpcAddress(c),
		grpc.WithTransportCredentials(grpcCredentials(c)),
	)
	if err != nil {
		return nil, fmt.Errorf("failed creating grpc client for %s: %w", c.Host, err)
	}

	return conn, nil
}

func checkGrpcHealth(ctx context.Context, conn grpc.ClientConnInterface, host string) error {
	if _, err := grpc_health_v1.NewHealthClient(conn).
		Check(ctx, &grpc_health_v1.HealthCheckRequest{}); err != nil {
		return fmt.Errorf("failed health checking grpc endpoint %s: %w", host, err)
	}

	return nil
}

func (w *Weaviate) attachGrpc(id int64, client *WClient) {
	conn, err := dialGrpc(client.grpcConfig)
	if err != nil {
		slog.Warn(
			"failed creating grpc client, grpc features disabled",
			slog.Int64("connectionID", id),
			slog.String("grpcEndpoint", client.grpcConfig.Host),
			slog.Any("error", err),
		)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := checkGrpcHealth(ctx, conn, client.grpcConfig.Host); err != nil {
		slog.Warn(
			"grpc endpoint unreachable, grpc features disabled",
			slog.Int64("connectionID", id),
			slog.String("grpcEndpoint", client.grpcConfig.Host),
			slog.Any("error", err),
		)
		closeGrpcConn(conn)

		return
	}

	client.grpcHealthy = true
	client.grpcConn = conn
	client.grpcClient = pb.NewWeaviateClient(conn)
}

func closeGrpcConn(conn *grpc.ClientConn) {
	if err := conn.Close(); err != nil {
		slog.Warn("failed closing grpc connection", slog.Any("error", err))
	}
}

func (w *Weaviate) GrpcAvailable(connectionID int64) (bool, error) {
	c, exists := w.clients[connectionID]
	if !exists {
		return false, fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	return c.grpcHealthy, nil
}
