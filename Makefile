.DEFAULT_GOAL := help

SHELL := /bin/bash

SCALINGO_REGION ?= osc-secnum-fr1
SCALINGO_ADDON ?= postgresql
LOCAL_PG_DB ?= dahlia
LOCAL_PG_USER ?= dahlia

.PHONY: help db-restore-from-prod db-restore-from-preprod

help:
	@printf '%s\n' \
		'Targets:' \
		'  make db-restore-from-prod      Scalingo backup (dahlia-prod) → local Docker Postgres' \
		'  make db-restore-from-preprod   Scalingo backup (dahlia-preprod) → local Docker Postgres' \
		'' \
		'Prerequisites: docker compose up -d, scalingo CLI logged in on osc-secnum-fr1' \
		'Skip confirmation: CONFIRM=1 make db-restore-from-prod' \
		'Overrides: SCALINGO_REGION, SCALINGO_ADDON, LOCAL_PG_DB, LOCAL_PG_USER'

db-restore-from-prod:
	SCALINGO_APP=dahlia-prod \
	SCALINGO_REGION="$(SCALINGO_REGION)" \
	SCALINGO_ADDON="$(SCALINGO_ADDON)" \
	LOCAL_PG_DB="$(LOCAL_PG_DB)" \
	LOCAL_PG_USER="$(LOCAL_PG_USER)" \
	bash scripts/db-restore-from-scalingo.sh

db-restore-from-preprod:
	SCALINGO_APP=dahlia-preprod \
	SCALINGO_REGION="$(SCALINGO_REGION)" \
	SCALINGO_ADDON="$(SCALINGO_ADDON)" \
	LOCAL_PG_DB="$(LOCAL_PG_DB)" \
	LOCAL_PG_USER="$(LOCAL_PG_USER)" \
	bash scripts/db-restore-from-scalingo.sh
