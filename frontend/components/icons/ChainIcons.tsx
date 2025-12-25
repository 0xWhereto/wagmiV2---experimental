"use client";

interface IconProps {
  className?: string;
}

export function FantomIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="#1969ff" />
      <path
        d="M16.5 4L16.5 12.5L23.5 8.5L16.5 4Z"
        fill="white"
        fillOpacity="0.8"
      />
      <path
        d="M16.5 4L9.5 8.5L16.5 12.5V4Z"
        fill="white"
      />
      <path
        d="M16.5 22L9.5 18L16.5 14L23.5 18L16.5 22Z"
        fill="white"
        fillOpacity="0.8"
      />
      <path
        d="M9.5 19.5L16.5 23.5V28L9.5 24V19.5Z"
        fill="white"
        fillOpacity="0.6"
      />
      <path
        d="M23.5 19.5V24L16.5 28V23.5L23.5 19.5Z"
        fill="white"
        fillOpacity="0.8"
      />
    </svg>
  );
}

export function KavaIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="#ff5f43" />
      <text
        x="50%"
        y="55%"
        dominantBaseline="middle"
        textAnchor="middle"
        fill="white"
        fontSize="16"
        fontWeight="bold"
        fontFamily="system-ui, sans-serif"
      >
        K
      </text>
    </svg>
  );
}

export function EthIcon({ className = "w-7 h-7" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="14" fill="#627EEA" />
      <path
        d="M14 4V11.5L20 14.25L14 4Z"
        fill="white"
        fillOpacity="0.6"
      />
      <path
        d="M14 4L8 14.25L14 11.5V4Z"
        fill="white"
      />
      <path
        d="M14 18.97V24L20 15.5L14 18.97Z"
        fill="white"
        fillOpacity="0.6"
      />
      <path
        d="M14 24V18.97L8 15.5L14 24Z"
        fill="white"
      />
      <path
        d="M14 17.72L20 14.25L14 11.5V17.72Z"
        fill="white"
        fillOpacity="0.2"
      />
      <path
        d="M8 14.25L14 17.72V11.5L8 14.25Z"
        fill="white"
        fillOpacity="0.6"
      />
    </svg>
  );
}

export function DaiIcon({ className = "w-7 h-7" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="14" fill="#F5AC37" />
      <path
        d="M14 5C9.03 5 5 9.03 5 14C5 18.97 9.03 23 14 23C18.97 23 23 18.97 23 14C23 9.03 18.97 5 14 5ZM17.5 11H19.5C19.5 11 19.5 11.5 19.5 12H17.8C18.1 12.6 18.3 13.3 18.3 14C18.3 14.7 18.1 15.4 17.8 16H19.5V17H17.5C16.7 18.2 15.4 19 14 19H10V17H11V15H10V13H11V11H10V9H14C15.4 9 16.7 9.8 17.5 11ZM13 11V13H15.8C15.5 11.8 14.4 11 13 11ZM13 17V15H15.8C15.5 16.2 14.4 17 13 17Z"
        fill="white"
      />
    </svg>
  );
}

export function WagmiTokenIcon({ className = "w-7 h-7" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="14" fill="#10B981" />
      <path
        d="M8 10L11 18L14 12L17 18L20 10"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SwapArrowsIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6 4L6 16M6 16L2 12M6 16L10 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 16L14 4M14 4L18 8M14 4L10 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SettingsIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3 5H17M3 10H17M3 15H17"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="7" cy="5" r="1.5" fill="currentColor" />
      <circle cx="13" cy="10" r="1.5" fill="currentColor" />
      <circle cx="7" cy="15" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function PlusIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8 3V13M3 8H13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CloseIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 4L12 12M12 4L4 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function EditIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M11.5 2.5L13.5 4.5L5 13H3V11L11.5 2.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChevronDownIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 6L8 10L12 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BellIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10 2C7.79 2 6 3.79 6 6V10L4 12V14H16V12L14 10V6C14 3.79 12.21 2 10 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 14V15C8 16.1 8.9 17 10 17C11.1 17 12 16.1 12 15V14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MenuIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 6H20M4 12H20M4 18H20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CoinIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="7" fill="#FBBF24" />
      <circle cx="8" cy="8" r="5" fill="#F59E0B" />
      <text
        x="8"
        y="11"
        textAnchor="middle"
        fill="white"
        fontSize="7"
        fontWeight="bold"
      >
        $
      </text>
    </svg>
  );
}



