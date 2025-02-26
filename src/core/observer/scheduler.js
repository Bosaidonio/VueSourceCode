/* @flow */

import type Watcher from './watcher'
import config from '../config'
import { callHook, activateChildComponent } from '../instance/lifecycle'

import {
  warn,
  nextTick,
  devtools,
  inBrowser,
  isIE
} from '../util/index'

// 定义最大更新次数，用于防止在 watcher 更新过程中出现无限循环。
export const MAX_UPDATE_COUNT = 100;

// 定义一个队列数组，用于存储需要更新的 Watcher 实例。
const queue: Array<Watcher> = [];

// 定义一个数组，用于存储需要激活的子组件（通常与 keep-alive 相关）。
const activatedChildren: Array<Component> = [];

// 定义一个对象，用于记录队列中已经存在的 Watcher 实例的 id，避免重复添加。
let has: { [key: number]: ?true } = {};

// 定义一个对象，用于检测 Watcher 更新过程中的循环依赖问题。
// 在开发环境下会记录每个 Watcher 的触发次数。
let circular: { [key: number]: number } = {};

// 标志位，表示是否正在等待下一次微任务或宏任务中刷新队列。
let waiting = false;

// 标志位，表示当前是否正在刷新队列（即正在执行 Watcher 的更新操作）。
let flushing = false;

// 当前正在处理的 Watcher 索引，用于在刷新队列时跟踪进度。
let index = 0;

/**
 * 重置调度器的状态。
 * 该函数会在每次队列刷新完成后调用，清理所有状态，确保调度器可以重新开始工作。
 */
function resetSchedulerState() {
  // 将队列长度、激活子组件数组长度和索引重置为 0，清空队列和激活子组件数组。
  index = queue.length = activatedChildren.length = 0;

  // 清空 has 对象，表示队列中不再有 Watcher 实例。
  has = {};

  // 在非生产环境下，清空 circular 对象，用于检测循环依赖。
  if (process.env.NODE_ENV !== 'production') {
    circular = {};
  }

  // 将 waiting 和 flushing 标志位重置为 false，表示调度器已准备好接受新的任务。
  waiting = flushing = false;
}
// Async edge case #6566 requires saving the timestamp when event listeners are
// attached. However, calling performance.now() has a perf overhead especially
// if the page has thousands of event listeners. Instead, we take a timestamp
// every time the scheduler flushes and use that for all event listeners
// attached during that flush.
export let currentFlushTimestamp = 0

// Async edge case fix requires storing an event listener's attach timestamp.
let getNow: () => number = Date.now

// Determine what event timestamp the browser is using. Annoyingly, the
// timestamp can either be hi-res (relative to page load) or low-res
// (relative to UNIX epoch), so in order to compare time we have to use the
// same timestamp type when saving the flush timestamp.
// All IE versions use low-res event timestamps, and have problematic clock
// implementations (#9632)
if (inBrowser && !isIE) {
  const performance = window.performance
  if (
    performance &&
    typeof performance.now === 'function' &&
    getNow() > document.createEvent('Event').timeStamp
  ) {
    // if the event timestamp, although evaluated AFTER the Date.now(), is
    // smaller than it, it means the event is using a hi-res timestamp,
    // and we need to use the hi-res version for event listener timestamps as
    // well.
    getNow = () => performance.now()
  }
}

/**
 * 刷新队列并运行 Watcher。
 * 该函数会按照一定的顺序执行队列中的 Watcher，并在完成后调用相关的生命周期钩子。
 */
