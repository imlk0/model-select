# 维护指南

## 本地预览

在仓库根目录运行 `python3 -m http.server 8080`，打开 `http://localhost:8080`。

这是静态网站，不需要安装前端依赖或构建。

## 文件职责

| 文件 | 用途 |
| --- | --- |
| `index.html` / `styles.css` / `app.js` | 页面、样式与交互 |
| `data/models.json` | 模型代码、区域价格、上下文与收录指标 |
| `data/recommendations.json` | 各档位的选择参考 |
| `config/scoring.json` | 评分权重与证据门槛 |
| `scripts/update.py` | 更新 benchmark 并计算推荐 |

## 数据更新

GitHub Actions 每天北京时间 02:17 运行，也可在 Actions 中手动触发。

在仓库 Settings → Secrets and variables → Actions 添加 `ARTIFICIAL_ANALYSIS_API_KEY`，启用 Artificial Analysis 数据接入。不要把密钥写入源码。

百炼价格目前维护在 `data/models.json`，尚未接入自动采集。发布新数据前核对供应商价格、区域和 model code。缺失 benchmark 保留 `null`，前端显示 N/A；证据不足时应明确标记推荐状态。

现有数据仅提供来源标签，后续需要增加来源 URL、采集时间和稳定模型 ID 映射。API 更新成功不代表百炼价格也已更新。

## 发布

仓库：`imlk0/model-select`。GitHub Pages 从 `main` 的根目录部署。推送变更后，在 Actions 检查 `pages build and deployment`。

公开地址：https://blog.imlk.top/model-select/

## 任务表排序与配置字段

Subagent 与默认兜底指导在任务表下展示，前端不再读取旧的 `config/claude-code-fields.json` 示例。三种排序限定于各档位候选，不是全站排行榜。缺失指标的模型以未排序候选补足每格三个模型，不显示名次。Coding 与 Agentic 必须来自可比较的同一量纲，核实后设置 `scores.comparable_scale: true`，前端才计算均值。不要把不同 benchmark 的原始值直接合并。性价比使用均值 /（10,000 输入 + 2,000 输出 token 的费用）。这是一项展示比较指标，与旧的角色综合评分不同。
