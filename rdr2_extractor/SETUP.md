# Setup Guide for RDR2 Map Data Extractor

This guide follows the setup process outlined in the project's CLAUDE.md file.

## Prerequisites

### 1. Install pyenv (if not already installed)

**Linux/macOS:**
```bash
curl https://pyenv.run | bash
```

**Manual installation:**
```bash
git clone https://github.com/pyenv/pyenv.git ~/.pyenv
```

### 2. Configure your shell

Add these lines to your shell configuration file (`~/.bashrc`, `~/.zshrc`, etc.):

```bash
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init -)"
```

Then restart your shell or run:
```bash
source ~/.bashrc  # or ~/.zshrc
```

## Automated Setup (Recommended)

1. **Clone the repository:**
```bash
git clone <repository-url>
cd rdr2_extractor
```

2. **Run the setup script:**
```bash
./setup.sh
```

This will automatically:
- Set up pyenv and install Python 3.11.9
- Create a virtual environment
- Install all dependencies
- Create configuration files
- Set up data directories

3. **Activate the environment (for future sessions):**
```bash
source venv/bin/activate
```

## Manual Setup

If you prefer to set up manually or the automated script doesn't work:

### Step 1: Python Environment Setup

```bash
# Navigate to project directory
cd rdr2_extractor

# Set up pyenv and Python version (as per CLAUDE.md)
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init -)"
pyenv local 3.11.9
```

### Step 2: Install Python 3.11.9 (if needed)

```bash
# Check if Python 3.11.9 is available
pyenv versions

# Install if not available
pyenv install 3.11.9
pyenv local 3.11.9
```

### Step 3: Virtual Environment

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
source venv/bin/activate  # Linux/macOS
# venv\Scripts\activate    # Windows
```

### Step 4: Install Dependencies

```bash
# Upgrade pip
python -m pip install --upgrade pip

# Install project dependencies
pip install -r requirements.txt
```

### Step 5: Configuration

```bash
# Create environment configuration
cp .env.example .env

# Create data directories
mkdir -p data/{network_logs,window_data,tiles,markers}
```

## Running the Extractor

### Using the Convenience Script (Recommended)

```bash
# Make sure you're in the project directory
cd rdr2_extractor

# Run with default settings
./run.sh

# Run with custom options
./run.sh --headless --rate-limit 3.0 --max-tiles 500
```

### Manual Execution

```bash
# Activate environment (if not already active)
source venv/bin/activate

# Run the extractor
python main.py

# With custom options
python main.py --headless --rate-limit 3.0 --max-tiles 500
```

## Verification

To verify your setup is working correctly:

1. **Check Python version:**
```bash
python --version
# Should show: Python 3.11.9
```

2. **Check installed packages:**
```bash
pip list
```

3. **Test import of key dependencies:**
```bash
python -c "import selenium, aiohttp, tqdm; print('All dependencies imported successfully')"
```

4. **Run help command:**
```bash
python main.py --help
```

## Troubleshooting

### Common Issues

**pyenv not found:**
- Make sure pyenv is properly installed and in your PATH
- Restart your shell after installation
- Check that shell configuration was updated

**Python 3.11.9 installation fails:**
```bash
# Install build dependencies (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install -y build-essential libssl-dev zlib1g-dev libbz2-dev \
    libreadline-dev libsqlite3-dev wget curl llvm libncurses5-dev \
    libncursesw5-dev xz-utils tk-dev libffi-dev liblzma-dev python3-openssl

# Install build dependencies (CentOS/RHEL)
sudo yum groupinstall -y "Development Tools"
sudo yum install -y zlib-devel bzip2-devel readline-devel sqlite-devel \
    wget curl llvm ncurses-devel ncurses-libs-devel xz tk-devel \
    libffi-devel openssl-devel

# Then retry Python installation
pyenv install 3.11.9
```

**Virtual environment activation fails:**
- Make sure you're in the correct directory
- Check that `venv` directory exists
- Try recreating the virtual environment

**Package installation errors:**
```bash
# Update pip and setuptools
python -m pip install --upgrade pip setuptools wheel

# Install packages one by one to identify issues
pip install selenium
pip install aiohttp
# etc.
```

**WebDriver issues:**
- Chrome/Chromium must be installed on your system
- WebDriver will be automatically managed by webdriver-manager
- If issues persist, try updating Chrome or installing Chromium

### Getting Help

If you encounter issues:

1. Check the main README.md for troubleshooting section
2. Ensure all prerequisites are met
3. Try the manual setup process if automated setup fails
4. Check that your system has required build tools for Python packages

## Environment Management

### Daily Usage

```bash
# Navigate to project
cd rdr2_extractor

# Activate environment
source venv/bin/activate

# Run extractor
./run.sh

# Deactivate when done
deactivate
```

### Updating Dependencies

```bash
# Activate environment
source venv/bin/activate

# Update all packages
pip install --upgrade -r requirements.txt

# Or update specific package
pip install --upgrade selenium
```

### Environment Variables

Edit `.env` file to customize configuration:

```bash
# Example .env configuration
RDR2_TARGET_URL=https://rdr2map.com
RDR2_HEADLESS=true
RDR2_RATE_LIMIT=2.0
RDR2_MAX_TILES=1000
RDR2_LOG_LEVEL=INFO
```