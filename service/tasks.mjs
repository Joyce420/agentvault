export function parseTask(task, content = '') {
  if (typeof task !== 'string' || !task.trim() || task.length > 500) throw new Error('请输入任务，最多 500 字。');
  if (typeof content !== 'string' || content.length > 10000) throw new Error('任务内容最多 10000 字。');
  const name = task.trim();
  if (/json/i.test(name)) {
    if (!content.trim()) throw new Error('请在任务内容中粘贴需要检查的 JSON。');
    return { type: 'json', description: 'JSON 格式检查', task: name, content };
  }
  if (/统计|字数|字符|文本|word|count/i.test(name)) {
    if (!content.trim()) throw new Error('请在任务内容中粘贴需要统计的文本。');
    return { type: 'text', description: '文本统计', task: name, content };
  }
  if (/天气|weather/i.test(name)) {
    if (!/上海|shanghai/i.test(name)) throw new Error('天气任务目前只支持上海固定样例，请输入“获取上海天气样例”。');
    return { type: 'weather', description: '上海天气固定样例', task: name, content: '' };
  }
  throw new Error('暂不支持这个任务。可输入：获取上海天气样例、统计文本字数、检查 JSON 格式。不会发起付款。');
}

export function executeTask(job) {
  if (job.type === 'text') return { task: job.task, characters: [...job.content].length, charactersWithoutWhitespace: [...job.content.replace(/\s/g, '')].length, lines: job.content.split(/\r\n|\r|\n/).length };
  if (job.type === 'json') {
    try { const value = JSON.parse(job.content); return { task: job.task, valid: true, formatted: JSON.stringify(value, null, 2) }; }
    catch (error) { return { task: job.task, valid: false, message: error.message }; }
  }
  return { task: job.task, city: 'Shanghai', outlook: '晴转多云', temperatureC: 24, note: '固定样例，并非实时天气预报。' };
}
