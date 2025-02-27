/* @flow */
import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError,
  invokeWithErrorHandling,
  noop
} from '../util/index'
import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'
import type { SimpleSet } from '../util/index'

let uid = 0

/**
 * Watcher 类是 Vue 响应式系统的核心，负责解析表达式、收集依赖并在表达式值变化时触发回调。
 * 它用于 $watch() API 和指令（如 v-model、v-bind 等）。
 */
export default class Watcher {
  vm: Component; // 当前的 Vue 实例
  expression: string; // 被观察的表达式或函数的字符串形式
  cb: Function; // 当被观察的值发生变化时执行的回调函数
  id: number; // Watcher 的唯一标识符，用于批量更新
  deep: boolean; // 是否深度监听对象内部的变化
  user: boolean; // 是否是用户定义的 watcher（通过 $watch 创建）
  lazy: boolean; // 是否是惰性 watcher（用于计算属性）
  sync: boolean; // 是否同步执行更新
  dirty: boolean; // 仅适用于惰性 watcher，表示是否需要重新计算值
  active: boolean; // 表示当前 watcher 是否处于激活状态
  deps: Array<Dep>; // 当前 watcher 所依赖的 Dep 对象数组
  newDeps: Array<Dep>; // 新一轮依赖收集中的 Dep 对象数组
  depIds: SimpleSet; // 当前 watcher 所依赖的 Dep 对象 ID 集合
  newDepIds: SimpleSet; // 新一轮依赖收集中的 Dep 对象 ID 集合
  before: ?Function; // 在 watcher 更新之前执行的钩子函数
  getter: Function; // 用于获取被观察值的函数
  value: any; // 被观察的值

  /**
   * 构造函数，初始化一个 Watcher 实例。
   * @param {Component} vm - Vue 实例
   * @param {string | Function} expOrFn - 被观察的表达式或函数
   * @param {Function} cb - 当值变化时的回调函数
   * @param {Object} options - 可选配置项，包括 deep、user、lazy、sync 等
   * @param {boolean} isRenderWatcher - 是否是渲染 watcher
   */
  constructor (
    vm: Component,
    expOrFn: string | Function,
    cb: Function,
    options?: ?Object,
    isRenderWatcher?: boolean
  ) {
    this.vm = vm
    if (isRenderWatcher) {
      vm._watcher = this // 如果是渲染 watcher，则将其赋值给 vm._watcher
    }
    vm._watchers.push(this) // 将当前 watcher 添加到 vm._watchers 数组中

    // 初始化选项
    if (options) {
      this.deep = !!options.deep // 是否深度监听
      this.user = !!options.user // 是否是用户定义的 watcher
      this.lazy = !!options.lazy // 是否是惰性 watcher
      this.sync = !!options.sync // 是否同步更新
      this.before = options.before // 更新前的钩子函数
    } else {
      this.deep = this.user = this.lazy = this.sync = false // 默认值
    }

    this.cb = cb // 回调函数
    this.id = ++uid // 唯一标识符
    this.active = true // 激活状态
    this.dirty = this.lazy // 惰性 watcher 的 dirty 状态
    this.deps = [] // 依赖的 Dep 对象数组
    this.newDeps = [] // 新一轮依赖收集中的 Dep 对象数组
    this.depIds = new Set() // 依赖的 Dep 对象 ID 集合
    this.newDepIds = new Set() // 新一轮依赖收集中的 Dep 对象 ID 集合

    // 记录表达式的字符串形式，仅在开发环境下生效
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''

    // 解析表达式为 getter 函数
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn // 如果是函数，直接赋值
    } else {
      this.getter = parsePath(expOrFn) // 如果是字符串路径，解析为 getter 函数
      if (!this.getter) {
        this.getter = noop // 如果解析失败，使用空函数
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }

    // 如果不是惰性 watcher，立即求值并收集依赖
    this.value = this.lazy
      ? undefined
      : this.get()
  }

  /**
   * 执行 getter 函数以获取值，并重新收集依赖。
   * @returns {*} 被观察的值
   */
  get () {
    pushTarget(this) // 将当前 watcher 设置为全局的 Dep.target
    let value
    const vm = this.vm
    try {
      value = this.getter.call(vm, vm) // 调用 getter 获取值
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`) // 处理用户定义 watcher 的错误
      } else {
        throw e // 抛出非用户定义 watcher 的错误
      }
    } finally {
      // 如果是深度监听，递归遍历所有属性以确保它们都被追踪为依赖
      if (this.deep) {
        traverse(value)
      }
      popTarget() // 清除全局变量Dep.target的Watcher实例，或取回上一次的watcher实例
      this.cleanupDeps() // 清理旧的依赖
    }
    return value
  }

  /**
   * 添加一个新的依赖（Dep）到当前 watcher。
   * @param {Dep} dep - 要添加的依赖
   */
  addDep (dep: Dep) {
    const id = dep.id
    if (!this.newDepIds.has(id)) { // 如果新依赖集合中没有该依赖
      this.newDepIds.add(id) // 添加到新依赖集合
      this.newDeps.push(dep) // 添加到新依赖数组
      if (!this.depIds.has(id)) { // 如果旧依赖集合中也没有该依赖
        dep.addSub(this) // 将当前 watcher 添加到依赖的订阅者列表
      }
    }
  }

  /**
   * 清理旧的依赖，保留新的依赖。
   */
  cleanupDeps () {
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) { // 如果旧依赖不在新依赖集合中
        dep.removeSub(this) // 从旧依赖的订阅者列表中移除当前 watcher
      }
    }
    // 交换新旧依赖集合和数组
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()

    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * 当依赖发生变化时，触发更新。
   */
  update () {
    /* istanbul ignore else */
    if (this.lazy) {
      this.dirty = true // 惰性 watcher 标记为 dirty
    } else if (this.sync) {
      this.run() // 同步更新，立即执行回调
    } else {
      queueWatcher(this) // 异步更新，将 watcher 加入调度队列
    }
  }

  /**
   * 执行回调函数，处理值的变化。
   */
  run () {
    if (this.active) {
      const value = this.get() // 获取最新的值
      if (
        value !== this.value || // 值发生变化
        isObject(value) || // 值是对象或数组
        this.deep // 深度监听
      ) {
        const oldValue = this.value
        this.value = value // 更新值
        if (this.user) {
          const info = `callback for watcher "${this.expression}"`
          invokeWithErrorHandling(this.cb, this.vm, [value, oldValue], this.vm, info) // 用户定义的回调函数，捕获错误
        } else {
          this.cb.call(this.vm, value, oldValue) // 非用户定义的回调函数，直接调用
        }
      }
    }
  }

  /**
   * 触发计算属性的 getter时，会调用该函数
   */
  evaluate () {
    this.value = this.get() // 获取最新值
    this.dirty = false // 标记为已计算
  }

  /**
   * 让当前 watcher 依赖的所有 Dep 对象都重新收集依赖。
   */
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend() // 调用每个 Dep 对象的 depend 方法
    }
  }

  /**
   * 销毁当前 watcher，移除所有依赖关系。
   */
  teardown () {
    if (this.active) {
      // 如果 Vue 实例未被销毁，从实例的 watcher 列表中移除当前 watcher
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this) // 从每个依赖的订阅者列表中移除当前 watcher
      }
      this.active = false // 标记为非激活状态
    }
  }
}
