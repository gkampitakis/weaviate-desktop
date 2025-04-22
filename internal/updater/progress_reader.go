package updater

import (
	"fmt"
	"io"
	"log/slog"
)

type ProgressReader struct {
	io.Reader
	Total       int64
	readSoFar   int64
	lastPrinted int64
	CallBack    func(float64)
}

func NewProgressReader(r io.Reader, total int64, callback func(float64)) *ProgressReader {
	return &ProgressReader{
		Reader:   r,
		Total:    total,
		CallBack: callback,
	}
}

func (pr *ProgressReader) Read(p []byte) (int, error) {
	n, err := pr.Reader.Read(p)
	if n > 0 {
		pr.readSoFar += int64(n)
		if pr.Total > 0 &&
			(pr.readSoFar-pr.lastPrinted >= pr.Total/100 || pr.readSoFar == pr.Total) {
			percent := float64(pr.readSoFar) / float64(pr.Total) * 100

			if pr.CallBack != nil {
				pr.CallBack(percent)
			} else {
				slog.Info("Download progress", "percent", fmt.Sprintf("%.2f%%", percent))
			}

			pr.lastPrinted = pr.readSoFar
		}
	}

	return n, err
}
