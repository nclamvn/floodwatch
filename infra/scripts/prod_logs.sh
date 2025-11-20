#!/bin/bash
# View production logs

SERVICE=${1:-all}

if [ "$SERVICE" == "all" ]; then
    docker-compose -f docker-compose.prod.yml logs -f --tail=100
else
    docker-compose -f docker-compose.prod.yml logs -f --tail=100 $SERVICE
fi
