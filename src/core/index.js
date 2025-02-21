/*
 * 1、设置全局API。
 * 2、定义是否服务端渲染相关的属性
 * 3、并暴露了函数式组件的渲染上下文。
 */

// 导入Vue构造函数
import Vue from './instance/index'
// 初始化全局API函数
import { initGlobalAPI } from './global-api/index'
// 判断是否是服务端渲染
import { isServerRendering } from 'core/util/env'
// 创建函数式组件
import { FunctionalRenderContext } from 'core/vdom/create-functional-component'

// 初始化全局API
initGlobalAPI(Vue)

// 定义$isServer属性，用于判断当前环境是否为服务端渲染
Object.defineProperty(Vue.prototype, '$isServer', {
  get: isServerRendering
})

// 定义$ssrContext属性，用于获取服务端渲染的上下文
Object.defineProperty(Vue.prototype, '$ssrContext', {
  get () {
    /* istanbul ignore next */
    return this.$vnode && this.$vnode.ssrContext
  }
})

// 暴露FunctionalRenderContext，用于服务端渲染时安装运行时辅助工具
Object.defineProperty(Vue, 'FunctionalRenderContext', {
  value: FunctionalRenderContext
})

Vue.version = '__VERSION__'

export default Vue
