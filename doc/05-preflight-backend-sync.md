# 飞前检查项前后端同步

返回：[文档入口](./README.md)

## 1. 当前接口约定

App、A2ZDispatch Web 和后端均使用 16 项检查。第三项为 `motorPropellerOk`，显示“电机/桨叶/机体完好”；第 10 项为 `batteryOk`，第 11 项为 `winchOk`。其他项目顺序见[检查项清单](./02-data-flow.md#5-检查模板与校验)。

App 此前采用的“显示 16 项、提交展开为 17 项”过渡处理已移除，现在直接提交 16 项，后端也存储 16 条检查明细。

## 2. A2ZDispatch 修改位置

A2ZDispatch 位于 WSL 的 `/root/tannuo/A2ZDispatch`。

| 文件（相对于 A2ZDispatch） | 职责 |
| --- | --- |
| `services/backend/project/api/preflight/items.py` | 16 项模板、已存旧模板的内存适配、旧两项合并、新旧请求校验 |
| `services/backend/project/api/preflight/services.py` | 新建/更新使用统一校验，详情按新顺序返回，列表备注和统计合并 |
| `services/frontend/ui/src/utils/preflightItems.js` | Web 显示顺序、历史与草稿旧数据合并 |
| `services/frontend/ui/src/utils/preflightDraft.js` | 新草稿版本 2，按旧步骤 key 恢复位置 |
| `services/frontend/ui/src/utils/preflightItemDemos.js` | 合并项使用原桨叶示例图 |
| `services/frontend/ui/src/lang/{zh,en}.json` | 合并标题及说明，保留 Web 原有的电机与桨叶检查要求 |

Web 原有的只读开关未调整。本次不执行部署或修改线上数据库。

## 3. 兼容策略

- 新请求为 16 项，电机与桨叶共用一个结果、备注和照片数组。
- 后端继续接受旧 17 项请求；原两项分别完成布尔值、必拍照片及最多 10 张校验后再合并，避免漏项或无效输入被合并掩盖。
- 请求同时带合并字段与原字段时拒绝，避免结果冲突。只带旧两项之一时视为缺项。
- 旧记录在读取时合并，两项都通过才显示通过；备注和照片去重保留。列表中的不通过项数、照片数与合并后的明细一致。
- 已存标准 17 项模板在内存中升级为 16 项，保留模板 ID，标记有效版本；不批量修改模板和历史行。不属于标准检查项集合的自定义模板不进行这种升级。
- App、Web 旧草稿均按检查项 key 恢复位置，避免合并和调序造成步骤错位；合并照片不静默截断。
- 新格式每项最多 10 张照片。旧两项合计超过 10 张的草稿可继续查看与编辑，按新格式提交前需要删除多余照片；旧请求则仍按原两项各最多 10 张处理。

数据库字段 `item_key` 已能存储合并键，不需要新增表或列。后端应先更新，再发布使用新字段的 App；这不是已经执行的上线动作。

## 4. 验证方式

App 目录：

```powershell
node --test tests/preflight.test.mjs
```

A2ZDispatch 后端目录：

```sh
python3 -m unittest discover -s tests -p test_preflight_items.py -v
```

A2ZDispatch Web 目录（Node 版本需支持内置 test runner）：

```sh
node --test tests/preflight-items.test.cjs
node node_modules/eslint/bin/eslint.js src/utils/preflightItems.js src/utils/preflightDraft.js src/utils/preflightItemDemos.js
```

后端测试隔离 ORM 和会话边界，验证实际服务函数及校验逻辑，不需要启动 Flask、数据库或图片服务。测试不替代真实 HTTP、数据库持久化及真机联调。

本次验证结果：App 8 项、Web 6 项、后端 15 项测试全部通过，共 29 项；三端检查项 key、顺序和照片必填规则一致，Web 修改文件 ESLint 检查通过，后端代码通过 Python 3.9 语法检查。
