/* @flow */

import VNode from './vnode'
import { resolveConstructorOptions } from 'core/instance/init'
import { queueActivatedComponent } from 'core/observer/scheduler'
import { createFunctionalComponent } from './create-functional-component'

import {
  warn,
  isDef,
  isUndef,
  isTrue,
  isObject
} from '../util/index'

import {
  resolveAsyncComponent,
  createAsyncPlaceholder,
  extractPropsFromVNodeData
} from './helpers/index'

import {
  callHook,
  activeInstance,
  updateChildComponent,
  activateChildComponent,
  deactivateChildComponent
} from '../instance/lifecycle'

import {
  isRecyclableComponent,
  renderRecyclableComponentTemplate
} from 'weex/runtime/recycle-list/render-component-template'

// inline hooks to be invoked on component VNodes during patch
const componentVNodeHooks = {
  /**
   * 初始化组件实例。
   *
   * 该函数是 Vue 内部生命周期钩子的一部分，用于初始化虚拟节点（vnode）对应的组件实例。
   * 如果组件被 `<keep-alive>` 包裹且未被销毁，则直接调用 `prepatch` 钩子进行更新；
   * 否则，创建一个新的组件实例并挂载到 DOM 中。
   *
   * @param {VNodeWithData} vnode - 当前的虚拟节点，包含组件的相关数据。
   * @param {boolean} hydrating - 是否是服务端渲染的 hydration 场景。
   * @returns {?boolean} - 返回值通常为 undefined，但在某些情况下可能返回布尔值。
   */
  init (vnode: VNodeWithData, hydrating: boolean): ?boolean {
    /**
     * 检查是否是被 <keep-alive> 缓存的组件。
     * 如果满足以下条件：
     * 1. 虚拟节点已经有一个组件实例（componentInstance）。
     * 2. 该组件实例未被销毁（_isDestroyed 为 false）。
     * 3. 启用了 keep-alive（data.keepAlive 为 true）。
     * 则认为这是一个被缓存的组件，直接调用 prepatch 钩子进行更新。
     */
    if (
      vnode.componentInstance &&
      !vnode.componentInstance._isDestroyed &&
      vnode.data.keepAlive
    ) {
      // 对于被 <keep-alive> 缓存的组件，直接调用 prepatch 钩子进行更新
      const mountedNode: any = vnode // 绕过 Flow 类型检查
      componentVNodeHooks.prepatch(mountedNode, mountedNode)
    } else {
      /**
       * 创建一个新的组件实例。
       * 如果不是被 <keep-alive> 缓存的组件，则需要创建一个新的组件实例。
       */
      const child = vnode.componentInstance = createComponentInstanceForVnode(
        vnode,       // 当前的虚拟节点
        activeInstance // 当前激活的 Vue 实例（父级上下文）
      )

      /**
       * 挂载组件实例。
       * 调用 $mount 方法将组件挂载到 DOM 中。
       * 如果是 hydration 场景，则传入现有的 DOM 元素（vnode.elm），否则不传入。
       */
      child.$mount(hydrating ? vnode.elm : undefined, hydrating)
    }
  },

  prepatch (oldVnode: MountedComponentVNode, vnode: MountedComponentVNode) {
    const options = vnode.componentOptions
    const child = vnode.componentInstance = oldVnode.componentInstance
    updateChildComponent(
      child,
      options.propsData, // updated props
      options.listeners, // updated listeners
      vnode, // new parent vnode
      options.children // new children
    )
  },

  insert (vnode: MountedComponentVNode) {
    const { context, componentInstance } = vnode
    if (!componentInstance._isMounted) {
      componentInstance._isMounted = true
      callHook(componentInstance, 'mounted')
    }
    if (vnode.data.keepAlive) {
      if (context._isMounted) {
        // vue-router#1212
        // During updates, a kept-alive component's child components may
        // change, so directly walking the tree here may call activated hooks
        // on incorrect children. Instead we push them into a queue which will
        // be processed after the whole patch process ended.
        queueActivatedComponent(componentInstance)
      } else {
        activateChildComponent(componentInstance, true /* direct */)
      }
    }
  },

  destroy (vnode: MountedComponentVNode) {
    const { componentInstance } = vnode
    if (!componentInstance._isDestroyed) {
      if (!vnode.data.keepAlive) {
        componentInstance.$destroy()
      } else {
        deactivateChildComponent(componentInstance, true /* direct */)
      }
    }
  }
}

const hooksToMerge = Object.keys(componentVNodeHooks)

