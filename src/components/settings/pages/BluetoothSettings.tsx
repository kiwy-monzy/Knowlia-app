import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Bluetooth, BluetoothOff, Wifi, WifiOff, Settings, RefreshCw, Shield, Smartphone, Info, AlertCircle } from 'lucide-react';

// TypeScript interfaces for BLE data
interface BleDeviceInfo {
  ble_support: boolean;
  id: string;
  name: string;
  bluetooth_on: boolean;
  adv_extended: boolean;
  adv_extended_bytes: number;
  le_2m: boolean;
  le_coded: boolean;
  le_audio: boolean;
  le_periodic_adv_support: boolean;
  le_multiple_adv_support: boolean;
  offload_filter_support: boolean;
  offload_scan_batching_support: boolean;
}

interface BleStatus {
  is_enabled: boolean;
  is_scanning: boolean;
  is_advertising: boolean;
  discovered_count: number;
  connected_count: number;
  last_error?: string;
}

interface DiscoveredDevice {
  qaul_id: string;
  rssi: number;
  discovered_at: number;
}

export default function BluetoothSettings() {
  const [bleStatus, setBleStatus] = useState<BleStatus | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<BleDeviceInfo | null>(null);
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch BLE status
  const fetchBleStatus = async () => {
    try {
      const status = await invoke<BleStatus>('get_ble_status');
      setBleStatus(status);
    } catch (err) {
      console.error('Failed to fetch BLE status:', err);
      setError('Failed to fetch BLE status');
    }
  };

  // Fetch device info
  const fetchDeviceInfo = async () => {
    try {
      const info = await invoke<BleDeviceInfo>('get_ble_info');
      setDeviceInfo(info);
    } catch (err) {
      console.error('Failed to fetch BLE device info:', err);
      setError('Failed to fetch BLE device info');
    }
  };

  // Fetch discovered devices
  const fetchDiscoveredDevices = async () => {
    try {
      const devices = await invoke<DiscoveredDevice[]>('get_discovered_devices');
      setDiscoveredDevices(devices);
    } catch (err) {
      console.error('Failed to fetch discovered devices:', err);
      setError('Failed to fetch discovered devices');
    }
  };

  // Refresh all data
  const refreshAll = async () => {
    setRefreshing(true);
    setError(null);
    await Promise.all([
      fetchBleStatus(),
      fetchDeviceInfo(),
      fetchDiscoveredDevices()
    ]);
    setRefreshing(false);
  };

  // Start BLE
  const startBle = async () => {
    try {
      setLoading(true);
      await invoke('start_ble');
      await fetchBleStatus();
      setError(null);
    } catch (err) {
      console.error('Failed to start BLE:', err);
      setError('Failed to start BLE');
    } finally {
      setLoading(false);
    }
  };

  // Stop BLE
  const stopBle = async () => {
    try {
      setLoading(true);
      await invoke('stop_ble');
      await fetchBleStatus();
      setDiscoveredDevices([]);
      setError(null);
    } catch (err) {
      console.error('Failed to stop BLE:', err);
      setError('Failed to stop BLE');
    } finally {
      setLoading(false);
    }
  };

  // Request permissions
  const requestPermissions = async () => {
    try {
      const granted = await invoke<boolean>('request_ble_permissions');
      if (granted) {
        await startBle();
      } else {
        setError('BLE permissions not granted');
      }
    } catch (err) {
      console.error('Failed to request BLE permissions:', err);
      setError('Failed to request BLE permissions');
    }
  };

  // Send message to device
  const sendMessageToDevice = async (deviceId: string) => {
    try {
      const message = new TextEncoder().encode('Hello from qaul!');
      await invoke('send_ble_message', { deviceId, messageData: message });
      console.log('Message sent to device:', deviceId);
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message');
    }
  };

  // Initialize data
  useEffect(() => {
    refreshAll();
    setLoading(false);

    // Set up periodic refresh
    const interval = setInterval(() => {
      fetchBleStatus();
      fetchDiscoveredDevices();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Format RSSI
  const formatRssi = (rssi: number) => {
    if (rssi >= -50) return 'Excellent';
    if (rssi >= -60) return 'Good';
    if (rssi >= -70) return 'Fair';
    return 'Poor';
  };

  // Get signal strength color
  const getSignalColor = (rssi: number) => {
    if (rssi >= -50) return 'text-green-600';
    if (rssi >= -60) return 'text-blue-600';
    if (rssi >= -70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="p-6 pb-18 space-y-6 bg-white min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Bluetooth Settings</h2>
          <p className="text-gray-600 mt-1">Manage Bluetooth Low Energy connections and devices</p>
        </div>
        <button
          onClick={refreshAll}
          disabled={refreshing}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-blue-600 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="text-sm font-medium text-blue-700">Refresh</span>
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* BLE Status Card */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            {bleStatus?.is_enabled ? (
              <Bluetooth className="w-5 h-5 text-blue-600" />
            ) : (
              <BluetoothOff className="w-5 h-5 text-gray-400" />
            )}
            <span>BLE Status</span>
          </h3>
          <div className="flex items-center space-x-2">
            {bleStatus?.is_enabled ? (
              <button
                onClick={stopBle}
                disabled={loading}
                className="px-4 py-2 bg-red-50 text-red-700 rounded-lg border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                Stop BLE
              </button>
            ) : (
              <button
                onClick={requestPermissions}
                disabled={loading}
                className="px-4 py-2 bg-green-50 text-green-700 rounded-lg border border-green-200 hover:bg-green-100 transition-colors disabled:opacity-50"
              >
                Start BLE
              </button>
            )}
          </div>
        </div>

        {bleStatus && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div className="text-center">
              <div className={`text-lg font-bold ${bleStatus.is_enabled ? 'text-green-600' : 'text-gray-400'}`}>
                {bleStatus.is_enabled ? 'Enabled' : 'Disabled'}
              </div>
              <div className="text-gray-600">Status</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">{bleStatus.discovered_count}</div>
              <div className="text-gray-600">Discovered</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">{bleStatus.connected_count}</div>
              <div className="text-gray-600">Connected</div>
            </div>
            <div className="text-center">
              <div className={`text-lg font-bold ${bleStatus.is_scanning ? 'text-blue-600' : 'text-gray-400'}`}>
                {bleStatus.is_scanning ? 'Scanning' : 'Idle'}
              </div>
              <div className="text-gray-600">Scanning</div>
            </div>
            <div className="text-center">
              <div className={`text-lg font-bold ${bleStatus.is_advertising ? 'text-green-600' : 'text-gray-400'}`}>
                {bleStatus.is_advertising ? 'Advertising' : 'Hidden'}
              </div>
              <div className="text-gray-600">Advertising</div>
            </div>
          </div>
        )}
      </div>

      {/* Device Information */}
      {deviceInfo && (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <Smartphone className="w-5 h-5 text-blue-600" />
            <span>Device Information</span>
          </h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Device Name:</span>
                <span className="ml-2 font-medium">{deviceInfo.name}</span>
              </div>
              <div>
                <span className="text-gray-600">Device ID:</span>
                <span className="ml-2 font-mono text-xs">{deviceInfo.id}</span>
              </div>
              <div>
                <span className="text-gray-600">BLE Support:</span>
                <span className={`ml-2 font-medium ${deviceInfo.ble_support ? 'text-green-600' : 'text-red-600'}`}>
                  {deviceInfo.ble_support ? 'Supported' : 'Not Supported'}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Bluetooth On:</span>
                <span className={`ml-2 font-medium ${deviceInfo.bluetooth_on ? 'text-green-600' : 'text-red-600'}`}>
                  {deviceInfo.bluetooth_on ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>

            {/* Advanced Features */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Advanced Features</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${deviceInfo.adv_extended ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span>Extended Advertising</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${deviceInfo.le_2m ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span>2M PHY</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${deviceInfo.le_coded ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span>Coded PHY</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${deviceInfo.le_audio ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span>LE Audio</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${deviceInfo.le_periodic_adv_support ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span>Periodic Adv</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${deviceInfo.le_multiple_adv_support ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span>Multiple Adv</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${deviceInfo.offload_filter_support ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span>Filter Offload</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${deviceInfo.offload_scan_batching_support ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span>Scan Batching</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Discovered Devices */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <Wifi className="w-5 h-5 text-blue-600" />
          <span>Discovered Devices ({discoveredDevices.length})</span>
        </h3>

        {discoveredDevices.length === 0 ? (
          <div className="text-center py-8">
            <WifiOff className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No devices discovered yet</p>
            <p className="text-sm text-gray-400 mt-1">Make sure BLE is enabled and devices are nearby</p>
          </div>
        ) : (
          <div className="space-y-3">
            {discoveredDevices.map((device, index) => (
              <div key={device.qaul_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Wifi className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Device #{index + 1}</div>
                    <div className="text-sm text-gray-500 font-mono">{device.qaul_id}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className={`text-sm font-medium ${getSignalColor(device.rssi)}`}>
                      {device.rssi} dBm
                    </div>
                    <div className={`text-xs ${getSignalColor(device.rssi)}`}>
                      {formatRssi(device.rssi)}
                    </div>
                  </div>
                  <button
                    onClick={() => sendMessageToDevice(device.qaul_id)}
                    className="px-3 py-1 bg-blue-50 text-blue-700 rounded border border-blue-200 hover:bg-blue-100 transition-colors text-sm"
                  >
                    Send Message
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="bg-blue-50 p-6 rounded-xl border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center space-x-2">
          <Info className="w-5 h-5 text-blue-600" />
          <span>Bluetooth Setup Guide</span>
        </h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p>• <strong>Enable Bluetooth:</strong> Make sure Bluetooth is enabled on your device</p>
          <p>• <strong>Grant Permissions:</strong> Allow the app to access Bluetooth when prompted</p>
          <p>• <strong>Start Scanning:</strong> Click "Start BLE" to begin discovering nearby devices</p>
          <p>• <strong>Discover Devices:</strong> Nearby qaul nodes will appear in the discovered list</p>
          <p>• <strong>Connect:</strong> Devices connect automatically when discovered</p>
        </div>
      </div>
    </div>
  );
}
