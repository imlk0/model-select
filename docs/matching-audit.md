# 模型匹配审计

研究范围为近期发布、适合编程或工具调用的模型。外部发布信息用于核对身份与版本，不直接写入测评分数。以下结果来自仓库保留的百炼 123 个文本模型与 Artificial Analysis 691 条记录。

| 模型 | 缺失原因与处理 |
| --- | --- |
| Qwen3.8 Max、27B、2.4T-A95B | 已匹配，三项指标都有值。Max 的 0902 快照也通过 AA 展示名称中的日期确认。 |
| Kimi K3 | 已匹配，三项指标都有值。AA 同时包含 Low 与 Max，不能任意合并推理档位。 |
| GLM-5.3 Prime | 百炼声明为基础型号高速版本，AA 没有独立 Prime 测评。引用基础型号能力指标，速度留空，不把基础速度当作提速版速度。 |
| GLM-5.2 Fast Preview | 同样有百炼高速版本声明，已由通用关系识别补上能力指标。 |
| DeepSeek V4 Flash 0731、V4 Pro 0813 | AA 展示名称含日期，slug 不含日期。此前仅比完整名称导致漏匹配，已补上快照身份识别。 |
| DeepSeek V4.1 Flash | 已匹配。API 中 Coding、Agentic 两个字段为 null，不是漏匹配；综合能力与速度有值。 |
| Qwen3.8 Flash | AA 有相近的 Flash-Next，但名称和规格并不相同。没有足够证据证明等效，保持空值并列入核对候选。 |
| Qwen3.7 Max 日期快照与 Preview | AA 有基础 Max，未提供足以确认这些版本等效的名称或快照信息。保持空值，不能删除日期或 Preview 后套分。 |
| Qwen3.6 Flash、Qwen3.7 Flash | 这份 AA 响应没有确认对应条目。相似品牌或参数量不能替代身份确认。 |

优化后的匹配数为 51 / 123；综合能力有值 51 个，Coding 28 个，Agentic 24 个。支持工具调用的 79 个目录模型中，38 个有综合能力参考。这个覆盖范围不能被解释为完整市场排名。

匹配顺序为规范化 ID、完整名称及有证据的快照名称、供应商明确描述的高速版本关系。Thinking/Reasoning 按模式同义词处理。字符串相似度只用于找候选，版本、规模和推理档位不相同的候选不会自动填分。生产流程不读取人工模型 ID 映射。

候选范围使用各档位最新官方参考模型的分数，不按目录四分位划分。排名前三项按 AA 测评身份去重，避免三个名称实为同一测评。空指标不按零分排名。综合能力分档仍是启发式，不能证明实际编程任务表现；缺少 Coding/Agentic 时不会编造这些分数。

每次采集生成 `data/matching-audit.json`，包含全部模型的状态、缺失指标与相近候选。回放旧响应验证解析器时保留原采集时间，不冒充新的 CI 成功采集。

参考来源：

- [Qwen 官方模型说明](https://github.com/QwenLM/Qwen3.8/blob/main/README.md)：新系列强化编程与长程任务，并支持调整推理深度。
- [Moonshot 官方首页](https://www.moonshot.ai/en)：Kimi K3 的长上下文、编程与推理定位。
- [GLM-5.3 测评](https://artificialanalysis.ai/models/glm-5-3)：对应的具体推理版本。
- [DeepSeek V4.1 Flash 发布说明](https://www.deepseek.com/en/news/deepseek-v4-1-flash/)：2026 年 9 月发布，原厂 API 存在旧型号路由变化。这不证明百炼同步改变路由。
- [Qwen3.8 Flash-Next 测评](https://artificialanalysis.ai/models/qwen3-8-flash-next)：不能仅凭近似名称视为百炼 Flash。
- [Artificial Analysis API 文档](https://artificialanalysis.ai/data-api/docs)：null 表示未测量或不适用；免费接口包含 Coding、Agentic，缺失不能一概归因于订阅权限。
