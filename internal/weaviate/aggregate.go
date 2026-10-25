package weaviate

import (
	"context"
	"fmt"
	"time"

	pb "github.com/weaviate/weaviate/grpc/generated/protocol/v1"
	"google.golang.org/grpc/metadata"
)

func (c *WClient) requireGrpcAggregate() error {
	if !c.features[FeatureGrpcAggregate] {
		return fmt.Errorf(
			"counting objects runs over gRPC Aggregate and requires Weaviate %s or newer, but this server reports %q: upgrade the server to see object counts",
			featureMinVersions[FeatureGrpcAggregate],
			c.version,
		)
	}

	if c.grpcClient == nil {
		return fmt.Errorf(
			"counting objects runs over gRPC but the endpoint %s was unreachable when this connection was established: fix the gRPC endpoint and reconnect",
			c.grpcConfig.Host,
		)
	}

	return nil
}

func (c *WClient) aggregate(
	ctx context.Context,
	req *pb.AggregateRequest,
) (*pb.AggregateReply, error) {
	if len(c.grpcHeaders) > 0 {
		ctx = metadata.NewOutgoingContext(ctx, metadata.New(c.grpcHeaders))
	}

	return c.grpcClient.Aggregate(ctx, req)
}

func (w *Weaviate) GetTotalObjects(
	connectionID int64,
	collection, tenant string,
	where *WhereFilter,
) (int64, error) {
	c, exists := w.clients[connectionID]
	if !exists {
		return -1, fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	if err := c.requireGrpcAggregate(); err != nil {
		return -1, err
	}

	req, err := buildCountRequest(collection, tenant, where)
	if err != nil {
		return -1, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	reply, err := c.aggregate(ctx, req)
	if err != nil {
		return -1, fmt.Errorf("failed aggregating total objects for %s: %w", collection, err)
	}

	single := reply.GetSingleResult()
	if single == nil || single.ObjectsCount == nil {
		return -1, fmt.Errorf("aggregate reply for %s carried no object count", collection)
	}

	return single.GetObjectsCount(), nil
}

func buildCountRequest(
	collection, tenant string,
	where *WhereFilter,
) (*pb.AggregateRequest, error) {
	req := &pb.AggregateRequest{
		Collection:   collection,
		Tenant:       tenant,
		ObjectsCount: true,
	}

	wb, err := buildWhereBuilder(where)
	if err != nil {
		return nil, fmt.Errorf("invalid where filter: %w", err)
	}
	if wb != nil {
		req.Filters = wb.ToGRPC()
	}

	return req, nil
}
