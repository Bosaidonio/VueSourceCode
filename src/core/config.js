/* @flow */

import {
  no,
  noop,
  identity
} from 'shared/util'

import { LIFECYCLE_HOOKS } from 'shared/constants'

/**
 * Vue 配置对象的类型定义，包含用户配置项和平台相关配置项。
 */
export type Config = {
  // 用户配置项
  optionMergeStrategies: { [key: string]: Function }; // 选项合并策略
  silent: boolean; // 是否抑制警告
  productionTip: boolean; // 是否显示生产模式提示信息
  performance: boolean; // 是否启用性能追踪
  devtools: boolean; // 是否启用开发者工具
  errorHandler: ?(err: Error, vm: Component, info: string) => void; // 错误处理器
  warnHandler: ?(msg: string, vm: Component, trace: string) => void; // 警告处理器
  ignoredElements: Array<string | RegExp>; // 忽略的自定义元素列表
  keyCodes: { [key: string]: number | Array<number> }; // 自定义按键别名

  // 平台相关配置项
  isReservedTag: (x?: string) => boolean; // 检查标签是否为保留标签
  isReservedAttr: (x?: string) => boolean; // 检查属性是否为保留属性
  parsePlatformTagName: (x: string) => string; // 解析平台特定的标签名称
  isUnknownElement: (x?: string) => boolean; // 检查标签是否为未知元素
  getTagNamespace: (x?: string) => string | void; // 获取元素的命名空间
  mustUseProp: (tag: string, type: ?string, name: string) => boolean; // 检查属性是否必须使用属性绑定

  // 私有配置项
  async: boolean; // 是否异步执行更新

  // 遗留配置项
  _lifecycleHooks: Array<string>; // 生命周期钩子（遗留）
};

/**
 * Vue 的默认配置对象。
 */
export default ({
  /**
   * 混入时的选项合并策略（用于 core/util/options）
   */
  // $flow-disable-line
  optionMergeStrategies: Object.create(null),

  /**
   * 是否取消 Vue 所有的日志与警告。
   * https://v2.cn.vuejs.org/v2/api/#silent
   */
  silent: false,

  /**
   * 是否在启动时显示式提示信息。
   */
  productionTip: process.env.NODE_ENV !== 'production',

  /**
   * 是否启用开发者工具。
   */
  devtools: process.env.NODE_ENV !== 'production',

  /**
   * 是否记录性能数据。
   * 设置为 true 以在浏览器开发工具的性能/时间线面板中启用对组件初始化、编译、渲染和打补丁的性能追踪。
   * 只适用于开发模式和支持 performance.mark API 的浏览器上。
   */
  performance: false,

  /**
   * 监听器错误处理函数。
   */
  errorHandler: null,

  /**
   * 监听器警告处理函数。
   */
  warnHandler: null,

  /**
   * 忽略某些自定义元素。
   */
  ignoredElements: [],

  /**
   * 自定义按键别名（用于 v-on）。
   */
  // $flow-disable-line
  keyCodes: Object.create(null),

  /**
   * 检查标签是否为保留标签（平台依赖，可以被覆盖）。
   */
  isReservedTag: no,

  /**
   * 检查属性是否为保留属性（平台依赖，可以被覆盖）。
   */
  isReservedAttr: no,

  /**
   * 检查标签是否为未知元素（平台依赖）。
   */
  isUnknownElement: no,

  /**
   * 获取元素的命名空间。
   */
  getTagNamespace: noop,

  /**
   * 解析平台特定的标签名称。
   */
  parsePlatformTagName: identity,

  /**
   * 检查属性是否必须使用属性绑定（平台依赖，可以被覆盖）。
   */
  mustUseProp: no,

  /**
   * 是否异步执行更新。主要用于测试工具中，设置为 false 会显著降低性能。
   */
  async: true,

  /**
   * 遗留的生命周期钩子数组。
   */
  _lifecycleHooks: LIFECYCLE_HOOKS
}: Config)
