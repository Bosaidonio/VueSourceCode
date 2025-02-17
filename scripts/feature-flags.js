/*
* 用于生成rollup配置时,注入环境变量
*/
module.exports = {
  // Vue 2.6 引入了新的插槽语法（Scoped Slots 的简写形式）v-slot，以替代旧的 slot 和 slot-scope 属性。
  // 当设置为 true 时，表示支持并启用新插槽语法。
  NEW_SLOT_SYNTAX: true,
  // 决定vue指令正则匹配公式: src/compiler/parser/index.js
  VBIND_PROP_SHORTHAND: false
}
