/*
* 执行npm run build的入口文件
*/
const fs = require('fs')
const path = require('path')
// 用于gzip压缩代码的第三方库
const zlib = require('zlib')
const rollup = require('rollup')
// 用于压缩和优化js代码。通过删除冗余代码、重命名变量、移除注释等方式减小Js文件的体积
const terser = require('terser')

// 判断dist目录是否存在,如果不存在则创建dist目录
if (!fs.existsSync('dist')) {
  // 创建dist目录
  fs.mkdirSync('dist')
}
// 执行npm run build时,包含了所有可能的构建目标配置。
let builds = require('./config').getAllBuilds()

// 判断命令是否包含额外参数
// 例如：build:ssr": "npm run build -- web-runtime-cjs,web-server-renderer",
if (process.argv[2]) {
  const filters = process.argv[2].split(',')
  // 根据命令参数过滤构建目标配置
  builds = builds.filter(b => {
    return filters.some(f => b.output.file.indexOf(f) > -1 || b._name.indexOf(f) > -1)
  })
} else {
  // 如果没有提供命令行参数，则默认过滤掉所有与 Weex 相关的构建目标
  builds = builds.filter(b => {
    return b.output.file.indexOf('weex') === -1
  })
}

build(builds)

/**
 * 逐个构建项目
 * 该函数接收一个构建配置数组，依次执行每个构建配置的构建过程
 * @param {Array} builds - 构建配置数组，每个元素代表一个待构建的配置
 */
function build (builds) {
  // 初始化已构建的数量为0
  let built = 0
  // 获取待构建的总数
  const total = builds.length

  /**
   * 构建下一个项目
   * 这个函数负责按顺序构建每个项目，直到所有项目构建完成
   */
  const next = () => {
    // 构建当前项目
    buildEntry(builds[built]).then(() => {
      // 构建成功后，增加已构建的数量
      built++
      // 如果还有项目未构建，则继续构建下一个项目
      if (built < total) {
        next()
      }
    }).catch(logError)
  }

  // 从第一个项目开始构建
  next()
}


/**
 * 构建入口文件
 * @param {Object} config - 配置对象，包含输出配置和构建所需的其他信息
 */
function buildEntry (config) {
  // 提取输出配置
  const output = config.output
  const { file, banner } = output
  // 判断是否是生产环境，根据文件名判断
  const isProd = /(min|prod)\.js$/.test(file)
  // 开始构建流程
  return rollup.rollup(config)
    .then(bundle => bundle.generate(output))
    .then(({ output: [{ code }] }) => {
      if (isProd) {
        // 如果是生产环境，进行代码压缩并添加banner（如果有）
        const minified = (banner ? banner + '\n' : '') + terser.minify(code, {
          // 允许优化顶层变量
          toplevel: true,
          // 确保输出只包含 ASCII 字符
          output: {
            ascii_only: true
          },
          // 移除 makeMap 等纯函数调用
          compress: {
            pure_funcs: ['makeMap']
          }
        }).code
        // 写入压缩后的文件
        return write(file, minified, true)
      } else {
        // 如果不是生产环境，直接写入未压缩的文件
        return write(file, code)
      }
    })
}


/**
 * @param {string} dest - 目标文件路径
 * @param {string} code - 要写入的文件内容
 * @param {boolean} zip - 指示是否需要压缩文件内容并报告压缩大小
 */
function write (dest, code, zip) {
  return new Promise((resolve, reject) => {
    /**
     * 在控制台中打印出文件的相对路径、大小，以及可选的额外信息
     * @param {string} extra - 压缩后的文件大小
     */
    function report (extra) {
      console.log(blue(path.relative(process.cwd(), dest)) + ' ' + getSize(code) + (extra || ''))
      resolve()
    }

    // 尝试写入目标文件
    fs.writeFile(dest, code, err => {
      // 如果写入过程中出现错误，拒绝Promise
      if (err) return reject(err)
      if (zip) {
        zlib.gzip(code, (err, zipped) => {
          if (err) return reject(err)
          // 打印gzip压缩后文件大小
          report(' (gzipped: ' + getSize(zipped) + ')')
        })
      } else {
        // 未压缩文件大小
        report()
      }
    })
  })
}

// 计算文件大小
function getSize (code) {
  return (code.length / 1024).toFixed(2) + 'kb'
}
// 打印文件写入过程中出现的错误信息
function logError (e) {
  console.log(e)
}
// 打印蓝色的日志信息
function blue (str) {
  return '\x1b[1m\x1b[34m' + str + '\x1b[39m\x1b[22m'
}
