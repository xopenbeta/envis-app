* sub_dirs 的作用是，不仅仅只把程序根目录加到path里就完事，程序可能在bin文件夹内，甚至有多个可执行程序分散在不同文件夹内，这里就是将这些子文件夹都放到path中
* 一般而言，如果解包后没有bin文件夹，那么也不要新建bin文件夹然后把程序拷贝过去，没那个必要
* env_vars 和 metadata 的区别是，env_vars 放进 metadata 里，但metadata中还有其他的，例如自定义服务的自定义路径，自定义变量，host服务的host数据等
* CommandResponse结构中，message 只能是字符串纯英文的，它代表这条消息的type