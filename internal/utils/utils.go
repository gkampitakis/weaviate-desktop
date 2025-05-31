package utils

import (
	"fmt"
	"strconv"
)

func Pointer[T any](v T) *T {
	return &v
}

func MustParseInt[T int | int64](s string) T {
	i, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		panic(fmt.Sprintf("failed to parse %s as int: %v", s, err))
	}
	return T(i)
}
