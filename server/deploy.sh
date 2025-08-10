#!/bin/bash

# EcoPaste 同步服务器部署脚本
# 支持多种部署方式：本地、Docker、生产环境

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
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

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 检查端口是否被占用
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# 生成随机密钥
generate_secret() {
    openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64
}

# 检查系统要求
check_requirements() {
    log_info "检查系统要求..."
    
    # 检查 Node.js
    if command_exists node; then
        local node_version=$(node --version | cut -d'v' -f2)
        local major_version=$(echo $node_version | cut -d'.' -f1)
        if [ $major_version -ge 18 ]; then
            log_success "Node.js 版本: $node_version ✓"
        else
            log_error "Node.js 版本过低，需要 18.0.0 或更高版本"
            exit 1
        fi
    else
        log_error "未找到 Node.js，请先安装 Node.js 18+"
        exit 1
    fi
    
    # 检查 npm
    if command_exists npm; then
        log_success "npm 版本: $(npm --version) ✓"
    else
        log_error "未找到 npm"
        exit 1
    fi
}

# 安装依赖
install_dependencies() {
    log_info "安装依赖包..."
    
    if [ -f "package-lock.json" ]; then
        npm ci
    else
        npm install
    fi
    
    log_success "依赖安装完成"
}

# 配置环境
setup_environment() {
    log_info "配置环境变量..."
    
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            log_info "已创建 .env 文件"
        else
            log_error "未找到 .env.example 文件"
            exit 1
        fi
    fi
    
    # 生成 JWT 密钥
    if grep -q "your-super-secret-jwt-key" .env; then
        local jwt_secret=$(generate_secret)
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s/your-super-secret-jwt-key/$jwt_secret/g" .env
        else
            # Linux
            sed -i "s/your-super-secret-jwt-key/$jwt_secret/g" .env
        fi
        log_success "已生成新的 JWT 密钥"
    fi
    
    log_success "环境配置完成"
}

# 创建必要目录
setup_directories() {
    log_info "创建必要目录..."
    
    mkdir -p data logs
    chmod 755 data logs
    
    log_success "目录创建完成"
}

# 检查端口
check_port_availability() {
    local port=${PORT:-3001}
    
    if check_port $port; then
        log_warning "端口 $port 已被占用"
        read -p "是否继续？(y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        log_success "端口 $port 可用"
    fi
}

# 本地部署
deploy_local() {
    log_info "开始本地部署..."
    
    check_requirements
    install_dependencies
    setup_environment
    setup_directories
    check_port_availability
    
    log_success "本地部署完成！"
    log_info "启动命令:"
    echo "  开发模式: npm run dev"
    echo "  生产模式: npm start"
    echo "  健康检查: curl http://localhost:3001/health"
}

# Docker 部署
deploy_docker() {
    log_info "开始 Docker 部署..."
    
    # 检查 Docker
    if ! command_exists docker; then
        log_error "未找到 Docker，请先安装 Docker"
        exit 1
    fi
    
    if ! command_exists docker-compose; then
        log_error "未找到 docker-compose，请先安装 docker-compose"
        exit 1
    fi
    
    setup_environment
    setup_directories
    
    # 构建和启动
    log_info "构建 Docker 镜像..."
    docker-compose build
    
    log_info "启动服务..."
    docker-compose up -d
    
    # 等待服务启动
    log_info "等待服务启动..."
    sleep 10
    
    # 健康检查
    if docker-compose ps | grep -q "Up"; then
        log_success "Docker 部署完成！"
        log_info "管理命令:"
        echo "  查看日志: docker-compose logs -f"
        echo "  停止服务: docker-compose down"
        echo "  重启服务: docker-compose restart"
        echo "  健康检查: curl http://localhost:3001/health"
    else
        log_error "服务启动失败，请检查日志"
        docker-compose logs
        exit 1
    fi
}

# 生产环境部署
deploy_production() {
    log_info "开始生产环境部署..."
    
    check_requirements
    install_dependencies
    setup_environment
    setup_directories
    
    # 设置生产环境变量
    if grep -q "NODE_ENV=development" .env; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' 's/NODE_ENV=development/NODE_ENV=production/g' .env
        else
            sed -i 's/NODE_ENV=development/NODE_ENV=production/g' .env
        fi
        log_info "已设置为生产环境"
    fi
    
    # 创建 systemd 服务文件
    if command_exists systemctl; then
        create_systemd_service
    fi
    
    log_success "生产环境部署完成！"
    log_info "启动命令:"
    echo "  直接启动: npm start"
    if command_exists systemctl; then
        echo "  系统服务: sudo systemctl start ecopaste-server"
        echo "  开机自启: sudo systemctl enable ecopaste-server"
    fi
}

# 创建 systemd 服务
create_systemd_service() {
    local service_file="/etc/systemd/system/ecopaste-server.service"
    local current_dir=$(pwd)
    local node_path=$(which node)
    
    log_info "创建 systemd 服务..."
    
    sudo tee $service_file > /dev/null <<EOF
[Unit]
Description=EcoPaste Sync Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$current_dir
ExecStart=$node_path src/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=$current_dir/.env

[Install]
WantedBy=multi-user.target
EOF
    
    sudo systemctl daemon-reload
    log_success "systemd 服务创建完成"
}

# 显示帮助信息
show_help() {
    echo "EcoPaste 同步服务器部署脚本"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  local       本地部署（默认）"
    echo "  docker      Docker 部署"
    echo "  production  生产环境部署"
    echo "  help        显示帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 local      # 本地开发部署"
    echo "  $0 docker     # Docker 容器部署"
    echo "  $0 production # 生产环境部署"
}

# 主函数
main() {
    local deploy_type=${1:-local}
    
    case $deploy_type in
        local)
            deploy_local
            ;;
        docker)
            deploy_docker
            ;;
        production)
            deploy_production
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "未知的部署类型: $deploy_type"
            show_help
            exit 1
            ;;
    esac
}

# 脚本入口
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi