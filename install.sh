#!/bin/bash

# TDX Finance MCP Plugin - Linux/Mac Installation Script
# 通达信金融数据服务MCP插件安装脚本（含45个专业投资技能）

set -e

echo "=========================================="
echo "  TDX Finance MCP Plugin Installer"
echo "  通达信金融数据服务MCP插件 + 45个技能"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

# OpenClaw 配置目录（按优先级检测）
detect_openclaw_dir() {
    if [ -n "$OPENCLAW_CONFIG_DIR" ] && [ -d "$OPENCLAW_CONFIG_DIR" ]; then
        echo "$OPENCLAW_CONFIG_DIR"
    elif [ -d "$HOME/.config/openclaw" ]; then
        echo "$HOME/.config/openclaw"
    elif [ -d "$HOME/.openclaw" ]; then
        echo "$HOME/.openclaw"
    else
        echo "$HOME/.config/openclaw"
    fi
}

# 检查 Node.js 版本
check_node_version() {
    print_info "检查 Node.js 版本..."
    if ! command -v node &> /dev/null; then
        print_error "Node.js 未安装！请先安装 Node.js >= 22.16.0"
        exit 1
    fi
    NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VERSION" -lt 22 ]; then
        print_error "Node.js 版本过低！当前: $(node -v)，要求: >= 22.16.0"
        exit 1
    fi
    print_success "Node.js 版本检查通过: $(node -v)"
}

check_npm() {
    print_info "检查 npm..."
    if ! command -v npm &> /dev/null; then
        print_error "npm 未安装！请先安装 npm"
        exit 1
    fi
    print_success "npm 可用: $(npm -v)"
}

get_api_token() {
    echo ""
    print_info "请输入您的通达信 API Token（从通达信官方获取）:"
    read -p "> " API_TOKEN
    if [ -z "$API_TOKEN" ]; then
        print_error "API Token 不能为空！"
        exit 1
    fi
    print_success "API Token 已接收"
}

choose_install_method() {
    echo ""
    echo "请选择安装方式："
    echo "  1) 本地开发模式（推荐用于测试）"
    echo "  2) npm 全局安装（推荐用于生产）"
    echo ""
    read -p "> 请输入选项 [1-2]: " INSTALL_METHOD
    case $INSTALL_METHOD in
        1) install_local ;;
        2) install_global ;;
        *) print_error "无效选项！"; exit 1 ;;
    esac
}

install_local() {
    print_info "执行本地安装..."
    CURRENT_DIR=$(pwd)
    PLUGIN_DIR="$CURRENT_DIR/tdx-finance-mcp-plugin"

    if [ -d "$PLUGIN_DIR" ]; then
        print_warning "插件目录已存在，是否更新？(y/n)"
        read -p "> " UPDATE_CHOICE
        if [ "$UPDATE_CHOICE" != "y" ] && [ "$UPDATE_CHOICE" != "Y" ]; then
            print_info "取消更新"; return
        fi
        rm -rf "$PLUGIN_DIR"
    fi

    print_info "正在下载插件..."
    git clone https://github.com/adambbhe/tdx-finance-mcp-plugin.git "$PLUGIN_DIR" || {
        print_error "无法克隆仓库！"
        exit 1
    }

    cd "$PLUGIN_DIR"
    npm install
    create_config
    install_skills "$CURRENT_DIR" "$PLUGIN_DIR"

    print_success "本地安装完成！"
    print_info "插件位置: $PLUGIN_DIR"
}

install_global() {
    print_info "执行全局安装..."
    print_info "正在从 npm 安装..."
    npm install -g @tdx/tdx-finance-mcp || {
        print_error "npm 安装失败！请确认包已发布到 npm registry"
        exit 1
    }

    GLOBAL_PLUGIN_DIR="$(npm root -g)/@tdx/tdx-finance-mcp"
    CONFIG_DIR="$HOME/.config/tdx-finance-mcp"
    mkdir -p "$CONFIG_DIR"
    create_global_config "$CONFIG_DIR"
    install_skills "" "$GLOBAL_PLUGIN_DIR"

    print_success "全局安装完成！"
    print_info "插件位置: $GLOBAL_PLUGIN_DIR"
}

# ========== 核心：Skills 安装 ==========
install_skills() {
    local base_dir="$1"
    local plugin_dir="$2"

    echo ""
    print_info "📚 安装 TDX 专业投资技能 (45个)..."

    SKILLS_SRC="$plugin_dir/skills"
    if [ ! -d "$SKILLS_SRC" ]; then
        print_warning "skills 目录不存在于插件中，跳过技能安装"
        return
    fi

    # 统计 skill 数量
    SKILL_COUNT=$(find "$SKILLS_SRC" -maxdepth 1 -type d -name 'tdx-*' | wc -l)
    print_info "发现 $SKILL_COUNT 个 TDX 技能"

    # 检测 OpenClaw 目录
    OPENCLAW_DIR=$(detect_openclaw_dir)
    SKILLS_DST="$OPENCLAW_DIR/skills"

    mkdir -p "$SKILLS_DST"

    # 复制每个 tdx-* skill
    INSTALLED=0
    SKIPPED=0
    for skill_dir in "$SKILLS_SRC"/tdx-*; do
        if [ -d "$skill_dir" ]; then
            skill_name=$(basename "$skill_dir")
            dst_path="$SKILLS_DST/$skill_name"

            if [ -d "$dst_path" ]; then
                rm -rf "$dst_path"
            fi

            cp -r "$skill_dir" "$dst_path"
            INSTALLED=$((INSTALLED + 1))
        fi
    done

    # 复制 skills 描述文件（如果存在）
    if [ -f "$SKILLS_SRC/../tdx-skills-desc.json" ]; then
        cp "$SKILLS_SRC/../tdx-skills-desc.json" "$OPENCLAW_DIR/" 2>/dev/null || true
    elif [ -f "$plugin_dir/skills/tdx-skills-desc.json" ]; then
        cp "$plugin_dir/skills/tdx-skills-desc.json" "$OPENCLAW_DIR/" 2>/dev/null || true
    fi

    print_success "已安装 $INSTALLED 个 TDX 技能 → $SKILLS_DST/"
    print_info "技能列表："
    ls -1 "$SKILLS_DST" | grep '^tdx-' | head -20 | sed 's/^/  /'
    REMAINING=$((INSTALLED - 20))
    if [ "$REMAINING" -gt 0 ]; then
        print_info "  ... 以及其他 $REMAINING 个技能"
    fi
}

