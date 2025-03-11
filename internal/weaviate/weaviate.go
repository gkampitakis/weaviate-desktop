package weaviate

import (
	"context"
	"net/url"
	"time"

	"github.com/weaviate/weaviate-go-client/v5/weaviate"
)

type Weaviate struct {
}

func (w Weaviate) TestConnection(uri string) (bool, error) {
	u, err := url.Parse(uri)
	if err != nil {
		return false, err
	}

	cfg := weaviate.Config{
		Host:   u.Host,
		Scheme: u.Scheme,
	}
	client, err := weaviate.NewClient(cfg)
	if err != nil {
		return false, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	return client.Misc().ReadyChecker().Do(ctx)
}
