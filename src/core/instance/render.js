/* @flow */
import {
  warn,
  nextTick,
  emptyObject,
  handleError,
  defineReactive
} from '../util/index'
import { createElement } from '../vdom/create-element'
import { installRenderHelpers } from './render-helpers/index'
import { resolveSlots } from './render-helpers/resolve-slots'
import { normalizeScopedSlots } from '../vdom/helpers/normalize-scoped-slots'
import VNode, { createEmptyVNode } from '../vdom/vnode'
import { isUpdatingChildComponent } from './lifecycle'

/**
 * 初始化渲染相关的属性和方法，该方法在src/core/instance/init.js文件的_init中被调用
 * @param {Component} vm - Vue 实例
 */
export function initRender (vm: Component) {
  vm._vnode = null // 子树的根节点
  vm._staticTrees = null // 缓存的 v-once 树
  const options = vm.$options
  const parentVnode = vm.$vnode = options._parentVnode // 父组件树中的占位符节点
  const renderContext = parentVnode && parentVnode.context
  vm.$slots = resolveSlots(options._renderChildren, renderContext) // 解析插槽内容
  vm.$scopedSlots = emptyObject // 初始化作用域插槽

  // 绑定 createElement 函数到当前实例，以便在内部使用正确的渲染上下文
  // 参数顺序：tag, data, children, normalizationType, alwaysNormalize
  // 内部版本用于模板编译生成的渲染函数
  vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)
  // 公共版本用于用户手写的渲染函数，始终应用标准化
  vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)

  // $attrs 和 $listeners 是为了方便创建高阶组件（HOC）而暴露的
  // 它们需要是响应式的，以便使用它们的 HOC 始终能被更新
  const parentData = parentVnode && parentVnode.data
  /* istanbul ignore else */
  if (process.env.NODE_ENV !== 'production') {
    // 在开发环境下，定义响应式属性并警告修改操作
    defineReactive(vm, '$attrs', parentData && parentData.attrs || emptyObject, () => {
      !isUpdatingChildComponent && warn(`$attrs is readonly.`, vm)
    }, true)
    defineReactive(vm, '$listeners', options._parentListeners || emptyObject, () => {
      !isUpdatingChildComponent && warn(`$listeners is readonly.`, vm)
    }, true)
  } else {
    // 在生产环境下，直接定义响应式属性
    defineReactive(vm, '$attrs', parentData && parentData.attrs || emptyObject, null, true)
    defineReactive(vm, '$listeners', options._parentListeners || emptyObject, null, true)
  }
}

// 当前正在渲染的实例，仅用于测试
export let currentRenderingInstance: Component | null = null

/**
 * 设置当前渲染的实例（仅用于测试）
 * @param {Component} vm - Vue 实例
 */
export function setCurrentRenderingInstance (vm: Component) {
  currentRenderingInstance = vm
}

/**
 * 混入渲染相关的方法到 Vue 原型上，该方法在src/core/instance/index.js文件中,npm run build期间被调用
 * @param {Class<Component>} Vue - Vue 构造函数
 */
export function renderMixin (Vue: Class<Component>) {
  // 安装运行时的渲染辅助方法
  installRenderHelpers(Vue.prototype)

  /**
   * 将 nextTick 方法绑定到 Vue 实例上。
   * @param {Function} fn - 回调函数
   */
  Vue.prototype.$nextTick = function (fn: Function) {
    return nextTick(fn, this)
  }

  /**
   * 定义 _render 方法，用于生成虚拟 DOM 节点。
   * @returns {VNode} 返回生成的虚拟 DOM 节点
   */
  Vue.prototype._render = function (): VNode {
    const vm: Component = this
    const { render, _parentVnode } = vm.$options

    // 如果存在父级占位符节点，则规范化作用域插槽
    if (_parentVnode) {
      vm.$scopedSlots = normalizeScopedSlots(
        _parentVnode.data.scopedSlots,
        vm.$slots,
        vm.$scopedSlots
      )
    }

    // 设置父级占位符节点，使渲染函数可以访问其数据
    vm.$vnode = _parentVnode

    let vnode
    try {
      // 设置当前渲染实例
      currentRenderingInstance = vm
      // 调用渲染函数生成虚拟 DOM 节点
      vnode = render.call(vm._renderProxy, vm.$createElement)
    } catch (e) {
      // 捕获渲染错误并处理
      handleError(e, vm, `render`)
      // 如果存在 renderError 函数，则尝试调用它
      /* istanbul ignore else */
      if (process.env.NODE_ENV !== 'production' && vm.$options.renderError) {
        try {
          vnode = vm.$options.renderError.call(vm._renderProxy, vm.$createElement, e)
        } catch (e) {
          handleError(e, vm, `renderError`)
          vnode = vm._vnode
        }
      } else {
        // 否则回退到之前的虚拟 DOM 节点
        vnode = vm._vnode
      }
    } finally {
      // 清除当前渲染实例
      currentRenderingInstance = null
    }

    // 如果返回的是单元素数组，则允许它作为根节点
    if (Array.isArray(vnode) && vnode.length === 1) {
      vnode = vnode[0]
    }

    // 如果渲染函数未返回有效的虚拟 DOM 节点，则返回空节点
    if (!(vnode instanceof VNode)) {
      if (process.env.NODE_ENV !== 'production' && Array.isArray(vnode)) {
        warn(
          'Multiple root nodes returned from render function. Render function ' +
          'should return a single root node.',
          vm
        )
      }
      vnode = createEmptyVNode()
    }

    // 设置父级节点
    vnode.parent = _parentVnode
    return vnode
  }
}
