# 页面导航与交互流程

返回：[文档入口](./README.md)

## 1. 页面与操作入口

| 页面 | 路由常量 | 主要操作 |
| --- | --- | --- |
| 登录 | `PAGES.login` | 验证码刷新、登录、记住密码、中英文切换 |
| 首页 Tab | `PAGES.home` | 进入无人机选择、切换历史 Tab、语言切换 |
| 历史 Tab（标题为“检查”） | `PAGES.check` / `PAGES.preflightHistory` | 新建检查、草稿继续/删除、ID 筛选、历史详情、分页刷新 |
| 设置 Tab | `PAGES.settings` | 用户资料、头像预览、退出确认 |
| 无人机选择 | `PAGES.preflightSelectDrone` | 搜索、点击选择、底部确认；长按选择后弹出开始确认 |
| 检查填写 | `PAGES.preflightCheck` | 17 项结果/备注/照片、步骤切换、汇总、保存草稿、提交、切换无人机 |
| 历史详情 | `PAGES.preflightHistoryDetail` | 结果、逐项备注、图片预览、删除确认 |

`HeaderBar` 负责事件发出，由页面决定动作。通知是占位交互：设置页点击后显示“建设中”提示，首页隐藏通知；没有发现通知列表或未读数服务。Tab 切换由 `pages.json` 的原生 TabBar 提供。

## 2. 页面导航图

```mermaid
flowchart TB
    Start["应用启动 / 回到前台"] --> Guard{"access 与 refresh token 齐全？"}
    Guard -->|"否"| Login["登录页"]
    Guard -->|"是"| Fresh["检查 / 刷新 token"]
    Fresh -->|"失败"| Login
    Fresh -->|"成功且当前为登录页"| Home["首页 Tab"]
    Fresh -->|"成功且当前为其他页面"| Stay["保留当前页"]
    Login -->|"登录成功"| Home
    Home <-->|"TabBar"| History["历史 Tab：PAGES.check"]
    Home <-->|"TabBar"| Settings["设置 Tab"]
    History <-->|"TabBar"| Settings
    Home -->|"新建：noprefill=1"| Select["无人机选择页"]
    Home -->|"查看历史"| History
    History -->|"新建：noprefill=1"| Select
    Select -->|"确认；写模式 1"| Check["检查填写页"]
    Select -->|"返回按钮"| History
    History -->|"继续草稿；写模式 draft"| Check
    Check -->|"切换无人机：from=check"| Select
    Select -->|"from=check 确认后 navigateBack"| Check
    Check -->|"提交成功 / 确认离开"| History
    History -->|"点击记录：id 参数"| Detail["历史详情页"]
    Detail -->|"返回 / 删除成功后返回"| History
    Settings -->|"确认退出"| Login
```

图中的详情返回表示常规入口；实现调用 `navigateBack`，失败时切历史 Tab。选择页自己的返回按钮固定切历史 Tab，即使从首页或检查页进入也是如此。直接设备返回与页面按钮的行为还受运行平台和页面栈影响。

导航封装会处理相同路由、忙状态和框架锁冲突；部分按钮还先检查 `isNavGuardActive()`。常见保护窗口为 450 ms，默认重试 2 次、间隔 120 ms，`safeReLaunch` 的默认间隔为 150 ms。保护用于抑制重复导航，不构成页面权限控制。

## 3. 登录与用户资料交互

```mermaid
sequenceDiagram
    actor U as 操作人员
    participant L as 登录页
    participant R as requestGet
    participant S as session.js
    participant H as httpRequest
    participant B as 外部后端
    participant K as uni本地存储
    participant N as navigation.js
    L->>R: getCaptcha({_ts}, dedup=false)
    R->>H: 免鉴权请求
    H->>B: GET /dev-api/auth/getCaptcha
    B-->>L: captcha_id 与图片源
    L->>K: 读取记住密码配置
    U->>L: 输入邮箱、密码、验证码并提交
    L->>L: 验证码非空、邮箱格式、密码非空
    L->>S: login(邮箱, 原始密码, 验证码)
    S->>K: 删除旧 userInfo
    S->>S: 使用 JSEncrypt 加密密码
    S->>H: 登录 POST（密文 password）
    H->>B: POST /dev-api/auth/login
    alt 登录成功
        B-->>S: access_token / refresh_token
        S->>K: 保存 tokens 与 loginTime
        S-->>L: 登录结果
        L->>S: 解码 access token payload.sub
        opt sub 存在
            L->>R: GET /dev-api/users/:id
            R->>B: 受保护请求（经 httpRequest）
            B-->>L: 用户资料
            L->>K: 缓存 userInfo（失败被忽略）
        end
        L->>K: 按勾选状态保存或删除记住的邮箱/密码
        L->>N: safeSwitchTab(PAGES.home)
    else 登录失败
        B-->>S: 登录错误
        S-->>L: 抛出错误
        L-->>U: 显示错误
        L->>R: 重新获取验证码
    end
```

