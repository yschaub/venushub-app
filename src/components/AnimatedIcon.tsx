
import React from 'react';
import { cn } from "@/lib/utils";

interface AnimatedIconProps {
  icon: React.ElementType;
  className?: string;
  size?: number;
  delay?: number;
}

const AnimatedIcon: React.FC<AnimatedIconProps> = ({ 
  icon: Icon, 
  className, 
  size = 24,
  delay = 0
}) => {
  return (
    <div 
      className={cn(
        "relative transition-opacity duration-500 ease-out-expo",
        "animate-fade-up",
        className
      )} 
      style={{ animationDelay: `${delay}ms` }}
    >
      <Icon size={size} />
    </div>
  );
};

export default AnimatedIcon;
