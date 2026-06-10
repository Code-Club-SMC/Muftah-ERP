#!/usr/bin/env bash

###############################################################################
# ☢️  DATABASE NUKER v2.0 - Complete PostgreSQL Reset System
#
# Features:
#   • Cinematic nuclear detonation animation
#   • Real-time sound effects (terminal bells)
#   • ASCII art mushroom cloud
#   • Progress bars and status indicators
#   • Complete data destruction verification
#   • Fresh database resurrection
#   • Automatic migration and seeding
#
# ⚠️  WARNING: PERMANENTLY DELETES ALL DATABASE DATA! ⚠️
###############################################################################

set -euo pipefail

# ============================================================================
# CONFIGURATION & CONSTANTS
# ============================================================================

# Color codes
RED='\033[0;31m'
DARK_RED='\033[1;31m'
GREEN='\033[0;32m'
BRIGHT_GREEN='\033[1;32m'
YELLOW='\033[0;33m'
BRIGHT_YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BRIGHT_CYAN='\033[1;36m'
MAGENTA='\033[0;35m'
WHITE='\033[1;37m'
ORANGE='\033[0;33m'
NC='\033[0m'

# Text effects
BOLD='\033[1m'
DIM='\033[2m'
UNDERLINE='\033[4m'
BLINK='\033[5m'
REVERSE='\033[7m'

# File paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCKER_COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"
DRIZZLE_CONFIG="$PROJECT_ROOT/drizzle.config.ts"

# Database configuration (defaults from docker-compose.yml)
DB_NAME="${POSTGRES_DB:-main}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_PASS="${POSTGRES_PASSWORD:-postgres}"
DB_PORT="${POSTGRES_PORT:-5433}"
CONTAINER_NAME="titan-new-postgres-1"

# Runtime flags
FORCE_MODE=false
SEED_MODE=false
SOUND_ENABLED=true
VERBOSE_MODE=false

# Timing
SCRIPT_START_TIME=$(date +%s%N)

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

# Get current timestamp
timestamp() {
    date '+%H:%M:%S'
}

# Calculate elapsed time
elapsed_time() {
    local end_time=$(date +%s%N)
    local elapsed_ms=$(( (end_time - SCRIPT_START_TIME) / 1000000 ))
    local seconds=$(( elapsed_ms / 1000 ))
    local milliseconds=$(( elapsed_ms % 1000 ))
    printf "%d.%03d" "$seconds" "$milliseconds"
}

# Move cursor to position
cursor_position() {
    local row=$1
    local col=$2
    echo -ne "\033[${row};${col}H"
}

# Save and restore cursor
save_cursor() { echo -ne "\0337"; }
restore_cursor() { echo -ne "\0338"; }

# Clear line
clear_line() {
    echo -ne "\033[2K"
}

# Clear from cursor to end of line
clear_eol() {
    echo -ne "\033[K"
}

# Hide/show cursor
hide_cursor() { echo -ne "\033[?25l"; }
show_cursor() { echo -ne "\033[?25h"; }

# ============================================================================
# OUTPUT FUNCTIONS
# ============================================================================

# Standard logging
log_info()    { echo -e "${BLUE}[$(timestamp)]${NC} ${CYAN}[INFO]${NC} $1"; }
log_success() { echo -e "${BLUE}[$(timestamp)]${NC} ${BRIGHT_GREEN}[✓]${NC} $1"; }
log_warn()    { echo -e "${BLUE}[$(timestamp)]${NC} ${BRIGHT_YELLOW}[⚠]${NC} $1"; }
log_error()   { echo -e "${BLUE}[$(timestamp)]${NC} ${DARK_RED}[✗]${NC} $1"; }
log_step()    { echo -e "\n${BOLD}${BLUE}[$(timestamp)]${NC} ${BRIGHT_CYAN}▶ $1${NC}"; }
log_critical(){ echo -e "${BLUE}[$(timestamp)]${NC} ${DARK_RED}${BOLD}[☢]${NC} ${BLINK}$1${NC}"; }

# Verbose logging (only if --verbose)
log_verbose() {
    if [ "$VERBOSE_MODE" = true ]; then
        echo -e "${BLUE}[$(timestamp)]${NC} ${DIM}[DBG]${NC} $1"
    fi
}

