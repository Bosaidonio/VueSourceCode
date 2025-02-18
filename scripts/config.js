const path = require('path')
// 将js转换为兼容性更高的代码。
const buble = require('rollup-plugin-buble')
// 模块路径别名插件，用于简化路径引用。
const alias = require('rollup-plugin-alias')
// 将 CommonJS 模块转换为 ES 模块。
const cjs = require('rollup-plugin-commonjs')
// 替换代码中的变量或字符串。
const replace = require('rollup-plugin-replace')
// 解析 Node.js 模块。
const node = require('rollup-plugin-node-resolve')
// 移除 Flow 类型注解。
const flow = require('rollup-plugin-flow-no-whitespace')
// 获取vue版本号
const version = process.env.VERSION || require('../package.json').version
// vue支持weex的版本号
const weexVersion = process.env.WEEX_VERSION || require('../packages/weex-vue-framework/package.json').version
// 用于注入环境变量
const featureFlags = require('./feature-flags')

// 生成文件注释
const banner =
  '/*!\n' +
  ` * Vue.js v${version}\n` +
  ` * (c) 2014-${new Date().getFullYear()} Evan You\n` +
  ' * Released under the MIT License.\n' +
  ' */'

// 自定义插件，用于生成 Weex 的工厂函数
const weexFactoryPlugin = {
  intro () {
    return 'module.exports = function weexFactory (exports, document) {'
  },
  outro () {
    return '}'
  }
}
// src目录下路径别名映射表，
const aliases = require('./alias')
const resolve = p => {
  const base = p.split('/')[0]
  console.log('aliases[base]',aliases[base],base)
  // 获取打包入口文件路径
  if (aliases[base]) {
    // src/platforms/web + entry-runtime-with-compiler.js
    return path.resolve(aliases[base], p.slice(base.length + 1))
  } else {
    // 获取打包文件输出路径
    return path.resolve(__dirname, '../', p)
  }
}
// 构建配置映射表，由package.json中的命令行参数决定运行哪个配置
const builds = {
  // Runtime only (CommonJS). Used by bundlers e.g. Webpack & Browserify
  'web-runtime-cjs-dev': {
    entry: resolve('web/entry-runtime.js'),
    dest: resolve('dist/vue.runtime.common.dev.js'),
    format: 'cjs',
    env: 'development',
    banner
  },
  'web-runtime-cjs-prod': {
    entry: resolve('web/entry-runtime.js'),
    dest: resolve('dist/vue.runtime.common.prod.js'),
    format: 'cjs',
    env: 'production',
    banner
  },
  // Runtime+compiler CommonJS build (CommonJS)
  'web-full-cjs-dev': {
    entry: resolve('web/entry-runtime-with-compiler.js'),
    dest: resolve('dist/vue.common.dev.js'),
    format: 'cjs',
    env: 'development',
    alias: { he: './entity-decoder' },
    banner
  },
  'web-full-cjs-prod': {
    entry: resolve('web/entry-runtime-with-compiler.js'),
    dest: resolve('dist/vue.common.prod.js'),
    format: 'cjs',
    env: 'production',
    alias: { he: './entity-decoder' },
    banner
  },
  // Runtime only ES modules build (for bundlers)
  'web-runtime-esm': {
    entry: resolve('web/entry-runtime.js'),
    dest: resolve('dist/vue.runtime.esm.js'),
    format: 'es',
    banner
  },
  // Runtime+compiler ES modules build (for bundlers)
  'web-full-esm': {
    entry: resolve('web/entry-runtime-with-compiler.js'),
    dest: resolve('dist/vue.esm.js'),
    format: 'es',
    alias: { he: './entity-decoder' },
    banner
  },
  // Runtime+compiler ES modules build (for direct import in browser)
  'web-full-esm-browser-dev': {
    entry: resolve('web/entry-runtime-with-compiler.js'),
    dest: resolve('dist/vue.esm.browser.js'),
    format: 'es',
    transpile: false,
    env: 'development',
    alias: { he: './entity-decoder' },
    banner
  },
  // Runtime+compiler ES modules build (for direct import in browser)
  'web-full-esm-browser-prod': {
    entry: resolve('web/entry-runtime-with-compiler.js'),
    dest: resolve('dist/vue.esm.browser.min.js'),
    format: 'es',
    transpile: false,
    env: 'production',
    alias: { he: './entity-decoder' },
    banner
  },
  // runtime-only build (Browser)
  'web-runtime-dev': {
    entry: resolve('web/entry-runtime.js'),
    dest: resolve('dist/vue.runtime.js'),
    format: 'umd',
    env: 'development',
    banner
  },
  // runtime-only production build (Browser)
  'web-runtime-prod': {
    entry: resolve('web/entry-runtime.js'),
    dest: resolve('dist/vue.runtime.min.js'),
    format: 'umd',
    env: 'production',
    banner
  },
  // Runtime+compiler development build (Browser)
  'web-full-dev': {
    entry: resolve('web/entry-runtime-with-compiler.js'),
    dest: resolve('dist/vue.js'),
    format: 'umd',
    env: 'development',
    alias: { he: './entity-decoder' },
    banner
  },
  // Runtime+compiler production build  (Browser)
  'web-full-prod': {
    entry: resolve('web/entry-runtime-with-compiler.js'),
    dest: resolve('dist/vue.min.js'),
    format: 'umd',
    env: 'production',
    alias: { he: './entity-decoder' },
    banner
  },
  // Web compiler (CommonJS).
  'web-compiler': {
    entry: resolve('web/entry-compiler.js'),
    dest: resolve('packages/vue-template-compiler/build.js'),
    format: 'cjs',
    external: Object.keys(require('../packages/vue-template-compiler/package.json').dependencies)
  },
  // Web compiler (UMD for in-browser use).
  'web-compiler-browser': {
    entry: resolve('web/entry-compiler.js'),
    dest: resolve('packages/vue-template-compiler/browser.js'),
    format: 'umd',
    env: 'development',
    moduleName: 'VueTemplateCompiler',
    plugins: [node(), cjs()]
  },
  // Web server renderer (CommonJS).
  'web-server-renderer-dev': {
    entry: resolve('web/entry-server-renderer.js'),
    dest: resolve('packages/vue-server-renderer/build.dev.js'),
    format: 'cjs',
    env: 'development',
    external: Object.keys(require('../packages/vue-server-renderer/package.json').dependencies)
  },
  'web-server-renderer-prod': {
    entry: resolve('web/entry-server-renderer.js'),
    dest: resolve('packages/vue-server-renderer/build.prod.js'),
    format: 'cjs',
    env: 'production',
    external: Object.keys(require('../packages/vue-server-renderer/package.json').dependencies)
  },
  'web-server-renderer-basic': {
    entry: resolve('web/entry-server-basic-renderer.js'),
    dest: resolve('packages/vue-server-renderer/basic.js'),
    format: 'umd',
    env: 'development',
    moduleName: 'renderVueComponentToString',
    plugins: [node(), cjs()]
  },
  'web-server-renderer-webpack-server-plugin': {
    entry: resolve('server/webpack-plugin/server.js'),
    dest: resolve('packages/vue-server-renderer/server-plugin.js'),
    format: 'cjs',
    external: Object.keys(require('../packages/vue-server-renderer/package.json').dependencies)
  },
  'web-server-renderer-webpack-client-plugin': {
    entry: resolve('server/webpack-plugin/client.js'),
    dest: resolve('packages/vue-server-renderer/client-plugin.js'),
    format: 'cjs',
    external: Object.keys(require('../packages/vue-server-renderer/package.json').dependencies)
  },
  // Weex runtime factory
  'weex-factory': {
    weex: true,
    entry: resolve('weex/entry-runtime-factory.js'),
    dest: resolve('packages/weex-vue-framework/factory.js'),
    format: 'cjs',
    plugins: [weexFactoryPlugin]
  },
  // Weex runtime framework (CommonJS).
  'weex-framework': {
    weex: true,
    entry: resolve('weex/entry-framework.js'),
    dest: resolve('packages/weex-vue-framework/index.js'),
    format: 'cjs'
  },
  // Weex compiler (CommonJS). Used by Weex's Webpack loader.
  'weex-compiler': {
    weex: true,
    entry: resolve('weex/entry-compiler.js'),
    dest: resolve('packages/weex-template-compiler/build.js'),
    format: 'cjs',
    external: Object.keys(require('../packages/weex-template-compiler/package.json').dependencies)
  }
}

/**
 * 根据给定的名称生成Rollup构建配置
 * @param {string} name - 构建配置的名称，对应builds对象中的键
 * @returns {Object} - Rollup构建配置对象
 */
function genConfig (name) {
  // 获取builds配置对象，name: builds对象的键
  const opts = builds[name]
  // rollup配置对象
  const config = {
    // 入口文件路径
    input: opts.entry,
    // 外部依赖库
    external: opts.external,
    // 插件数组，包含通用插件和根据具体配置添加的插件
    plugins: [
      flow(),
      alias(Object.assign({}, aliases, opts.alias))
    ].concat(opts.plugins || []),
    // 输出配置
    output: {
      // 输出文件路径
      file: opts.dest,
      // 输出文件格式例如 cjs（CommonJS）、es（ES 模块）、umd（通用模块定义）。
      format: opts.format,
      // 文件头部注释
      banner: opts.banner,
      // UMD 格式下的全局变量名称。
      name: opts.moduleName || 'Vue'
    },
    // 警告处理函数，忽略循环依赖的警告
    onwarn: (msg, warn) => {
      if (!/Circular/.test(msg)) {
        warn(msg)
      }
    }
  }

  // 内置变量配置
  const vars = {
    __WEEX__: !!opts.weex,
    __WEEX_VERSION__: weexVersion,
    __VERSION__: version
  }
  // 将featureFlags中的环境变量注入到构建配置中
  Object.keys(featureFlags).forEach(key => {
    vars[`process.env.${key}`] = featureFlags[key]
  })
  // 构建特定的环境变量
  if (opts.env) {
    vars['process.env.NODE_ENV'] = JSON.stringify(opts.env)
  }
  // 将环境变量添加到插件中
  config.plugins.push(replace(vars))

  // 是否需要转译，根据配置决定是否添加buble插件
  if (opts.transpile !== false) {
    config.plugins.push(buble())
  }

  // 定义配置对象的_name属性，不可枚举
  Object.defineProperty(config, '_name', {
    enumerable: false,
    value: name
  })

  // 返回构建配置对象
  return config
}

// 如果命令指定了TARGET 环境变量，则导出对应的目标配置。
if (process.env.TARGET) {
  module.exports = genConfig(process.env.TARGET)
} else {
  // 否则，导出所有构建配置
  exports.getBuild = genConfig
  // 获取所有构建配置
  exports.getAllBuilds = () => Object.keys(builds).map(genConfig)
}
