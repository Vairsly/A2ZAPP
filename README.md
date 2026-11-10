# A2ZApp

A2Z 无人机配送飞前检查 App（uni-app / Vue 3），详情见 [doc/README.md](doc/README.md)。

## 云打包 APK

### 前置条件

- HBuilderX 3.1.5+（已验证 5.34），且已在 HBuilderX 中登录 DCloud 账号（云打包会占用账号打包额度）
- HBuilderX 已导入本项目
- Node.js（与运行 `tests/` 相同）

### 流程

根目录 `build.config.json` 的 `env` 与 `versionName` → HBuilderX `cli pack` 云打包（脚本自动把版本同步进 `manifest.json`）→ 从输出解析下载地址 → 改名为 `<name>-<versionName>.apk` → 归档到 `unpackage/release/apk/<环境中文目录>/`。

例：`env = "cn"`、`versionName = "1.0.1"` → `unpackage/release/apk/正式服/gcs-a2zd-co-1.0.1.apk`。

### 用法

```shell
node scripts/pack-apk.mjs                  # 云打包当前环境并归档
node scripts/pack-apk.mjs --dry-run        # 只打印解析结果与打包命令，不打包
node scripts/pack-apk.mjs --force          # 目标同名时覆盖旧归档
node scripts/pack-apk.mjs --skip-pack --apk <xxx.apk>   # 跳过打包，只改名归档现成 APK
node scripts/pack-apk.mjs --cli <cli.exe>  # 指定 HBuilderX cli.exe 路径（默认自动查找）
node scripts/pack-apk.mjs --timeout 45     # 云打包等待上限（分钟，默认 30）
```

### 发版参数：根目录 build.config.json

每次发版只改这一个文件：

```json
{
  "env": "kz",
  "versionName": "1.0.1",
  "versionCode": "100"
}
```

- `env`：运行环境（`local` / `test` / `pre` / `bali` / `usTrial` / `us` / `kz` / `cn`）。`common/api.js` 运行时直接读取，App 内调试运行也立即生效；`name` 决定 APK 文件名前缀，环境键经 `scripts/pack.config.json` 的 `envDirs` 映射到中文归档目录（正式服 / 预发布 / 测试服……）。
- `versionName` / `versionCode`：版本号（进文件名）与构建号（Android 升级判断）。打包脚本会自动把这两个值同步进 `manifest.json`，无需手动改。

### 打包配置 scripts/pack.config.json

| 字段 | 说明 |
| --- | --- |
| `android.packagename` | Android 包名，当前 `uni.app.UNI134ED0E` |
| `android.androidpacktype` | 证书类型：`3` 云端证书（当前使用）、`0` 自有证书、`1` 公共证书（DCloud 已停用，新打包会被拒绝）、`2` DCloud 老版证书 |
| `android.certfile` / `certalias` | 仅自有证书（`0`）需要：keystore 路径与别名 |
| `android.certpassword` / `storepassword` | 仅自有证书（`0`）需要；也可用环境变量 `HBX_ANDROID_CERT_PASSWORD`、`HBX_ANDROID_STORE_PASSWORD`，避免密码写进配置 |
| `envDirs` | 环境键 → 归档中文目录的映射 |

### 注意

- **证书**：DCloud 已不再支持公共证书（`1`）提交新打包，当前使用云端证书（`3`）。请先确认 DCloud 账号里已有云端证书（创建方式见 <https://ask.dcloud.net.cn/article/35985#server>，也可在 HBuilderX 云打包面板按提示创建）。若云端证书是新建的，与历史 APK 签名不一致时，已安装设备需卸载重装。
- 云打包成功后输出的下载地址是临时链接（限下载次数），脚本会立即下载并归档到本地。
- 同版本重新打包会与已有归档同名，需加 `--force` 才会覆盖。
- 打包输出中的 `[Warning]`（如隐私合规配置）会打印但不阻断；上架国内应用市场才需要处理隐私配置。
