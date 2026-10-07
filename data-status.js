(function (root) {
  function modelUpdateNotice(status, mode, now = Date.now()) {
    if (status?.execution === 'local') return null;
    const fallback = mode === 'demo' ? '当前展示演示数据，请勿据此选择模型。' : '当前展示已有快照，请核对快照时间。';
    if (!status || !['updated', 'partial', 'blocked', 'failed'].includes(status.status))
      return {title: '更新状态未知', detail: '暂时无法确认 CI 更新结果。' + fallback};
    const time = Date.parse(status.attempted_at);
    if (status.status !== 'updated') {
      const titles = {partial: '数据更新不完整', blocked: '数据更新受阻', failed: '数据更新失败'};
      const detail = status.status === 'partial' && mode !== 'demo' ? '部分来源采集失败，缺失指标未参与排名。' : fallback;
      return {title: titles[status.status], detail};
    }
    if (!Number.isFinite(time) || now - time > 48 * 60 * 60 * 1000)
      return {title: '数据更新已逾期', detail: '超过两个更新周期未收到成功记录，CI 可能未运行或发布失败。' + fallback};
    return null;
  }
  root.modelUpdateNotice = modelUpdateNotice;
  if (typeof module !== 'undefined') module.exports = modelUpdateNotice;
})(typeof window === 'undefined' ? globalThis : window);