登录后用户信息获取失败不会阻止进入首页。若本地密码加密失败，会在发送登录请求前直接抛错，登录页同样显示错误并刷新验证码。验证码图片支持完整 URL、以 `/` 开头的路径、Data URI 或裸 Base64；`normalizeCaptchaImageSrc` 不会为相对验证码路径自动拼接 API 主机。

## 4. 会话刷新交互

```mermaid
sequenceDiagram
    participant P as 业务页面
    participant R as request.js
    participant S as session.js
    participant K as uni本地存储
    participant B as 外部后端
    participant N as 登录导航
    P->>R: 发起受保护业务请求
    R->>S: ensureFreshAccessToken()
    S->>K: 读取 token、exp 或 loginTime
    opt 即将过期
        S->>S: 复用或创建 refreshPromise
        S->>B: POST auth/refresh（经 httpRequest）
        B-->>S: 新 token
        S->>K: setSession()
    end
    S-->>R: 可继续请求
    R->>B: Bearer + lang 的业务请求
    alt 返回 HTTP 401 或业务 code=401
        R->>S: refreshTokens()
        S->>B: POST auth/refresh
        B-->>S: 新 token 或错误
        S->>K: 成功时更新 tokens
        S-->>R: 刷新结果
        opt 刷新成功
            R->>B: 重新发送原业务请求
            B-->>R: 重发结果
        end
        alt 确认为会话失效
            R->>S: clearSession()
            R->>N: 默认提示并 safeReLaunch(login)
            R-->>P: 抛出错误
        else 业务成功或其他错误
            R-->>P: 解包数据或抛出相应错误
        end
    else 正常业务响应
        B-->>R: 响应
        R-->>P: res（数据位于 res.data）
    end
```

这是主路径说明。发送前刷新失败会直接清会话；401 后刷新失败的处理还取决于错误是否带有可识别的 401 响应。`request.js` 的外层 `catch` 存在额外重试分支；具体边界应通过请求 mock 或联调验证。`onUnauthorized` 自定义回调可以取代默认提示/导航。

## 5. 新建、恢复与切换无人机

| 进入方式 | 跨页状态 | 检查页行为 |
| --- | --- | --- |
| 首页/历史新建 | 选择页参数 `noprefill=1`；确认写 ID、alias 和 `'1'` | 检查页消费标记并 `resetFlow()`，不自动恢复同 ID 的旧草稿 |
| 历史继续草稿 | 历史页写 ID、alias 和 `'draft'` | `tryRestoreDraft()` 按 key 恢复；恢复失败则重置流程 |
| 检查页切无人机 | 参数 `from=check`；确认仅更新 ID/alias 并返回 | 原检查页 `onShow` 读取新 ID/alias；无新模式标记时保留现有步骤内容 |
| 普通返回检查页 | 无 `preflightStartNew` | 保留内存内容；若无选中无人机且无进度，尝试导航到历史页 |

最后一项的空状态分支实际调用 `safeNavigateTo(PAGES.preflightHistory)`；但历史页是 Tab，按 uni-app 导航语义应使用 `switchTab`，该分支可能导航失败，见风险文档。

