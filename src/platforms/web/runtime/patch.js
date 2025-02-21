/* @flow */
import * as nodeOps from 'web/runtime/node-ops' // 导入与 DOM 操作相关的工具函数
import { createPatchFunction } from 'core/vdom/patch' // 导入创建 patch 函数的工厂方法
import baseModules from 'core/vdom/modules/index' // 导入核心模块（如 ref、directives 等）
import platformModules from 'web/runtime/modules/index' // 导入平台特定模块（如 attrs、class、style 等）

// 指令模块应该最后应用，确保所有内置模块已经应用完毕
const modules = platformModules.concat(baseModules)

/**
 * 创建并导出 patch 函数。
 * patch 函数是 Vue 的核心 diff 算法实现，用于将虚拟 DOM 转换为真实 DOM 并更新视图。
 */
export const patch: Function = createPatchFunction({ nodeOps, modules })
