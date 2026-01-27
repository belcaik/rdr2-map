#!/bin/bash

# RDR2 Map Data Extractor Runner Script
# Activates virtual environment and runs the extractor

set -e

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found!"
    echo "Run ./setup.sh first to set up the project."
    exit 1
fi

# Configure pyenv
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"

# Initialize pyenv if available
if command -v pyenv >/dev/null 2>&1; then
    eval "$(pyenv init -)"
fi

# Set Python version
pyenv local 3.11.9

# Activate virtual environment
echo "⚡ Activating virtual environment..."
source venv/bin/activate

# Run the extractor with any passed arguments
echo "🚀 Starting RDR2 Map Data Extractor..."
python main.py "$@"