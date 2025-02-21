/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import { mark, measure } from '../util/perf'
import { createEmptyVNode } from '../vdom/vnode'
import { updateComponentListeners } from './events'
import { resolveSlots } from './render-helpers/resolve-slots'
import { toggleObserving } from '../observer/index'
import { pushTarget, popTarget } from '../observer/dep'

import {
  warn,
  noop,
  remove,
  emptyObject,
  validateProp,
  invokeWithErrorHandling
} from '../util/index'

export let activeInstance: any = null
export let isUpdatingChildComponent: boolean = false

export function setActiveInstance(vm: Component) {
  const prevActiveInstance = activeInstance
  activeInstance = vm
  return () => {
    activeInstance = prevActiveInstance
  }
}

export function initLifecycle (vm: Component) {
  const options = vm.$options

  // locate first non-abstract parent
  let parent = options.parent
  if (parent && !options.abstract) {
    while (parent.$options.abstract && parent.$parent) {
      parent = parent.$parent
    }
    parent.$children.push(vm)
  }

  vm.$parent = parent
  vm.$root = parent ? parent.$root : vm

  vm.$children = []
  vm.$refs = {}

  vm._watcher = null
  vm._inactive = null
  vm._directInactive = false
  vm._isMounted = false
  vm._isDestroyed = false
  vm._isBeingDestroyed = false
}

/**
 * 混入生命周期相关的方法到 Vue 原型上，该方法在src/core/instance/index.js文件中,npm run build期间被调用
 * @param {Class<Component>} Vue - Vue 构造函数
 */
