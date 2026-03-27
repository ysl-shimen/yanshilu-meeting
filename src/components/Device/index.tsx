import { Row, Space, Tooltip, Col, Divider, Typography } from 'ant-design-vue';
import Icon from '../Icon';
import { CheckOutlined } from '@ant-design/icons-vue';
import { useGlobalFlag, useDeviceInfo, useChannelInfo } from '~/store';
import style from './index.module.less';
import { logger } from '~/utils/tools';
import { ref, computed } from 'vue';

const { Text } = Typography;

interface SelectorProps {
  title: string;
  list: MediaDeviceInfo[];
  currentId: string;
  onClick: (deviceId: string) => void;
  type: 'mic' | 'camera' | 'speaker';
}

interface DeviceProps {
  click?: () => void;
  inToolbar?: boolean;
}

// 将设备 label 转为友好的中文显示名
const getDeviceLabel = (item: MediaDeviceInfo, type: 'mic' | 'camera' | 'speaker'): string => {
  if (item.label) {
    // 常见英文设备名映射为中文
    const labelMap: Record<string, string> = {
      'speakerphone': '扬声器麦克风（免提）',
      'headset earpiece': '听筒麦克风',
      'built-in microphone': '内置麦克风',
      'default': '默认麦克风',
      'communications': '通话麦克风',
      'front camera': '前置摄像头',
      'back camera': '后置摄像头',
      'environment': '后置摄像头',
      'user': '前置摄像头',
    };
    const lower = item.label.toLowerCase();
    for (const [key, val] of Object.entries(labelMap)) {
      if (lower.includes(key)) return val;
    }
    return item.label;
  }
  // label 为空时按 deviceId 和类型给默认名称
  if (item.deviceId === 'default' || item.deviceId === 'communications') {
    return type === 'camera' ? '默认摄像头' : type === 'speaker' ? '默认扬声器' : '默认麦克风';
  }
  return type === 'camera' ? '摄像头' : type === 'speaker' ? '扬声器' : '麦克风';
};

const Selector = (props: SelectorProps) => {
  const { title, list, currentId, onClick, type } = props;
  if (list.length === 0) return null;
  return (
    <Row class={style.list}>
      <span>{title}</span>
      {list.map((item) => (
        <Col
          key={item.deviceId}
          // @ts-ignore
          onClick={(e) => {
            e.stopPropagation();
            onClick(item.deviceId);
          }}
        >
          {currentId === item.deviceId ? <CheckOutlined class={style.checked} /> : null}
          <Text>{getDeviceLabel(item, type)}</Text>
        </Col>
      ))}
    </Row>
  );
};

const useBase = () => {
  const showPanel = ref(false);
  const globalFlag = useGlobalFlag();
  const setShowPannel = (newValue: boolean) => {
    showPanel.value = newValue;
  };
  const getNode = (pannel: any, icon: string, onClick: any, hideArrow = false, inToolbar = false) => {
    // 仅在会议工具栏（inToolbar）且为触摸设备时加大间距，首页保持原有的 12px
    const spaceSize = (inToolbar && globalFlag.isTouch) ? 20 : 12;
    return (
      <Row class={style.wrap}>
        <Space size={[spaceSize, 0]}>
          <Icon type={icon} class={style.deviceIcon} onClick={onClick} />
          {hideArrow ? null : (
            <div onClick={(e) => e.stopPropagation()}>
              <Tooltip
                overlayClassName={style.tooltip}
                overlayInnerStyle={{
                  backgroundColor: 'rgba(245,247,250,0.9)',
                }}
                arrow={false}
                onOpenChange={(show) => {
                  showPanel.value = show;
                }}
                open={showPanel.value}
                title={pannel}
                trigger={'click'}
              >
                <Icon
                  class={[style.arrow, (inToolbar && globalFlag.isTouch) ? style.arrowTouch : '']}
                  type={!showPanel.value ? 'icon-XDS_Uparrow' : 'icon-XDS_Downarrow'}
                />
              </Tooltip>
            </div>
          )}
        </Space>
      </Row>
    );
  };
  return {
    getNode,
    showPanel,
    setShowPannel,
  };
};

export const Camera = (props: DeviceProps) => {
  const { click, inToolbar } = props;
  const channelInfo = useChannelInfo();
  const deviceInfo = useDeviceInfo();
  const iconType = computed(() =>
    !deviceInfo.cameraEnable ? 'icon-XDS_FrameMeetingFill' : 'icon-XDS_FrameMeetingLine',
  );
  const { getNode, setShowPannel } = useBase();
  const onCameraClick = (deviceId: string) => {
    deviceInfo.$patch({ cameraId: deviceId });
    logger.info(`camera changeTo ${deviceId}`);
    let newDeviceId = deviceId;
    if (deviceId === '0') {
      newDeviceId = 'environment';
    } else if (deviceId === '1') {
      newDeviceId = 'user';
    }
    channelInfo.cameraTrack?.setDevice(newDeviceId);
    setShowPannel(false);
  };
  const DevicePannel = (
    <Row>
      <Selector
        title="请选择摄像头"
        list={deviceInfo.cameraList}
        currentId={deviceInfo.cameraId}
        onClick={onCameraClick}
        type="camera"
      />
    </Row>
  );
  return getNode(DevicePannel, iconType.value, click, false, inToolbar);
};

export const Mic = (props: DeviceProps) => {
  const { click, inToolbar } = props;
  const globalFlag = useGlobalFlag();
  const channelInfo = useChannelInfo();
  const deviceInfo = useDeviceInfo();
  const { getNode, setShowPannel } = useBase();

  const iconType = computed(() =>
    !deviceInfo.micEnable ? 'icon-XDS_UnMute2Fill' : 'icon-XDS_Mute2',
  );
  const onMicClick = (deviceId: string) => {
    deviceInfo.$patch({ micId: deviceId });
    logger.info(`mic changeTo ${deviceId}`);
    channelInfo.micTrack?.setDevice(deviceId);
    setShowPannel(false);
  };
  const onSpeakerClick = (deviceId: string) => {
    deviceInfo.$patch({ speakerId: deviceId });
    logger.info(`speaker changeTo ${deviceId}`);
    setShowPannel(false);
    channelInfo.mcuAudioTrack?.setSpeaker(deviceId || undefined);
  };
  const DevicePannel = (
    <Row>
      <Selector
        title="请选择麦克风"
        list={deviceInfo.micList}
        currentId={deviceInfo.micId}
        onClick={onMicClick}
        type="mic"
      />
      {/* 触摸设备（手机/平板）不支持网页控制扬声器，隐藏此选项 */}
      {globalFlag.isTouch ? null : (
        <>
          <Divider style={{ margin: '6px 0' }} />
          <Selector
            title="请选择扬声器"
            list={deviceInfo.speakerList}
            currentId={deviceInfo.speakerId}
            onClick={onSpeakerClick}
            type="speaker"
          />
        </>
      )}
    </Row>
  );
  return getNode(DevicePannel, iconType.value, click, false, inToolbar);
};

export const Screen = () => {
  const { getNode } = useBase();
  return getNode(null, 'icon-XDS_share_screen1', null, true);
};
