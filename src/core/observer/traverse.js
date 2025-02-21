/* @flow */
import { _Set as Set, isObject } from '../util/index'
import type { SimpleSet } from '../util/index'
import VNode from '../vdom/vnode'

// 用于存储已经访问过的对象，避免重复递归
const seenObjects = new Set()

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 */
/**
 * 递归遍历一个对象以触发所有已转换的 getter，
 * 从而将对象中的每个嵌套属性收集为“深度”依赖。
 * @param {any} val - 要遍历的对象或值
 */
export function traverse (val: any) {
  // 调用内部递归函数进行遍历
  _traverse(val, seenObjects)
  // 清空 seenObjects 集合，以便下次使用
  seenObjects.clear()
}

/**
 * 内部递归函数，用于深度遍历对象并触发 getter。
 * @param {any} val - 当前要遍历的对象或值
 * @param {SimpleSet} seen - 已访问过的对象集合，避免重复递归
 */
function _traverse (val: any, seen: SimpleSet) {
  let i, keys
  const isA = Array.isArray(val)

  // 如果值不是对象或数组，或者被冻结，或者是一个 VNode 实例，则直接返回
  if ((!isA && !isObject(val)) || Object.isFrozen(val) || val instanceof VNode) {
    return
  }

  // 如果对象是响应式的（即有 __ob__ 属性），检查是否已经访问过
  if (val.__ob__) {
    const depId = val.__ob__.dep.id
    if (seen.has(depId)) {
      return // 如果已经访问过，直接返回，避免重复递归
    }
    seen.add(depId) // 标记当前对象为已访问
  }

  // 如果是数组，递归遍历每个元素
  if (isA) {
    i = val.length
    while (i--) _traverse(val[i], seen)
  } else {
    // 如果是对象，递归遍历每个属性
    keys = Object.keys(val)
    i = keys.length
    while (i--) _traverse(val[keys[i]], seen)
  }
}