```mermaid
sequenceDiagram
    actor U as 操作人员
    participant H as 历史页
    participant D as 无人机选择页
    participant C as 检查页
    participant K as uni本地存储
    alt 新建检查
        U->>D: 选择无人机并确认
        D->>K: 写 ID / alias / preflightStartNew=1
        D->>C: navigateTo(检查页)
        C->>K: 读取并删除进入模式
        C->>C: resetFlow()
    else 继续草稿
        U->>H: 点击本地草稿
        H->>K: 写 ID / alias / preflightStartNew=draft
        H->>C: navigateTo(检查页)
        C->>K: 读取模式、删除标记、读取对应草稿
        C->>C: 按 key 恢复结果/备注/照片/步骤位置
    end
    loop 每 3 秒
        C->>C: 有进度且指纹变化？
        opt 可保存且内容变化
            C->>K: preflightDrafts[droneId] = 快照
        end
    end
    opt 手动保存或页面 onHide
        C->>K: 可保存时写草稿快照
    end
    U->>C: 点击返回 / 原生返回 / 边缘滑动
    alt 已提交或无进度
        C->>H: 切换历史 Tab
    else 有未提交进度
        C-->>U: 弹窗：保存草稿 / 放弃草稿
        alt 保存
            C->>K: 保存当前快照
        else 放弃
            C->>C: discardingDraft=true
            Note over C,K: 当前分支未删除已经自动保存的草稿
        end
        C->>H: 切换历史 Tab
    end
```

## 6. 检查填写状态与规则

```mermaid
stateDiagram-v2
    [*] --> Steps: 新建或恢复到步骤页
    state "逐项检查" as Steps
    state "保留当前项并提示" as NeedInput
    state "汇总" as Summary
    state "确认提交" as Confirm
    state "提交中" as Submitting
    state "历史列表" as History
    Steps --> NeedInput: 下一项时未选择结果或缺少必拍照片
    NeedInput --> Steps: 补充结果或照片
    Steps --> Steps: 有效结果后自动前进 / 上一项 / 下一项
    Steps --> Summary: 全部选择结果且必拍照片满足
    Summary --> Steps: 点击某项复查
    Steps --> Summary: 复查项有效标记后返回汇总
    Summary --> Confirm: 点击提交
    Confirm --> Summary: 取消
    Confirm --> Submitting: 确认且提交方法校验通过
    Submitting --> History: 成功并清除当前无人机草稿
    Submitting --> Summary: 失败显示错误并允许重试
    Steps --> History: 确认离开
    Summary --> History: 确认离开
    History --> [*]
```

交互细节：

1. 点击“通过/不通过”先写入 `ok`，再检查必拍照片；缺照片会留在当前项，但 `ok` 已被记录。
2. 结果有效且照片满足时自动进入下一项；最后一项通过完整性检查后进入汇总。
3. 点击“下一项”不自动设结果；必须先明确选择 `true/false`。
4. 汇总可以点击某项复查；重新标记该项后回汇总。汇总中未选择结果的项会按假值显示为不通过，但提交按钮仍由 `flowCompleted` 禁用。
5. “保存草稿”要求已选无人机、有任意进度、当前未提交；不要求所有步骤完成。
6. “提交”按钮要求未上传、未提交中、当前未标记已提交且所有项已选择结果；不要求全部通过。
7. 检查页通过页面钩子、Vue 3 返回钩子、`plus.key` 原生监听和边缘触摸处理进入相同离开确认逻辑；`leavePrompting` 防止弹窗重复。实际手势行为需真机验证。

## 7. 拍照、上传与提交时序

```mermaid
sequenceDiagram
    actor U as 操作人员
    participant C as 检查页
    participant D as 设备能力
    participant S as session.js
    participant M as 图片上传API
    participant R as requestPost
    participant B as 检查API
    participant K as uni本地存储
    U->>C: 点击当前项上传
    C->>C: 检查每项最多10张和上传锁
    C->>D: chooseImage（仅相机）
    D-->>C: 临时路径数组
    C->>D: 文件大小 / 图片尺寸 / 压缩
    loop 逐张上传
        C->>S: 有 refresh token 时尝试预刷新
        C->>M: uploadFile，files[] + Bearer + lang
        alt 上传返回401且存在refresh token
            C->>S: refreshTokens()
            C->>M: 刷新成功后重试上传
        end
        M-->>C: uploaded_files[0]
    end
    C->>C: 全部成功后合并本批照片URL到步骤
    U->>C: 逐项选择结果并查看汇总
    U->>C: 点击提交并确认
    C->>C: 检查完成度、无人机、提交锁与指纹
    C->>R: createCheck(scope, drone_id, items, summary_note)
    R->>B: POST /dev-api/preflight/checks
    alt 提交成功
        B-->>C: 成功响应
        C->>C: hasSubmittedCurrent=true
        C->>K: 删除当前无人机草稿
        C-->>U: 上传成功提示
        C->>C: safeSwitchTab(历史Tab)
    else 提交失败
        B-->>C: HTTP / 业务 / 网络错误
        C-->>U: 弹窗显示错误，可再次提交
        Note over C,U: photo required for item_key 会转换为对应检查项提示
    end
```

