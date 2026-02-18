#!/bin/bash
# ============================================
# Dump.do Backend - Deploy Script
# ============================================

set -e

echo "\n🚀 Deploying Dump.do Backend\n"
echo "=================================\n"

# Load environment variables
if [ -f ".env" ]; then
    set -a
    source .env
    set +a
fi

# Push database migrations
echo "\n🗄️  Applying database migrations...\n"
supabase db push
echo "✅ Migrations applied\n"

# Deploy Edge Functions
echo "\n☁️  Deploying Edge Functions...\n"

# Set secrets for the function
echo "Setting function secrets...\n"
supabase secrets set GEMINI_API_KEY="$GEMINI_API_KEY"

if [ -n "$OPENAI_API_KEY" ]; then
    supabase secrets set OPENAI_API_KEY="$OPENAI_API_KEY"
fi

if [ -n "$ANTHROPIC_API_KEY" ]; then
    supabase secrets set ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"
fi

supabase secrets set ENVIRONMENT="${ENVIRONMENT:-production}"

# Deploy the chat function
supabase functions deploy chat --no-verify-jwt=false

echo "✅ Edge Functions deployed\n"

echo "\n=================================\n"
echo "🎉 Deployment complete!\n"
echo "\nYour chat endpoint is available at:\n"
echo "  ${SUPABASE_URL}/functions/v1/chat\n"
echo "\nTest with:\n"
echo "  curl -X POST ${SUPABASE_URL}/functions/v1/chat \\"
echo "    -H 'Authorization: Bearer YOUR_USER_TOKEN' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"message\": \"Oi, preciso desabafar\", \"mode\": \"dump\"}'"
