# Model Select

**用数据选模型。** 为 Claude Code 等编程工具提供模型选择参考，将能力、速度、价格与证据完整度放到同一张表里。

[打开网站 →](https://blog.imlk.top/model-select/)

## 怎么用

1. 按任务选择档位：Fable / Opus 面向复杂任务，Sonnet 面向日常开发，Haiku 面向轻量任务。
2. 比较能力、速度和成本，再检查证据覆盖率。
3. 点击 model code 复制，在你的工具中配置。

## 数值怎么看

| 指标 | 含义 |
| --- | --- |
| 能力 / Coding / Agentic | 已收录的 benchmark 指标，缺失显示 N/A |
| 输出速度 | 每秒输出 token 数（tok/s） |
| 输入 / 输出价格 | 人民币 / 百万 token，当前展示百炼北京区域价格 |
| 上下文 | 模型上下文窗口，单位 K tokens |
| 证据覆盖 | 已收录证据的完整程度，不代表成功率 |

当前版本的 benchmark 数据尚不完整。推荐是初始参考，不应视为经过完整跑分验证的排名；缺失数值不会用估计值填充。价格和可用性以供应商最新信息为准。

目前支持 Claude Code，后续扩展其他编程工具。

---

[维护与部署说明](docs/maintenance.md) · [评分配置](config/scoring.json)
