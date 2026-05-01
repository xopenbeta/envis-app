* 因为各自服务的特殊性，启动服务都是放在各个服务的逻辑文件中
* 这里只处理一些简单的逻辑，例如获取所有服务，获取服务体积等
* 文件的引用逻辑大致为 service -> serviceData -> environment，然后三者都可以用在command中，这样比较清晰，防止循环引用
* 因此 delete_service 这里就不能获取服务被哪些serviceData引用了然后禁止删除，这个逻辑只能写在command中