/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { defineComputed, proxy } from '../instance/state'
import { extend, mergeOptions, validateComponentName } from '../util/index'
/**
 * 初始化 Vue 的继承功能（Vue.extend）。
 *
 * 该函数为 Vue 添加了一个静态方法 `Vue.extend`，用于创建子类构造器。
 * 子类构造器通过原型继承的方式扩展父类的功能，并支持组件选项的合并和缓存。
 *
 * 主要功能包括：
 * 1. **唯一标识符 (cid)**：
 *    - 每个构造器（包括 Vue 和其子类）都有一个唯一的 `cid`，用于标识构造器并支持缓存。
 * 2. **子类构造器的创建**：
 *    - 使用 `Vue.extend` 方法，基于父类构造器创建子类构造器。
 *    - 子类构造器会继承父类的原型链，并合并父类和子类的选项。
 * 3. **选项合并**：
 *    - 合并父类和子类的选项（如 props、computed、components 等），确保子类拥有完整的配置。
 * 4. **性能优化**：
 *    - 在扩展时为 props 和 computed 属性定义代理 getter，避免在每个实例化对象时重复调用 `Object.defineProperty`。
 * 5. **递归组件支持**：
 *    - 如果子类有名称（`name`），会自动将其注册到自身的 `components` 中，支持递归组件。
 * 6. **资源注册器的继承**：
 *    - 子类继承父类的资源注册器（如 component、directive、filter），允许子类拥有独立的资源。
 * 7. **缓存机制**：
 *    - 缓存已创建的子类构造器，避免重复创建相同的子类。
 *
 * @param {GlobalAPI} Vue - Vue 构造器，用于挂载 `Vue.extend` 方法。
 */
export function initExtend (Vue: GlobalAPI) {
  /**
   * Each instance constructor, including Vue, has a unique
   * cid. This enables us to create wrapped "child
   * constructors" for prototypal inheritance and cache them.
   */
  Vue.cid = 0
  let cid = 1

  /**
   * @param {Object} extendOptions - 就是export default的时候导出的对象。
   * @returns {Function} Sub - 返回一个子类构造器函数。
   */
  Vue.extend = function (extendOptions: Object): Function {
    // 如果 extendOptions 未定义，则初始化为空对象
    extendOptions = extendOptions || {}

    // this为Vue构造函数
    const Super = this

    // 获取父类构造器的唯一标识符 cid
    const SuperId = Super.cid

    // 缓存机制：尝试从 extendOptions._Ctor 中获取已缓存的子类构造器
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})
    if (cachedCtors[SuperId]) {
      return cachedCtors[SuperId] // 如果已缓存，直接返回缓存的子类构造器
    }

    // 获取子类的名称（优先使用 extendOptions.name，否则使用父类的 name）
    const name = extendOptions.name || Super.options.name

    // 在非生产环境下，验证组件名称是否合法
    if (process.env.NODE_ENV !== 'production' && name) {
      validateComponentName(name)
    }

    /**
     * 定义子类构造器函数 Sub。
     * Sub 是一个构造函数，实例化时会调用 Vue 实例的 _init 方法进行初始化。
     */
    const Sub = function VueComponent (options) {
      this._init(options) // 调用 Vue 实例的初始化方法
    }

    // 设置子类的原型链，使其继承父类的原型
    Sub.prototype = Object.create(Super.prototype)
    Sub.prototype.constructor = Sub

    // 为子类分配唯一的 cid
    Sub.cid = cid++

    // 合并父类和子类的选项，生成子类的最终选项
    Sub.options = mergeOptions(
      Super.options, // 父类选项
      extendOptions  // 子类扩展选项
    )

    // 保存对父类构造器的引用
    Sub['super'] = Super

    /**
     * 性能优化：
     * 在扩展时为 props 和 computed 属性定义代理 getter，避免在每个实例化对象时重复调用 Object.defineProperty。
     */
    if (Sub.options.props) {
      initProps(Sub) // 初始化 props
    }
    if (Sub.options.computed) {
      initComputed(Sub) // 初始化 computed 属性
    }

    /**
     * 允许子类进一步扩展或使用混入、插件等功能。
     * 将父类的静态方法（如 extend、mixin、use）复制到子类上。
     */
    Sub.extend = Super.extend
    Sub.mixin = Super.mixin
    Sub.use = Super.use

    /**
     * 创建资源注册器（component、directive、filter），使子类可以拥有独立的资源。
     * 遍历 ASSET_TYPES（如 component、directive、filter），将父类的资源注册器复制到子类上。
     */
    ASSET_TYPES.forEach(function (type) {
      Sub[type] = Super[type]
    })

    /**
     * 支持递归组件：
     * 如果子类有名称（name），将其注册到自身的 components 中，以便支持递归调用。
     */
    if (name) {
      Sub.options.components[name] = Sub
    }

    /**
     * 保存父类选项的引用，便于后续实例化时检查父类选项是否更新。
     * sealedOptions 是子类选项的一个深拷贝，用于冻结子类的初始选项。
     */
    Sub.superOptions = Super.options // 父类选项
    Sub.extendOptions = extendOptions // 子类扩展选项
    Sub.sealedOptions = extend({}, Sub.options) // 冻结的子类选项

    /**
     * 缓存子类构造器，避免重复创建相同的子类。
     * 将子类构造器缓存到 extendOptions._Ctor 中，键为父类的 cid。
     */
    cachedCtors[SuperId] = Sub

    // 返回子类构造器
    return Sub
  }
}

function initProps (Comp) {
  const props = Comp.options.props
  for (const key in props) {
    proxy(Comp.prototype, `_props`, key)
  }
}

function initComputed (Comp) {
  const computed = Comp.options.computed
  for (const key in computed) {
    defineComputed(Comp.prototype, key, computed[key])
  }
}
