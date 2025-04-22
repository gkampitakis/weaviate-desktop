package http_util

import (
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
)

// Code take from net/http/httptest and adjusted

type Options struct {
	Address string
}

func NewServer(handler http.Handler, opts ...Options) *httptest.Server {
	if len(opts) == 0 {
		opts = append(opts, Options{})
	}

	ts := &httptest.Server{
		Listener: newLocalListener(opts[0]),
		Config:   &http.Server{Handler: handler},
	}

	ts.Start()
	return ts
}

func newLocalListener(opts Options) net.Listener {
	if opts.Address != "" {
		l, err := net.Listen("tcp", opts.Address)
		if err != nil {
			panic(fmt.Sprintf("httptest: failed to listen on %v: %v", opts.Address, err))
		}

		return l
	}
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		if l, err = net.Listen("tcp6", "[::1]:0"); err != nil {
			panic(fmt.Sprintf("httptest: failed to listen on a port: %v", err))
		}
	}
	return l
}
