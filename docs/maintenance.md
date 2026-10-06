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
