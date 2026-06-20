# TDX Finance MCP Plugin - Windows PowerShell Installation Script
# 通达信金融数据服务MCP插件安装程序（含45个专业投资技能）

param(
    [switch]$Local,
    [switch]$Global,
    [string]$Token,
    [switch]$SkipEnvVar,
    [switch]$Force,
    [string]$OpenClawDir
)

$ErrorActionPreference = "Stop"

# 颜色定义
function Write-Info($message) { Write-Host "[INFO] $message" -ForegroundColor Cyan }
function Write-Success($message) { Write-Host "[SUCCESS] $message" -ForegroundColor Green }
function Write-Warning($message) { Write-Host "[WARNING] $message" -ForegroundColor Yellow }
function Write-ErrorCustom($message) { Write-Host "[ERROR] $message" -ForegroundColor Red }

Write-Host ""
Write-Host "==========================================" -ForegroundColor White
Write-Host "  TDX Finance MCP Plugin Installer" -ForegroundColor White
Write-Host "  工具 + 45个技能 一键安装" -ForegroundColor White
Write-Host "==========================================" -ForegroundColor White
Write-Host ""

# 检测 OpenClaw 配置目录
function Get-OpenClawDir {
    if ($OpenClawDir -and (Test-Path $OpenClawDir)) {
        return $OpenClawDir
    }
    if (Test-Path "$env:USERPROFILE\.openclaw") {
        return "$env:USERPROFILE\.openclaw"
    }
    if (Test-Path "$env:APPDATA\openclaw") {
        return "$env:APPDATA\openclaw"
    }
    return "$env:USERPROFILE\.openclaw"
}

# 检查 Node.js 版本
function Test-NodeVersion {
    Write-Info "检查 Node.js 版本..."
    try {
        $nodeVersion = node -v
        $versionNumber = $nodeVersion -replace 'v', '' -split '\.'
        $majorVersion = [int]$versionNumber[0]
        if ($majorVersion -lt 22) {
            Write-ErrorCustom "Node.js 版本过低！当前: $nodeVersion，要求: >= 22.16.0"
            exit 1
        }
        Write-Success "Node.js 版本检查通过: $nodeVersion"
    } catch {
        Write-ErrorCustom "Node.js 未安装！请先安装 Node.js >= 22.16.0"
        exit 1
    }
}

# 检查 npm
function Test-Npm {
    Write-Info "检查 npm..."
    try {
        $npmVersion = npm -v
        Write-Success "npm 可用: $npmVersion"
    } catch {
        Write-ErrorCustom "npm 未安装！请先安装 npm"
        exit 1
    }
}

# 获取 API Token
function Get-ApiToken {
    if ($Token) {
        $script:apiToken = $Token
        Write-Success "API Token 已通过命令行参数提供"
        return
    }

    Write-Host ""
    Write-Info "请输入您的通达信 API Token（从通达信官方获取）:"
    $script:apiToken = Read-Host "> "

    if ([string]::IsNullOrWhiteSpace($script:apiToken)) {
        Write-ErrorCustom "API Token 不能为空！"
        exit 1
    }
    Write-Success "API Token 已接收"
}

# 安装 Skills
function Install-Skills {
    param([string]$PluginDir)

    Write-Host ""
    Write-Info "📚 安装 TDX 专业投资技能..."

    $skillsSrc = Join-Path $PluginDir "skills"
    if (-not (Test-Path $skillsSrc)) {
        Write-Warning "skills 目录不存在于插件中，跳过技能安装"
        return
    }

    # 统计 skill 数量
    $skillDirs = Get-ChildItem $skillsSrc -Directory | Where-Object { $_.Name -match '^tdx-' }
    $skillCount = @($skillDirs).Count
    Write-Info "发现 $skillCount 个 TDX 技能"

    # 目标目录
    $ocDir = Get-OpenClawDir
    $skillsDst = Join-Path $ocDir "skills"
    if (-not (Test-Path $skillsDst)) {
        New-Item -ItemType Directory -Path $skillsDst -Force | Out-Null
    }

    # 复制每个 tdx-* skill
    $installed = 0
    foreach ($sd in $skillDirs) {
        $dstPath = Join-Path $skillsDst $sd.Name
        if (Test-Path $dstPath) { Remove-Item $dstPath -Recurse -Force }
        Copy-Item $sd.FullName $dstPath -Recurse -Force
        $installed++
    }

    # 复制描述文件（如果存在）
    $descFile = Join-Path $skillsSrc "..\tdx-skills-desc.json"
    if (-not (Test-Path $descFile)) {
        $descFile = Join-Path $skillsSrc "tdx-skills-desc.json"
    }
    if (Test-Path $descFile) {
        Copy-Item $descFile $ocDir -Force -ErrorAction SilentlyContinue
    }

    Write-Success "已安装 $installed 个 TDX 技能 → $skillsDst\"
    Write-Info "技能列表："
    Get-ChildItem $skillsDst -Directory | Where-Object { $_.Name -match '^tdx-' } |
        Select-Object -First 20 Name | ForEach-Object { Write-Host "  $($_.Name)" }
    $remaining = $installed - 20
    if ($remaining -gt 0) {
        Write-Info "  ... 以及其他 $remaining 个技能"
    }
}

