.PHONY: lint test test-verbose format help dev release mocks build

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

lint: ## Run linter
	golangci-lint run -c ./golangci.yml ./...
	(cd frontend && npm run lint)

format: ## Format code
	gofumpt -l -w -extra .
	golines . -w
	(cd frontend && npm run format)

test: ## Run tests
	go test -shuffle on -cover ./...

test-verbose: ## Run tests with verbose output
	go test -shuffle on -v -cover ./...

dev: ## Run wails dev server
	wails dev -browser

release: ## Run commit-and-tag-version
	(cd frontend && npm run release)

mocks: ## Generate mocks
	mockery

build: ## Build the project
	wails build
