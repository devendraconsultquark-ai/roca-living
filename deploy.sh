#!/bin/bash

# Exit immediately if any command exits with a non-zero status
set -e

# Colored output formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Ensure script is run from the root of the project
if [ ! -d "server" ] || [ ! -d "client" ] || [ ! -d "admin" ]; then
    log_error "This script must be run from the root of the Roca Living project directory."
    exit 1
fi

log_info "Starting project deployment..."

# 1. Pull latest changes
log_info "Fetching latest code from Git..."
git pull
log_success "Git repository updated successfully."

# 2. Deploy Server (Backend)
log_info "Deploying Backend (Server)..."
cd server
log_info "Installing server dependencies..."
npm install --omit=dev
log_success "Server dependencies installed."

# Check if pm2 is running the server
if command -v pm2 &> /dev/null; then
    log_info "PM2 detected. Restarting backend server..."
    # Restart the active process name matching your environment
    if pm2 list | grep -q "rocaliving-backend"; then
        pm2 restart "rocaliving-backend"
    else
        pm2 restart server.js --name "rocaliving-backend" || pm2 start server.js --name "rocaliving-backend"
    fi
    log_success "Backend restarted successfully via PM2."
else
    log_warning "PM2 is not installed. You will need to manually restart the backend process."
fi
cd ..

# 3. Deploy Client (Landlord Portal)
log_info "Deploying Client (Landlord Portal)..."
cd client
log_info "Installing client dependencies..."
npm install
log_info "Building client static assets..."
npm run build
log_success "Client build completed successfully."
cd ..

# 4. Deploy Admin (Admin Portal)
log_info "Deploying Admin Portal..."
cd admin
log_info "Installing admin dependencies..."
npm install
log_info "Building admin static assets..."
npm run build
log_success "Admin build completed successfully."
cd ..

log_success "Deployment process finished successfully!"
log_info "Please ensure your Nginx / reverse proxy config is pointing to the following build outputs:"
echo -e "  - Landlord Portal static files: ${GREEN}$(pwd)/client/dist${NC}"
echo -e "  - Admin Portal static files:    ${GREEN}$(pwd)/admin/dist${NC}"
echo -e "  - Backend API requests proxy:   ${GREEN}http://localhost:9000${NC} (or PORT defined in server .env)"