上传和记录提交是两个独立请求阶段。上传批次任意一张失败时会跳出流程，当前代码静默捕获异常，本批已成功上传的 URL 也不会合并回步骤；提交失败则保留页面内容和已有照片 URL。

## 8. 历史、详情与删除时序

```mermaid
sequenceDiagram
    actor U as 操作人员
    participant H as 历史页
    participant D as 详情页
    participant R as request.js
    participant B as 外部后端
    participant K as uni本地存储
    H->>K: onShow读取草稿摘要，按ts倒序
    H->>R: GET checks(page=1,pageSize=10,drone_id可选)
    R->>B: 查询服务端历史
    B-->>H: list / total
    H->>H: 映射字段并计算hasMore
    opt 触底
        H->>R: GET checks(下一页)
        R->>B: 分页查询
        B-->>H: 追加记录
    end
    opt 应用ID筛选或下拉刷新
        H->>H: 清空列表，重置page=1并重新请求
    end
    U->>H: 点击历史记录
    H->>D: navigateTo(detail?id=编码后的ID)
    D->>R: GET checks/:id
    R->>B: 查询详情
    B-->>D: 记录与items
    D->>D: 建立结果/备注映射，汇总照片URL
    opt 点击照片
        D-->>U: uni.previewImage
    end
    U->>D: 点击删除并确认
    D->>R: DELETE checks/:id?reason=
    R->>B: 删除记录请求
    B-->>D: 成功
    D->>H: navigateBack，失败则切历史Tab
    H->>H: onShow重新加载服务端列表与本地草稿
```

本地草稿删除走另一条路径：确认后删除 `preflightDrafts[droneId]` 并刷新摘要，不向后端发送 DELETE。详情删除失败没有页面级错误捕获；当前详情加载失败则把 `detail` 置空显示 `-`。

## 9. 设置与退出

设置页先展示本地缓存，再按 JWT `sub` 请求最新资料；头像支持多个兼容字段并可预览。点击退出需确认；页面调用 `session.logout()`，不论其抛错与否都会显示成功提示并跳登录。

`session.logout()` 在没有 refresh token 时直接清本地会话；有 refresh token 时等待退出接口返回后清理，再检查 HTTP 错误。如果请求在网络层直接 reject，清理语句不会执行。该边界会导致页面提示与实际本地状态不一致，见[风险与建议](./04-findings.md)。

## 10. 源码定位

| 交互 | 文件与分析时行号 |
| --- | --- |
| 首页入口 | [首页](../pages/index/index.vue)，73 |
| 登录与记住密码 | [登录页](../pages/login/login.vue)，112、164 |
| 无人机确认 | [选择页](../pages/preflightSelectDrone/preflightSelectDrone.vue)，265 |
| 草稿模式消费 | [检查页](../pages/check/check.vue)，557 |
| 离开拦截 | [检查页](../pages/check/check.vue)，326、654、712 |
| 步骤/汇总切换 | [检查页](../pages/check/check.vue)，929、981、1005 |
| 提交确认 | [检查页](../pages/check/check.vue)，1247、1328 |
| 草稿继续与删除 | [历史页](../pages/preflightHistory/preflightHistory.vue)，222、229 |
| 详情删除 | [详情页](../pages/preflightHistoryDetail/preflightHistoryDetail.vue)，224 |
| 退出确认与会话清理 | [设置页](../pages/settings/settings.vue)，138；[session.js](../common/session.js)，467 |
