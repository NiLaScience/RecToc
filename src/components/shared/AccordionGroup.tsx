import { IonAccordionGroup } from '@ionic/react';

interface AccordionGroupProps {
  children: React.ReactNode;
  value?: string;
  className?: string;
}

const AccordionGroup: React.FC<AccordionGroupProps> = ({
  children,
  value,
  className = ''
}) => {
  return (
    <IonAccordionGroup 
      value={value}
      multiple={true}
      className={`accordion-group ${className}`}
      style={{ 
        borderRadius: '8px', 
        border: '2px solid rgba(255, 255, 255, 0.2)',
        background: '#333',
        overflow: 'hidden'
      }}
    >
      {children}
    </IonAccordionGroup>
  );
};

export default AccordionGroup; 