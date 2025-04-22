package updater

import (
	"bytes"
	"io"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestProgressReader_Read(t *testing.T) {
	tests := []struct {
		name          string
		input         []byte
		expectedCalls []float64
	}{
		{
			name:          "Exact total size",
			input:         []byte("1234567890"),
			expectedCalls: []float64{10, 20, 30, 40, 50, 60, 70, 80, 90, 100},
		},
		{
			name:          "Empty input",
			input:         []byte(""),
			expectedCalls: []float64{},
		},
		{
			name:          "Single byte input",
			input:         []byte("1"),
			expectedCalls: []float64{100},
		},
		{
			name:          "Partial progress updates",
			input:         []byte("12345"),
			expectedCalls: []float64{20, 40, 60, 80, 100},
		},
		{
			name:  "Large input with multiple updates",
			input: []byte("12345678901234567890"),
			expectedCalls: []float64{
				5,
				10,
				15,
				20,
				25,
				30,
				35,
				40,
				45,
				50,
				55,
				60,
				65,
				70,
				75,
				80,
				85,
				90,
				95,
				100,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var callbackCalls []float64
			callback := func(percent float64) {
				callbackCalls = append(callbackCalls, percent)
			}

			reader := NewProgressReader(bytes.NewReader(tt.input), int64(len(tt.input)), callback)
			buf := make([]byte, 1)

			for {
				_, err := reader.Read(buf)
				if err == io.EOF {
					break
				}
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
			}

			if len(callbackCalls) != len(tt.expectedCalls) {
				t.Errorf(
					"expected %d callback calls, got %d",
					len(tt.expectedCalls),
					len(callbackCalls),
				)
			}

			for i, expected := range tt.expectedCalls {
				assert.InDelta(t, expected, callbackCalls[i], 0.01, "callback call %d", i)
			}
		})
	}
}
