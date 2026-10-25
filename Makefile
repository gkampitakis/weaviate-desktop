.PHONY: lint test test-verbose format help dev release mocks build tools check-wails

WAILS_VERSION := v2.17.0

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

tools: ## Install the pinned wails CLI
	go install github.com/wailsapp/wails/v2/cmd/wails@$(WAILS_VERSION)

check-wails: ## Check the installed wails CLI is new enough
	@pinned=$$(echo "$(WAILS_VERSION)" | tr -d 'v'); \
	installed=$$(wails version 2>/dev/null | head -n 1 | tr -d 'v\r'); \
	if [ -z "$$installed" ]; then \
		echo "wails CLI not found, run 'make tools' to install $(WAILS_VERSION)"; \
		exit 1; \
	fi; \
	if [ "$$(printf '%s\n%s\n' "$$installed" "$$pinned" | sort -V | head -n 1)" != "$$pinned" ]; then \
		echo "wails CLI v$$installed is older than the required $(WAILS_VERSION), run 'make tools' to update"; \
		exit 1; \
	fi

dev: check-wails ## Run wails dev server
	wails dev -browser

release: ## Run commit-and-tag-version
	(cd frontend && npm run release)

mocks: ## Generate mocks
	mockery

build: check-wails ## Build the project
	wails build