export function createComponent (
  Ctor: Class<Component> | Function | Object | void, // 组件构造器或选项对象
  data: ?VNodeData,                                  // 节点数据（如 props、事件等）
  context: Component,                                //  Vue 实例
  children: ?Array<VNode>,                           // 子节点
  tag?: string                                       // 标签名（可选）
): VNode | Array<VNode> | void {
  // 如果没有值，直接返回
  if (isUndef(Ctor)) {
    return
  }

  // 获取Vue的constructor
  const baseCtor = context.$options._base

  // 如果 Ctor 是一个普通的选项对象（Object），将其转换为构造器
  if (isObject(Ctor)) {
    Ctor = baseCtor.extend(Ctor) // 使用 Vue.extend 方法将选项对象转换为构造器
  }

  // 如果此时 Ctor 不是一个函数（即不是有效的构造器或异步组件工厂函数），报错并返回
  if (typeof Ctor !== 'function') {
    if (process.env.NODE_ENV !== 'production') {
      warn(`Invalid Component definition: ${String(Ctor)}`, context)
    }
    return
  }

  // 处理异步组件
  let asyncFactory
  if (isUndef(Ctor.cid)) { // 如果 Ctor 没有 cid 属性，说明这是一个异步组件
    asyncFactory = Ctor
    Ctor = resolveAsyncComponent(asyncFactory, baseCtor) // 解析异步组件
    if (Ctor === undefined) {
      // 如果异步组件尚未解析完成，返回一个占位符节点
      return createAsyncPlaceholder(
        asyncFactory,
        data,
        context,
        children,
        tag
      )
    }
  }

  // 初始化数据对象
  data = data || {}

  // 解析构造器选项（处理全局混入等情况）
  resolveConstructorOptions(Ctor)

  // 处理 v-model 数据，将其转换为 props 和事件
  if (isDef(data.model)) {
    transformModel(Ctor.options, data)
  }

  // 提取 props 数据
  const propsData = extractPropsFromVNodeData(data, Ctor, tag)

  // 处理函数式组件
  if (isTrue(Ctor.options.functional)) {
    return createFunctionalComponent(Ctor, propsData, data, context, children)
  }

  // 提取监听器（listeners），这些监听器需要作为子组件的监听器而不是 DOM 监听器
  const listeners = data.on

  // 替换监听器为带有 .native 修饰符的监听器，以便在父组件的 patch 阶段处理
  data.on = data.nativeOn

  // 处理抽象组件（abstract components）
  if (isTrue(Ctor.options.abstract)) {
    // 抽象组件只保留 props、监听器和插槽
    const slot = data.slot
    data = {}
    if (slot) {
      data.slot = slot
    }
  }

  // 安装组件管理钩子到占位符节点上
  installComponentHooks(data)

  // 创建虚拟节点
  const name = Ctor.options.name || tag
  const vnode = new VNode(
    `vue-component-${Ctor.cid}${name ? `-${name}` : ''}`, // 节点类型标识
    data,                                                  // 节点数据
    undefined,                                            // 子节点（此处为空）
    undefined,                                            // 文本内容（此处为空）
    undefined,                                            // DOM 元素（此处为空）
    context,                                              // 上下文
    { Ctor, propsData, listeners, tag, children },         // 组件实例信息
    asyncFactory                                           // 异步组件工厂（可选）
  )

  // Weex 特定逻辑：调用优化的 @render 函数提取 cell-slot 模板
  /* istanbul ignore if */
  if (__WEEX__ && isRecyclableComponent(vnode)) {
    return renderRecyclableComponentTemplate(vnode)
  }

  // 返回虚拟节点
  return vnode
}
/**
 * 为虚拟节点创建组件实例。
 *
 * 该函数根据传入的虚拟节点（vnode）和父级上下文（activeInstance），创建一个新的组件实例。
 * 它主要用于处理子组件的初始化逻辑，包括设置组件选项、处理内联模板等。
 *
 * @param {any} vnode - 当前的虚拟节点（MountedComponentVNode），表示一个子组件。
 * @param {any} parent - 父级 Vue 实例（activeInstance），用于提供上下文。
 * @returns {Component} - 返回新创建的组件实例。
 */
