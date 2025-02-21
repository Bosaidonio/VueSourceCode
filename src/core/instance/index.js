/**
 * Vue构造函数的定义文件，负责初始化Vue实例并混入各种功能模块。
 * 1、initMixin: 定义 _init 方法，用于初始化 Vue 实例
 * 2、stateMixin: 定义与数据相关的 API（如 $data、$props、$set、$delete 等）。
 * 3、renderMixin: 混入渲染相关方法，如$nextTick,_render等。
 * 4、eventsMixin: 定义事件相关的 API（如 $on、$off、$emit、$once 等）
 * 5、lifecycleMixin: 混入生命周期相关方法，如$mount,$destroy等。
 */

import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  // _init 方法由 initMixin 提供，
  // 负责处理选项（options）、初始化生命周期、事件系统、数据响应式等。
  // 原型链挂载位置：src/core/instance/init.js
  this._init(options)
}

initMixin(Vue)
stateMixin(Vue)
eventsMixin(Vue)
// 给Vue的prototype上挂载_update、$forceUpdate、$destroy方法
lifecycleMixin(Vue)
// 给Vue的prototype上挂载$nextTick、_render方法
renderMixin(Vue)

export default Vue