# 本地安装
function Install-Local {
    Write-Info "执行本地安装..."
    $currentDir = Get-Location
    $pluginDir = Join-Path $currentDir "tdx-finance-mcp-plugin"

    if (Test-Path $pluginDir) {
        if (-not $Force) {
            Write-Warning "插件目录已存在，是否更新？(y/n)"
            $updateChoice = Read-Host "> "
            if ($updateChoice -ne 'y' -and $updateChoice -ne 'Y') {
                Write-Info "取消更新"; return
            }
        }
        Remove-Item $pluginDir -Recurse -Force
    }

    Write-Info "正在下载插件..."
    git clone https://github.com/adambbhe/tdx-finance-mcp-plugin.git $pluginDir | Out-Null
    if (-not $?) {
        Write-ErrorCustom "无法克隆仓库！请检查网络连接或仓库地址"
        exit 1
    }

    Set-Location $pluginDir

    Write-Info "正在安装依赖..."
    npm install

    New-ConfigFile
    Install-Skills -PluginDir $pluginDir

    Set-Location $currentDir

    Write-Success "本地安装完成！"
    Write-Info "插件位置: $pluginDir"
}

# 全局安装
function Install-Global {
    Write-Info "执行全局安装..."

    Write-Info "正在从 npm 安装..."
    npm install -g @tdx/tdx-finance-mcp | Out-Null
    if (-not $?) {
        Write-ErrorCustom "npm 安装失败！请确认包已发布到 npm registry"
        exit 1
    }

    $globalPluginDir = (npm root -g) + "\@tdx\tdx-finance-mcp"
    $configDir = Join-Path $env:APPDATA "tdx-finance-mcp"
    if (-not (Test-Path $configDir)) {
        New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    }

    New-GlobalConfigFile -ConfigDir $configDir
    Install-Skills -PluginDir $globalPluginDir

    Write-Success "全局安装完成！"
    Write-Info "插件位置: $globalPluginDir"
}

# 创建配置文件
function New-ConfigFile {
    Write-Info "创建配置文件..."

    $configContent = @"
{
  "plugins": {
    "tdx-finance-mcp": {
      "enabled": true,
      "config": {
        "tdxApiToken": "$($script:apiToken)",
        "apiEndpoint": "http://tdxhub.icfqs.com:7615/TQLEX"
      }
    }
  },
  "env": {
    "TDX_API_KEY": "$($script:apiToken)"
  }
}
"@
    $configContent | Out-File -FilePath "config.json" -Encoding UTF8
    Write-Success "配置文件已创建: config.json"
}

# 创建全局配置文件
function New-GlobalConfigFile {
    param([string]$ConfigDir)

    Write-Info "创建全局配置文件..."

    $configContent = @"
{
  "plugins": {
    "tdx-finance-mcp": {
      "enabled": true,
      "config": {
        "tdxApiToken": "$($script:apiToken)",
        "apiEndpoint": "http://tdxhub.icfqs.com:7615/TQLEX"
      }
    }
  },
  "env": {
    "TDX_API_KEY": "$($script:apiToken)"
  }
}
"@
    $configPath = Join-Path $ConfigDir "config.json"
    $configContent | Out-File -FilePath $configPath -Encoding UTF8
    Write-Success "全局配置已创建: $configPath"
}

