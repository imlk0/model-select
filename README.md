# Model Select

一个面向 CC Switch / Claude Code 用户的百炼模型选择站：根据公开 benchmark、百炼官方价格和速度数据，用固定公式推荐 Fable / Opus / Sonnet / Haiku 的能力最优、速度最优和性价比最优模型。

## 架构

- 前端：纯静态 HTML/CSS/JS
- 数据：`data/models.json` + `data/recommendations.json`
- 评分：`config/scoring.json`
- 每日更新：GitHub Actions → `scripts/update.py`
- Benchmark：Artificial Analysis Free API（可选，需要 API Key）
- 百炼：价格、model code、context 等硬事实保存在 `models.json`；后续 collector 可自动同步官方文档

## 本地预览

```bash
python3 -m http.server 8080
```

打开 `http://localhost:8080`。

## GitHub Pages 部署

1. 新建 GitHub 仓库并上传本目录。
2. Settings → Pages → Build and deployment → Deploy from a branch。
3. 选择 `main` / `/ (root)`。
4. 如果需要自动 benchmark：在 Settings → Secrets and variables → Actions 中新增：
   - `ARTIFICIAL_ANALYSIS_API_KEY`
5. Actions 每天 02:17（中国时间）自动刷新数据。

## Cloudflare Pages / Vercel

这是纯静态站：

- Build command：留空
- Output directory：`.`
- Root directory：仓库根目录

## 为什么第一版不使用 Agent / LLM

排名必须可复现。价格、速度和 benchmark 均来自结构化数据；评分由代码按固定权重计算。AI 以后只作为可选的“解释层”，不参与基础排名。

## 数据安全策略

- 缺失字段显示 N/A，不补猜。
- 证据覆盖不足的模型不自动进入主排名。
- API/抓取失败时保留上一次结果，不用空数据覆盖生产结果。
- 百炼价格与 model code 需要保留官方来源 URL 和更新时间（下一版会拆成独立 provenance 字段）。

## 下一步建议

1. 增加 `collectors/bailian.py`：自动同步百炼价格与新模型列表。
2. 完善 Artificial Analysis 的模型 ID 映射，不依赖展示名。
3. 加入 LiveBench / Terminal-Bench adapter（仅在有稳定可再分发接口时）。
4. 新增 `config/codex.json`，复用同一数据层支持 Codex。
5. 输出 CC Switch 可复制配置片段。
