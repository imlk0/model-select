# Model Select

给自己做的编程模型选择工具。

模型越来越多，名字、价格和能力也总在变。每次配置 Claude Code 或 Codex 都重新翻一遍资料，太麻烦了。这个页面把我关心的数据放在一起，方便比较、选模型、复制代码。

**[打开 Model Select ↗](https://blog.imlk.top/model-select/)**

## 我用它做什么

- **Claude Code**：按 Fable、Opus、Sonnet、Haiku 查看替代模型，切换能力、速度或性价比；展开排名比较每档的前三个选择。
- **Codex**：按 Astra、Sol、Terra、Luna 四档查看替代模型，同样支持三种排序和展开排名。
- **查数据**：筛选模型，按任意表头排序，对比指标、价格和上下文。悬停查看详情，点击排名中的模型跳到数据表。

## 数据状态

目前页面默认展示**演示数据**，用于打磨选择流程和界面，数值与排名不代表真实测评结果。采集器已支持动态目录、价格、上下文与 AA 指标；需要配置采集密钥并完成真实接口验收，详见数据来源文档。

能力排序使用 AA Intelligence Index；速度看输出 tok/s；性价比按固定输入、输出用量的成本比较。Claude Code 和 Codex 均在各档候选中排序。GPT 档位用于任务定位，不代表模型能力已达到对应 GPT 水平。

---

[维护与部署](docs/maintenance.md) · [数据来源与可靠性](docs/data-sources.md)

GPT 档位名称与定位参考 [OpenAI 官方模型目录](https://developers.openai.com/api/docs/models/all)；Terra 对应 GPT-5.6，其他档位采用当前主推版本。
