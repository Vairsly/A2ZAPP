# A2ZApp 项目分析文档

分析日期：2026-11-03。分析对象：当前工作目录中的前端源码与配置。

A2ZApp 是基于 uni-app、Vue 3 的无人机飞前检查客户端。当前业务闭环是：账号登录 → 选择已分配无人机 → 完成 16 项检查并拍照 → 提交记录 → 查询和删除历史；未提交内容可以保存为本地草稿。

检查项已调整：电机与桨叶/机体合并，电池移至绞盘之前。填写、汇总与历史共用 `common/preflight.js` 的定义；A2ZDispatch 后端和 Web 端已同步，新提交使用 16 项及 `motorPropellerOk` 合并字段。后端兼容旧 17 项提交，旧草稿和历史记录支持合并显示。

| 文档 | 内容 |
| --- | --- |
| [01 项目结构](./01-project-structure.md) | 目录树、技术栈、模块职责、依赖图、启动与环境配置 |
| [02 数据流与接口](./02-data-flow.md) | 系统数据流图、上传链路、数据模型、接口清单、本地存储 |
| [03 页面与交互](./03-interactions.md) | 页面导航图、检查状态图、登录/鉴权/草稿/提交/删除时序图 |
| [04 风险与核查建议](./04-findings.md) | 源码中确认的问题、影响范围、建议及尚未验证的边界 |
| [05 前后端检查项同步](./05-preflight-backend-sync.md) | A2ZDispatch 实际接口调整、旧数据兼容、上线顺序与验证方式 |

## 阅读说明

- 图使用 Mermaid 编写，包含 `flowchart`、`sequenceDiagram` 和 `stateDiagram-v2`；请在支持 Mermaid 的 Markdown 阅读器中查看。
- 文档中的源码链接使用相对路径，方便在整个项目复制或迁移后继续访问；“源码定位”另给出分析时的行号。
- `PAGES.check` 指向历史列表 `/pages/preflightHistory/preflightHistory`；填写检查表的页面是 `PAGES.preflightCheck`，即 `/pages/check/check`。
- 图中的“后端 API / 图片服务”是前端代码引用的外部系统边界，不表示本目录包含相应服务实现。

## 分析范围与验证边界

已检查 7 个页面、1 个共享 Vue 组件、入口与应用生命周期、`common/` 公共模块、语言包及构建配置。`common/vendor/` 重点核对 JSEncrypt 加载链路；`unpackage/` 按生成产物处理，不以其中编译代码替代源码判断。

当前目录没有 `package.json`、依赖锁文件和后端源码。最初分析来自静态源码阅读，未启动应用、调用线上接口或执行删除等业务操作。后续已初始化 Git，并新增 `tests/preflight.test.mjs`，可通过 `node --test tests/preflight.test.mjs` 验证检查项调整与兼容逻辑。框架精确版本、接口真实响应、数据库结构、后端权限及软删除实现均需在相应环境核实。

最初分析仅新增文档；本文档随后已同步检查项调整。源码定位中的行号为最初分析快照，后续变更请按函数名定位。
