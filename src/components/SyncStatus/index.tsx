import { useState, useEffect } from 'react'
import { useSnapshot } from 'valtio'
import { Badge, Button, Progress, Tooltip, Popover, Space, Typography } from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DisconnectOutlined,
  ExclamationCircleOutlined,
  PauseOutlined,
  ReloadOutlined,
  WifiOutlined,
  CloudOutlined,
  GlobalOutlined,
  ClockCircleOutlined,
  PlayCircleOutlined
} from '@ant-design/icons'
import { syncStore } from '@/stores/sync'
import syncPlugin from '@/plugins/sync'

const { Text } = Typography

interface SyncStatusProps {
  className?: string
  showDetails?: boolean
}

export default function SyncStatus({ className, showDetails = false }: SyncStatusProps) {
  const syncStoreSnapshot = useSnapshot(syncStore)
  const [isOpen, setIsOpen] = useState(false)
  const [syncProgress, setSyncProgress] = useState(0)
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected')
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'paused'>('idle')
  const [wsConnected, setWsConnected] = useState(false)
  const [networkOnline, setNetworkOnline] = useState(navigator.onLine)

  useEffect(() => {
    // 监听同步状态变化
    syncPlugin.on('sync-status', (event: any) => {
      setSyncStatus(event.status)
      if (event.progress !== undefined) {
        setSyncProgress(event.progress)
      }
    })

    // 监听连接状态变化
    syncPlugin.on('connection-change', (event: any) => {
      setConnectionStatus(event.status)
    })

    // 监听WebSocket状态变化
    syncPlugin.on('websocket-status', (event: any) => {
      setWsConnected(event.connected)
    })

    // 监听网络状态变化
    syncPlugin.on('network-status', (event: any) => {
      setNetworkOnline(event.online)
    })

    // 监听认证状态变化
    syncPlugin.on('auth-status', (event: any) => {
      if (event.authenticated) {
        // 登录成功后重新加载状态
        loadInitialStatus()
      } else {
        // 登出后重置状态
        syncStore.account.isLoggedIn = false
        syncStore.account.userId = ''
        syncStore.account.email = ''
        syncStore.account.devices = []
        setConnectionStatus('disconnected')
        setSyncStatus('idle')
        setWsConnected(false)
      }
    })

    // 监听同步更新
    syncPlugin.on('sync-update', (event: any) => {
      if (event.type === 'sync_complete') {
        setLastSyncTime(new Date().toLocaleString())
        setSyncProgress(100)
        setTimeout(() => setSyncProgress(0), 2000)
      }
    })

    // 初始化状态
    loadInitialStatus()

    // 清理函数（如果需要的话）
    return () => {
      // 事件监听器清理逻辑
    }
  }, [])

  const loadInitialStatus = async () => {
    try {
      const status = await syncPlugin.getSyncStatus()
      setSyncStatus(status.isRunning ? 'syncing' : 'idle')
      setLastSyncTime(status.lastSync ? status.lastSync.toLocaleString() : null)
      
      // 检查连接状态
      const isConnected = await syncPlugin.testConnection()
      setConnectionStatus(isConnected ? 'connected' : 'disconnected')
      
      // 检查WebSocket状态
      const wsStatus = await syncPlugin.getWebSocketStatus()
      setWsConnected(wsStatus.connected)
    } catch (error) {
      console.error('Failed to load sync status:', error)
    }
  }

  const handleToggleSync = async () => {
    try {
      if (syncStatus === 'paused') {
        await syncPlugin.startSyncService()
      } else {
        await syncPlugin.stopSyncService()
      }
    } catch (error) {
      console.error('Failed to toggle sync:', error)
    }
  }

  const handleForceSync = async () => {
    try {
      setSyncStatus('syncing')
      setSyncProgress(0)
      await syncPlugin.forceSyncAll()
    } catch (error) {
      console.error('Failed to force sync:', error)
      setSyncStatus('error')
    }
  }

  const handleReconnectWebSocket = async () => {
    try {
      await syncPlugin.reconnectWebSocket()
    } catch (error) {
      console.error('Failed to reconnect WebSocket:', error)
    }
  }

  const getStatusIcon = () => {
    if (!syncStoreSnapshot.account.isLoggedIn) {
      return <DisconnectOutlined style={{ fontSize: '16px', color: '#d9d9d9' }} />
    }

    switch (syncStatus) {
      case 'syncing':
        return <ReloadOutlined spin style={{ fontSize: '16px', color: '#1890ff' }} />
      case 'error':
        return <CloseCircleOutlined style={{ fontSize: '16px', color: '#ff4d4f' }} />
      case 'paused':
        return <PauseOutlined style={{ fontSize: '16px', color: '#faad14' }} />
      case 'idle':
        return connectionStatus === 'connected' 
          ? <CheckCircleOutlined style={{ fontSize: '16px', color: '#52c41a' }} />
          : <DisconnectOutlined style={{ fontSize: '16px', color: '#d9d9d9' }} />
      default:
        return <CloudOutlined style={{ fontSize: '16px', color: '#d9d9d9' }} />
    }
  }

  const getStatusText = () => {
    if (!syncStoreSnapshot.account.isLoggedIn) {
      return '未登录'
    }

    switch (syncStatus) {
      case 'syncing':
        return '同步中'
      case 'error':
        return '同步错误'
      case 'paused':
        return '已暂停'
      case 'idle':
        return connectionStatus === 'connected' ? '已连接' : '已断开'
      default:
        return '未知状态'
    }
  }

  const getStatusColor = () => {
    if (!syncStoreSnapshot.account.isLoggedIn) {
      return 'default'
    }

    switch (syncStatus) {
      case 'syncing':
        return 'processing'
      case 'error':
        return 'error'
      case 'paused':
        return 'warning'
      case 'idle':
        return connectionStatus === 'connected' ? 'success' : 'default'
      default:
        return 'default'
    }
  }

  const StatusIndicator = () => (
    <Space className={className}>
      {getStatusIcon()}
      {showDetails && (
        <>
          <Badge status={getStatusColor() as any} text={getStatusText()} />
          {syncProgress > 0 && syncProgress < 100 && (
            <Progress percent={syncProgress} size="small" style={{ width: 64 }} />
          )}
        </>
      )}
    </Space>
  )

  if (!showDetails) {
    return (
      <Tooltip
        title={
          <div>
            <div>同步状态: {getStatusText()}</div>
            {lastSyncTime && <div>最后同步: {lastSyncTime}</div>}
            {syncStoreSnapshot.conflicts.length > 0 && (
              <div style={{ color: '#faad14' }}>
                {syncStoreSnapshot.conflicts.length} 个冲突待解决
              </div>
            )}
          </div>
        }
      >
        <Button type="text" size="small" className={className}>
          <StatusIndicator />
        </Button>
      </Tooltip>
    )
  }

  return (
    <Popover
      open={isOpen}
      onOpenChange={setIsOpen}
      content={
        <div style={{ width: 320 }}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong style={{ fontSize: 16 }}>同步状态</Text>
              <Badge status={getStatusColor() as any} text={getStatusText()} />
            </div>

            {syncProgress > 0 && syncProgress < 100 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
                  <span>同步进度</span>
                  <span>{Math.round(syncProgress)}%</span>
                </div>
                <Progress percent={syncProgress} />
              </div>
            )}

            <div style={{ fontSize: 14 }}>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>连接状态</span>
                  <Space size={4}>
                    {connectionStatus === 'connected' ? (
                      <WifiOutlined style={{ fontSize: 12, color: '#52c41a' }} />
                    ) : (
                      <DisconnectOutlined style={{ fontSize: 12, color: '#d9d9d9' }} />
                    )}
                    <span>
                      {connectionStatus === 'connected' ? '已连接' : '已断开'}
                    </span>
                  </Space>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>WebSocket</span>
                  <Space size={4}>
                    {wsConnected ? (
                      <GlobalOutlined style={{ fontSize: 12, color: '#52c41a' }} />
                    ) : (
                      <DisconnectOutlined style={{ fontSize: 12, color: '#d9d9d9' }} />
                    )}
                    <span>
                      {wsConnected ? '已连接' : '未连接'}
                    </span>
                  </Space>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>网络状态</span>
                  <Space size={4}>
                    {networkOnline ? (
                      <CheckCircleOutlined style={{ fontSize: 12, color: '#52c41a' }} />
                    ) : (
                      <CloseCircleOutlined style={{ fontSize: 12, color: '#ff4d4f' }} />
                    )}
                    <span>
                      {networkOnline ? '在线' : '离线'}
                    </span>
                  </Space>
                </div>

                {lastSyncTime && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>最后同步</span>
                    <Space size={4}>
                      <ClockCircleOutlined style={{ fontSize: 12 }} />
                      <span>{lastSyncTime}</span>
                    </Space>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>设备数量</span>
                  <span>{syncStoreSnapshot.account.devices.length}</span>
                </div>

                {syncStoreSnapshot.conflicts.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>待解决冲突</span>
                    <Space size={4}>
                      <ExclamationCircleOutlined style={{ fontSize: 12, color: '#faad14' }} />
                      <span>{syncStoreSnapshot.conflicts.length}</span>
                    </Space>
                  </div>
                )}
              </Space>
            </div>

            {syncStoreSnapshot.account.isLoggedIn && (
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Space.Compact style={{ width: '100%' }}>
                  <Button
                    style={{ flex: 1 }}
                    onClick={handleToggleSync}
                  >
                    {syncStatus === 'paused' ? (
                      <>
                        <PlayCircleOutlined style={{ marginRight: 4 }} />
                        恢复
                      </>
                    ) : (
                      <>
                        <PauseOutlined style={{ marginRight: 4 }} />
                        暂停
                      </>
                    )}
                  </Button>
                  <Button
                    style={{ flex: 1 }}
                    onClick={handleForceSync}
                    disabled={syncStatus === 'syncing' || !wsConnected}
                  >
                    <ReloadOutlined
                      spin={syncStatus === 'syncing'}
                      style={{ marginRight: 4 }}
                    />
                    同步
                  </Button>
                </Space.Compact>
                {!wsConnected && (
                  <Button
                    block
                    onClick={handleReconnectWebSocket}
                  >
                    <GlobalOutlined style={{ marginRight: 4 }} />
                    重连WebSocket
                  </Button>
                )}
              </Space>
            )}

            {!syncStoreSnapshot.account.isLoggedIn && (
              <div style={{ textAlign: 'center' }}>
                <Text type="secondary">请先登录以启用同步功能</Text>
              </div>
            )}
          </Space>
        </div>
      }
      placement="bottomRight"
    >
      <Button type="text" size="small" className={className}>
        <StatusIndicator />
      </Button>
    </Popover>
  )
}