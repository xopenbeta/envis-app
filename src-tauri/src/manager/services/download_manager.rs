use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::ErrorKind;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, OnceLock};
use tokio::fs::File;
use tokio::io::AsyncWriteExt;

/// 下载状态
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DownloadStatus {
    Pending,
    Downloading,
    Downloaded,
    Installing,
    Installed,
    Failed,
    Cancelled,
}

/// 下载任务信息
#[derive(Clone, Serialize, Deserialize)]
pub struct DownloadTask {
    pub id: String,
    pub urls: Vec<String>,
    pub current_url_index: usize,
    pub url: String,          // 当前使用的URL
    pub target_path: PathBuf, // 下载位置
    pub filename: String,
    pub total_size: u64,
    pub downloaded_size: u64,
    pub status: DownloadStatus,
    pub progress: f64,
    pub error_message: Option<String>,
    pub failed_urls: Vec<String>, // 记录失败的URLs
    #[serde(skip)]
    pub success_callback: Option<SuccessCallback>, // 下载成功后的回调函数
}

impl std::fmt::Debug for DownloadTask {
    // 实现Debug trait以便于调试输出
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("DownloadTask")
            .field("id", &self.id)
            .field("urls", &self.urls)
            .field("current_url_index", &self.current_url_index)
            .field("url", &self.url)
            .field("target_path", &self.target_path)
            .field("filename", &self.filename)
            .field("total_size", &self.total_size)
            .field("downloaded_size", &self.downloaded_size)
            .field("status", &self.status)
            .field("progress", &self.progress)
            .field("error_message", &self.error_message)
            .field("failed_urls", &self.failed_urls)
            .field("success_callback", &self.success_callback.is_some())
            .finish()
    }
}

impl DownloadTask {
    pub fn new(
        id: String,
        urls: Vec<String>,
        target_path: PathBuf,
        filename: String,
        success_callback: Option<SuccessCallback>,
    ) -> Self {
        let current_url = urls.first().unwrap_or(&String::new()).clone();
        Self {
            id,
            urls,
            current_url_index: 0,
            url: current_url,
            target_path,
            filename,
            total_size: 0,
            downloaded_size: 0,
            status: DownloadStatus::Pending,
            progress: 0.0,
            error_message: None,
            failed_urls: Vec::new(),
            success_callback,
        }
    }

    /// 切换到下一个URL
    pub fn switch_to_next_url(&mut self) -> bool {
        if self.current_url_index + 1 < self.urls.len() {
            // 记录当前失败的URL
            if let Some(current_url) = self.urls.get(self.current_url_index) {
                self.failed_urls.push(current_url.clone());
            }

            self.current_url_index += 1;
            if let Some(next_url) = self.urls.get(self.current_url_index) {
                self.url = next_url.clone();
                // 重置下载进度，准备重新下载
                self.downloaded_size = 0;
                self.total_size = 0;
                self.progress = 0.0;
                self.status = DownloadStatus::Pending;
                return true;
            }
        }
        false
    }

    /// 获取当前URL
    pub fn get_current_url(&self) -> Option<&String> {
        self.urls.get(self.current_url_index)
    }

    /// 检查是否还有备用URL
    pub fn has_backup_urls(&self) -> bool {
        self.current_url_index + 1 < self.urls.len()
    }

    /// 计算下载进度
    pub fn calculate_progress(&mut self) {
        if self.total_size > 0 {
            self.progress = (self.downloaded_size as f64 / self.total_size as f64) * 100.0;
        }
    }
}

/// 下载成功回调函数类型
pub type SuccessCallback = Arc<dyn Fn(&DownloadTask) + Send + Sync>;

/// 全局下载管理器单例
static GLOBAL_DOWNLOAD_MANAGER: OnceLock<Arc<DownloadManager>> = OnceLock::new();

/// 下载管理器
pub struct DownloadManager {
    pub(crate) tasks: Arc<Mutex<HashMap<String, DownloadTask>>>,
    client: reqwest::Client,
}

impl DownloadManager {
    /// 获取全局下载管理器单例
    pub fn global() -> Arc<DownloadManager> {
        GLOBAL_DOWNLOAD_MANAGER
            .get_or_init(|| Arc::new(DownloadManager::new()))
            .clone()
    }

