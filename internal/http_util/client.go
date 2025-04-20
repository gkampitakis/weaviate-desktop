package http_util

import (
	"net/http"
	"time"
)

func GetClient(timeout time.Duration) *http.Client {
	cl := http.DefaultClient
	tr := http.DefaultTransport.(*http.Transport)
	cl.Transport = tr

	tr.MaxIdleConnsPerHost = 10
	tr.MaxIdleConns = 100
	cl.Timeout = timeout

	return cl
}
