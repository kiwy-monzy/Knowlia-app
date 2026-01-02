import React from 'react';
import cardSvg from '@/assets/card.svg';

const Card: React.FC = () => {
  return (
    <div className=" pointer-events-none z-2 w-full h-full">
      <img 
        src={cardSvg} 
        alt="Card background" 
        className="w-full h-full object-cover transform "
      />
    </div>
  );
};

export default Card;