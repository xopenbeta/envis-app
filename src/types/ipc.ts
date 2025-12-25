// 抽象到这里其实没啥作用了
export interface CommonResult {
  success: boolean
  message?: string
  data?: any
}

export interface IPCResult<T = any> extends CommonResult {
  data?: T
}

export interface CommandResult extends CommonResult {
  data?: {
    output?: string
  }
}
