# operon-labs-contract-incentives Makefile
# CI/local automation for the Operon Labs Contract Incentives web app.

SERVICE_NAME := contract-incentives-web
DOCKER_REGISTRY := us-central1-docker.pkg.dev
PROJECT_ID := operon-labs-nonprod
ARTIFACT_REPO := operon-labs-docker
REGION := us-central1

GIT_COMMIT := $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
GIT_BRANCH := $(shell git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
BUILD_TIME := $(shell date -u +"%Y-%m-%dT%H:%M:%SZ")
VERSION := $(GIT_COMMIT)

ENV ?= nonprod

ifneq ($(ENV),nonprod)
  $(error Invalid ENV=$(ENV). Supported environment: nonprod)
endif

IMAGE_REPO := $(DOCKER_REGISTRY)/$(PROJECT_ID)/$(ARTIFACT_REPO)/$(SERVICE_NAME)
IMAGE_TAG := $(VERSION)
IMAGE_FULL := $(IMAGE_REPO):$(IMAGE_TAG)
IMAGE_LATEST := $(IMAGE_REPO):latest

TF_LABELS := environment=$(ENV),managed_by=terraform,project=operon-labs,app=contract-incentives
TF_REMOVE_LABELS := commit,deployed-by,deployed-at,deployment-time

NODE_VERSION := 24
DOCKER_BUILDX_BUILDER := trustoperon-builder

ifdef CI
  DOCKER_BUILDX_CACHE := type=gha,mode=max
else
  DOCKER_BUILDX_CACHE := type=local,dest=/tmp/.buildx-cache-$(SERVICE_NAME)
endif

RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[1;33m
BLUE := \033[0;34m
NC := \033[0m

.PHONY: all
all: clean install lint test typecheck build

.PHONY: install
install:
	@echo "$(YELLOW)Installing workspace dependencies...$(NC)"
	@if [ -n "$(CI)" ]; then npm ci; else npm install; fi

.PHONY: lint
lint:
	@echo "$(YELLOW)Running lint...$(NC)"
	@npm run lint

.PHONY: test
test:
	@echo "$(YELLOW)Running tests...$(NC)"
	@npm test

.PHONY: typecheck
typecheck:
	@echo "$(YELLOW)Running typecheck...$(NC)"
	@npm run typecheck

.PHONY: build
build:
	@echo "$(YELLOW)Building Next.js app...$(NC)"
	@npm run build

.PHONY: serve
serve:
	@echo "$(YELLOW)Starting development server...$(NC)"
	@npm run dev

.PHONY: clean
clean:
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	@rm -rf src/apps/web/.next coverage dist tmp

.PHONY: env-info
env-info:
	@echo "$(BLUE)Environment Information$(NC)"
	@echo "  Service: $(SERVICE_NAME)"
	@echo "  Environment: $(ENV)"
	@echo "  Project: $(PROJECT_ID)"
	@echo "  Region: $(REGION)"
	@echo "  Version: $(VERSION)"
	@echo "  Branch: $(GIT_BRANCH)"
	@echo "  Image: $(IMAGE_FULL)"
	@echo "  Latest image: $(IMAGE_LATEST)"

.PHONY: compliance-check
compliance-check:
	@echo "$(YELLOW)Running deployment compliance check...$(NC)"
	@grep -q -- "--cpu-throttling" scripts/ci/deploy.sh
	@grep -q "gcloud run services describe" scripts/ci/deploy.sh
	@echo "$(GREEN)Deployment script includes CPU throttling and Terraform-first service guard$(NC)"

.PHONY: docker-setup
docker-setup:
	@echo "$(YELLOW)Preparing buildx builder '$(DOCKER_BUILDX_BUILDER)'...$(NC)"
	@if ! docker buildx inspect $(DOCKER_BUILDX_BUILDER) >/dev/null 2>&1; then \
		docker buildx create --name $(DOCKER_BUILDX_BUILDER) --use; \
	fi
	@docker buildx use $(DOCKER_BUILDX_BUILDER)

.PHONY: docker-build
docker-build:
	@echo "$(YELLOW)Building Docker image $(IMAGE_FULL) (ENVIRONMENT=$(ENV))...$(NC)"
	@if [ -n "$(CI)" ]; then \
		$(MAKE) docker-setup && \
			docker buildx build \
				--platform linux/amd64 \
				--build-arg ENVIRONMENT=$(ENV) \
				--cache-to $(DOCKER_BUILDX_CACHE) \
				--cache-from $(DOCKER_BUILDX_CACHE) \
				--tag "$(IMAGE_FULL)" \
				--tag "$(IMAGE_LATEST)" \
				--file Dockerfile \
				--push \
				.; \
	else \
		docker build \
			--platform linux/amd64 \
			--build-arg ENVIRONMENT=$(ENV) \
			-t "$(IMAGE_FULL)" \
			-t "$(IMAGE_LATEST)" \
			--file Dockerfile \
			.; \
	fi

.PHONY: docker-push
docker-push:
	@echo "$(YELLOW)Pushing Docker image...$(NC)"
	@docker push "$(IMAGE_FULL)"
	@docker push "$(IMAGE_LATEST)"

.PHONY: deploy
deploy:
	@echo "$(YELLOW)Deploying to Cloud Run...$(NC)"
	@scripts/ci/deploy.sh \
		"$(SERVICE_NAME)" \
		"$(ENV)" \
		"$(IMAGE_LATEST)" \
		"$(GIT_COMMIT)" \
		"$(PROJECT_ID)" \
		"$(TF_LABELS)" \
		"$(TF_REMOVE_LABELS)"

.PHONY: ci-validate
ci-validate: clean install lint test typecheck compliance-check
	@echo "$(GREEN)Validation complete$(NC)"

.PHONY: ci-build
ci-build: docker-build
	@if [ -z "$(CI)" ]; then \
		echo "$(YELLOW)Pushing image for local run...$(NC)"; \
		$(MAKE) docker-push; \
	fi
	@echo "$(GREEN)Image build complete$(NC)"

.PHONY: ci-deploy
ci-deploy: deploy
	@echo "$(GREEN)Deployment complete$(NC)"

.PHONY: ci-all
ci-all: ci-validate ci-build ci-deploy
	@echo "$(GREEN)Full CI pipeline complete$(NC)"

.PHONY: help
help:
	@echo "$(BLUE)Operon Labs Contract Incentives - Make Targets$(NC)"
	@echo ""
	@echo "$(GREEN)Development$(NC)"
	@echo "  make install       Install dependencies"
	@echo "  make lint          Run ESLint"
	@echo "  make test          Run Vitest tests"
	@echo "  make typecheck     Run Next typegen and TypeScript"
	@echo "  make build         Build Next.js standalone output"
	@echo "  make serve         Start dev server"
	@echo "  make clean         Remove generated outputs"
	@echo ""
	@echo "$(GREEN)Docker / Deployment$(NC)"
	@echo "  make docker-build  Build container image"
	@echo "  make docker-push   Push commit and latest tags"
	@echo "  make deploy        Update existing Terraform-managed Cloud Run service"
	@echo ""
	@echo "$(GREEN)CI Pipeline$(NC)"
	@echo "  make ci-validate   Install, lint, test, typecheck"
	@echo "  make ci-build      Build and push image"
	@echo "  make ci-deploy     Deploy image"
	@echo "  make ci-all        Full CI pipeline"
