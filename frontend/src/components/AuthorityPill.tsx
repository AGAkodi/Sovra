import React from 'react';

interface AuthorityPillProps {
  level: number;
  name?: string;
  showDetails?: boolean;
}

export const AuthorityPill: React.FC<AuthorityPillProps> = ({ level, name, showDetails = false }) => {
  const getStyle = () => {
    switch (level) {
      case 1:
        return 'bg-[#134731]/40 border-[#38C98B]/30 text-[#38C98B]';
      case 2:
        return 'bg-[#1B4754]/40 border-[#4CC9E8]/30 text-[#4CC9E8]';
      case 3:
        return 'bg-[#543D16]/40 border-[#F2B544]/30 text-[#F2B544]';
      case 4:
        return 'bg-[#5A3818]/40 border-[#F28B44]/30 text-[#F28B44]';
      case 5:
        return 'bg-[#542B1B]/40 border-[#EF7A55]/30 text-[#EF7A55]';
      case 6:
      default:
        return 'bg-[#4D1D1D]/40 border-[#EF6464]/30 text-[#EF6464]';
    }
  };

  const defaultNames: Record<number, string> = {
    1: 'Full Autonomous',
    2: 'Logged & Monitored',
    3: 'Velocity Restricted',
    4: 'Monitored Warning',
    5: 'Approval Required',
    6: 'Frozen / Blocked',
  };

  const displayName = name || defaultNames[level] || `Level ${level}`;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[6px] border text-xs font-medium tabular-nums ${getStyle()}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      <span>L{level} · {displayName}</span>
    </span>
  );
};