export function createComponentInstanceForVnode (
  // 我们知道它是 MountedComponentVNode，但 Flow 类型检查工具无法识别
  vnode: any,
  // 生命周期状态中的 activeInstance
  parent: any
): Component {
  /**
   * 定义组件的内部选项。
   * 这些选项用于标识组件的身份，并提供必要的上下文信息。
   */
  const options: InternalComponentOptions = {
    _isComponent: true,       // 标记这是一个组件实例
    _parentVnode: vnode,      // 父级虚拟节点（当前组件的占位符节点）
    parent                     // 父级 Vue 实例（activeInstance）
  }

  /**
   * 检查是否存在内联模板（inline-template）。
   * 如果存在内联模板，则将其渲染函数（render 和 staticRenderFns）添加到组件选项中。
   */
  const inlineTemplate = vnode.data.inlineTemplate
  if (isDef(inlineTemplate)) {
    options.render = inlineTemplate.render          // 内联模板的渲染函数
    options.staticRenderFns = inlineTemplate.staticRenderFns // 静态渲染函数
  }

  /**
   * 创建并返回组件实例。
   * 使用 vnode.componentOptions.Ctor（组件构造器）创建新的组件实例，
   * 并将上述定义的选项传递给构造器。
   */
  return new vnode.componentOptions.Ctor(options)
}

/**
 * 安装组件的生命周期钩子到虚拟节点（VNode）的数据对象中。
 *
 * 该函数将预定义的组件生命周期钩子（componentVNodeHooks）合并到虚拟节点的 `data.hook` 中。
 * 如果某个钩子已经存在，则会将其与现有的钩子合并，避免覆盖。
 *
 * @param {VNodeData} data - 虚拟节点的数据对象，包含钩子（hook）、属性（props）、事件等信息。
 */
function installComponentHooks (data: VNodeData) {
  // 获取或初始化 data.hook 对象，用于存储生命周期钩子
  const hooks = data.hook || (data.hook = {})

  /**
   * 遍历需要合并的钩子列表（hooksToMerge），逐个处理每个钩子。
   * hooksToMerge 是一个数组，包含了所有需要合并的生命周期钩子名称（如 init、prepatch、insert 等）。
   */
  for (let i = 0; i < hooksToMerge.length; i++) {
    const key = hooksToMerge[i] // 当前需要处理的钩子名称

    const existing = hooks[key] // 当前虚拟节点中已有的钩子函数（如果存在）
    const toMerge = componentVNodeHooks[key] // 预定义的组件生命周期钩子函数

    /**
     * 如果当前钩子不等于预定义钩子，并且当前没有定义钩子、没有合并过，就进入判断。
     */
    if (existing !== toMerge && !(existing && existing._merged)) {
      // 1. 如果当前钩子不存在（existing 为 undefined），直接使用预定义的钩子（toMerge）。
      // 2. 如果已有钩子存在，则合并两个钩子；
      hooks[key] = existing ? mergeHook(toMerge, existing) : toMerge
    }
  }
}

/**
 * 合并两个生命周期钩子函数。
 *
 * 该函数用于将两个钩子函数合并为一个新函数。当调用合并后的函数时，会依次执行两个原始钩子函数。
 * 合并后的函数会被标记为已合并（_merged = true），以避免重复合并。
 *
 * @param {Function} f1 - 第一个钩子函数。
 * @param {Function} f2 - 第二个钩子函数。
 * @returns {Function} merged - 返回一个新的函数，该函数在调用时会依次执行 f1 和 f2。
 */
function mergeHook (f1: any, f2: any): Function {
  /**
   * 定义合并后的函数。
   * 当调用该函数时，会依次执行 f1 和 f2，并传递相同的参数。
   *
   * @param {any} a - 钩子函数的第一个参数。
   * @param {any} b - 钩子函数的第二个参数。
   */
  const merged = (a, b) => {
    // flow 报告额外参数的问题，因此使用 any 类型
    f1(a, b) // 调用第一个钩子函数
    f2(a, b) // 调用第二个钩子函数
  }

  // 标记合并后的函数为已合并（避免重复合并）
  merged._merged = true

  // 返回合并后的函数
  return merged
}

// transform component v-model info (value and callback) into
// prop and event handler respectively.
function transformModel (options, data: any) {
  const prop = (options.model && options.model.prop) || 'value'
  const event = (options.model && options.model.event) || 'input'
  ;(data.attrs || (data.attrs = {}))[prop] = data.model.value
  const on = data.on || (data.on = {})
  const existing = on[event]
  const callback = data.model.callback
  if (isDef(existing)) {
    if (
      Array.isArray(existing)
        ? existing.indexOf(callback) === -1
        : existing !== callback
    ) {
      on[event] = [callback].concat(existing)
    }
  } else {
    on[event] = callback
  }
}
