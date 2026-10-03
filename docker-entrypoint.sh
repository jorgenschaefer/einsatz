#!/bin/sh
set -e

# Schema aktualisieren und Erst-Admin sicherstellen, dann Server starten.
npm run db:migrate
npm run db:seed
exec node_modules/.bin/next start
