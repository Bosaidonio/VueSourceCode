import { inBrowser } from './env'

export let mark
export let measure

/**
 * 在非生产环境下，初始化性能标记和测量函数。
 */
if (process.env.NODE_ENV !== 'production') {
  // 获取浏览器的性能对象
  const perf = inBrowser && window.performance

  /* istanbul ignore if */
  /**
   * 检查性能 API 是否可用，并初始化 `mark` 和 `measure` 函数。
   * 如果性能 API 可用，则定义 `mark` 和 `measure` 函数用于性能标记和测量。
   */
  if (
    perf &&
    perf.mark &&
    perf.measure &&
    perf.clearMarks &&
    perf.clearMeasures
  ) {
    /**
     * 创建一个性能标记。
     *
     * @param {string} tag - 标记的名称。
     */
    mark = tag => perf.mark(tag)

    /**
     * 测量两个标记之间的时间差，并清除相关标记。
     *
     * @param {string} name - 测量项的名称。
     * @param {string} startTag - 开始标记的名称。
     * @param {string} endTag - 结束标记的名称。
     */
    measure = (name, startTag, endTag) => {
      perf.measure(name, startTag, endTag)
      perf.clearMarks(startTag)
      perf.clearMarks(endTag)
      // perf.clearMeasures(name)
    }
  }
}