    /// 创建新的下载管理器实例（内部使用）
    fn new() -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(300)) // 5分钟超时
            .build()
            .expect("Failed to create HTTP client");

        Self {
            tasks: Arc::new(Mutex::new(HashMap::new())),
            client,
        }
    }

    /// 开始下载任务（支持备用URL和成功回调）
    pub async fn start_download(
        &self,
        id: String,
        urls: Vec<String>,
        target_dir: PathBuf,
        filename: String,
        overwrite_existing: bool,
        success_callback: Option<SuccessCallback>,
    ) -> Result<()> {
        if urls.is_empty() {
            return Err(anyhow!("下载URL列表不能为空"));
        }

        // 确保目标目录存在
        if !target_dir.exists() {
            fs::create_dir_all(&target_dir)?;
        }

        // 如果需要覆盖，先清理现有文件
        let target_path = target_dir.join(&filename);
        if overwrite_existing && target_path.exists() {
            // 如果是目录，删除整个目录
            if target_path.is_dir() {
                fs::remove_dir_all(&target_path)?;
            } else {
                fs::remove_file(&target_path)?;
            }
            log::debug!("已清理现有文件: {:?}", target_path);
        }

        // 创建下载任务
        let task = DownloadTask::new(
            id.clone(),
            urls,
            target_path.clone(),
            filename,
            success_callback,
        );

        // 添加任务到管理器
        {
            let mut tasks = self.tasks.lock().unwrap();
            tasks.insert(id.clone(), task.clone());
        }

        // 开始下载（支持重试不同URL）
        self.download_with_fallback(&id).await
    }

    /// 支持备用URL的下载方法
    pub async fn download_with_fallback(&self, id: &str) -> Result<()> {
        loop {
            let current_task = {
                let tasks = self.tasks.lock().unwrap();
                tasks.get(id).cloned()
            };

            let Some(mut task) = current_task else {
                return Err(anyhow!("未找到下载任务: {}", id));
            };

            // 检查任务是否被取消
            if matches!(task.status, DownloadStatus::Cancelled) {
                return Err(anyhow!("下载已取消"));
            }

            // 尝试下载当前URL
            let result = self.download_file(&mut task).await;

            match result {
                Ok(_) => {
                    // 下载成功，更新任务状态并调用回调
                    let callback = {
                        let mut tasks = self.tasks.lock().unwrap();
                        if let Some(stored_task) = tasks.get_mut(id) {
                            stored_task.status = DownloadStatus::Downloaded;
                            stored_task.progress = 100.0;
                            stored_task.success_callback.clone()
                        } else {
                            None
                        }
                    };

                    // 在锁外调用回调，避免死锁
                    if let Some(callback) = callback {
                        let task_for_callback = {
                            let tasks = self.tasks.lock().unwrap();
                            tasks.get(id).cloned()
                        };
                        if let Some(task) = task_for_callback {
                            callback(&task);
                        }
                    }
                    return Ok(());
                }
                Err(e) => {
                    // 下载失败，尝试切换到下一个URL
                    let should_retry = {
                        let mut tasks = self.tasks.lock().unwrap();
                        if let Some(stored_task) = tasks.get_mut(id) {
                            // 如果任务已被取消，不要重试备用 URL，直接停止
                            if matches!(stored_task.status, DownloadStatus::Cancelled) {
                                log::info!("检测到任务已取消，停止重试: {}", id);
                                false
                            } else if stored_task.switch_to_next_url() {
                                log::warn!(
                                    "下载失败，切换到备用URL: {} -> {}",
                                    e,
                                    stored_task.get_current_url().unwrap_or(&"未知".to_string())
                                );
                                true
                            } else {
                                // 没有更多备用URL，设置为失败状态
                                stored_task.status = DownloadStatus::Failed;
                                stored_task.error_message = Some(format!(
                                    "所有下载地址都失败了。失败的URLs: {:?}。最后错误: {}",
                                    stored_task.failed_urls, e
                                ));
                                false
                            }
                        } else {
                            false
                        }
                    };

                    if !should_retry {
                        return Err(e);
                    }
                    // 继续循环，尝试下一个URL
                }
            }
        }
    }

    /// 执行文件下载
    async fn download_file(&self, task: &mut DownloadTask) -> Result<()> {
        log::info!("开始下载文件: {} -> {:?}", task.url, task.target_path);

        // 发送HTTP请求
        log::info!("正在连接下载服务器...");
        let response = self.client.get(&task.url).send().await?;

        if !response.status().is_success() {
            let error_msg = format!("下载失败，状态码: {}", response.status());
            log::error!("{}", error_msg);
            return Err(anyhow!(error_msg));
        }

        // 更新任务状态和文件大小到全局存储
        let total_size = response.content_length().unwrap_or(0);
        {
            let mut tasks = self.tasks.lock().unwrap();
            if let Some(stored_task) = tasks.get_mut(&task.id) {
                stored_task.status = DownloadStatus::Downloading;
                stored_task.total_size = total_size;
            }
        }

        task.status = DownloadStatus::Downloading;
        task.total_size = total_size;
        log::info!(
            "文件大小: {} 字节 ({:.2} MB)",
            task.total_size,
            task.total_size as f64 / 1024.0 / 1024.0
        );

        // 创建输出文件
        let mut file = File::create(&task.target_path).await?;
        let mut downloaded = 0u64;
        let mut last_log_time = std::time::Instant::now();

        // 读取响应流并写入文件
        let mut stream = response.bytes_stream();
        use futures_util::StreamExt;

        log::info!("开始下载数据流...");
        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result?;

            // 检查任务是否被取消
            {
                let tasks = self.tasks.lock().unwrap();
                if let Some(current_task) = tasks.get(&task.id) {
                    if matches!(current_task.status, DownloadStatus::Cancelled) {
                        log::info!("下载已取消: {}", task.id);
                        return Err(anyhow!("下载已取消"));
                    }
                }
            }

            // 写入文件
            file.write_all(&chunk).await?;
            downloaded += chunk.len() as u64;

            // 更新进度
            {
                let mut tasks = self.tasks.lock().unwrap();
                if let Some(stored_task) = tasks.get_mut(&task.id) {
                    stored_task.downloaded_size = downloaded;
                    stored_task.calculate_progress();

                    // 每1秒打印一次进度日志
                    if last_log_time.elapsed() >= std::time::Duration::from_secs(1) {
                        log::debug!(
                            "下载进度 [{}]: {:.1}% ({}/{} 字节)",
                            stored_task.id,
                            stored_task.progress,
                            stored_task.downloaded_size,
                            stored_task.total_size
                        );
                        last_log_time = std::time::Instant::now();
                    }
                }
            }
        }

        file.flush().await?;
        log::info!("文件下载完成: {:?} ({} 字节)", task.target_path, downloaded);
        Ok(())
    }

    /// 取消下载任务
    pub fn cancel_download(&self, id: &str) -> Result<()> {
        let mut tasks = self.tasks.lock().unwrap();

        if let Some(task) = tasks.get_mut(id) {
            task.status = DownloadStatus::Cancelled;

            // 清理已下载的文件
            if task.target_path.exists() {
                if task.target_path.is_dir() {
                    fs::remove_dir_all(&task.target_path)?;
                } else {
                    fs::remove_file(&task.target_path)?;
                }
                log::debug!("已清理取消的下载文件: {:?}", task.target_path);

                // 强制删除父目录及其所有内容（不判断是否为空）
                if let Some(parent) = task.target_path.parent() {
                    match fs::remove_dir_all(parent) {
                        Ok(_) => log::debug!("已强制删除父目录及其内容: {:?}", parent),
                        Err(e) => {
                            // 忽略目标不存在的错误，其他错误打印日志
                            if e.kind() != ErrorKind::NotFound {
                                log::error!("强制删除父目录失败: {:?}, 错误: {}", parent, e);
                            }
                        }
                    }
                }
            }

            Ok(())
        } else {
            Err(anyhow!("未找到下载任务: {}", id))
        }
    }

    /// 获取下载任务状态
    pub fn get_task_status(&self, id: &str) -> Option<DownloadTask> {
        let tasks = self.tasks.lock().unwrap();
        tasks.get(id).cloned()
    }

    /// 获取所有下载任务
    pub fn get_all_tasks(&self) -> Vec<DownloadTask> {
        let tasks = self.tasks.lock().unwrap();
        tasks.values().cloned().collect()
    }

    /// 更新任务状态
    pub fn update_task_status(
        &self,
        id: &str,
        status: DownloadStatus,
        error_message: Option<String>,
    ) -> Result<()> {
        let mut tasks = self.tasks.lock().unwrap();

        if let Some(task) = tasks.get_mut(id) {
            task.status = status;
            if let Some(msg) = error_message {
                task.error_message = Some(msg);
            }
            Ok(())
        } else {
            Err(anyhow!("未找到下载任务: {}", id))
        }
    }

    /// 获取正在进行的下载任务数量
    pub fn get_active_downloads_count(&self) -> usize {
        let tasks = self.tasks.lock().unwrap();
        tasks
            .values()
            .filter(|task| {
                matches!(
                    task.status,
                    DownloadStatus::Pending | DownloadStatus::Downloading
                )
            })
            .count()
    }
}

/// 下载结果
#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadResult {
    pub success: bool,
    pub message: String,
    pub task: Option<DownloadTask>,
}

impl DownloadResult {
    pub fn success(message: String, task: Option<DownloadTask>) -> Self {
        Self {
            success: true,
            message,
            task,
        }
    }

    pub fn error(message: String) -> Self {
        Self {
            success: false,
            message,
            task: None,
        }
    }
}
