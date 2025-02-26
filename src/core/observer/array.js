/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */
// 由于 Flow 类型检查工具在动态访问数组原型方法时表现不佳，因此不对该文件进行类型检查。

import { def } from '../util/index'; // 导入辅助函数 `def`，用于定义对象属性。
const arrayProto = Array.prototype; // 获取原生数组的原型对象。
export const arrayMethods = Object.create(arrayProto); // 创建一个新的对象，继承自数组原型，用于重写数组方法。
const methodsToPatch = [
  'push',    // 向数组末尾添加元素
  'pop',     // 删除数组末尾的元素
  'shift',   // 删除数组开头的元素
  'unshift', // 向数组开头添加元素
  'splice',  // 在数组中插入、删除或替换元素
  'sort',    // 对数组进行排序
  'reverse'  // 反转数组
];
/**
 * Intercept mutating methods and emit events
 * 拦截数组的变异方法，并触发事件通知
 */
methodsToPatch.forEach(function (method) {
  // 遍历需要拦截的数组方法列表。

  // 缓存原始方法（即原生数组方法）。
  const original = arrayProto[method];

  // 使用 `def` 函数在 `arrayMethods` 对象上定义新的方法。
  def(arrayMethods, method, function mutator(...args) {
    // 调用原始方法，并将结果存储在 `result` 中。
    const result = original.apply(this, args);

    // 获取当前数组的观察者实例（__ob__ 是 Vue 响应式系统中的一个内部属性）。
    const ob = this.__ob__;

    let inserted; // 用于存储新插入的元素。

    // 根据不同的方法，处理可能插入的新元素。
    switch (method) {
      case 'push':    // push 方法会向数组末尾添加元素。
      case 'unshift': // unshift 方法会向数组开头添加元素。
        inserted = args; // 新插入的元素就是传入的参数。
        break;
      case 'splice': // splice 方法可以从数组中插入、删除或替换元素。
        inserted = args.slice(2); // 新插入的元素是从第三个参数开始的部分。
        break;
    }

    // 如果有新插入的元素，调用观察者实例的 `observeArray` 方法对这些元素进行响应式处理。
    if (inserted) ob.observeArray(inserted);

    // 通知依赖更新（触发所有订阅者的重新渲染）。
    ob.dep.notify();

    // 返回原始方法的执行结果。
    return result;
  });
});
