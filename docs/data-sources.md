# 数据来源与可靠性

## 动态采集

模型集合来自百炼 `GET /api/v1/models`，分页到 `output.total`。查询文本生成、百炼推理供应商、中国部署模式；每次成功返回的目录重建模型集合，不保留旧的固定八模型清单。新增模型自动进入数据表，下架模型从当前目录移除。目录返回并不证明账户有权限调用或该模型适用于 Claude Code/Codex。

默认使用旧入口 `https://dashscope.aliyuncs.com/api/v1/models`，无需业务空间 ID。仓库 Actions secret 为 `DASHSCOPE_API_KEY`；可选 variable `BAILIAN_MODELS_ENDPOINT` 可覆盖为北京工作空间入口。旧域名已验证可访问，未认证返回 401；仍需有权限的密钥才能验收返回内容。当前采集中国部署模式，人民币价格；不把入口迁移当成模型变更，也不推断其他部署模式的价格相同。

benchmark：Actions secret `ARTIFICIAL_ANALYSIS_API_KEY`。使用 AA 免费接口 `/api/v2/language/models/free`，按 `pagination.has_more` 获取所有页。保留 Intelligence Index 版本。无 key 或采集失败仍可发布真实百炼目录，但 benchmark 留空，CI 报 partial 并失败，不能冒充完整更新。

| 字段 | 来源 | 处理规则 |
| --- | --- | --- |
| 名称、code、工具调用能力 | 百炼模型目录 | 保留精确 model ID、features |
| 上下文 | `model_info.context_window` | token / 1000；null 不猜 |
| 输入、输出价格 | `prices` | 选择 10k 输入对应的唯一分段或 Default，保留完整分段；只接收标准输入、输出人民币每百万 token，未知或重叠区间留空 |
| 综合能力 | AA `evaluations.artificial_analysis_intelligence_index` | 原值及版本，能力排序采用该指标 |
| Coding | AA `evaluations.artificial_analysis_coding_index` | 原值，不拿 LiveCodeBench 替代 |
| Agentic | AA `evaluations.artificial_analysis_agentic_index` | 原值，不拿 Terminal-Bench 替代 |
| 速度 | AA `performance.median_output_tokens_per_second` | 免费端点默认测量口径；跨供应商中位数，不是百炼实测 |
| 性价比 | 能力 /（输入单价 × 0.01 + 输出单价 × 0.002） | 对应 10k 输入 + 2k 输出；任一字段缺失不排名 |
| 字段完整率 | 六类字段是否有值 | 不代表可信度或成功率 |

## 模型映射

百炼 ID/快照 ID 与 AA slug 仅按大小写和标点规范化作严格匹配。不去掉模型版本、thinking/high 等后缀；歧义不匹配。需要人工确认的例外记录在 `config/model-mappings.json`，格式为 `{ "百炼code": { "aa_id": "稳定AA ID" } }`。映射审核必须核对模型版本与推理设置；不能只看品牌相同。

## 分档与局限

已匹配综合能力且目录确认 function-calling 的模型，按 AA 综合能力排序分为四个四分位候选池。Claude 和 Codex 目前共用这些池；这是公开的任务分层启发式，不是对 Claude/GPT 官方模型的等效测评。缺失指标只影响相应排序，不强制凑三个候选。

这仍不能证明第三方模型在具体工具内的效果或协议兼容性。尚未实现百炼端点速度实测与工具内任务评测；目录和上下文不是实际调用成功证明。分段价格只覆盖明确的输入 token 区间，其他计费规则不猜。

## 发布与追溯

`data/raw/` 保存最近成功采集的完整响应（不保存请求 headers 或密钥）；每个模型 provenance 保存来源、采集时间、provider ID、实际查询端点、AA ID 和指标版本。

`data/update-status.json` 区分 updated / partial / blocked / failed。采集失败保留上次发布快照；目录成功但 benchmark 失败发布目录与空指标，不挪用上一版指标。GitHub Actions 即使失败也提交状态报告，状态不能伪装成功。

网页只接受 schema v2 的核实目录快照，允许指标缺失。缓存使用独立 v2 key，不能把旧初始数据当成可信快照。尚无真实目录时加载独立演示数据，并显示顶部警告；真实快照中的空字段不会被演示值填补。

## 当前验收状态

旧域名目录已完成真实采集验证，动态模型、价格和上下文均来自接口响应。AA 采集尚未通过验收，相关指标保持空值，不生成评测排名。测试 fixture 与文档示例不进入发布数据。网页顶部显示 CI 部分更新或失败提示，超过 48 小时未收到成功记录时显示逾期提示。

官方文档：[百炼模型目录](https://help.aliyun.com/zh/model-studio/list-models)、[AA Data API](https://artificialanalysis.ai/data-api/docs)。
