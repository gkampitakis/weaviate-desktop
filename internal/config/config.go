package config

import (
	"github.com/Masterminds/semver"
	"github.com/tidwall/gjson"
)

type Config struct {
	Version  *semver.Version
	AppName  string
	FileName string
}

func New(data string) *Config {
	result := gjson.GetMany(data, "info.productVersion", "name", "outputfilename")

	return &Config{
		Version:  semver.MustParse(result[0].String()),
		AppName:  result[1].String(),
		FileName: result[2].String(),
	}
}
