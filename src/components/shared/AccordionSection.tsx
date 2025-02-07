import { IonAccordion, IonItem, IonLabel, IonChip } from '@ionic/react';

interface AccordionSectionProps {
  value: string;
  label: string;
  className?: string;
  children: React.ReactNode;
}

const AccordionSection: React.FC<AccordionSectionProps> = ({
  value,
  label,
  className = '',
  children
}) => {
  return (
    <IonAccordion value={value} className={`accordion-section ${className}`}>
      <IonItem slot="header" style={{ '--background': '#2a2a2a', '--color': '#fff' }} lines="none">
        <IonLabel>{label}</IonLabel>
      </IonItem>
      <div className="ion-padding accordion-content" slot="content">
        {children}
      </div>
    </IonAccordion>
  );
};

export default AccordionSection; 