export function lifecycleMixin (Vue: Class<Component>) {
  /**
   * _update 方法是 Vue 实例的核心更新方法，用于将虚拟 DOM 转换为真实 DOM 并更新视图。
   * @param {VNode} vnode - 新的虚拟 DOM 节点
   * @param {boolean} hydrating - 是否进行服务端渲染
   */
  Vue.prototype._update = function (vnode: VNode, hydrating?: boolean) {
    const vm: Component = this
    const prevEl = vm.$el // 当前的真实 DOM 元素
    const prevVnode = vm._vnode // 上一次的虚拟 DOM 节点
    const restoreActiveInstance = setActiveInstance(vm) // 设置当前活动实例
    vm._vnode = vnode // 更新当前虚拟 DOM 节点

    // Vue.prototype.__patch__ 是根据渲染后端注入的，负责将虚拟 DOM 转换为真实 DOM
    if (!prevVnode) {
      // 初次渲染
      vm.$el = vm.__patch__(vm.$el, vnode, hydrating, false /* removeOnly */)
    } else {
      // 更新渲染
      vm.$el = vm.__patch__(prevVnode, vnode)
    }

    restoreActiveInstance() // 恢复之前的活动实例

    // 更新 __vue__ 引用
    if (prevEl) {
      prevEl.__vue__ = null // 清除旧 DOM 的引用
    }
    if (vm.$el) {
      vm.$el.__vue__ = vm // 将新的 DOM 元素与 Vue 实例关联
    }

    // 如果父组件是一个高阶组件（HOC），也需要更新其 $el
    if (vm.$vnode && vm.$parent && vm.$vnode === vm.$parent._vnode) {
      vm.$parent.$el = vm.$el
    }

    // updated 钩子由调度器调用，以确保子组件在父组件的 updated 钩子中被更新
  }

  /**
   * 强制更新当前组件。
   * 通过触发 watcher 的 update 方法来强制重新渲染。
   */
  Vue.prototype.$forceUpdate = function () {
    const vm: Component = this
    if (vm._watcher) {
      vm._watcher.update() // 触发渲染 watcher 的更新
    }
  }

  /**
   * 销毁 Vue 实例。
   * 包括清理父子关系、销毁 watcher、移除事件监听器等操作。
   */
  Vue.prototype.$destroy = function () {
    const vm: Component = this
    if (vm._isBeingDestroyed) {
      return // 如果实例已经在销毁过程中，则直接返回
    }

    callHook(vm, 'beforeDestroy') // 调用 beforeDestroy 生命周期钩子
    vm._isBeingDestroyed = true // 标记实例正在销毁

    // 从父组件中移除自己
    const parent = vm.$parent
    if (parent && !parent._isBeingDestroyed && !vm.$options.abstract) {
      remove(parent.$children, vm) // 移除当前实例在父组件的子组件列表中的引用
    }

    // 销毁所有的 watcher
    if (vm._watcher) {
      vm._watcher.teardown() // 销毁渲染 watcher
    }
    let i = vm._watchers.length
    while (i--) {
      vm._watchers[i].teardown() // 销毁所有用户定义的 watcher
    }

    // 从数据观察者中移除对 Vue 实例的引用
    if (vm._data.__ob__) {
      vm._data.__ob__.vmCount-- // 减少观察者的计数
    }

    // 标记实例已销毁
    vm._isDestroyed = true

    // 调用 __patch__ 方法销毁当前渲染树
    vm.__patch__(vm._vnode, null)

    // 调用 destroyed 生命周期钩子
    callHook(vm, 'destroyed')

    // 移除所有实例事件监听器
    vm.$off()

    // 移除 DOM 元素上的 __vue__ 引用
    if (vm.$el) {
      vm.$el.__vue__ = null
    }

    // 解决循环引用问题 (#6759)
    if (vm.$vnode) {
      vm.$vnode.parent = null
    }
  }
}
// 将 Vue 实例挂载到 DOM 元素上，并初始化渲染和更新机制
export function mountComponent (
  vm: Component, // 当前 Vue 实例
  el: ?Element, // 挂载的目标 DOM 元素
  hydrating?: boolean // 是否是服务端渲染的水合模式
): Component {
  vm.$el = el // 将目标 DOM 元素赋值给实例的 $el 属性

  // 如果没有定义 render 函数，则设置一个空的 VNode 渲染函数
  if (!vm.$options.render) {
    vm.$options.render = createEmptyVNode

    // 在开发环境中，检查是否使用了template,但没有使用compile + runtime的版本
    if (process.env.NODE_ENV !== 'production') {
      /* istanbul ignore if */
      if ((vm.$options.template && vm.$options.template.charAt(0) !== '#') ||
        vm.$options.el || el) {
        warn(
          'You are using the runtime-only build of Vue where the template ' +
          'compiler is not available. Either pre-compile the templates into ' +
          'render functions, or use the compiler-included build.',
          vm
        )
      } else {
        warn(
          'Failed to mount component: template or render function not defined.',
          vm
        )
      }
    }
  }

  // 调用 beforeMount 生命周期钩子
  callHook(vm, 'beforeMount')

  // 定义 updateComponent 函数，用于执行渲染和更新逻辑
  let updateComponent
  /* istanbul ignore if */
  if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
    // 如果启用了性能监控，则记录渲染和更新的耗时
    updateComponent = () => {
      const name = vm._name // 组件名称
      const id = vm._uid // 唯一标识符
      const startTag = `vue-perf-start:${id}` // 性能标记的开始标签
      const endTag = `vue-perf-end:${id}` // 性能标记的结束标签

      // 记录渲染阶段的性能
      mark(startTag)
      const vnode = vm._render() // 调用 _render 方法生成虚拟 DOM
      mark(endTag)
      measure(`vue ${name} render`, startTag, endTag)

      // 记录更新（patch）阶段的性能
      mark(startTag)
      vm._update(vnode, hydrating) // 调用 _update 方法将虚拟 DOM 更新到真实 DOM
      mark(endTag)
      measure(`vue ${name} patch`, startTag, endTag)
    }
  } else {
    // 生产环境下的 updateComponent 函数
    updateComponent = () => {
      vm._update(vm._render(), hydrating) // 调用 _render 和 _update 完成渲染和更新
    }
  }

  // 创建一个渲染观察者（Watcher），用于监听数据变化并触发重新渲染
  // 在 Watcher 的构造函数中会将自身赋值给 vm._watcher
  new Watcher(vm, updateComponent, noop, {
    before () {
      // 在组件已挂载且未销毁的情况下，调用 beforeUpdate 生命周期钩子
      if (vm._isMounted && !vm._isDestroyed) {
        callHook(vm, 'beforeUpdate')
      }
    }
  }, true /* isRenderWatcher */)

  hydrating = false // 标记水合完成

  // 如果当前实例是根组件（$vnode 为 null），则标记为已挂载并调用 mounted 钩子
  if (vm.$vnode == null) {
    vm._isMounted = true
    callHook(vm, 'mounted')
  }

  return vm // 返回当前 Vue 实例
}
export function updateChildComponent (
  vm: Component,
  propsData: ?Object,
  listeners: ?Object,
  parentVnode: MountedComponentVNode,
  renderChildren: ?Array<VNode>
) {
  if (process.env.NODE_ENV !== 'production') {
    isUpdatingChildComponent = true
  }

  // determine whether component has slot children
  // we need to do this before overwriting $options._renderChildren.

  // check if there are dynamic scopedSlots (hand-written or compiled but with
  // dynamic slot names). Static scoped slots compiled from template has the
  // "$stable" marker.
  const newScopedSlots = parentVnode.data.scopedSlots
  const oldScopedSlots = vm.$scopedSlots
  const hasDynamicScopedSlot = !!(
    (newScopedSlots && !newScopedSlots.$stable) ||
    (oldScopedSlots !== emptyObject && !oldScopedSlots.$stable) ||
    (newScopedSlots && vm.$scopedSlots.$key !== newScopedSlots.$key) ||
    (!newScopedSlots && vm.$scopedSlots.$key)
  )

  // Any static slot children from the parent may have changed during parent's
  // update. Dynamic scoped slots may also have changed. In such cases, a forced
  // update is necessary to ensure correctness.
  const needsForceUpdate = !!(
    renderChildren ||               // has new static slots
    vm.$options._renderChildren ||  // has old static slots
    hasDynamicScopedSlot
  )

  vm.$options._parentVnode = parentVnode
  vm.$vnode = parentVnode // update vm's placeholder node without re-render

  if (vm._vnode) { // update child tree's parent
    vm._vnode.parent = parentVnode
  }
  vm.$options._renderChildren = renderChildren

  // update $attrs and $listeners hash
  // these are also reactive so they may trigger child update if the child
  // used them during render
  vm.$attrs = parentVnode.data.attrs || emptyObject
  vm.$listeners = listeners || emptyObject

  // update props
  if (propsData && vm.$options.props) {
    toggleObserving(false)
    const props = vm._props
    const propKeys = vm.$options._propKeys || []
    for (let i = 0; i < propKeys.length; i++) {
      const key = propKeys[i]
      const propOptions: any = vm.$options.props // wtf flow?
      props[key] = validateProp(key, propOptions, propsData, vm)
    }
    toggleObserving(true)
    // keep a copy of raw propsData
    vm.$options.propsData = propsData
  }

  // update listeners
  listeners = listeners || emptyObject
  const oldListeners = vm.$options._parentListeners
  vm.$options._parentListeners = listeners
  updateComponentListeners(vm, listeners, oldListeners)

  // resolve slots + force update if has children
  if (needsForceUpdate) {
    vm.$slots = resolveSlots(renderChildren, parentVnode.context)
    vm.$forceUpdate()
  }

  if (process.env.NODE_ENV !== 'production') {
    isUpdatingChildComponent = false
  }
}