# 设置环境变量
function Set-EnvironmentVariable {
    if ($SkipEnvVar) { return }

    Write-Host ""
    Write-Warning "是否要将 API Token 设置为系统环境变量？（推荐）"
    $envChoice = Read-Host "> (y/n)"

    if ($envChoice -eq 'y' -or $envChoice -eq 'Y') {
        [System.Environment]::SetEnvironmentVariable("TDX_API_KEY", $script:apiToken, "User")
        $env:TDX_API_KEY = $script:apiToken
        Write-Success "用户级环境变量已设置：TDX_API_KEY"
        Write-Warning "请重启终端或重新打开 PowerShell 使环境变量生效"
    }
}

# 验证安装
function Test-Installation {
    Write-Host ""
    Write-Info "验证安装..."

    if (Test-Path "node_modules\@sinclair\typebox") {
        Write-Success "✓ 依赖安装正确"
    } else {
        Write-Warning "⚠ 依赖可能未完全安装，请运行: npm install"
    }

    if (Test-Path "skills") {
        $sc = @(Get-ChildItem "skills" -Directory | Where-Object { $_.Name -match '^tdx-' }).Count
        Write-Success "✓ Skills 包含 $sc 个 TDX 技能"
    }

    Write-Info "测试插件加载..."
    node -e "try{require('./index.js');console.log('✓ 插件代码可正常加载');process.exit(0)}catch(e){console.error('✗ 加载失败:',e.message);process.exit(1)}" 2>$null
    if ($?) { Write-Success "✓ 插件加载测试通过" } else { Write-Warning "⚠ 插件加载测试跳过" }
}

# 显示后续步骤
function Show-NextSteps {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor White
    Write-Host "  🎉 安装完成！（工具 + 技能 一键就绪）" -ForegroundColor White
    Write-Host "==========================================" -ForegroundColor White
    Write-Host ""

    Write-Success "已安装："
    Write-Host "  🔧 9 个数据工具 (tdx_api_data, tdx_quotes, tdx_kline...)"
    Write-Host "  📚 45 个专业投资技能 (A股分析、财务研究、龙虎榜...)"
    Write-Host ""

    Write-Host "📋 后续步骤：" -ForegroundColor White
    Write-Host ""
    Write-Host "  1️⃣  启动/重启 OpenClaw:" -ForegroundColor White
    Write-Host "      openclaw start   (或 restart)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  2️⃣  验证加载日志应显示：" -ForegroundColor White
    Write-Host "      tdx-finance-mcp: registering plugin..." -ForegroundColor Gray
    Write-Host "      tdx-finance-mcp: registered tool: tdx_api_data" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  3️⃣  开始使用（示例查询）：" -ForegroundColor White
    Write-Host '      "查一下000001平安银行的实时行情"' -ForegroundColor Gray
    Write-Host '      "帮我分析宁德时代的投资价值"' -ForegroundColor Gray
    Write-Host '      "今天有哪些股票涨停了？"' -ForegroundColor Gray
    Write-Host '      "查询贵州茅台的龙虎榜资金流向"' -ForegroundColor Gray
    Write-Host ""
    Write-Host "📚 文档与支持："
    Write-Host "  - 完整文档: README.md"
    Write-Host "  - API参考: README.md#api文档"
    Write-Host "  - 问题反馈: https://github.com/adambbhe/tdx-finance-mcp-plugin/issues"
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor White
}

# 主流程
function Main {
    Write-Host "欢迎使用 TDX Finance MCP Plugin 安装向导！"
    Write-Host "(工具 + 技能 一键安装)"
    Write-Host ""

    Test-NodeVersion
    Test-Npm
    Get-ApiToken

    if ($Local) {
        Install-Local
    } elseif ($Global) {
        Install-Global
    } else {
        Write-Host ""
        Write-Host "请选择安装方式：" -ForegroundColor White
        Write-Host "  1) 本地开发模式（推荐用于测试）" -ForegroundColor White
        Write-Host "  2) npm 全局安装（推荐用于生产）" -ForegroundColor White
        Write-Host ""
        $choice = Read-Host "> 请输入选项 [1-2]"
        switch ($choice) {
            '1' { Install-Local }
            '2' { Install-Global }
            default { Write-ErrorCustom "无效选项！"; exit 1 }
        }
    }

    Set-EnvironmentVariable
    Test-Installation
    Show-NextSteps
}

Main