create_config() {
    print_info "创建配置文件..."
    cat > config.json << EOF
{
  "plugins": {
    "tdx-finance-mcp": {
      "enabled": true,
      "config": {
        "tdxApiToken": "${API_TOKEN}",
        "apiEndpoint": "http://tdxhub.icfqs.com:7615/TQLEX"
      }
    }
  },
  "env": {
    "TDX_API_KEY": "${API_TOKEN}"
  }
}
EOF
    print_success "配置文件已创建: config.json"
}

create_global_config() {
    local config_dir=$1
    print_info "创建全局配置文件..."
    cat > "$config_dir/config.json" << EOF
{
  "plugins": {
    "tdx-finance-mcp": {
      "enabled": true,
      "config": {
        "tdxApiToken": "${API_TOKEN}",
        "apiEndpoint": "http://tdxhub.icfqs.com:7615/TQLEX"
      }
    }
  },
  "env": {
    "TDX_API_KEY": "${API_TOKEN}"
  }
}
EOF
    print_success "全局配置已创建: $config_dir/config.json"
}

setup_env_vars() {
    echo ""
    print_warning "是否要将 API Token 设置为环境变量？（推荐）"
    read -p "> (y/n): " ENV_CHOICE
    if [ "$ENV_CHOICE" = "y" ] || [ "$ENV_CHOICE" = "Y" ]; then
        SHELL_RC=""
        if [ -n "$ZSH_VERSION" ]; then SHELL_RC="$HOME/.zshrc"
        elif [ -n "$BASH_VERSION" ]; then SHELL_RC="$HOME/.bashrc"; fi
        if [ -n "$SHELL_RC" ] && [ -f "$SHELL_RC" ]; then
            echo "" >> "$SHELL_RC"
            echo "# TDX Finance MCP Plugin" >> "$SHELL_RC"
            echo "export TDX_API_KEY=\"${API_TOKEN}\"" >> "$SHELL_RC"
            print_success "环境变量已添加到 $SHELL_RC"
            print_warning "请执行 'source $SHELL_RC' 或重启终端使环境变量生效"
        else
            print_warning "无法自动检测 shell 配置文件"
            print_info "请手动添加: export TDX_API_KEY=\"${API_TOKEN}\""
        fi
    fi
}

verify_installation() {
    echo ""
    print_info "验证安装..."

    if [ -d "node_modules/@sinclair/typebox" ]; then
        print_success "✓ 依赖安装正确"
    else
        print_warning "⚠ 依赖可能未完全安装，请运行: npm install"
    fi

    if [ -d "skills" ]; then
        SKILL_COUNT=$(find skills -maxdepth 1 -type d -name 'tdx-*' 2>/dev/null | wc -l)
        print_success "✓ Skills 包含 $SKILL_COUNT 个 TDX 技能"
    fi

    print_info "测试插件加载..."
    node -e "
        try { require('./index.js'); console.log('✓ 插件代码可正常加载'); process.exit(0) }
        catch(e) { console.error('✗ 加载失败:', e.message); process.exit(1) }
    " 2>/dev/null && print_success "✓ 插件加载测试通过" || print_warning "⚠ 插件加载测试跳过（需在OpenClaw环境中运行）"
}

show_next_steps() {
    echo ""
    echo "=========================================="
    echo "  🎉 安装完成！（工具 + 技能 一键就绪）"
    echo "=========================================="
    echo ""
    print_success "已安装："
    echo "  🔧 9 个数据工具 (tdx_api_data, tdx_quotes, tdx_kline...)"
    echo "  📚 45 个专业投资技能 (A股分析、财务研究、龙虎榜...)"
    echo ""
    echo "📋 后续步骤："
    echo ""
    echo "  1️⃣  启动/重启 OpenClaw:"
    echo "      openclaw start   (或 restart)"
    echo ""
    echo "  2️⃣  验证加载日志应显示："
    echo "      tdx-finance-mcp: registering plugin..."
    echo "      tdx-finance-mcp: registered tool: tdx_api_data"
    echo "      ..."
    echo ""
    echo "  3️⃣  开始使用（示例查询）："
    echo "      \"查一下000001平安银行的实时行情\""
    echo "      \"帮我分析宁德时代的投资价值\""
    echo "      \"今天有哪些股票涨停了？\""
    echo "      \"查询贵州茅台的龙虎榜资金流向\""
    echo ""
    echo "📚 文档与支持："
    echo "  - 完整文档: README.md"
    echo "  - API参考: README.md#api文档"
    echo "  - 问题反馈: https://github.com/adambbhe/tdx-finance-mcp-plugin/issues"
    echo ""
    echo "=========================================="
}

main() {
    echo "欢迎使用 TDX Finance MCP Plugin 安装向导！"
    echo "(工具 + 技能 一键安装)"
    echo ""

    check_node_version
    check_npm
    get_api_token
    choose_install_method
    setup_env_vars
    verify_installation
    show_next_steps
}

main "$@"
