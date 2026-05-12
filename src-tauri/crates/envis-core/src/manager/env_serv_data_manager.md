* 获取的 serviceData，一般不直接用其里面的status，而是有专门的接口轮询status，因此获取所有服务数据这里就不用设置sync_host_service_status了
* 获取所有service data，一般是通过读取 service data 文件获取的
* 创建service data后，立马尝试激活service data，但是如果激活失败那就算了，例如服务程序还没下载，如果后续错误修复了，例如服务程序下载了，也不在自动激活（目前是在前端实现的）