function flushSchedulerQueue() {
  // 获取当前时间戳，用于记录调度器刷新的时间。
  currentFlushTimestamp = getNow();

  // 标记调度器正在刷新队列（flushing 为 true）。
  flushing = true;

  let watcher, id;

  // 在刷新队列之前对队列进行排序。
  // 排序的目的是确保：
  // 1. 父组件的 Watcher 先于子组件的 Watcher 执行（因为父组件总是先于子组件创建）。
  // 2. 用户定义的 Watcher 先于渲染 Watcher 执行（因为用户 Watcher 总是先于渲染 Watcher 创建）。
  // 3. 如果某个组件在父组件的 Watcher 执行过程中被销毁，则其 Watcher 可以被跳过。
  queue.sort((a, b) => a.id - b.id);

  // 不缓存队列长度，因为在执行现有 Watcher 的过程中可能会有新的 Watcher 被添加到队列中。
  for (index = 0; index < queue.length; index++) {
    // 获取当前 Watcher。
    watcher = queue[index];

    // 如果 Watcher 定义了 before 钩子（例如 beforeUpdate 生命周期钩子），则调用它。
    if (watcher.before) {
      watcher.before();
    }

    // 获取当前 Watcher 的唯一标识符 id。
    id = watcher.id;

    // 将 has[id] 重置为 null，表示该 Watcher 已经被处理。
    has[id] = null;

    // 执行 Watcher 的 run 方法，触发更新逻辑。
    watcher.run();

    // 在开发环境下，检查是否存在循环更新问题。
    if (process.env.NODE_ENV !== 'production' && has[id] != null) {
      // 记录当前 Watcher 的触发次数。
      circular[id] = (circular[id] || 0) + 1;

      // 如果触发次数超过最大更新次数限制，则抛出警告并终止循环。
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          '可能存在无限更新循环 ' + (
            watcher.user
              ? `在表达式为 "${watcher.expression}" 的 Watcher 中`
              : `在组件的渲染函数中`
          ),
          watcher.vm
        );
        break;
      }
    }
  }

  // 在重置调度器状态之前，保存激活队列和更新队列的副本。
  const activatedQueue = activatedChildren.slice();
  const updatedQueue = queue.slice();

  // 重置调度器的状态，准备下一次调度。
  resetSchedulerState();

  // 调用组件的 activated 和 updated 生命周期钩子。
  callActivatedHooks(activatedQueue);
  callUpdatedHooks(updatedQueue);

  // 开发工具钩子：通知 devtools 当前调度器已完成刷新。
  /* istanbul ignore if */
  if (devtools && config.devtools) {
    devtools.emit('flush');
  }
}

/**
 * 调用组件实例的 updated 生命周期钩子。
 * 该函数会在 Watcher 队列刷新完成后调用，触发所有符合条件的组件的 updated 钩子。
 */
function callUpdatedHooks(queue) {
  // 从队列末尾开始遍历（倒序遍历）。
  let i = queue.length;
  while (i--) {
    // 获取当前 Watcher 实例。
    const watcher = queue[i];

    // 获取与当前 Watcher 关联的 Vue 组件实例。
    const vm = watcher.vm;

    // 检查以下条件：
    // 1. 当前 Watcher 是组件的渲染 Watcher（vm._watcher === watcher）。
    // 2. 组件已经挂载（vm._isMounted 为 true）。
    // 3. 组件未被销毁（!vm._isDestroyed）。
    if (vm._watcher === watcher && vm._isMounted && !vm._isDestroyed) {
      // 如果满足条件，调用组件的 updated 生命周期钩子。
      callHook(vm, 'updated');
    }
  }
}

/**
 * Queue a kept-alive component that was activated during patch.
 * The queue will be processed after the entire tree has been patched.
 */
export function queueActivatedComponent (vm: Component) {
  // setting _inactive to false here so that a render function can
  // rely on checking whether it's in an inactive tree (e.g. router-view)
  vm._inactive = false
  activatedChildren.push(vm)
}

function callActivatedHooks (queue) {
  for (let i = 0; i < queue.length; i++) {
    queue[i]._inactive = true
    activateChildComponent(queue[i], true /* true */)
  }
}

/**
 * 将一个 Watcher 推入 Watcher 队列。
 * 如果队列中已经存在相同 ID 的 Watcher，则会跳过，除非当前队列正在被刷新（flushing）。
 */
export function queueWatcher(watcher: Watcher) {
  // 获取当前 Watcher 的唯一标识符 id。
  const id = watcher.id;

  // 检查当前 Watcher 是否已经存在于队列中（通过 has 对象记录）。
  if (has[id] == null) {
    // 标记该 Watcher 已经被添加到队列中。
    has[id] = true;

    // 如果队列尚未开始刷新（flushing 为 false），直接将 Watcher 添加到队列末尾。
    if (!flushing) {
      queue.push(watcher);
    } else {
      // 如果队列正在刷新（flushing 为 true），需要根据 Watcher 的 id 插入到正确的位置。
      // 这是为了保证 Watcher 的执行顺序与其 id 的顺序一致（即按照创建顺序执行）。

      // 从队列末尾向前遍历，找到第一个 id 小于等于当前 Watcher id 的位置。
      let i = queue.length - 1;
      while (i > index && queue[i].id > watcher.id) {
        i--;
      }

      // 将当前 Watcher 插入到正确的位置。
      queue.splice(i + 1, 0, watcher);
    }

    // 如果当前没有等待刷新队列的任务（waiting 为 false），则安排一次队列刷新任务。
    if (!waiting) {
      waiting = true; // 标记已经开始等待刷新。

      // 在非生产环境下，如果配置了同步模式（config.async 为 false），立即刷新队列。
      if (process.env.NODE_ENV !== 'production' && !config.async) {
        flushSchedulerQueue();
        return;
      }

      // 否则，使用 nextTick 安排一次异步任务来刷新队列。
      nextTick(flushSchedulerQueue);
    }
  }
}
