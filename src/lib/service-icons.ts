import {
  FaShieldAlt,
  FaWindowMaximize,
  FaLayerGroup,
  FaPaintBrush,
  FaEye,
  FaCar,
  FaLock,
  FaUserShield,
  FaGem,
  FaCheckCircle,
  FaSprayCan,
  FaSun,
} from "react-icons/fa";

export interface IconOption {
  key: string;
  label: string;
  component: React.ComponentType<{ className?: string }>;
}

export const ICON_OPTIONS: IconOption[] = [
  { key: "shield", label: "درع الحماية", component: FaShieldAlt },
  { key: "tint", label: "تظليل النوافذ", component: FaWindowMaximize },
  { key: "nano", label: "طبقات نانو", component: FaLayerGroup },
  { key: "paint", label: "فرشاة الطلاء", component: FaPaintBrush },
  { key: "eye", label: "عين / رؤية", component: FaEye },
  { key: "car", label: "سيارة", component: FaCar },
  { key: "lock", label: "قفل / خصوصية", component: FaLock },
  { key: "user-shield", label: "حماية شخصية", component: FaUserShield },
  { key: "gem", label: "جودة استثنائية", component: FaGem },
  { key: "check", label: "علامة اكتمال", component: FaCheckCircle },
  { key: "spray", label: "رش", component: FaSprayCan },
  { key: "sun", label: "شمس", component: FaSun },
];

export function getServiceIcon(key: string | null | undefined) {
  const option = ICON_OPTIONS.find((o) => o.key === key);
  return option ? option.component : FaPaintBrush;
}

export function getIconLabel(key: string | null | undefined) {
  const option = ICON_OPTIONS.find((o) => o.key === key);
  return option ? option.label : "أيقونة افتراضية";
}