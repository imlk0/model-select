# 维护与部署

本地运行 `python3 -m http.server 8080`，打开 `http://127.0.0.1:8080`。静态网站，无构建依赖。

数据源、字段口径、动态目录、密钥配置、发布策略和未完成项见 [数据来源与可靠性](data-sources.md)。

更新入口为 `scripts/update.py`，CI 每天北京时间 02:17 运行，也可手动触发。凭据只能放在 Actions secrets。真实目录缺失时更新必须失败，不允许演示数据进入采集输出。

验证：`python3 -m unittest discover -s tests -v`，以及 `node --check app.js`。

站点从 main 根目录发布：[model-select](https://github.com/imlk0/model-select) / [网站](https://blog.imlk.top/model-select/)。

`config/scoring.json` 是旧权重配置，当前 v2 不读取；Subagent/默认兜底提示属于界面指导，旧 `config/claude-code-fields.json` 不参与数据采集。
