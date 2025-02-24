/* @flow */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from '../components/index'
import { observe } from 'core/observer/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'
/**
 * 初始化 Vue 的全局 API。
 *
 * 该函数负责设置 Vue 的全局配置选项（Vue.config）、工具方法（如 Vue.util）、
 * 全局 API（如 Vue.set、Vue.nextTick）以及资源注册器（如 Vue.component、Vue.directive）。
 * 主要功能包括：
 * 1. 定义 Vue.config 对象，并限制其在非生产环境下的直接替换。
 * 2. 暴露内部工具方法（如 warn、extend 等），但这些方法不属于公共 API。
 * 3. 定义全局 API：
 *    - Vue.set：向响应式对象添加新属性并确保其是响应式的。
 *    - Vue.delete：从响应式对象中删除属性并触发视图更新。
 *    - Vue.nextTick：在 DOM 更新完成后执行回调。
 *    - Vue.observable：将普通对象转换为响应式对象（2.6 新增）。
 * 4. 初始化 Vue.options 对象，用于存储全局选项（如 components、directives、filters）。
 * 5. 注册内置组件（如 keep-alive）到 Vue.options.components 中。
 * 6. 初始化插件系统（Vue.use）、混入功能（Vue.mixin）、继承功能（Vue.extend）。
 * 7. 初始化资源注册器（Vue.component、Vue.directive、Vue.filter）。
 *
 * @param {GlobalAPI} Vue - Vue 构造器，用于挂载全局 API 和配置。
 */
export function initGlobalAPI (Vue: GlobalAPI) {
  // 初始化 Vue.config 对象
  const configDef = {}
  configDef.get = () => config // 定义 getter，返回 Vue 的全局配置对象
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      // 在非生产环境下，禁止直接替换 Vue.config 对象
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  Object.defineProperty(Vue, 'config', configDef) // 将 config 定义为 Vue 的只读属性

  // 暴露一些内部工具方法（注意：这些方法不属于公共 API）
  Vue.util = {
    warn,            // 警告工具方法
    extend,          // 对象扩展工具方法
    mergeOptions,    // 合并选项工具方法
    defineReactive   // 定义响应式数据工具方法
  }

  // 全局 API：Vue.set 和 Vue.delete
  Vue.set = set         // 用于向响应式对象添加新属性，并确保其是响应式的
  Vue.delete = del      // 用于从响应式对象中删除属性，并触发视图更新

  // 全局 API：Vue.nextTick
  Vue.nextTick = nextTick // 用于在 DOM 更新完成后执行回调

  // 2.6 版本新增的显式可观察对象 API
  Vue.observable = <T>(obj: T): T => {
    observe(obj) // 将普通对象转换为响应式对象
    return obj   // 返回响应式对象
  }

  // 初始化 Vue.options 对象
  Vue.options = Object.create(null) // 创建一个空对象作为 Vue 的全局选项
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null) // 为每种资源类型（如 components、directives、filters）创建一个空对象
  })

  // 设置 Vue.options._base 属性，用于标识基础构造器
  Vue.options._base = Vue

  // 将内置组件（如 keep-alive）扩展到 Vue.options.components 中
  extend(Vue.options.components, builtInComponents)

  // 初始化插件系统
  initUse(Vue) // 定义 Vue.use 方法，用于安装插件

  // 初始化混入功能
  initMixin(Vue) // 定义 Vue.mixin 方法，用于全局混入选项

  // 初始化继承功能
  initExtend(Vue) // 定义 Vue.extend 方法，用于创建子类构造器

  // 初始化资源注册器
  initAssetRegisters(Vue) // 定义 Vue.component、Vue.directive 和 Vue.filter 方法，用于注册全局组件、指令和过滤器
}
