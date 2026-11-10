#!/usr/bin/env node
/**
 * scripts/pack-apk.mjs — HBuilderX 云打包 APK，按「环境名-版本号」改名并归档到对应环境目录。
 *
 * 用法：
 *   node scripts/pack-apk.mjs                     读 build.config.json 的环境与版本，云打包并归档
 *   node scripts/pack-apk.mjs --dry-run           只打印解析结果、打包配置与目标路径，不打包
 *   node scripts/pack-apk.mjs --skip-pack --apk <已生成的.apk>   跳过云打包，直接改名归档
 *   node scripts/pack-apk.mjs --cli <cli.exe>     指定 HBuilderX cli 路径
 *   node scripts/pack-apk.mjs --force             目标文件已存在时覆盖
 *   node scripts/pack-apk.mjs --timeout <分钟>    云打包等待上限，默认 30 分钟
 *
 * 规则：
 *   - 环境与版本来自根目录 build.config.json（env / versionName / versionCode），发版只改这一个文件
 *   - env 经 common/api.js 的 API_ENVS 映射服务地址，name 决定文件名前缀，环境键查 envDirs 得到中文归档目录
 *   - 打包前自动把 versionName / versionCode 同步进 manifest.json；目标形如 unpackage/release/apk/正式服/gcs-a2zd-co-1.0.1.apk
 *   - 打包参数见 scripts/pack.config.json（androidpacktype：0 自有证书 / 1 公共证书 / 2 老版证书 / 3 云端证书）
 *   - 自有证书（0）的密码可用环境变量 HBX_ANDROID_CERT_PASSWORD / HBX_ANDROID_STORE_PASSWORD 代替写入配置
 *   - 需要 HBuilderX 3.1.5+（已验证 5.34）、HBuilderX 内已登录 DCloud 账号，云打包会占用账号打包额度
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, renameSync, rmSync, statSync, readdirSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { dirname, join, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const log = (...args) => console.log('[pack-apk]', ...args)

function parseArgs(argv) {
  const args = { dryRun: false, force: false, skipPack: false, apk: null, cli: null, timeoutMin: 30 }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--dry-run') args.dryRun = true
    else if (a === '--force') args.force = true
    else if (a === '--skip-pack') args.skipPack = true
    else if (a === '--apk') args.apk = argv[++i]
    else if (a === '--cli') args.cli = argv[++i]
    else if (a === '--timeout') args.timeoutMin = Number(argv[++i]) || 30
    else if (a === '--help' || a === '-h') {
      console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^\/\*\*?/, ''))
      process.exit(0)
    } else throw new Error(`未知参数：${a}`)
  }
  return args
}

// 根目录 build.config.json：发版参数只改这一个文件
function readBuildConfig() {
  const config = JSON.parse(readFileSync(join(ROOT, 'build.config.json'), 'utf8'))
  if (!config.env) throw new Error('build.config.json 缺少 env')
  if (!config.versionName) throw new Error('build.config.json 缺少 versionName')
  return {
    env: String(config.env),
    versionName: String(config.versionName),
    versionCode: config.versionCode == null ? '' : String(config.versionCode),
  }
}

// common/api.js 的环境表；name 决定文件名前缀，环境键查 envDirs 得到中文归档目录
function readApiEnv(envKey) {
  const src = readFileSync(join(ROOT, 'common', 'api.js'), 'utf8')
  const envs = {}
  const re = /(\w+)\s*:\s*\{\s*url\s*:\s*['"]([^'"]+)['"]\s*,\s*name\s*:\s*['"]([^'"]+)['"]\s*\}/g
  let m
  while ((m = re.exec(src))) envs[m[1]] = { url: m[2], name: m[3] }
  if (!envs[envKey]) {
    throw new Error(`build.config.json 的 env "${envKey}" 不在 common/api.js 的 API_ENVS 中（可选：${Object.keys(envs).join(' / ')}）`)
  }
  return { key: envKey, name: envs[envKey].name, url: envs[envKey].url }
}

// 把 build.config.json 的版本同步进 manifest.json，只替换数值，保留注释与原有格式
function syncManifest(build, dryRun) {
  const path = join(ROOT, 'manifest.json')
  let text = readFileSync(path, 'utf8')
  const changes = []
  for (const key of ['versionName', 'versionCode']) {
    if (!build[key]) continue
    const re = new RegExp(`"${key}"(\\s*:\\s*)"[^"]*"`)
    if (!re.test(text)) throw new Error(`manifest.json 里找不到 "${key}"`)
    text = text.replace(re, (match, sep) => {
      const old = match.match(/"([^"]*)"$/)[1]
      if (old !== build[key]) changes.push(`${key}: ${old} → ${build[key]}`)
      return `"${key}"${sep}"${build[key]}"`
    })
  }
  if (!changes.length) {
    log('manifest.json 版本与 build.config.json 一致，无需同步')
    return
  }
  if (dryRun) {
    log(`dry-run：将同步 manifest.json（${changes.join('，')}）`)
    return
  }
  writeFileSync(path, text, 'utf8')
  log(`已同步 manifest.json：${changes.join('，')}`)
}

function readPackConfig() {
  const path = join(ROOT, 'scripts', 'pack.config.json')
  const config = JSON.parse(readFileSync(path, 'utf8'))
  if (!config.android || !config.android.packagename) throw new Error('scripts/pack.config.json 缺少 android.packagename')
  return config
}

// 查找 HBuilderX cli.exe：显式参数 > HBX_CLI > 配置 > PATH > 常见安装目录
function resolveCli(explicit, configPath) {
  const candidates = []
  if (explicit) candidates.push(explicit)
  if (process.env.HBX_CLI) candidates.push(process.env.HBX_CLI)
  if (configPath) candidates.push(configPath)
  const where = spawnSync('where.exe', ['cli'], { windowsHide: true, encoding: 'utf8' })
  if (where.status === 0) {
    for (const line of where.stdout.split(/\r?\n/)) {
      const p = line.trim()
      if (p.toLowerCase().endsWith('cli.exe')) candidates.push(p)
    }
  }
  const scanRoots = ['D:\\programs', 'D:\\Program Files', 'C:\\Program Files', 'D:\\', 'C:\\', homedir()]
  for (const root of scanRoots) {
    let entries = []
    try {
      entries = readdirSync(root)
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!/^hbuilderx/i.test(entry)) continue
      candidates.push(join(root, entry, 'HBuilderX', 'cli.exe'))
      candidates.push(join(root, entry, 'cli.exe'))
    }
  }
  for (const c of candidates) {
    if (c && existsSync(c)) return c
  }
  throw new Error('找不到 HBuilderX cli.exe，请用 --cli 指定路径，或设置 HBX_CLI 环境变量')
}

const CERT_TYPES = { 0: '自有证书', 1: '公共证书', 2: 'DCloud老版证书', 3: '云端证书' }

function buildConfigure(config, envInfo) {
  const android = config.android || {}
  const type = String(android.androidpacktype ?? '1')
  const certfile = android.certfile ? resolve(ROOT, android.certfile) : ''
  return {
    project: ROOT.replace(/\\/g, '/'),
    platform: 'android',
    iscustom: false,
    safemode: false,
    sourceMap: false,
    isconfusion: false,
    ignoreWarnings: false,
    android: {
      packagename: android.packagename,
      androidpacktype: type,
      certalias: android.certalias || '',
      certfile: certfile.replace(/\\/g, '/'),
      certpassword: android.certpassword || process.env.HBX_ANDROID_CERT_PASSWORD || '',
      storePassword: android.storepassword || process.env.HBX_ANDROID_STORE_PASSWORD || process.env.HBX_ANDROID_CERT_PASSWORD || '',
      channels: android.channels || '',
    },
  }
}

function maskSecrets(json) {
  const copy = JSON.parse(JSON.stringify(json))
  for (const [k, v] of Object.entries(copy.android || {})) {
    if (/pass/i.test(k) && v) copy.android[k] = '***'
  }
  return copy
}

function targetApkPath(config, envInfo, versionName) {
  const dirName = (config.envDirs && config.envDirs[envInfo.key]) || envInfo.name
  return {
    dir: join(ROOT, 'unpackage', 'release', 'apk', dirName),
    file: `${envInfo.name}-${versionName}.apk`,
  }
}

function parseDownloadUrl(output) {
  const fallback = []
  for (const line of output.split(/\r?\n/)) {
    const m = line.match(/下载地址[:：]\s*(https?:\/\/\S+)/)
    if (!m) continue
    const url = m[1].replace(/[^\w\-.:/?&=%#]+$/, '')
    if (/Android/i.test(line)) return url
    fallback.push(url)
  }
  return fallback[0] || null
}

// 打包输出里夹着 HTML 列表；把 [Error]/[Warning] 提出来（去掉标签），错误时优先展示
function parseIssues(output) {
  const errors = []
  const warnings = []
  for (const line of output.split(/\r?\n/)) {
    for (const m of line.matchAll(/\[(Error|Warning)\]\s*([\s\S]*?)(?:<\/li>|$)/g)) {
      const text = m[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
      if (!text) continue
      if (m[1] === 'Error') errors.push(text)
      else warnings.push(text)
    }
  }
  return { errors, warnings }
}

function runPack(cli, configPath, timeoutMin) {
  return new Promise((resolvePromise, reject) => {
    log(`执行：${basename(cli)} pack --config ${configPath}`)
    const child = spawn(cli, ['pack', '--config', configPath], { cwd: ROOT, windowsHide: true })
    let output = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`云打包超时（${timeoutMin} 分钟），可用 --timeout 调整；也可用 cli pack cancel 取消任务`))
    }, timeoutMin * 60 * 1000)
    const onData = (chunk) => {
      const text = chunk.toString()
      output += text
      process.stdout.write(text)
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('error', reject)
    child.on('close', (code) => {
      clearTimeout(timer)
      resolvePromise({ code, output })
    })
  })
}

async function download(url, dest) {
  log(`下载：${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`下载失败：HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 1024 * 1024 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
    throw new Error('下载内容不是有效的 APK（ZIP）文件')
  }
  writeFileSync(dest, buf)
}

function placeApk(sourcePath, targetPath, force) {
  if (existsSync(targetPath) && !force) {
    throw new Error(`目标已存在：${targetPath}（重新打包同版本请加 --force 覆盖）`)
  }
  mkdirSync(dirname(targetPath), { recursive: true })
  const tmp = `${targetPath}.part`
  copyFileSync(sourcePath, tmp)
  renameSync(tmp, targetPath)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const build = readBuildConfig()
  const envInfo = readApiEnv(build.env)
  const config = readPackConfig()
  const target = targetApkPath(config, envInfo, build.versionName)
  const targetPath = join(target.dir, target.file)
  const type = String(config.android.androidpacktype ?? '1')

  log(`环境：${envInfo.key}（${envInfo.name}）→ ${envInfo.url}`)
  log(`版本：${build.versionName}（versionCode ${build.versionCode || '-'}）`)
  log(`证书：${CERT_TYPES[type] || type}（androidpacktype ${type}） 包名：${config.android.packagename}`)
  log(`目标：${targetPath}`)
  syncManifest(build, args.dryRun)

  if (args.skipPack) {
    if (!args.apk) throw new Error('--skip-pack 需要配合 --apk <文件> 使用')
    const src = resolve(process.cwd(), args.apk)
    if (!existsSync(src)) throw new Error(`找不到 APK：${src}`)
    if (args.dryRun) {
      log(`dry-run，不写入。将归档：${src} → ${targetPath}`)
      return
    }
    placeApk(src, targetPath, args.force)
    log(`已归档：${targetPath}（${(statSync(targetPath).size / 1024 / 1024).toFixed(1)} MB）`)
    return
  }

  const cli = resolveCli(args.cli, config.cliPath)
  log(`cli：${cli}`)
  const configure = buildConfigure(config, envInfo)
  const configPath = join(ROOT, 'unpackage', 'cache', 'pack', 'configure.json')
  mkdirSync(dirname(configPath), { recursive: true })

  if (args.dryRun) {
    log('dry-run，不执行打包。生成的 configure.json 内容：')
    console.log(JSON.stringify(maskSecrets(configure), null, 2))
    log(`打包命令：${cli} pack --config ${configPath}`)
    log(`目标文件：${targetPath}`)
    return
  }

  writeFileSync(configPath, JSON.stringify(configure, null, 2), 'utf8')
  try {
    // 文档要求 HBuilderX 处于运行状态
    spawnSync(cli, ['open'], { windowsHide: true, timeout: 60 * 1000 })
    const { code, output } = await runPack(cli, configPath, args.timeoutMin)
    const { errors, warnings } = parseIssues(output)
    for (const w of warnings) log(`打包警告：${w}`)
    const url = parseDownloadUrl(output)
    if (code !== 0 || !url) {
      const tail = output.trim().split(/\r?\n/).slice(-8).join('\n')
      if (/未登录|请登录|login/i.test(output)) {
        throw new Error(`云打包失败（未登录），请先打开 HBuilderX 登录 DCloud 账号后重试。输出末尾：\n${tail}`)
      }
      const detail = errors.length
        ? `\n${errors.map((e) => `[Error] ${e}`).join('\n')}`
        : `\n输出末尾：\n${tail}`
      throw new Error(`云打包失败（退出码 ${code}${url ? '' : '，未解析到下载地址'}）。${detail}`)
    }
    const part = `${targetPath}.part`
    mkdirSync(target.dir, { recursive: true })
    await download(url, part)
    if (existsSync(targetPath) && !args.force) {
      rmSync(part)
      throw new Error(`目标已存在：${targetPath}（重新打包同版本请加 --force 覆盖）`)
    }
    renameSync(part, targetPath)
    log(`已归档：${targetPath}（${(statSync(targetPath).size / 1024 / 1024).toFixed(1)} MB）`)
    log(`下载地址为临时链接（限下载次数），已保存到本地归档，无需再次下载。`)
  } finally {
    rmSync(configPath, { force: true })
  }
}

main().catch((err) => {
  console.error('[pack-apk] 失败：', err.message)
  process.exit(1)
})
