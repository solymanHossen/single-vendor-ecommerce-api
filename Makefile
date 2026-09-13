.PHONY: up down restart logs ps build prod-up prod-down prod-logs backup restore-list restore db-shell redis-shell

COMPOSE = docker compose
PROD = docker compose -f docker-compose.yml -f docker-compose.prod.yml

## Local dev stack (base + override auto-merged)
up:
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) restart app

logs:
	$(COMPOSE) logs -f app

ps:
	$(COMPOSE) ps

build:
	$(COMPOSE) build

## Production stack (base + prod overlay: nginx, replicas, backups)
prod-up:
	$(PROD) up -d --build

prod-down:
	$(PROD) down

prod-logs:
	$(PROD) logs -f

## One-off Postgres dump, independent of the scheduled backup sidecar
backup:
	$(COMPOSE) exec -T postgres sh -c \
		'pg_dump -U $${POSTGRES_USER:-app_user} -d $${POSTGRES_DB:-nestjs_starter_kit} --clean --if-exists' \
		> "backups/manual-$$(date +%Y%m%d-%H%M%S).sql"

restore-list:
	@ls -1 backups/*.sql 2>/dev/null || echo "No backups found in ./backups"

## Usage: make restore FILE=backups/manual-20260101-120000.sql
restore:
	@test -n "$(FILE)" || (echo "Usage: make restore FILE=backups/<file>.sql" && exit 1)
	$(COMPOSE) exec -T postgres psql -U $${POSTGRES_USER:-app_user} -d $${POSTGRES_DB:-nestjs_starter_kit} < $(FILE)

db-shell:
	$(COMPOSE) exec postgres psql -U $${POSTGRES_USER:-app_user} -d $${POSTGRES_DB:-nestjs_starter_kit}

redis-shell:
	$(COMPOSE) exec redis redis-cli -a $${REDIS_PASSWORD} --no-auth-warning
