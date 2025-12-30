#!/bin/bash
set -e

echo "🚀 Deploying Returns Hub to Fly.io"
echo ""

if ! command -v fly &> /dev/null; then
    echo "❌ Fly CLI not found. Install with: brew install flyctl"
    exit 1
fi

if ! fly auth whoami &> /dev/null; then
    echo "📝 Please log in to Fly.io..."
    fly auth login
fi

if ! fly apps list | grep -q "returns-hub"; then
    echo "📦 Creating Fly.io app..."
    fly apps create returns-hub --machines
    
    echo "🐘 Creating Postgres database..."
    fly postgres create --name returns-hub-db --region sjc --vm-size shared-cpu-1x --volume-size 1
    fly postgres attach returns-hub-db --app returns-hub
fi

echo ""
echo "🔐 Setting secrets..."
echo "Please enter your Shopify API credentials:"
read -p "SHOPIFY_API_KEY: " SHOPIFY_API_KEY
read -sp "SHOPIFY_API_SECRET: " SHOPIFY_API_SECRET
echo ""

fly secrets set \
    SHOPIFY_API_KEY="$SHOPIFY_API_KEY" \
    SHOPIFY_API_SECRET="$SHOPIFY_API_SECRET" \
    SCOPES="read_orders,write_orders,read_returns,write_returns,read_fulfillments,write_fulfillments,read_products,read_customers" \
    --app returns-hub

echo ""
echo "🏗️ Deploying application..."
fly deploy

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Get your app URL: fly open"
echo "2. Set SHOPIFY_APP_URL in Fly secrets:"
echo "   fly secrets set SHOPIFY_APP_URL=https://returns-hub.fly.dev"
echo "3. Update your Shopify Partner Dashboard with the new URL"
echo ""