function isInInactiveTree (vm) {
  while (vm && (vm = vm.$parent)) {
    if (vm._inactive) return true
  }
  return false
}

export function activateChildComponent (vm: Component, direct?: boolean) {
  if (direct) {
    vm._directInactive = false
    if (isInInactiveTree(vm)) {
      return
    }
  } else if (vm._directInactive) {
    return
  }
  if (vm._inactive || vm._inactive === null) {
    vm._inactive = false
    for (let i = 0; i < vm.$children.length; i++) {
      activateChildComponent(vm.$children[i])
    }
    callHook(vm, 'activated')
  }
}

export function deactivateChildComponent (vm: Component, direct?: boolean) {
  if (direct) {
    vm._directInactive = true
    if (isInInactiveTree(vm)) {
      return
    }
  }
  if (!vm._inactive) {
    vm._inactive = true
    for (let i = 0; i < vm.$children.length; i++) {
      deactivateChildComponent(vm.$children[i])
    }
    callHook(vm, 'deactivated')
  }
}

export function callHook (vm: Component, hook: string) {
  // #7573 disable dep collection when invoking lifecycle hooks
  pushTarget()
  const handlers = vm.$options[hook]
  const info = `${hook} hook`
  if (handlers) {
    for (let i = 0, j = handlers.length; i < j; i++) {
      invokeWithErrorHandling(handlers[i], vm, null, vm, info)
    }
  }
  if (vm._hasHookEvent) {
    vm.$emit('hook:' + hook)
  }
  popTarget()
}
