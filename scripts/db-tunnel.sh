#!/bin/bash
echo "Establishing secure tunnel to Monaco PRO Database (VPS)..."
echo "Local: localhost:5433 -> Remote: localhost:54321"

# Check if port 5433 is already in use
lsof -i :5433 > /dev/null
if [ $? -eq 0 ]; then
    echo "Port 5433 is already in use. Tunnel might be running."
    exit 0
fi

# Run SSH tunnel
ssh -L 5433:127.0.0.1:54321 root@187.77.15.68 -N
