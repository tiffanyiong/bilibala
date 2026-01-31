import React from 'react';

interface CarouselCardProps {
  index: number;
  totalCards: number;
  isActive: boolean;
  isRotating: boolean;
  children: React.ReactNode;
}

const CarouselCard: React.FC<CarouselCardProps> = ({
  index,
  totalCards,
  isActive,
  isRotating,
  children,
}) => {
  // Calculate rotation angle for this card's position on the cube
  // For 6 cards: 0°, 60°, 120°, 180°, 240°, 300°
  const anglePerCard = 360 / totalCards;
  const rotateY = index * anglePerCard;

  // Calculate translateZ based on number of cards
  // For a hexagonal prism with 6 faces, the apothem (distance from center to face) is:
  // apothem = sideLength / (2 * tan(π/n)) where n = number of sides
  // For card width of ~448px and 6 sides: ~388px
  const cardWidth = 448; // max-w-xl equivalent
  const translateZ = cardWidth / (2 * Math.tan(Math.PI / totalCards));

  return (
    <div
      className={`
        absolute inset-0 w-full h-full
        transition-opacity duration-300
        ${isRotating ? '' : isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}
      `}
      style={{
        // Only apply 3D transform during rotation
        transform: isRotating
          ? `rotateY(${rotateY}deg) translateZ(${translateZ}px)`
          : 'none',
        backfaceVisibility: 'hidden',
      }}
    >
      {children}
    </div>
  );
};

export default CarouselCard;
