/* @flow */
// 全局配置对象
import config from '../config'
// 为开发环境创建代理对象，用于捕获未定义属性的访问错误。
import { initProxy } from './proxy'
// 初始化数据响应式系统（data、props、computed、watch 等）
import { initState } from './state'
// 初始化渲染相关的内容（如 $slots、$scopedSlots 等）。
import { initRender } from './render'
// 初始化事件
import { initEvents } from './events'
// 用于性能监控，标记和测量初始化时间
import { mark, measure } from '../util/perf'
// 初始化生命周期以及调用生命周期钩子
import { initLifecycle, callHook } from './lifecycle'
// 处理依赖注入（provide 和 inject）
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0

// 定义 initMixin 函数，用于为 Vue 原型添加 _init 方法
export function initMixin (Vue: Class<Component>) {
  // 在 Vue 原型上定义 _init 方法，每个 Vue 实例创建时都会调用此方法进行初始化
  Vue.prototype._init = function (options?: Object) {
    const vm: Component = this // 当前 Vue 实例的引用
    vm._uid = uid++ // 为每个实例分配一个唯一的标识符

    let startTag, endTag
    /* istanbul ignore if */
    // 如果处于开发环境且启用了性能监控，则记录性能标记
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}` // 性能标记的开始标签
      endTag = `vue-perf-end:${vm._uid}` // 性能标记的结束标签
      mark(startTag) // 记录性能开始标记
    }

    // 设置 _isVue 标志位，避免 Vue 实例被响应式系统观察
    vm._isVue = true

    // 合并选项（用户传入的 options 和构造函数上的选项）
    if (options && options._isComponent) {
      // 如果是内部组件实例，优化选项合并过程
      initInternalComponent(vm, options)
    } else {
      // 否则，合并构造函数选项和用户传入的选项
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor), // 获取构造函数上的选项
        options || {}, // 用户传入的选项
        vm // 当前实例
      )
    }

    /* istanbul ignore else */
    // 在开发环境中，为实例设置代理，用于警告未定义的属性访问
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      // 在生产环境中，直接将 _renderProxy 设置为实例本身
      vm._renderProxy = vm
    }

    // 暴露真实实例，方便在某些场景下访问原始实例
    vm._self = vm

    // 初始化生命周期相关的属性（如 $parent、$root、$children 等）
    initLifecycle(vm)

    // 初始化事件系统，处理父组件传递的监听器
    initEvents(vm)

    // 初始化渲染相关的属性（如 $slots、$scopedSlots 等）
    initRender(vm)

    // 调用 beforeCreate 生命周期钩子，此时响应式系统尚未初始化
    callHook(vm, 'beforeCreate')

    // 初始化 inject 注入的内容（在 data/props 之前解析）
    initInjections(vm)

    // 初始化响应式系统的核心部分（data、props、computed、watch 等）
    initState(vm)

    // 初始化 provide 提供的内容（在 data/props 之后解析）
    initProvide(vm)

    // 调用 created 生命周期钩子，此时响应式系统已经初始化完成
    callHook(vm, 'created')

    /* istanbul ignore if */
    // 如果启用了性能监控，则记录性能结束标记，并测量初始化耗时
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false) // 格式化组件名称
      mark(endTag) // 记录性能结束标记
      measure(`vue ${vm._name} init`, startTag, endTag) // 测量初始化耗时
    }

    // 如果用户指定了 el 属性，则自动挂载到指定的 DOM 元素上
    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}
export function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode

  const vnodeComponentOptions = parentVnode.componentOptions
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

export function resolveConstructorOptions (Ctor: Class<Component>) {
  let options = Ctor.options
  if (Ctor.super) {
    const superOptions = resolveConstructorOptions(Ctor.super)
    const cachedSuperOptions = Ctor.superOptions
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}

function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