# ============================================================================
# SOUND SYSTEM
# ============================================================================

# Single beep
beep() {
    if [ "$SOUND_ENABLED" = true ]; then
        echo -ne "\a"
    fi
}

# Launch sequence sound (3 ascending beeps)
sound_launch() {
    if [ "$SOUND_ENABLED" = true ]; then
        for i in 1 2 3; do
            beep
            sleep 0.08
        done
    fi
}

# Warning sound (2 beeps)
sound_warning() {
    if [ "$SOUND_ENABLED" = true ]; then
        beep
        sleep 0.15
        beep
    fi
}

# Explosion sound (rapid fire beeps)
sound_explosion() {
    if [ "$SOUND_ENABLED" = true ]; then
        for i in $(seq 1 12); do
            beep
            sleep 0.04
        done
    fi
}

# Success sound (ascending tone - 2 quick beeps)
sound_success() {
    if [ "$SOUND_ENABLED" = true ]; then
        beep
        sleep 0.1
        beep
        sleep 0.15
        beep
    fi
}

# Countdown beep (single, emphatic)
sound_countdown() {
    if [ "$SOUND_ENABLED" = true ]; then
        beep
    fi
}

# ============================================================================
# VISUAL EFFECTS
# ============================================================================

# Typewriter effect - types text character by character
type_text() {
    local text="$1"
    local color="${2:-$WHITE}"
    local speed="${3:-normal}"
    
    local delay
    case "$speed" in
        fast)   delay=0.015 ;;
        normal) delay=0.03 ;;
        slow)   delay=0.05 ;;
        *)      delay=0.03 ;;
    esac
    
    for (( i=0; i<${#text}; i++ )); do
        printf "${color}%s${NC}" "${text:$i:1}"
        sleep "$delay"
    done
    echo ""
}

# Animated progress bar
progress_bar() {
    local current=$1
    local total=$2
    local width=${3:-40}
    local label=${4:-""}
    
    local percentage=$(( current * 100 / total ))
    local filled=$(( current * width / total ))
    local empty=$(( width - filled ))
    
    local bar=""
    for (( i=0; i<filled; i++ )); do
        bar+="█"
    done
    for (( i=0; i<empty; i++ )); do
        bar+="░"
    done
    
    printf "\r  ${CYAN}[%s]${NC} ${BRIGHT_GREEN}%3d%%${NC} %s" "$bar" "$percentage" "$label"
}

# Spinner animation (runs in background)
# Usage: spinner_start & SPINNER_PID=$!
#        spinner_stop
spinner_chars=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
spinner_active=true

spinner_start() {
    local message="${1:-Working}"
    spinner_active=true
    
    while $spinner_active; do
        for char in "${spinner_chars[@]}"; do
            if ! $spinner_active; then break; fi
            printf "\r  ${CYAN}%s${NC} %s..." "$char" "$message"
            sleep 0.1
        done
    done
    printf "\r\033[K"
}

spinner_stop() {
    spinner_active=false
    sleep 0.15
}

# Flashing text effect
flash_text() {
    local text="$1"
    local color="${2:-$RED}"
    local flashes="${3:-3}"
    
    for (( i=0; i<flashes; i++ )); do
        echo -ne "\r${color}${BOLD}${BLINK}$text${NC}"
        sleep 0.3
        echo -ne "\r${color}${BOLD}$text${NC}"
        sleep 0.3
    done
    echo ""
}

# ============================================================================
# ASCII ART LIBRARY
# ============================================================================

# Nuclear warning symbol
ascii_radiation_symbol() {
    cat << 'EOF'
         ☢️
    ☢️         ☢️
         ☢️
EOF
}

# Explosion effect
ascii_explosion() {
    cat << EOF
${BRIGHT_YELLOW}                    .   *   .  .    *   .   *  .
         *    .  .      *    .   *   .
   .        *  .    *      .  *    .     *
     *  .       *    .  *     .   *   .
  .      *  .      .    *  .     .   *
${YELLOW}         💥💥💥   NUCLEAR DETONATION   💥💥💥${NC}
${ORANGE}      *    .   *  .      *   .  *    .   *
    .  *     .    *   .    *  .    *   .
  *    .  *     .    *  .    .  *     .   *
     .     *  .    .  *   .    *   .    *
EOF
}

# Mushroom cloud (detailed)
ascii_mushroom_cloud() {
    echo ""
    echo -e "${BRIGHT_YELLOW}                        .  *  .  *  .${NC}"
    sleep 0.08
    echo -e "${YELLOW}                   .  *  .  *  .  *  .${NC}"
    sleep 0.08
    echo -e "${YELLOW}              .  * ╔═══════════╗ *  .${NC}"
    sleep 0.08
    echo -e "${ORANGE}            *  ╔═╝ ☢️   ☢️   ☢️  ╚═╗  *${NC}"
    sleep 0.08
    echo -e "${ORANGE}          . ╔═╝  ╔═══════════╗  ╚═╗ .${NC}"
    sleep 0.08
    echo -e "${RED}         * ╔╝    ╔╝  DATABASE   ╚╗   ╚╗ *${NC}"
    sleep 0.08
    echo -e "${RED}       . ╔╝    ╔╝  ANNIHILATED  ╚╗   ╚╗ .${NC}"
    sleep 0.08
    echo -e "${RED}      * ║    ╔╝               ╚╗   ║ *${NC}"
    sleep 0.08
    echo -e "${MAGENTA}       . ╚╗  ║    ☢️  ☢️  ☢️    ║  ╔╝ .${NC}"
    sleep 0.08
    echo -e "${MAGENTA}        * ╚╗ ║                 ║ ╔╝ *${NC}"
    sleep 0.08
    echo -e "${MAGENTA}         . ╚╗║                 ║╔╝ .${NC}"
    sleep 0.08
    echo -e "${CYAN}          * ╚═══════════════════════╝ *${NC}"
    sleep 0.08
    echo -e "${CYAN}            . ║                   ║ .${NC}"
    sleep 0.08
    echo -e "${BLUE}             *║                   ║*${NC}"
    sleep 0.08
    echo -e "${BLUE}             .║                   ║.${NC}"
    sleep 0.08
    echo -e "${BLUE}          ═══╩═══════════════════╩═══${NC}"
    sleep 0.08
    echo -e "${BLUE}          ═══════════════════════════${NC}"
    echo ""
}

# Phoenix rising (reconstruction)
ascii_phoenix() {
    cat << EOF
${BRIGHT_YELLOW}                \\   |   /
                 \\  |  /
               \\  \\ | /  /
                 \\  |  /
                   \\|/
          ${YELLOW}.-~^^^^^^^~-.
        /            ${BRIGHT_GREEN}✓${YELLOW}       \\
       |    DATABASE   |
       |    RESTORED   |
        \\             /
          '-._____.-'
              | |
             /   \\
            /     \\
${BRIGHT_GREEN}           ▲   ▲   ▲
          ▲ ▲ ▲ ▲ ▲
         ▲ ▲ ▲ ▲ ▲ ▲
        ▲ ▲ ▲ ▲ ▲ ▲ ▲
${NC}
EOF
}

# Success banner
ascii_success_banner() {
    echo -e "${BRIGHT_GREEN}"
    cat << 'EOF'
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║        ✅   DATABASE SUCCESSFULLY RESET   ✅             ║
║                                                          ║
║              "FROM ASHES TO FRESH"                       ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

# ============================================================================
# NUCLEAR SEQUENCE ANIMATIONS
# ============================================================================

# Opening title sequence
opening_sequence() {
    clear
    hide_cursor
    
    echo ""
    echo -e "${BOLD}${BRIGHT_CYAN}"
    cat << 'EOF'
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║          ☢️  ☢️  ☢️    DATABASE NUKER    ☢️  ☢️  ☢️         ║
║                                                          ║
║              Complete PostgreSQL Reset System            ║
║                    "From Ashes to Fresh"                 ║
║                                                          ║
║                  Version 2.0 | 2026                      ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    
    sound_launch
    sleep 0.3
    show_cursor
}

# Pre-destruction warning sequence
pre_destruction_sequence() {
    clear
    hide_cursor
    
    echo ""
    echo -e "${DARK_RED}${BOLD}${REVERSE}"
    cat << 'EOF'
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║              ☢️  DANGER ZONE - CLASSIFIED  ☢️            ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    echo ""
    
    # Type out warnings
    type_text "  ⚡ Protocol: COMPLETE DATABASE ANNIHILATION" "$BRIGHT_YELLOW" "normal"
    sleep 0.2
    type_text "  ⚡ Target: PostgreSQL Database Cluster" "$BRIGHT_YELLOW" "normal"
    sleep 0.2
    type_text "  ⚡ Warhead: Total Data Destruction Payload" "$DARK_RED" "normal"
    sleep 0.2
    type_text "  ⚡ Recovery: IMPOSSIBLE - No backups will exist" "$DARK_RED" "slow"
    sleep 0.3
    
    echo ""
    echo -e "  ${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    show_cursor
}

# Countdown sequence with visual effects
countdown_sequence() {
    local seconds="${1:-5}"
    
    echo ""
    
    for (( i=seconds; i>0; i-- )); do
        # Clear line
        clear_line
        
        if [ $i -le 3 ]; then
            # Critical phase - red and blinking
            if [ $i -eq 3 ]; then
                echo -e "  ${DARK_RED}${BOLD}${BLINK}  ☢️  T-MINUS $i - CRITICAL MASS  ☢️  ${NC}"
            elif [ $i -eq 2 ]; then
                echo -e "  ${DARK_RED}${BOLD}${BLINK}  ☢️  T-MINUS $i - POINT OF NO RETURN  ☢️  ${NC}"
            else
                echo -e "  ${DARK_RED}${BOLD}${BLINK}  ☢️  T-MINUS $i - DETONATION IMMINENT  ☢️  ${NC}"
            fi
            sound_countdown
        elif [ $i -le 5 ]; then
            # Warning phase - yellow
            echo -e "  ${BRIGHT_YELLOW}${BOLD}  ⚡ T-MINUS $i - LAUNCH SEQUENCE  ⚡  ${NC}"
            sound_countdown
        else
            # Normal phase - cyan
            echo -e "  ${BRIGHT_CYAN}  T-MINUS $i  ${NC}"
        fi
        
        sleep 1
    done
    
    # Final moment
    clear_line
    echo -e "  ${DARK_RED}${BOLD}${BLINK}  ☢️  T-MINUS 0 - LAUNCH  ☢️  ${NC}"
    sound_countdown
    sleep 0.5
    echo ""
}

# NUCLEAR DETONATION ANIMATION
nuke_detonation() {
    clear
    hide_cursor
    
    # Flash warning
    echo -e "${DARK_RED}${BOLD}${BLINK}"
    cat << 'EOF'
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║        ☢️  ☢️  ☢️  NUCLEAR LAUNCH DETECTED  ☢️  ☢️  ☢️      ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    
    sound_launch
    sleep 0.8
    
    # Missile launch messages
    echo ""
    type_text "  🚀 Missile armed and ready" "$BRIGHT_CYAN" "fast"
    sleep 0.2
    type_text "  🎯 Target locked: PostgreSQL Database" "$BRIGHT_YELLOW" "fast"
    sleep 0.2
    type_text "  💣 Warhead: COMPLETE DATA ANNIHILATION" "$DARK_RED" "fast"
    sleep 0.3
    
    # Countdown
    countdown_sequence 5
    
    # IMPACT!
    clear
    sound_explosion
    
    echo -e "${DARK_RED}${BOLD}${BLINK}"
    cat << 'EOF'
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║              💥💥💥  IMPACT CONFIRMED  💥💥💥              ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    
    # Explosion animation
    ascii_explosion
    sleep 0.5
    
    # Destruction reports
    echo ""
    type_text "  ☢️  Docker volumes: VAPORIZED" "$DARK_RED" "fast"
    sleep 0.15
    type_text "  ☢️  Database tables: ANNIHILATED" "$DARK_RED" "fast"
    sleep 0.15
    type_text "  ☢️  Data records: COMPLETELY DESTROYED" "$DARK_RED" "fast"
    sleep 0.15
    type_text "  ☢️  Indexes: OBLITERATED" "$DARK_RED" "fast"
    sleep 0.15
    type_text "  ☢️  Schemas: ERADICATED" "$DARK_RED" "fast"
    sleep 0.3
    
    # Mushroom cloud
    ascii_mushroom_cloud
    sleep 0.5
    
    echo ""
    type_text "  ☢️  All data permanently destroyed - recovery impossible" "$DIM" "slow"
    echo ""
    
    show_cursor
}

# Reconstruction animation
reconstruction_sequence() {
    echo ""
    type_text "  🏗️  Initiating database reconstruction protocol..." "$BRIGHT_CYAN" "normal"
    sleep 0.4
    
    echo ""
    
    # Progress bar animation
    local steps=(
        "Initializing PostgreSQL container"
        "Allocating storage volumes"
        "Creating database schemas"
        "Building system tables"
        "Configuring connections"
        "Starting database engine"
        "Running health checks"
        "Database online"
    )
    
    local total_steps=${#steps[@]}
    
    for (( i=0; i<total_steps; i++ )); do
        progress_bar $((i + 1)) $total_steps 50 "${steps[$i]}"
        sleep 0.35
    done
    
    echo ""
    echo ""
    
    # Phoenix rising
    ascii_phoenix
    sleep 0.3
    
    sound_success
    type_text "  ✅ Fresh database successfully constructed from ashes!" "$BRIGHT_GREEN" "normal"
    echo ""
}

# ============================================================================
# VALIDATION FUNCTIONS
# ============================================================================

# Verify we're in the project root
check_project_root() {
    log_verbose "Checking project root..."
    
    if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
        log_error "docker-compose.yml not found at: $DOCKER_COMPOSE_FILE"
        log_error "Run this script from the project root directory"
        exit 1
    fi
    
    if [ ! -f "$DRIZZLE_CONFIG" ]; then
        log_error "drizzle.config.ts not found at: $DRIZZLE_CONFIG"
        log_error "This doesn't appear to be a Drizzle project"
        exit 1
    fi
    
    log_success "Project structure validated"
}

# Check Docker availability and status
check_docker() {
    log_verbose "Checking Docker status..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker daemon is not running"
        log_info "Please start Docker Desktop or the Docker service"
        exit 1
    fi
    
    log_success "Docker is running and accessible"
}

# Verify Docker Compose availability
check_docker_compose() {
    log_verbose "Checking Docker Compose..."
    
    if ! docker compose version > /dev/null 2>&1; then
        log_error "Docker Compose plugin not found"
        log_info "Please install Docker Compose V2"
        exit 1
    fi
    
    log_success "Docker Compose available"
}

# Check environment file
check_env_file() {
    local env_file="$PROJECT_ROOT/.env"
    
    if [ ! -f "$env_file" ]; then
        log_warn ".env file not found"
        log_info "Some operations may fail without proper configuration"
        return 1
    fi
    
    log_success "Environment file located"
    return 0
}

# Check if psql is available (optional but useful)
check_psql_client() {
    if command -v psql &> /dev/null; then
        log_verbose "PostgreSQL client (psql) available"
        return 0
    else
        log_verbose "psql client not found - will skip direct DB tests"
        return 1
    fi
}

# ============================================================================
# CONFIRMATION & SAFETY
# ============================================================================

# Safety confirmation with visual impact
confirm_destruction() {
    if [ "$FORCE_MODE" = true ]; then
        log_warn "FORCE MODE: Skipping safety confirmation"
        return 0
    fi
    
    echo ""
    echo -e "${DARK_RED}${BOLD}"
    cat << 'EOF'
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║           ⚠️   SAFETY PROTOCOL ENGAGED   ⚠️              ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    echo ""
    echo -e "  ${BRIGHT_YELLOW}This action will:${NC}"
    echo -e ""
    echo -e "    ${DARK_RED}✗${NC} ${DARK_RED}PERMANENTLY DELETE${NC} all database data"
    echo -e "    ${DARK_RED}✗${NC} ${DARK_RED}DESTROY${NC} all Docker volumes"
    echo -e "    ${DARK_RED}✗${NC} ${DARK_RED}ERASE${NC} all tables, records, and schemas"
    echo -e "    ${BRIGHT_GREEN}✓${NC} ${BRIGHT_GREEN}CREATE${NC} a fresh database instance"
    echo -e "    ${BRIGHT_GREEN}✓${NC} ${BRIGHT_GREEN}APPLY${NC} all migrations from scratch"
    echo -e ""
    echo -e "  ${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e ""
    echo -e "  ${BOLD}${BRIGHT_YELLOW}This action CANNOT be undone!${NC}"
    echo -e ""
    
    # Build prompt without escape codes in the read command
    local prompt_msg="${BRIGHT_YELLOW}  Type '${DARK_RED}${BOLD}NUKE${NC}${BRIGHT_YELLOW}' to proceed, anything else to abort: ${NC}"
    echo -ne "$prompt_msg"
    read confirm
    
    if [ "$confirm" != "NUKE" ]; then
        echo ""
        log_info "Operation aborted - database remains safe 😊"
        echo ""
        exit 0
    fi
    
    echo ""
    log_success "Confirmation accepted"
}

# ============================================================================
# DATABASE OPERATIONS
# ============================================================================

# Stop all running containers
stop_containers() {
    log_step "Stopping database containers"
    
    if docker compose -f "$DOCKER_COMPOSE_FILE" ps --status=running 2>/dev/null | grep -q postgres; then
        log_info "Stopping PostgreSQL container..."
        docker compose -f "$DOCKER_COMPOSE_FILE" down > /dev/null 2>&1
        log_success "Containers stopped"
    else
        log_info "No running containers detected"
    fi
}

# Drop all tables and types (nuclear option)
drop_all_tables() {
    log_step "Dropping all database objects"
    
    if ! check_psql_client; then
        log_error "psql client required to drop tables"
        log_info "Please install postgresql-client package"
        exit 1
    fi
    
    log_info "Generating DROP script..."
    
    # Generate and execute DROP statements for all tables
    PGPASSWORD="$DB_PASS" psql -h localhost -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
        "SELECT 'DROP TABLE IF EXISTS \"' || tablename || '\" CASCADE;' FROM pg_tables WHERE schemaname = 'public';" | \
        PGPASSWORD="$DB_PASS" psql -h localhost -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1
    
    # Drop all custom types
    PGPASSWORD="$DB_PASS" psql -h localhost -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
        "SELECT 'DROP TYPE IF EXISTS \"' || typname || '\" CASCADE;' FROM pg_type WHERE typtype = 'e';" | \
        PGPASSWORD="$DB_PASS" psql -h localhost -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1
    
    # Drop Drizzle migrations table if exists
    PGPASSWORD="$DB_PASS" psql -h localhost -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
        "DROP TABLE IF EXISTS \"__drizzle_migrations\" CASCADE;" > /dev/null 2>&1
    
    log_success "All database objects dropped"
}

# Destroy all volumes (THE ACTUAL NUKE)
destroy_volumes() {
    log_step "Executing data annihilation"
    
    # Trigger nuclear animation
    nuke_detonation
    
    # Stop containers
    log_info "Stopping containers..."
    docker compose -f "$DOCKER_COMPOSE_FILE" down > /dev/null 2>&1
    log_success "Containers stopped"
    
    # Remove Docker volumes
    log_info "Removing Docker volumes..."
    docker compose -f "$DOCKER_COMPOSE_FILE" down -v --remove-orphans > /dev/null 2>&1
    log_success "All volumes destroyed"
    
    # Cleanup radioactive fallout
    log_info "Purging dangling volumes..."
    docker volume prune -f > /dev/null 2>&1
    log_success "Radioactive waste cleaned"
    
    # Start fresh and drop tables (double nuke)
    log_info "Starting fresh database for table cleanup..."
    docker compose -f "$DOCKER_COMPOSE_FILE" up -d > /dev/null 2>&1
    
    # Wait for DB
    local max_retries=15
    local retry_count=0
    while [ $retry_count -lt $max_retries ]; do
        if docker exec "$CONTAINER_NAME" pg_isready -U "$DB_USER" > /dev/null 2>&1; then
            break
        fi
        retry_count=$((retry_count + 1))
        sleep 1
    done
    
    # Drop all tables if any exist
    if check_psql_client; then
        local table_count
        table_count=$(PGPASSWORD="$DB_PASS" psql -h localhost -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
            "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';" 2>/dev/null | tr -d ' ')
        
        if [ "$table_count" != "0" ] && [ -n "$table_count" ]; then
            log_warn "Found $table_count existing tables - dropping them all..."
            drop_all_tables
        else
            log_info "Database is already clean"
        fi
    fi
    
    # Stop again for clean restart
    docker compose -f "$DOCKER_COMPOSE_FILE" down > /dev/null 2>&1
}

# Start fresh database
start_fresh_db() {
    reconstruction_sequence
    
    log_step "Initializing fresh PostgreSQL instance"
    
    docker compose -f "$DOCKER_COMPOSE_FILE" up -d > /dev/null 2>&1
    log_success "Database container launched"
}

# Wait for database readiness
wait_for_db() {
    log_step "Awaiting database initialization"
    
    local max_retries=30
    local retry_count=0
    
    # Get actual container name
    local actual_container
    actual_container=$(docker compose -f "$DOCKER_COMPOSE_FILE" ps -q postgres 2>/dev/null | head -1)
    
    while [ $retry_count -lt $max_retries ]; do
        if docker exec "$actual_container" pg_isready -U "$DB_USER" > /dev/null 2>&1 2>&1; then
            log_success "Database is operational"
            return 0
        fi
        
        retry_count=$((retry_count + 1))
        printf "\r  ${CYAN}  Waiting for PostgreSQL...${NC} (%ds)" "$retry_count"
        sleep 1
    done
    
    echo ""
    log_error "Database failed to initialize within timeout"
    exit 1
}

# Verify database connection
verify_connection() {
    log_step "Validating database connectivity"
    
    if check_psql_client; then
        if PGPASSWORD="$DB_PASS" psql -h localhost -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
            log_success "Connection verified - database responding"
        else
            log_error "Connection test failed"
            exit 1
        fi
    else
        log_info "Skipping direct connection test (psql not available)"
    fi
}

# Generate migrations if needed
generate_migrations() {
    log_step "Checking migration status"
    
    local migration_dir="$PROJECT_ROOT/src/db/migrations"
    
    if [ ! -d "$migration_dir" ] || [ -z "$(ls -A "$migration_dir" 2>/dev/null)" ]; then
        log_info "No migrations detected - generating..."
        
        cd "$PROJECT_ROOT"
        if command -v bun &> /dev/null; then
            bun run db:generate > /dev/null 2>&1
        elif command -v npx &> /dev/null; then
            npx drizzle-kit generate > /dev/null 2>&1
        else
            log_error "Package manager not found (bun/npx)"
            exit 1
        fi
        
        log_success "Migrations generated"
    else
        log_info "Existing migrations found - skipping generation"
    fi
}

# Apply migrations
run_migrations() {
    log_step "Applying database migrations"
    
    cd "$PROJECT_ROOT"
    if command -v bun &> /dev/null; then
        bun run db:migrate
    elif command -v npx &> /dev/null; then
        npx drizzle-kit migrate
    else
        log_error "Package manager not found (bun/npx)"
        exit 1
    fi
    
    log_success "All migrations applied successfully"
}

# Seed database (optional)
seed_database() {
    if [ "$SEED_MODE" = true ]; then
        log_step "Seeding database with initial data"
        
        cd "$PROJECT_ROOT"
        if command -v bun &> /dev/null; then
            bun run db:seed:hr
        else
            log_warn "bun not available - skipping seed"
            return 1
        fi
        
        log_success "Database seeded"
    else
        log_info "Seed skipped (use --seed to enable)"
    fi
}

# ============================================================================
# FINALIZATION
# ============================================================================

# Final verification and summary
print_summary() {
    sound_success
    sleep 0.3
    
    clear
    
    ascii_success_banner
    
    local elapsed=$(elapsed_time)
    
    echo -e "  ${BRIGHT_GREEN}▸${NC} All data ${DARK_RED}PERMANENTLY DESTROYED${NC}"
    sleep 0.1
    echo -e "  ${BRIGHT_GREEN}▸${NC} Fresh database ${BRIGHT_CYAN}CONSTRUCTED${NC}"
    sleep 0.1
    echo -e "  ${BRIGHT_GREEN}▸${NC} Migrations ${BRIGHT_GREEN}APPLIED${NC}"
    sleep 0.1
    
    if [ "$SEED_MODE" = true ]; then
        echo -e "  ${BRIGHT_GREEN}▸${NC} Database ${BRIGHT_YELLOW}SEEDED${NC}"
        sleep 0.1
    fi
    
    echo -e ""
    echo -e "  ${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e ""
    echo -e "  ${BOLD}${UNDERLINE}Connection String:${NC}"
    echo -e "    ${BRIGHT_CYAN}postgresql://$DB_USER:$DB_PASS@localhost:$DB_PORT/$DB_NAME${NC}"
    echo -e ""
    echo -e "  ${BOLD}${UNDERLINE}Available Commands:${NC}"
    echo -e "    🚀  Start dev server:     ${BRIGHT_CYAN}bun run dev${NC}"
    echo -e "    🔍  Database studio:      ${BRIGHT_CYAN}bun run db:studio${NC}"
    echo -e "    🌱  Seed database:        ${BRIGHT_CYAN}./scripts/nuke-db.sh --seed${NC}"
    echo -e "    🔇  Silent mode:          ${BRIGHT_CYAN}./scripts/nuke-db.sh --no-sound${NC}"
    echo -e "    🪟  PowerShell reset:     ${BRIGHT_CYAN}.\\scripts\\nuke-db.ps1 --force${NC}"
    echo -e "    🪟  CMD reset:            ${BRIGHT_CYAN}scripts\\nuke-db.cmd --force${NC}"
    echo -e ""
    echo -e "  ${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e ""
    echo -e "  ${BRIGHT_GREEN}${BOLD}  ⏱️  Total execution time: ${elapsed}s${NC}"
    echo -e ""
    echo -e "  ${BRIGHT_YELLOW}${BOLD}    🎉🎉🎉  DATABASE OPERATIONAL  🎉🎉🎉${NC}"
    echo -e ""
}

# ============================================================================
# ARGUMENT PARSING
# ============================================================================

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force|-f)
                FORCE_MODE=true
                shift
                ;;
            --seed|-s)
                SEED_MODE=true
                shift
                ;;
            --no-sound|-n)
                SOUND_ENABLED=false
                shift
                ;;
            --verbose|-v)
                VERBOSE_MODE=true
                shift
                ;;
            --help|-h)
                cat << EOF
