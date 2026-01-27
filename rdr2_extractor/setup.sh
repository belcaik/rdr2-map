#!/bin/bash

# RDR2 Map Data Extractor Setup Script
# Sets up pyenv, Python version, and virtual environment as per CLAUDE.md

set -e

echo "🚀 Setting up RDR2 Map Data Extractor..."

# Configure pyenv
echo "📦 Configuring pyenv..."
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"

# Initialize pyenv if available
if command -v pyenv >/dev/null 2>&1; then
    eval "$(pyenv init -)"
    echo "✅ pyenv initialized"
else
    echo "⚠️  pyenv not found. Please install pyenv first:"
    echo "   curl https://pyenv.run | bash"
    echo "   Then restart your shell and run this script again."
    exit 1
fi

# Set Python version
echo "🐍 Setting Python version to 3.11.9..."
pyenv local 3.11.9

# Check if Python version is available
if ! pyenv versions | grep -q "3.11.9"; then
    echo "📥 Installing Python 3.11.9..."
    pyenv install 3.11.9
    pyenv local 3.11.9
fi

# Create virtual environment
echo "🏗️  Creating virtual environment..."
python -m venv venv

# Activate virtual environment
echo "⚡ Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "📦 Upgrading pip..."
python -m pip install --upgrade pip

# Install dependencies
echo "📚 Installing dependencies..."
pip install -r requirements.txt

# Create environment file
if [ ! -f ".env" ]; then
    echo "⚙️  Creating .env file..."
    cp .env.example .env
    echo "✅ Created .env file from template"
else
    echo "✅ .env file already exists"
fi

# Create data directories
echo "📁 Creating data directories..."
mkdir -p data/{network_logs,window_data,tiles,markers}

echo ""
echo "🎉 Setup complete!"
echo ""
echo "To activate the environment in the future, run:"
echo "  source venv/bin/activate"
echo ""
echo "To run the extractor:"
echo "  python main.py"
echo ""
echo "To deactivate the environment:"
echo "  deactivate"