/* @flow */
// 导入Vue构造函数
import Vue from 'core/index'
// 导入vue全局配置
import config from 'core/config'
// 导入合并对象函数以及占位函数
import { extend, noop } from 'shared/util'
// 导入挂载组件函数
import { mountComponent } from 'core/instance/lifecycle'
// 导入devtools相关函数
import { devtools, inBrowser } from 'core/util/index'

import {
  query,
  mustUseProp,
  isReservedTag,
  isReservedAttr,
  getTagNamespace,
  isUnknownElement
} from 'web/util/index'

import { patch } from './patch'
import platformDirectives from './directives/index'
import platformComponents from './components/index'

/* 给Vue的全局配置增加工具函数。*/
// 判断某个属性是否必须使用 v-bind 来绑定
Vue.config.mustUseProp = mustUseProp
// 判断一个标签是否是 Vue 保留的标签（例如 slot、component 等）
Vue.config.isReservedTag = isReservedTag
// 判断一个属性是否是 Vue 保留的属性（例如 key、ref 等）
Vue.config.isReservedAttr = isReservedAttr
//获取特定标签的命名空间（例如 SVG 标签的命名空间是 http://www.w3.org/2000/svg）
Vue.config.getTagNamespace = getTagNamespace
// 判断一个标签是否是未知的元素（即不是 Vue 保留的标签，也不是浏览器原生的标签）。
Vue.config.isUnknownElement = isUnknownElement

// install platform runtime directives & components
extend(Vue.options.directives, platformDirectives)
extend(Vue.options.components, platformComponents)

// install platform patch function
Vue.prototype.__patch__ = inBrowser ? patch : noop

// 将 Vue 实例挂载到指定的 DOM 元素上
Vue.prototype.$mount = function (
  el?: string | Element, // 挂载的目标元素（可以是选择器字符串或 DOM 元素）
  hydrating?: boolean // 服务端渲染时的标志
): Component {
  // 如果传入了 el，并且当前运行环境是在浏览器中，则通过 query 函数将其转换为真实的 DOM 元素
  // 如果不在浏览器环境中（例如服务端渲染），则将 el 设置为 undefined
  el = el && inBrowser ? query(el) : undefined

  // 调用 mountComponent 方法完成挂载逻辑
  return mountComponent(this, el, hydrating)
}

// 判断是否在浏览器中
/* istanbul ignore next */
if (inBrowser) {
  setTimeout(() => {
    // 判断是否在全局配置中开启了devtools
    if (config.devtools) {
      // 如果下载了devtools，则初始化devtools
      if (devtools) {
        devtools.emit('init', Vue)
      } else if (
        process.env.NODE_ENV !== 'production' &&
        process.env.NODE_ENV !== 'test'
      ) {
        // 当开发环境，并且没有开启devtools，则提示用户下载devtools
        console[console.info ? 'info' : 'log'](
          'Download the Vue Devtools extension for a better development experience:\n' +
          'https://github.com/vuejs/vue-devtools'
        )
      }
    }
    // 当在开发环境并且config.productionTip为true时，提示正在开发，如果要部署建议切换到生产环境
    if (process.env.NODE_ENV !== 'production' &&
      process.env.NODE_ENV !== 'test' &&
      config.productionTip !== false &&
      typeof console !== 'undefined'
    ) {
      console[console.info ? 'info' : 'log'](
        `You are running Vue in development mode.\n` +
        `Make sure to turn on production mode when deploying for production.\n` +
        `See more tips at https://vuejs.org/guide/deployment.html`
      )
    }
  }, 0)
}

export default Vue
