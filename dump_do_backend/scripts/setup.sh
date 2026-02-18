#!/bin/bash
# ============================================
# Dump.do Backend - Setup Script
# ============================================

set -e

echo "\n🚀 Dump.do Backend Setup\n"
echo "=================================\n"

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "⚠️  Supabase CLI not found. Installing...\n"
    
    # Detect OS and install accordingly
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install supabase/tap/supabase
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux installation
        curl -sSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar xz
        sudo mv supabase /usr/local/bin/
    else
        echo "❌ Unsupported OS. Please install Supabase CLI manually:"
        echo "   https://supabase.com/docs/guides/cli"
        exit 1
    fi
    
    echo "✅ Supabase CLI installed\n"
fi

echo "Supabase CLI version: $(supabase --version)\n"

# Check for .env file
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Creating from .env.example...\n"
    cp .env.example .env
    echo "✅ .env file created. Please edit it with your credentials.\n"
    echo "   Required:\n"
    echo "   - SUPABASE_URL"
    echo "   - SUPABASE_ANON_KEY"
    echo "   - SUPABASE_SERVICE_ROLE_KEY"
    echo "   - GEMINI_API_KEY\n"
    exit 1
fi

# Load environment variables
set -a
source .env
set +a

# Validate required variables
required_vars=("SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY" "GEMINI_API_KEY")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Missing required environment variable: $var"
        exit 1
    fi
done

echo "✅ Environment variables loaded\n"

# Initialize Supabase if not already done
if [ ! -f "supabase/.gitignore" ]; then
    echo "Initializing Supabase project...\n"
    supabase init
    echo "✅ Supabase initialized\n"
fi

# Link to remote project (if URL is not localhost)
if [[ "$SUPABASE_URL" != *"localhost"* ]] && [[ "$SUPABASE_URL" != *"127.0.0.1"* ]]; then
    echo "Linking to remote Supabase project...\n"
    echo "Please enter your project reference (from Supabase dashboard):"
    read -r project_ref
    supabase link --project-ref "$project_ref"
    echo "✅ Project linked\n"
fi

echo "\n=================================\n"
echo "🎉 Setup complete!\n"
echo "\nNext steps:\n"
echo "1. Run migrations:  supabase db push"
echo "2. Deploy functions: supabase functions deploy chat"
echo "3. Start local dev:  supabase start\n"
echo "\nFor more info, see README.md"