╔══════════════════════════════════════════════════════════╗
║              DATABASE NUKER v2.0 - Help                 ║
╚══════════════════════════════════════════════════════════╝

Usage:
    Git Bash / Linux / macOS:
        ./scripts/nuke-db.sh [OPTIONS]

    PowerShell:
        .\scripts\nuke-db.ps1 [OPTIONS]

    CMD:
        scripts\nuke-db.cmd [OPTIONS]

Options:
  --force, -f        Skip confirmation prompt
  --seed, -s         Seed database after reset
  --no-sound, -n     Disable sound effects
  --verbose, -v      Enable verbose/debug output
  --help, -h         Show this help message

Examples:
    ./scripts/nuke-db.sh                  # Interactive mode (Git Bash / Linux)
    ./scripts/nuke-db.sh --force          # Skip confirmation
    ./scripts/nuke-db.sh --seed           # With seeding
    ./scripts/nuke-db.sh -f -s            # Force + seed
    .\scripts\nuke-db.ps1 --seed          # PowerShell with seeding
    scripts\nuke-db.cmd --seed            # CMD with seeding
    scripts\nuke-db.cmd -f -s             # CMD force + seed
    ./scripts/nuke-db.sh --no-sound       # Silent mode

⚠️  WARNING: This permanently deletes all database data!
EOF
                exit 0
                ;;
            *)
                log_error "Unknown argument: $1"
                log_info "Use --help for usage information"
                exit 1
                ;;
        esac
    done
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    # Parse arguments first
    parse_arguments "$@"
    
    # Opening cinematic
    opening_sequence
    
    # Pre-flight checks
    check_project_root
    check_docker
    check_docker_compose
    check_env_file || true
    
    # Safety confirmation
    confirm_destruction
    
    # Pre-destruction sequence
    pre_destruction_sequence
    beep
    sleep 0.5
    
    # Execute nuke sequence
    log_step "Initiating nuclear reset sequence"
    echo ""
    
    stop_containers
    destroy_volumes
    start_fresh_db
    wait_for_db
    verify_connection
    generate_migrations
    run_migrations
    seed_database
    
    # Completion
    print_summary
}

# Execute main function
main "$@"
