import { Environment, ServiceData } from "@/types/index"

// 排序辅助函数
export const sortEnvironments = (environments: Environment[]): Environment[] => {
  return [...environments].sort((a, b) => {
    const sortA = a.sort ?? 0
    const sortB = b.sort ?? 0
    return sortA - sortB
  })
}

export const sortServices = (services: ServiceData[]): ServiceData[] => {
  return [...services].sort((a, b) => {
    const sortA = a.sort ?? 0
    const sortB = b.sort ?? 0
    return sortA - sortB
  })
}
