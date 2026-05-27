package http_util

import (
	"net/http"
	"time"
)

func GetClient(timeout time.Duration) *http.Client {
	tr := http.DefaultTransport.(*http.Transport).Clone()
	tr.MaxIdleConnsPerHost = 10
	tr.IdleConnTimeout = 15 * time.Second

	return &http.Client{
		Transport: tr,
		Timeout:   timeout,
	}
}
