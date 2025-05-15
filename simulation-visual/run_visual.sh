#!/bin/bash

# Script to launch the visual simulation in the browser
PORT=8080
URL="http://localhost:$PORT"
echo "Starting server at $URL ..."
echo "(Press Ctrl+C to stop)"
python3 -m http.server $PORT
