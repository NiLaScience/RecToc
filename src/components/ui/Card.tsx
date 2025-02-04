import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <div className={`overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-sm ${className}`}>
      {children}
    </div>
  );
};

export default Card; 