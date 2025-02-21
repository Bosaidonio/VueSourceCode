/* @flow */

// vue全局配置信息
import config from 'core/config'
// cached函数位置： src/shared/util.js
import { warn, cached } from 'core/util/index'
// 性能测试
import { mark, measure } from 'core/util/perf'

import Vue from './runtime/index'
import { query } from './util/index'
import { compileToFunctions } from './compiler/index'
import { shouldDecodeNewlines, shouldDecodeNewlinesForHref } from './util/compat'
// 当template的值以#开头，则从id中获取template内容
const idToTemplate = cached(id => {
  const el = query(id)
  return el && el.innerHTML
})

const mount = Vue.prototype.$mount
// 定义 Vue.prototype.$mount 方法，用于将 Vue 实例挂载到指定的 DOM 元素上
Vue.prototype.$mount = function (
  el?: string | Element, // 挂载的目标元素（可以是选择器字符串或 DOM 元素）
  hydrating?: boolean // 服务端渲染时的水合标志
): Component {
  // 如果传入了 el，则通过 query 函数将其转换为真实的 DOM 元素
  el = el && query(el)

  /* istanbul ignore if */
  // 禁止将 Vue 实例挂载到 <html> 或 <body> 元素上
  if (el === document.body || el === document.documentElement) {
    process.env.NODE_ENV !== 'production' && warn(
      `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
    )
    return this
  }

  const options = this.$options // 获取当前实例的配置选项

  // 如果没有定义 render 函数，则需要解析 template 或 el 并将其转换为 render 函数
  if (!options.render) {
    let template = options.template // 尝试从 options.template 中获取模板

    if (template) {
      // 如果 template 是字符串
      if (typeof template === 'string') {
        // 如果 template 是以 '#' 开头的选择器，则尝试通过 id 查找对应的 DOM 元素并获取其内容
        if (template.charAt(0) === '#') {
          template = idToTemplate(template)
          /* istanbul ignore if */
          // 如果在开发环境中未找到对应的模板元素，则发出警告
          if (process.env.NODE_ENV !== 'production' && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
      }
      // 如果 template 是一个 DOM 元素，则直接获取其 innerHTML
      else if (template.nodeType) {
        template = template.innerHTML
      }
      // 如果 template 格式无效，则发出警告并终止挂载
      else {
        if (process.env.NODE_ENV !== 'production') {
          warn('invalid template option:' + template, this)
        }
        return this
      }
    }
    // 如果没有提供 template，则尝试从 el 中获取外层 HTML 作为模板
    else if (el) {
      template = getOuterHTML(el)
    }

    // 如果成功获取到模板，则将其编译为 render 函数
    if (template) {
      /* istanbul ignore if */
      // 如果启用了性能监控，则记录编译开始标记
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile')
      }

      // 调用 compileToFunctions 将模板编译为 render 函数和静态渲染函数
      const { render, staticRenderFns } = compileToFunctions(template, {
        outputSourceRange: process.env.NODE_ENV !== 'production', // 是否输出源码范围（开发环境）
        shouldDecodeNewlines, // 是否解码换行符
        shouldDecodeNewlinesForHref, // 是否对 href 属性解码换行符
        delimiters: options.delimiters, // 自定义分隔符
        comments: options.comments // 是否保留注释
      }, this)

      // 将编译结果赋值给 options.render 和 options.staticRenderFns
      options.render = render
      options.staticRenderFns = staticRenderFns

      /* istanbul ignore if */
      // 如果启用了性能监控，则记录编译结束标记，并测量编译耗时
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile end')
        measure(`vue ${this._name} compile`, 'compile', 'compile end')
      }
    }
  }

  // 调用原始的 mount 方法完成挂载
  return mount.call(this, el, hydrating)
}
/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
function getOuterHTML (el: Element): string {
  if (el.outerHTML) {
    return el.outerHTML
  } else {
    const container = document.createElement('div')
    container.appendChild(el.cloneNode(true))
    return container.innerHTML
  }
}

Vue.compile = compileToFunctions

export default Vue
