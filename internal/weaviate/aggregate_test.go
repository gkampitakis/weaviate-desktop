package weaviate

import (
	"context"
	"fmt"
	"testing"

	"weaviate-desktop/internal/utils"

	"github.com/Masterminds/semver"
	"github.com/stretchr/testify/assert"
	weaviate_grpc "github.com/weaviate/weaviate-go-client/v5/weaviate/grpc"
	pb "github.com/weaviate/weaviate/grpc/generated/protocol/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

type fakeAggregator struct {
	reply    *pb.AggregateReply
	err      error
	request  *pb.AggregateRequest
	metadata metadata.MD
}

func (f *fakeAggregator) Aggregate(
	ctx context.Context,
	in *pb.AggregateRequest,
	_ ...grpc.CallOption,
) (*pb.AggregateReply, error) {
	f.request = in
	f.metadata, _ = metadata.FromOutgoingContext(ctx)

	return f.reply, f.err
}

func countReply(count int64) *pb.AggregateReply {
	return &pb.AggregateReply{
		Result: &pb.AggregateReply_SingleResult{
			SingleResult: &pb.AggregateReply_Single{ObjectsCount: &count},
		},
	}
}

func aggregateClient(f *fakeAggregator) *WClient {
	return &WClient{
		version:     "1.37.2",
		features:    Features{FeatureGrpcAggregate: true},
		grpcHealthy: true,
		grpcClient:  f,
	}
}

func TestGetTotalObjects(t *testing.T) {
	connectionID := int64(1)
	collection := "TestCollection"

	t.Run("should return error if connection doesn't exist", func(t *testing.T) {
		w := &Weaviate{clients: map[int64]*WClient{}}

		total, err := w.GetTotalObjects(connectionID, collection, "", nil)

		assert.Equal(t, int64(-1), total)
		assert.EqualError(t, err, "connection doesn't exist 1")
	})

	t.Run("should count objects over the aggregate rpc", func(t *testing.T) {
		fake := &fakeAggregator{reply: countReply(42)}
		w := &Weaviate{clients: map[int64]*WClient{connectionID: aggregateClient(fake)}}

		total, err := w.GetTotalObjects(connectionID, collection, "", nil)

		assert.NoError(t, err)
		assert.Equal(t, int64(42), total)
		assert.Equal(t, collection, fake.request.GetCollection())
		assert.True(t, fake.request.GetObjectsCount())
		assert.Empty(t, fake.request.GetTenant())
		assert.Nil(t, fake.request.GetFilters())
		assert.Empty(t, fake.request.GetAggregations())
		assert.Nil(t, fake.request.GetGroupBy())
	})

	t.Run("should scope the count to a tenant", func(t *testing.T) {
		fake := &fakeAggregator{reply: countReply(7)}
		w := &Weaviate{clients: map[int64]*WClient{connectionID: aggregateClient(fake)}}

		total, err := w.GetTotalObjects(connectionID, collection, "tenant-a", nil)

		assert.NoError(t, err)
		assert.Equal(t, int64(7), total)
		assert.Equal(t, "tenant-a", fake.request.GetTenant())
	})

	t.Run("should return a zero count", func(t *testing.T) {
		fake := &fakeAggregator{reply: countReply(0)}
		w := &Weaviate{clients: map[int64]*WClient{connectionID: aggregateClient(fake)}}

		total, err := w.GetTotalObjects(connectionID, collection, "", nil)

		assert.NoError(t, err)
		assert.Equal(t, int64(0), total)
	})

	t.Run("should send the api key as bearer metadata", func(t *testing.T) {
		fake := &fakeAggregator{reply: countReply(1)}
		client := aggregateClient(fake)
		client.grpcHeaders = grpcHeaders(utils.Pointer("mock-key"))
		w := &Weaviate{clients: map[int64]*WClient{connectionID: client}}

		_, err := w.GetTotalObjects(connectionID, collection, "", nil)

		assert.NoError(t, err)
		assert.Equal(t, []string{"Bearer mock-key"}, fake.metadata.Get("authorization"))
	})

	t.Run("should not send metadata without an api key", func(t *testing.T) {
		fake := &fakeAggregator{reply: countReply(1)}
		w := &Weaviate{clients: map[int64]*WClient{connectionID: aggregateClient(fake)}}

		_, err := w.GetTotalObjects(connectionID, collection, "", nil)

		assert.NoError(t, err)
		assert.Empty(t, fake.metadata)
	})

	t.Run("should wrap a failing rpc", func(t *testing.T) {
		fake := &fakeAggregator{err: fmt.Errorf("mock-error")}
		w := &Weaviate{clients: map[int64]*WClient{connectionID: aggregateClient(fake)}}

		total, err := w.GetTotalObjects(connectionID, collection, "", nil)

		assert.Equal(t, int64(-1), total)
		assert.EqualError(
			t,
			err,
			"failed aggregating total objects for TestCollection: mock-error",
		)
	})

	t.Run("should error when the reply carries no single result", func(t *testing.T) {
		fake := &fakeAggregator{reply: &pb.AggregateReply{}}
		w := &Weaviate{clients: map[int64]*WClient{connectionID: aggregateClient(fake)}}

		total, err := w.GetTotalObjects(connectionID, collection, "", nil)

		assert.Equal(t, int64(-1), total)
		assert.EqualError(
			t,
			err,
			"aggregate reply for TestCollection carried no object count",
		)
	})

	t.Run("should error when the single result omits the count", func(t *testing.T) {
		fake := &fakeAggregator{reply: &pb.AggregateReply{
			Result: &pb.AggregateReply_SingleResult{
				SingleResult: &pb.AggregateReply_Single{},
			},
		}}
		w := &Weaviate{clients: map[int64]*WClient{connectionID: aggregateClient(fake)}}

		total, err := w.GetTotalObjects(connectionID, collection, "", nil)

		assert.Equal(t, int64(-1), total)
		assert.EqualError(
			t,
			err,
			"aggregate reply for TestCollection carried no object count",
		)
	})

	t.Run("should reject an invalid where filter before dialling", func(t *testing.T) {
		fake := &fakeAggregator{reply: countReply(1)}
		w := &Weaviate{clients: map[int64]*WClient{connectionID: aggregateClient(fake)}}

		total, err := w.GetTotalObjects(connectionID, collection, "", &WhereFilter{
			Operator: "Equal",
			Path:     []string{"name"},
		})

		assert.Equal(t, int64(-1), total)
		assert.EqualError(t, err, `invalid where filter: unsupported valueType ""`)
		assert.Nil(t, fake.request)
	})
}

func TestRequireGrpcAggregate(t *testing.T) {
	t.Run("should require the server version floor", func(t *testing.T) {
		c := &WClient{
			version:    "1.28.0",
			features:   Features{FeatureGrpcAggregate: false},
			grpcClient: &fakeAggregator{},
		}

		assert.EqualError(
			t,
			c.requireGrpcAggregate(),
			fmt.Sprintf(
				"counting objects runs over gRPC Aggregate and requires Weaviate %s or newer, but this server reports %q: upgrade the server to see object counts",
				featureMinVersions[FeatureGrpcAggregate],
				"1.28.0",
			),
		)
	})

	t.Run("should require a reachable grpc endpoint", func(t *testing.T) {
		c := &WClient{
			version:    "1.37.2",
			features:   Features{FeatureGrpcAggregate: true},
			grpcConfig: weaviate_grpc.Config{Host: "localhost:50051"},
		}

		assert.EqualError(
			t,
			c.requireGrpcAggregate(),
			"counting objects runs over gRPC but the endpoint localhost:50051 was unreachable when this connection was established: fix the gRPC endpoint and reconnect",
		)
	})

	t.Run("should pass when both preconditions hold", func(t *testing.T) {
		assert.NoError(t, aggregateClient(&fakeAggregator{}).requireGrpcAggregate())
	})
}

func TestGrpcAggregateVersionFloor(t *testing.T) {
	t.Run("should match the gRPC search floor", func(t *testing.T) {
		assert.Equal(
			t,
			semver.MustParse("1.29.0"),
			featureMinVersions[FeatureGrpcAggregate],
		)
	})

	tests := []struct {
		version   string
		supported bool
	}{
		{version: "1.28.5", supported: false},
		{version: "1.28.16", supported: false},
		{version: "1.29.0-rc.0", supported: false},
		{version: "1.29.0", supported: true},
		{version: "1.30.0-rc.0", supported: true},
		{version: "v1.37.2", supported: true},
	}

	for _, test := range tests {
		t.Run(test.version, func(t *testing.T) {
			assert.Equal(
				t,
				test.supported,
				evaluateFeatures(test.version)[FeatureGrpcAggregate],
			)
		})
	}
}

func TestBuildCountRequest(t *testing.T) {
	t.Run("should translate a leaf filter onto the request", func(t *testing.T) {
		req, err := buildCountRequest("TestCollection", "tenant-a", &WhereFilter{
			Operator:  "Equal",
			Path:      []string{"name"},
			ValueType: "text",
			ValueText: "foo",
		})

		assert.NoError(t, err)
		assert.Equal(t, "TestCollection", req.GetCollection())
		assert.Equal(t, "tenant-a", req.GetTenant())
		assert.True(t, req.GetObjectsCount())

		filters := req.GetFilters()
		assert.Equal(t, pb.Filters_OPERATOR_EQUAL, filters.GetOperator())
		assert.Equal(t, "name", filters.GetTarget().GetProperty())
		assert.Equal(t, "foo", filters.GetValueText())
	})

	t.Run("should translate a grouping filter onto the request", func(t *testing.T) {
		req, err := buildCountRequest("TestCollection", "", &WhereFilter{
			Operator: "And",
			Operands: []*WhereFilter{
				{
					Operator:    "GreaterThan",
					Path:        []string{"price"},
					ValueType:   "number",
					ValueNumber: 10,
				},
				{
					Operator:     "Equal",
					Path:         []string{"active"},
					ValueType:    "boolean",
					ValueBoolean: true,
				},
			},
		})

		assert.NoError(t, err)

		filters := req.GetFilters()
		assert.Equal(t, pb.Filters_OPERATOR_AND, filters.GetOperator())
		assert.Len(t, filters.GetFilters(), 2)
		assert.Equal(
			t,
			pb.Filters_OPERATOR_GREATER_THAN,
			filters.GetFilters()[0].GetOperator(),
		)
		assert.InDelta(t, 10, filters.GetFilters()[0].GetValueNumber(), 0)
		assert.True(t, filters.GetFilters()[1].GetValueBoolean())
	})

	t.Run("should translate a contains filter into an array test value", func(t *testing.T) {
		req, err := buildCountRequest("TestCollection", "", &WhereFilter{
			Operator:   "ContainsAny",
			Path:       []string{"tags"},
			ValueType:  "text",
			ValueTexts: []string{"a", "b"},
		})

		assert.NoError(t, err)

		filters := req.GetFilters()
		assert.Equal(t, pb.Filters_OPERATOR_CONTAINS_ANY, filters.GetOperator())
		assert.Equal(t, []string{"a", "b"}, filters.GetValueTextArray().GetValues())
	})

	t.Run("should leave filters unset without a where clause", func(t *testing.T) {
		req, err := buildCountRequest("TestCollection", "", nil)

		assert.NoError(t, err)
		assert.Nil(t, req.GetFilters())
		assert.True(t, req.GetObjectsCount())
	})

	t.Run("should leave filters unset for an empty grouping", func(t *testing.T) {
		req, err := buildCountRequest("TestCollection", "", &WhereFilter{
			Operator: "And",
			Operands: []*WhereFilter{},
		})

		assert.Nil(t, req)
		assert.EqualError(
			t,
			err,
			"invalid where filter: operator And requires at least one operand",
		)
	})

	t.Run("should surface a filter translation error", func(t *testing.T) {
		req, err := buildCountRequest("TestCollection", "", &WhereFilter{
			Operator:  "Equal",
			Path:      []string{"created"},
			ValueType: "date",
		})

		assert.Nil(t, req)
		assert.EqualError(t, err, "invalid where filter: date filter requires a value")
	})
}
