import { useState, useEffect } from 'react'
import { ServiceData, ServiceDataStatus, HostEntry } from '@/types/index'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
    Plus,
    Trash2,
    Edit2,
    Save,
    X,
    Globe,
    RefreshCw,
    AlertTriangle,
    FolderOpen
} from 'lucide-react'
import { useHostService } from '@/hooks/services/host'
import { useEnvironmentServiceData } from '@/hooks/env-serv-data'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'

interface HostManagementViewProps {
    selectedEnvironmentId: string
    serviceData: ServiceData
}

export function HostManagementView({
    selectedEnvironmentId,
    serviceData,
}: HostManagementViewProps) {
    const { addHost, updateHost, deleteHost, toggleHost, openHostsFile } = useHostService()
    const { updateServiceData } = useEnvironmentServiceData()
    const [hosts, setHosts] = useState<HostEntry[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [editingHost, setEditingHost] = useState<HostEntry | null>(null)
    const [showAddDialog, setShowAddDialog] = useState(false)
    const [showPasswordDialog, setShowPasswordDialog] = useState(false)
    const [password, setPassword] = useState('')
    const [pendingAction, setPendingAction] = useState<((pwd: string) => Promise<void>) | null>(null)
    const isServiceDataActive = serviceData.status === ServiceDataStatus.Active

    // 新增/编辑表单状态
    const [formData, setFormData] = useState({
        ip: '',
        hostname: '',
        comment: '',
        enabled: true,
    })

    // 从 sessionStorage 获取密码
    const getStoredPassword = () => {
        return sessionStorage.getItem('envis_sudo_password') || ''
    }

    // 存储密码到 sessionStorage
    const storePassword = (pwd: string) => {
        sessionStorage.setItem('envis_sudo_password', pwd)
    }

    // 清除存储的密码
    const clearStoredPassword = () => {
        sessionStorage.removeItem('envis_sudo_password')
    }

    // 请求密码的辅助函数
    const requestPassword = (action: (pwd: string) => Promise<void>) => {
        const storedPassword = getStoredPassword()
        if (storedPassword) {
            // 如果已有密码，直接执行
            executeWithPassword(action, storedPassword)
        } else {
            // 否则显示密码输入对话框
            setPendingAction(() => action)
            setPassword('')
            setShowPasswordDialog(true)
        }
    }

    // 使用密码执行操作
    const executeWithPassword = async (action: (pwd: string) => Promise<void>, pwd: string) => {
        try {
            await action(pwd)
            // 操作成功，存储密码
            storePassword(pwd)
        } catch (error: any) {
            // 如果是密码错误，清除存储的密码
            if (error?.message?.includes('密码错误')) {
                clearStoredPassword()
                toast.error('密码错误，请重新输入')
                // 重新显示密码对话框
                setPendingAction(() => action)
                setPassword('')
                setShowPasswordDialog(true)
            } else {
                throw error
            }
        }
    }

    // 确认密码输入
    const handlePasswordConfirm = async () => {
        if (!password.trim()) {
            toast.error('请输入密码')
            return
        }

        if (pendingAction) {
            setShowPasswordDialog(false)
            await executeWithPassword(pendingAction, password)
            setPendingAction(null)
            setPassword('')
        }
    }

    // 加载 hosts 列表
    const loadHosts = async () => {
        setIsLoading(true)
        try {
            // 直接从 metadata 加载
            const metadataHosts = serviceData.metadata?.hosts as HostEntry[] | undefined
            setHosts(metadataHosts || [])
        } catch (error) {
            console.error('加载 hosts 失败:', error)
            toast.error('加载 hosts 失败')
        } finally {
            setIsLoading(false)
        }
    }

    // 组件挂载或 metadata 变化时加载 hosts
    useEffect(() => {
        loadHosts()
    }, [serviceData.id, serviceData.metadata, isServiceDataActive])

    // 重置表单
    const resetForm = () => {
        setFormData({
            ip: '',
            hostname: '',
            comment: '',
            enabled: true,
        })
        setEditingHost(null)
    }

    // 打开新增对话框
    const handleAddClick = () => {
        resetForm()
        setShowAddDialog(true)
    }

    // 打开编辑对话框
    const handleEditClick = (host: HostEntry) => {
        setEditingHost(host)
        setFormData({
            ip: host.ip,
            hostname: host.hostname,
            comment: host.comment || '',
            enabled: host.enabled,
        })
        setShowAddDialog(true)
    }

    // 保存 host（新增或更新）
    const handleSave = async () => {
        // 验证输入
        if (!formData.ip.trim() || !formData.hostname.trim()) {
            toast.error('IP 地址和主机名不能为空')
            return
        }

        // 简单的 IP 地址格式验证
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
        if (!ipRegex.test(formData.ip.trim())) {
            toast.error('请输入有效的 IP 地址')
            return
        }

        const entry: HostEntry = {
            id: editingHost?.id || `${formData.ip}_${formData.hostname}`,
            ip: formData.ip.trim(),
            hostname: formData.hostname.trim(),
            comment: formData.comment.trim() || undefined,
            enabled: formData.enabled,
        }

        // 请求密码并执行操作
        const action = async (pwd?: string) => {
            setIsLoading(true)
            try {
                // 1. 如果服务激活，更新系统文件
                if (isServiceDataActive && pwd) {
                    let res
                    if (editingHost) {
                        res = await updateHost(editingHost, entry, pwd)
                    } else {
                        res = await addHost(entry, pwd)
                    }

                    if (!res || !res.success) {
                        if (res?.message?.includes('密码错误')) {
                            throw new Error('密码错误')
                        }
                        throw new Error(res?.message || '系统文件更新失败')
                    }
                }

                // 2. 更新 ServiceData
                const newHosts = [...hosts]
                if (editingHost) {
                    const index = newHosts.findIndex(h => h.id === editingHost.id)
                    if (index !== -1) newHosts[index] = entry
                } else {
                    newHosts.push(entry)
                }

                await updateServiceData(serviceData.id, {
                    metadata: { ...serviceData.metadata, hosts: newHosts }
                })

                setHosts(newHosts)

                toast.success(editingHost ? 'Host 更新成功' : 'Host 添加成功')
                setShowAddDialog(false)
                resetForm()
            } catch (error: any) {
                console.error('保存失败:', error)
                if (error.message === '密码错误') {
                    throw error // 让 executeWithPassword 处理
                }
                toast.error((editingHost ? '更新失败: ' : '添加失败: ') + (error.message || '未知错误'))
            } finally {
                setIsLoading(false)
            }
        }

        if (isServiceDataActive) {
            requestPassword(action)
        } else {
            await action()
        }
    }

    // 删除 host
    const handleDelete = async (host: HostEntry) => {
        const action = async (pwd?: string) => {
            setIsLoading(true)
            try {
                // 1. 如果服务激活，更新系统文件
                if (isServiceDataActive && pwd) {
                    const res = await deleteHost(host.ip, host.hostname, pwd)
                    if (!res || !res.success) {
                        if (res?.message?.includes('密码错误')) {
                            throw new Error('密码错误')
                        }
                        throw new Error(res?.message || '系统文件更新失败')
                    }
                }

                // 2. 更新 ServiceData
                const newHosts = hosts.filter(h => h.id !== host.id)
                await updateServiceData(serviceData.id, {
                    metadata: { ...serviceData.metadata, hosts: newHosts }
                })
                setHosts(newHosts)

                toast.success('Host 删除成功')
            } catch (error: any) {
                console.error('删除失败:', error)
                if (error.message === '密码错误') {
                    throw error
                }
                toast.error('删除失败: ' + (error.message || '未知错误'))
            } finally {
                setIsLoading(false)
            }
        }

        if (isServiceDataActive) {
            requestPassword(action)
        } else {
            await action()
        }
    }

    // 切换 host 启用状态
    const handleToggle = async (host: HostEntry) => {
        const action = async (pwd?: string) => {
            setIsLoading(true)
            try {
                // 1. 如果服务激活，更新系统文件
                if (isServiceDataActive && pwd) {
                    const res = await toggleHost(host.ip, host.hostname, pwd)
                    if (!res || !res.success) {
                        if (res?.message?.includes('密码错误')) {
                            throw new Error('密码错误')
                        }
                        throw new Error(res?.message || '系统文件更新失败')
                    }
                }

                // 2. 更新 ServiceData
                const newHosts = hosts.map(h =>
                    h.id === host.id ? { ...h, enabled: !h.enabled } : h
                )
                await updateServiceData(serviceData.id, {
                    metadata: { ...serviceData.metadata, hosts: newHosts }
                })
                setHosts(newHosts)

                toast.success('Host 状态切换成功')
            } catch (error: any) {
                console.error('切换状态失败:', error)
                if (error.message === '密码错误') {
                    throw error
                }
                toast.error('切换状态失败: ' + (error.message || '未知错误'))
            } finally {
                setIsLoading(false)
            }
        }

        if (isServiceDataActive) {
            requestPassword(action)
        } else {
            await action()
        }
    }


    // 打开 hosts 文件所在文件夹
    const handleOpenHostsFile = async () => {
        try {
            const res = await openHostsFile()
            if (res && res.success) {
                toast.success('已打开 hosts 文件所在文件夹')
            } else {
                toast.error('打开失败: ' + (res?.message || '未知错误'))
            }
        } catch (error) {
            console.error('打开 hosts 文件失败:', error)
            toast.error('打开 hosts 文件失败')
        }
    }

    return (
        <div className="w-full space-y-4">

            <Alert className="bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900/20 mb-4">
                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
                {/* <AlertTitle className="text-yellow-800 dark:text-yellow-500 text-xs font-semibold">
                        提示
                    </AlertTitle> */}
                <AlertDescription className="text-yellow-700 dark:text-yellow-600/90 text-xs mt-1.5 space-y-2">
                    <p>
                        管理系统 hosts 文件中的域名映射。注意：修改 Hosts 文件需要管理员权限，操作时可能需要输入密码。
                    </p>
                </AlertDescription>
            </Alert>

            <div className="p-3 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
                <div className="flex justify-between w-full items-center mb-4">
                    <div>
                        <Label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                            <Globe className="h-3.5 w-3.5" />
                            Hosts 管理
                        </Label>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleOpenHostsFile}
                            disabled={isLoading || !isServiceDataActive}
                            className="h-7 text-xs px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        >
                            <FolderOpen className="h-3 w-3 mr-1" />
                            打开 hosts
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleAddClick}
                            disabled={isLoading || !isServiceDataActive}
                            className="h-7 text-xs px-2 shadow-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        >
                            <Plus className="h-3 w-3 mr-1" />
                            添加 Host
                        </Button>
                    </div>
                </div>

                <div className="space-y-2">
                    {hosts.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed border-gray-200 dark:border-white/10">
                            <p className="text-sm">还没有配置任何 host</p>
                            <p className="text-xs mt-1">点击"添加 Host"开始配置</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {hosts.map((host) => (
                                <div
                                    key={host.id}
                                    className={`flex items-center justify-between gap-2 p-3 border rounded-lg transition-colors ${host.enabled
                                            ? 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10'
                                            : 'bg-gray-50 dark:bg-white/[0.02] border-gray-200 dark:border-white/10 opacity-75'
                                        }`}
                                >
                                    <div className="flex flex-col gap-1 overflow-hidden">
                                        {/* 第一行：域名，IP */}
                                        <div className="flex items-center gap-2">
                                            <span className={`text-sm font-medium leading-none ${!host.enabled && 'text-muted-foreground'}`}>
                                                {host.hostname}
                                            </span>
                                            <span className={`text-[12px] font-mono bg-gray-100 dark:bg-white/10 px-1 py-0.5 rounded text-muted-foreground leading-none`}>
                                                {host.ip}
                                            </span>
                                        </div>
                                        {/* 第二行：备注 */}
                                        {!!host.comment && (
                                            <span className="text-xs text-muted-foreground truncate">
                                                {host.comment || '无备注'}
                                            </span>
                                        )}
                                    </div>

                                    {/* 操作按钮 */}
                                    <div className="flex items-center gap-1 shrink-0">
                                        <div className="flex items-center gap-1.5 mr-1">
                                            <Label className="text-xs cursor-pointer" htmlFor={`switch-${host.id}`}>启用</Label>
                                            <Switch
                                                id={`switch-${host.id}`}
                                                checked={host.enabled}
                                                onCheckedChange={() => handleToggle(host)}
                                                disabled={isLoading || !isServiceDataActive}
                                                className="origin-right"
                                            />
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEditClick(host)}
                                            disabled={isLoading || !isServiceDataActive}
                                            className="h-5 w-5 p-0"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(host)}
                                            disabled={isLoading || !isServiceDataActive}
                                            className="h-5 w-5 p-0 text-destructive hover:text-destructive hover:bg-red-50 dark:hover:bg-red-900/20"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* 添加/编辑 Host 对话框 */}
            <AlertDialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {editingHost ? '编辑 Host' : '添加 Host'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            配置域名到 IP 地址的映射关系
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="ip">IP 地址 *</Label>
                            <Input
                                id="ip"
                                value={formData.ip}
                                onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
                                placeholder="例如: 127.0.0.1"
                                className="shadow-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="hostname">主机名 *</Label>
                            <Input
                                id="hostname"
                                value={formData.hostname}
                                onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
                                placeholder="例如: example.local"
                                className="shadow-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="comment">备注（可选）</Label>
                            <Input
                                id="comment"
                                value={formData.comment}
                                onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                                placeholder="添加说明信息"
                                className="shadow-none"
                            />
                        </div>
                        <div className="flex items-center space-x-2">
                            <Switch
                                id="enabled"
                                checked={formData.enabled}
                                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                            />
                            <Label htmlFor="enabled">启用此 Host</Label>
                        </div>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel className='shadow-none' onClick={resetForm}>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSave} disabled={isLoading}>
                            {isLoading ? '保存中...' : '保存'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* 密码输入对话框 */}
            <AlertDialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>需要管理员权限</AlertDialogTitle>
                        <AlertDialogDescription>
                            修改系统 hosts 文件需要管理员权限，请输入您的密码。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="password">密码 *</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handlePasswordConfirm()
                                    }
                                }}
                                placeholder="输入您的系统密码"
                                className="shadow-none"
                                autoFocus
                            />
                        </div>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel className='shadow-none' onClick={() => {
                            setPassword('')
                            setPendingAction(null)
                        }}>
                            取消
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={handlePasswordConfirm}>
                            确认
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
