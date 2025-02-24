/* @flow */
import config from '../config'
import VNode, { createEmptyVNode } from './vnode'
import { createComponent } from './create-component'
import { traverse } from '../observer/traverse'
import {
  warn,
  isDef,
  isUndef,
  isTrue,
  isObject,
  isPrimitive,
  resolveAsset
} from '../util/index'
import {
  normalizeChildren,
  simpleNormalizeChildren
} from './helpers/index'

const SIMPLE_NORMALIZE = 1
const ALWAYS_NORMALIZE = 2

/**
 * createElement 是一个包装函数，提供更灵活的接口，同时避免 Flow 类型检查报错。
 * @param {Component} context - 当前 Vue 实例
 * @param {string | Class<Component> | Function | Object} tag - 标签名或组件定义
 * @param {VNodeData} data - 节点数据对象
 * @param {any} children - 子节点
 * @param {number} normalizationType - 子节点标准化类型
 * @param {boolean} alwaysNormalize - 是否始终应用标准化
 * @returns {VNode | Array<VNode>} 返回虚拟 DOM 节点
 */
export function createElement (
  context: Component,
  tag: any,
  data: any,
  children: any,
  normalizationType: any,
  alwaysNormalize: boolean
): VNode | Array<VNode> {
  // 如果 data 是数组或原始值，则调整参数顺序
  if (Array.isArray(data) || isPrimitive(data)) {
    normalizationType = children
    children = data
    data = undefined
  }
  // 如果 alwaysNormalize 为 true，则设置标准化类型为 ALWAYS_NORMALIZE
  if (isTrue(alwaysNormalize)) {
    normalizationType = ALWAYS_NORMALIZE
  }
  return _createElement(context, tag, data, children, normalizationType)
}

/**
 * _createElement 是 createElement 的核心实现，用于创建虚拟 DOM 节点。
 * @param {Component} context - 当前 Vue 实例
 * @param {string | Class<Component> | Function | Object} tag - 标签名或组件定义
 * @param {VNodeData} data - 节点数据对象
 * @param {any} children - 子节点
 * @param {number} normalizationType - 子节点标准化类型
 * @returns {VNode | Array<VNode>} 返回虚拟 DOM 节点
 */
export function _createElement (
  context: Component,
  tag?: string | Class<Component> | Function | Object,
  data?: VNodeData,
  children?: any,
  normalizationType?: number
): VNode | Array<VNode> {
  // 如果 data 是响应式对象，则发出警告并返回空节点
  if (isDef(data) && isDef((data: any).__ob__)) {
    process.env.NODE_ENV !== 'production' && warn(
      `Avoid using observed data object as vnode data: ${JSON.stringify(data)}\n` +
      'Always create fresh vnode data objects in each render!',
      context
    )
    return createEmptyVNode()
  }

  // 支持 v-bind 的对象语法
  if (isDef(data) && isDef(data.is)) {
    tag = data.is
  }

  // 如果 tag 不存在（例如 :is 设置为 false 值），返回空节点
  if (!tag) {
    return createEmptyVNode()
  }

  // 警告非原始值作为 key 的使用
  if (process.env.NODE_ENV !== 'production' &&
    isDef(data) && isDef(data.key) && !isPrimitive(data.key)
  ) {
    if (!__WEEX__ || !('@binding' in data.key)) {
      warn(
        'Avoid using non-primitive value as key, ' +
        'use string/number value instead.',
        context
      )
    }
  }

  // 支持单个函数子节点作为默认作用域插槽
  if (Array.isArray(children) &&
    typeof children[0] === 'function'
  ) {
    data = data || {}
    data.scopedSlots = { default: children[0] }
    children.length = 0
  }

  // 根据标准化类型对子节点进行处理
  if (normalizationType === ALWAYS_NORMALIZE) {
    children = normalizeChildren(children)
  } else if (normalizationType === SIMPLE_NORMALIZE) {
    children = simpleNormalizeChildren(children)
  }

  let vnode, ns
  if (typeof tag === 'string') {
    let Ctor
    // 获取命名空间
    ns = (context.$vnode && context.$vnode.ns) || config.getTagNamespace(tag)

    // 如果是平台内置标签
    if (config.isReservedTag(tag)) {
      if (process.env.NODE_ENV !== 'production' && isDef(data) && isDef(data.nativeOn) && data.tag !== 'component') {
        warn(
          `The .native modifier for v-on is only valid on components but it was used on <${tag}>.`,
          context
        )
      }
      vnode = new VNode(
        config.parsePlatformTagName(tag), data, children,
        undefined, undefined, context
      )
    }
    // 如果是组件
    else if ((!data || !data.pre) && isDef(Ctor = resolveAsset(context.$options, 'components', tag))) {
      vnode = createComponent(Ctor, data, context, children, tag)
    }
    // 未知或未列出的命名空间元素
    else {
      vnode = new VNode(
        tag, data, children,
        undefined, undefined, context
      )
    }
  } else {
    // 渲染组件的时候，tag就是我们在`.vue`文件中通过export default返回的对象
    vnode = createComponent(tag, data, context, children)
  }

  // 处理返回值
  if (Array.isArray(vnode)) {
    return vnode
  } else if (isDef(vnode)) {
    if (isDef(ns)) applyNS(vnode, ns) // 应用命名空间
    if (isDef(data)) registerDeepBindings(data) // 注册深度绑定
    return vnode
  } else {
    return createEmptyVNode() // 返回空节点
  }
}

/**
 * 递归地为虚拟 DOM 节点及其子节点应用命名空间。
 * @param {VNode} vnode - 虚拟 DOM 节点
 * @param {string} ns - 命名空间
 * @param {boolean} force - 是否强制应用命名空间
 */
function applyNS (vnode, ns, force) {
  vnode.ns = ns
  if (vnode.tag === 'foreignObject') {
    // 在 foreignObject 内部使用默认命名空间
    ns = undefined
    force = true
  }
  if (isDef(vnode.children)) {
    for (let i = 0, l = vnode.children.length; i < l; i++) {
      const child = vnode.children[i]
      if (isDef(child.tag) && (
        isUndef(child.ns) || (isTrue(force) && child.tag !== 'svg'))) {
        applyNS(child, ns, force)
      }
    }
  }
}


// ref #5318
// necessary to ensure parent re-render when deep bindings like :style and
// :class are used on slot nodes
/**
 * 注册深度绑定（如 :style 和 :class）以确保父组件重新渲染。
 * @param {VNodeData} data - 节点数据对象
 */
function registerDeepBindings (data) {
  if (isObject(data.style)) {
    traverse(data.style) // 遍历 style 对象以触发依赖收集
  }
  if (isObject(data.class)) {
    traverse(data.class) // 遍历 class 对象以触发依赖收集
  }
}


