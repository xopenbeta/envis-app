import { MongoDBConfig } from "@/types/service"
import * as yaml from 'js-yaml'

/**
 * 解析 MongoDB YAML 配置字符串
 * @param yamlContent YAML 配置文件内容
 * @returns 解析后的配置对象
 */
export function parseMongoDBYamlConfig(yamlContent: string): MongoDBConfig {
  try {
    // 使用 js-yaml 解析 YAML
    const parsedYaml = yaml.load(yamlContent) as any
    
    if (!parsedYaml || typeof parsedYaml !== 'object') {
      return {
        parseError: '无效的 YAML 格式'
      }
    }
    
    const config: Partial<MongoDBConfig> = {}
    
    // 解析 net 配置
    if (parsedYaml.net) {
      if (parsedYaml.net.port !== undefined) {
        config.port = Number(parsedYaml.net.port)
      }
      if (parsedYaml.net.bindIp !== undefined) {
        config.bindIp = String(parsedYaml.net.bindIp)
      }
    }
    
    // 解析 storage 配置
    if (parsedYaml.storage) {
      if (parsedYaml.storage.dbPath !== undefined) {
        config.dataPath = String(parsedYaml.storage.dbPath)
      }
    }
    
    // 解析 systemLog 配置
    if (parsedYaml.systemLog) {
      if (parsedYaml.systemLog.path !== undefined) {
        config.logPath = String(parsedYaml.systemLog.path)
      }
      // 解析错误日志路径
      if (parsedYaml.systemLog.errorLogPath !== undefined) {
        config.errorLogPath = String(parsedYaml.systemLog.errorLogPath)
      }
    }
    
    // 设置默认值
    if (!config.bindIp) {
      config.bindIp = '127.0.0.1'
    }
    
    if (!config.port) {
      config.port = 27017
    }
    
    return config as MongoDBConfig
    
  } catch (error) {
    console.error('解析 MongoDB YAML 配置失败:', error)
    return {
      parseError: `解析配置文件失败: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}
